import {randomBytes,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {WebSocketServer,WebSocket} from 'ws';
import {CARS,TRACKS,makeTrack,createRace,updateRace,repositionRace,clamp} from '../js/sim.mjs';
import {activateFocus} from '../js/focus.mjs';
import {sameOrigin} from './accounts.mjs';

const IDLE_INPUT={steer:0,throttle:false,brake:true,handbrake:false};
const cleanName=value=>typeof value==='string'?value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}<>]/gu,'').trim().slice(0,20):'';
const profile=data=>{const name=cleanName(data.name),car=CARS.find(c=>c.id===data.car);if(!name||!car)throw Error('Escribe tu nombre y elige un coche válido.');return {name,car:car.id};};
const config=data=>({track:TRACKS.some(t=>t.id===data.track)?data.track:TRACKS[0].id,night:data.night!==false,wet:data.wet===true});
const compact=r=>Object.fromEntries(['s','lateral','speed','yaw','yawRate','travelYaw','lateralV','steer','gripUsage','understeer','cornerSpeed','driftAssist','slipAngle','gear','rpm','elapsed','countdown','headlights','braking','drift','driftPoints','combo','bestCombo','collision','checkpoints','timeLeft','finished','won','blindPasses','blindAward','skill','focus','resetId','resetHold','resetCooldown','wallTouch','wallContact','wallCooldown','wallSlow'].map(k=>[k,r[k]]));
export class OnlineRooms {
  constructor({now=()=>performance.now(),store=null}={}){this.now=now;this.store=store;this.rooms=new Map();this.clients=new Set();this.tickId=0;}
  connect(send,close=()=>{},identity=null){
    const c={id:randomUUID(),send,close,identity,room:null,messages:0,window:this.now(),joined:this.now()};this.clients.add(c);this.send(c,{type:'hello',id:c.id});return c;
  }
  send(c,message){c.send(message);}
  broadcast(room,message){for(const p of room.players.values())if(p.connected)this.send(p.client,message);}
  lobby(room){return {type:'room',code:room.code,public:room.public,hostId:room.hostId,phase:room.phase,config:room.config,players:[...room.players.values()].map(p=>({id:p.client.id,userId:p.userId,portraitUrl:p.portraitUrl,name:p.name,car:p.car,ready:p.ready,connected:p.connected}))};}
  publicRooms(){return [...this.rooms.values()].filter(r=>r.public&&r.phase==='lobby'&&r.players.size<4).map(r=>({code:r.code,host:[...r.players.values()].find(p=>p.client.id===r.hostId)?.name||'Piloto',track:r.config.track,night:r.config.night,wet:r.config.wet,players:r.players.size,maxPlayers:4}));}
  details(c,data){if(!this.store)return profile(data);const user=this.store.user(c.identity?.id);if(!user?.onboarded)throw Error('Inicia sesión y completa tu perfil.');return {name:user.displayName,car:user.defaultCar,userId:user.id,portraitUrl:user.portraitUrl};}
  revoke(userId){for(const c of this.clients)if(c.identity?.id===userId){this.disconnect(c);c.close(4001,'Sesión cerrada');}}
  publish(room){this.broadcast(room,this.lobby(room));}
  receive(c,data){
    try{
      const now=this.now();if(now-c.window>1000){c.window=now;c.messages=0;}if(++c.messages>100){c.close(1008,'Demasiados mensajes');return;}
      if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Mensaje inválido.');
      if(data.type==='ping'){this.send(c,{type:'pong',at:data.at});return;}
      if(data.type==='leave'){this.leave(c);this.send(c,{type:'left'});return;}
      if(data.type==='create'||data.type==='join'){
        if(c.room)throw Error('Ya estás en una sala. Sal antes de crear o entrar en otra.');
        const details=this.details(c,data);let room;
        if(details.userId&&[...this.clients].some(other=>other!==c&&other.identity?.id===details.userId&&other.room))throw Error('Tu piloto ya está en otra sala.');
        if(data.type==='create'){
          if(this.rooms.size>=64)throw Error('Servidor lleno. Intenta nuevamente en unos minutos.');
          let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(this.rooms.has(code));
          room={code,public:data.public===true,hostId:c.id,players:new Map(),phase:'lobby',config:config(data.config||{}),created:now,lastActive:now,elapsed:0,finishOrder:[],firstFinish:null};this.rooms.set(code,room);
        }else{
          room=this.rooms.get(typeof data.code==='string'?data.code.toUpperCase():'');
          if(!room)throw Error('La sala no existe o ha caducado.');
          if(room.phase!=='lobby')throw Error('La carrera ya comenzó. La sala está cerrada.');
          if(room.players.size>=4)throw Error('Sala llena: el máximo es de 4 jugadores.');
        }
        room.players.set(c.id,{client:c,...details,ready:false,connected:true,input:{...IDLE_INPUT},inputAt:now,sequence:-1,race:null,place:null,dnf:false});c.room=room;room.lastActive=now;this.publish(room);return;
      }
      const room=c.room,p=room?.players.get(c.id);if(!room||!p)throw Error('Entra en una sala primero.');room.lastActive=now;
      if(data.type==='profile'){
        if(room.phase!=='lobby')throw Error('El coche queda bloqueado al comenzar.');Object.assign(p,this.details(c,data),{ready:false});this.publish(room);
      }else if(data.type==='ready'){
        if(room.phase!=='lobby')throw Error('La carrera ya comenzó.');p.ready=data.ready===true;this.publish(room);
      }else if(data.type==='config'){
        if(room.hostId!==c.id)throw Error('Solo el anfitrión puede elegir el circuito.');if(room.phase!=='lobby')throw Error('La carrera ya comenzó.');room.config=config(data.config||{});for(const other of room.players.values())other.ready=false;this.publish(room);
      }else if(data.type==='start'){
        if(room.hostId!==c.id)throw Error('Solo el anfitrión puede iniciar la partida.');if(room.phase!=='lobby')throw Error('La carrera ya comenzó.');
        if(room.players.size<2)throw Error('Se necesitan al menos 2 jugadores.');if([...room.players.values()].some(v=>!v.ready))throw Error('Todos deben estar listos antes de iniciar.');
        room.track=makeTrack(TRACKS.find(t=>t.id===room.config.track));room.runId=randomUUID();room.phase='racing';room.elapsed=0;room.firstFinish=null;room.finishOrder=[];let i=0;
        for(const other of room.players.values()){
          const r=other.race=createRace(CARS.find(car=>car.id===other.car),room.track,{mode:'time',night:room.config.night,wet:room.config.wet});r.s=24-Math.floor(i/2)*7;r.lateral=i%2?2:-2;r.countdown=3;r.timeLeft=Math.ceil(room.track.length/20)+90;other.input={...IDLE_INPUT};other.inputAt=now;other.place=null;other.dnf=false;other.saved=false;i++;
        }
        this.publish(room);this.snapshot(room);return;
      }else if(data.type==='reposition'||data.type==='focus'){
        if(room.phase!=='racing'||p.dnf||p.race.finished)throw Error('La acción solo está disponible durante tu carrera.');
        if(data.type==='reposition'){
          if(!repositionRace(p.race))throw Error('Espera a la salida o a que se habilite de nuevo CENTRAR.');
          p.input={...IDLE_INPUT};
        }else if(!activateFocus(p.race))throw Error('Necesitas al menos 30% de concentración y estar fuera de un impacto o recuperación.');
        this.snapshot(room);
      }else if(data.type==='input'){
        if(room.phase!=='racing'||p.dnf||p.race.finished)return;
        if(!Number.isSafeInteger(data.seq)||data.seq<=p.sequence||typeof data.steer!=='number'||!Number.isFinite(data.steer))return;
        p.sequence=data.seq;p.inputAt=now;p.input={steer:clamp(data.steer,-1,1),throttle:data.throttle===true,brake:data.brake===true,handbrake:data.handbrake===true};
        p.race.headlights=data.headlights!==false;
      }else if(data.type==='rematch'){
        if(room.hostId!==c.id)throw Error('Solo el anfitrión puede abrir la revancha.');if(room.phase!=='results')throw Error('La carrera todavía no terminó.');
        for(const [id,other] of room.players){if(!other.connected){room.players.delete(id);continue;}other.race=null;other.ready=false;other.dnf=false;other.place=null;}room.phase='lobby';this.publish(room);
      }else throw Error('Acción desconocida.');
    }catch(error){this.send(c,{type:'error',message:error.message});}
  }
  leave(c){
    const room=c.room;if(!room)return;c.room=null;const p=room.players.get(c.id);
    if(room.phase==='lobby')room.players.delete(c.id);else if(p){p.connected=false;p.dnf=!p.place;p.race.finished=true;p.input={...IDLE_INPUT};if(this.store&&p.userId&&!p.saved){p.race.netPlace=p.place;this.store.addRun(room.runId+':'+p.userId,p.userId,p.race,'online',p.race.elapsed);p.saved=true;}}
    const connected=[...room.players.values()].filter(v=>v.connected);
    if(!connected.length){this.rooms.delete(room.code);return;}
    if(room.hostId===c.id)room.hostId=connected[0].client.id;this.publish(room);
  }
  disconnect(c){this.leave(c);this.clients.delete(c);}
  snapshot(room){this.broadcast(room,{type:'snapshot',tick:this.tickId,phase:room.phase,elapsed:room.elapsed,players:[...room.players.values()].map(p=>({id:p.client.id,name:p.name,car:p.car,connected:p.connected,dnf:p.dnf,place:p.place,state:compact(p.race)}))});}
  step(dt=1/120){
    this.tickId++;const now=this.now();
    for(const room of this.rooms.values()){
      if(room.phase!=='racing')continue;room.elapsed+=dt;
      const newlyFinished=[];
      for(const p of room.players.values()){
        if(p.dnf||p.race.finished)continue;const before=p.race.s;
        updateRace(p.race,now-p.inputAt>300?IDLE_INPUT:p.input,dt);
        if(p.race.finished){if(p.race.s>=room.track.length)newlyFinished.push({p,fraction:clamp((room.track.length-before)/Math.max(.00001,p.race.s-before),0,1)});else p.dnf=true;}
      }
      // Resolve contacts once, on the server, for the same outcome on every client.
      const active=[...room.players.values()].filter(p=>!p.dnf&&!p.race.finished);
      for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
        const a=active[i].race,b=active[j].race;
        if(a.countdown===0&&a.resetHold===0&&b.resetHold===0&&a.wallCooldown<=0&&b.wallCooldown<=0&&Math.abs(a.s-b.s)<4.1&&Math.abs(a.lateral-b.lateral)<1.7){
          const direction=a.lateral>=b.lateral?1:-1;a.speed*=a.s<b.s?.87:.94;b.speed*=b.s<a.s?.87:.94;a.lateral=clamp(a.lateral+direction*.18,-4.75,4.75);b.lateral=clamp(b.lateral-direction*.18,-4.75,4.75);a.collision=b.collision=.55;a.wallCooldown=b.wallCooldown=1;
        }
      }
      newlyFinished.sort((a,b)=>a.fraction-b.fraction);
      for(const {p,fraction} of newlyFinished){p.place=room.finishOrder.length+1;p.finishTime=room.elapsed-3-dt*(1-fraction);room.finishOrder.push(p.client.id);if(room.firstFinish===null)room.firstFinish=room.elapsed;
        if(this.store&&p.userId){p.race.netPlace=p.place;this.store.addRun(room.runId+':'+p.userId,p.userId,p.race,'online',p.finishTime);p.saved=true;}
      }
      const players=[...room.players.values()];
      if(players.every(p=>p.race.finished)||room.firstFinish!==null&&room.elapsed-room.firstFinish>45||room.elapsed>room.track.length/15+150){
        for(const p of players)if(!p.place){p.dnf=true;p.race.finished=true;}room.phase='results';
        if(this.store)for(const p of players)if(p.userId&&!p.saved){p.race.netPlace=p.place;this.store.addRun(room.runId+':'+p.userId,p.userId,p.race,'online',p.race.elapsed);p.saved=true;}
        const results=players.sort((a,b)=>(a.place??99)-(b.place??99)||b.race.s-a.race.s).map(p=>({id:p.client.id,userId:p.userId,portraitUrl:p.portraitUrl,name:p.name,car:p.car,place:p.place,dnf:p.dnf,connected:p.connected,time:p.place?p.finishTime:null,points:Math.floor(p.race.skill.points)}));
        room.results=results;this.snapshot(room);this.broadcast(room,{type:'results',results});this.publish(room);
      }else if(this.tickId%6===0)this.snapshot(room);
    }
  }
  sweep(){const now=this.now();for(const room of this.rooms.values())if(room.phase!=='racing'&&now-room.lastActive>30*60*1000){this.broadcast(room,{type:'expired'});for(const p of room.players.values()){p.client.room=null;}this.rooms.delete(room.code);}}
}
export function attachOnline(server,{accounts=null,store=null}={}){
  const rooms=new OnlineRooms({store}),wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    const reject=code=>socket.end(`HTTP/1.1 ${code}\r\nConnection: close\r\n\r\n`);
    if(req.url!=='/online')return reject('404 Not Found');
    const allowed=sameOrigin(req);
    if(!allowed)return reject('403 Forbidden');if(wss.clients.size>=128)return reject('503 Service Unavailable');
    const session=accounts?.session(req);if(accounts&&!session?.user?.onboarded)return reject('401 Unauthorized');
    wss.handleUpgrade(req,socket,head,ws=>{ws.sessionToken=session?.token;wss.emit('connection',ws,session?.user);});
  });
  wss.on('connection',(ws,identity)=>{
    ws.alive=true;const c=rooms.connect(message=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>256*1024){ws.terminate();return;}ws.send(JSON.stringify(message));}},(code,reason)=>ws.close(code,reason),identity);
    ws.on('pong',()=>ws.alive=true);ws.on('error',()=>{});ws.on('close',()=>rooms.disconnect(c));
    ws.on('message',(raw,binary)=>{if(binary)return ws.close(1003,'Solo JSON');try{rooms.receive(c,JSON.parse(raw.toString()));}catch{ws.close(1007,'JSON inválido');}});
  });
  let previous=performance.now(),accumulator=0;
  const timer=setInterval(()=>{const now=performance.now();accumulator+=Math.min((now-previous)/1000,.25);previous=now;let n=0;while(accumulator>=1/120&&n++<30){rooms.step();accumulator-=1/120;}},8);timer.unref();
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive||accounts&&!store.session(ws.sessionToken)){ws.terminate();continue;}ws.alive=false;ws.ping();}rooms.sweep();},15000);heartbeat.unref();
  server.on('close',()=>{clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();});
  return {rooms,wss};
}
