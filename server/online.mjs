import {randomBytes,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {WebSocketServer,WebSocket} from 'ws';
import {ALL_CARS as CARS,ALL_TRACKS as TRACKS,makeTrack} from '../js/sim.mjs';
import {IDLE_INPUT,placeOnlineCar,onlineAction,onlineInput,onlineSnapshot,stepOnlineRace} from '../js/online-race.mjs';
import {sameOrigin} from './accounts.mjs';
import {databaseUnavailable,isMongoError} from './database.mjs';
import {stockBuild} from '../js/tuning.mjs';
import {selectRaceHost} from '../js/online-direct.mjs';

const MAX_SOCKET_BACKLOG=256*1024;
const RACE_LOAD_TIMEOUT=30000;

export function sendOnlineFrame(ws,message,replaceable=false){
  if(ws.readyState!==WebSocket.OPEN)return;
  if(ws.bufferedAmount>MAX_SOCKET_BACKLOG){ws.terminate();return;}
  if(replaceable&&ws.bufferedAmount>0)return;
  ws.send(JSON.stringify(message));
}

const cleanName=value=>typeof value==='string'?value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}<>]/gu,'').trim().slice(0,20):'';
const profile=data=>{const name=cleanName(data.name),car=CARS.find(c=>c.id===data.car);if(!name||!car)throw Error('Escribe tu nombre y elige un coche válido.');return {name,car:car.id};};
const config=data=>({track:TRACKS.some(t=>t.id===data.track)?data.track:TRACKS[0].id,night:data.night!==false,wet:data.wet===true});
const buildFor=(user,car)=>user?.garage[car]?.build||stockBuild();
const lobbyState=room=>JSON.stringify([room.config,[...room.players.values()].map(p=>[p.client.id,p.car,p.ready,p.manual])]);
export class OnlineRooms {
  constructor({now=()=>performance.now(),store=null}={}){this.now=now;this.store=store;this.rooms=new Map();this.clients=new Set();this.tickId=0;}
  connect(send,close=()=>{},identity=null){
    const c={id:randomUUID(),send,close,identity,room:null,messages:0,window:this.now(),joined:this.now()};this.clients.add(c);this.send(c,{type:'hello',id:c.id});return c;
  }
  send(c,message,replaceable){c.send(message,replaceable);}
  broadcast(room,message,replaceable){for(const p of room.players.values())if(p.connected)this.send(p.client,message,replaceable);}
  lobby(room){return {type:'room',code:room.code,public:room.public,hostId:room.hostId,phase:room.phase,config:room.config,transport:room.transport||'server',raceHost:room.raceHost,runId:room.runId,players:[...room.players.values()].map(p=>({id:p.client.id,userId:p.userId,portraitUrl:p.portraitUrl,name:p.name,car:p.car,build:p.build,manual:!!p.manual,ready:p.ready,loaded:!!p.loaded,connected:p.connected}))};}
  publicRooms(){return [...this.rooms.values()].filter(r=>r.public&&r.phase==='lobby'&&r.players.size<4).map(r=>({code:r.code,host:[...r.players.values()].find(p=>p.client.id===r.hostId)?.name||'Piloto',track:r.config.track,night:r.config.night,wet:r.config.wet,players:r.players.size,maxPlayers:4}));}
  details(data,user){if(!this.store)return profile(data);if(!user?.onboarded)throw Error('Inicia sesión y completa tu perfil.');return {name:user.displayName,car:user.defaultCar,userId:user.id,portraitUrl:user.portraitUrl,build:buildFor(user,user.defaultCar)};}
  revoke(userId){for(const c of this.clients)if(c.identity?.id===userId){this.disconnect(c);c.close(4001,'Sesión cerrada');}}
  publish(room){this.broadcast(room,this.lobby(room));}
  publishProbe(room){
    const peers=[...room.players.values()].filter(p=>p.probe).map(p=>p.client.id);
    for(const id of peers)this.send(room.players.get(id).client,{type:'probe-peers',peers});
  }
  receive(c,data){
    try{
      const now=this.now();if(now-c.window>1000){c.window=now;c.messages=0;}if(++c.messages>100){c.close(1008,'Demasiados mensajes');return;}
      if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Mensaje inválido.');
      if(this.store?.remote&&['create','join','profile','start'].includes(data.type))return this.receiveWithPilot(c,data).catch(error=>this.sendError(c,error));
      this.receiveAction(c,data);
    }catch(error){this.sendError(c,error);}
  }
  sendError(c,error){if(this.clients.has(c))this.send(c,{type:'error',message:isMongoError(error)?databaseUnavailable:error.message});}
  checkStart(c,room){
    if(!room)throw Error('Entra en una sala primero.');
    if(room.hostId!==c.id)throw Error('Solo el anfitrión puede iniciar la partida.');
    if(room.phase!=='lobby')throw Error('La carrera ya comenzó.');
    if(room.players.size<2)throw Error('Se necesitan al menos 2 jugadores.');
    if([...room.players.values()].some(p=>!p.ready))throw Error('Todos deben estar listos antes de iniciar.');
  }
  async receiveWithPilot(c,data){
    if(c.loadingLobby)throw Error('Espera a que termine la acción anterior.');
    c.loadingLobby=true;
    try{
      const room=c.room;
    if(data.type==='start'){
        this.checkStart(c,room);
        const before=lobbyState(room),pilots=await Promise.all([...room.players.values()].map(p=>this.store.user(p.userId)));
        if(!this.clients.has(c)||c.room!==room)return;
        if(lobbyState(room)!==before)throw Error('La sala cambió. Comprueba que todos sigan listos.');
        if(pilots.some(p=>!p?.onboarded))throw Error('Un piloto necesita completar su perfil.');
        this.receiveAction(c,data,{pilots:new Map(pilots.map(p=>[p.id,p]))});
      }else{
        const user=await this.store.user(c.identity?.id);
        if(this.clients.has(c)&&c.room===room)this.receiveAction(c,data,{user});
      }
    }finally{c.loadingLobby=false;}
  }
  receiveAction(c,data,prepared=null){
      const now=this.now();
      if(data.type==='ping'){this.send(c,{type:'pong',at:data.at});return;}
      if(data.type==='leave'){this.leave(c);this.send(c,{type:'left'});return;}
      if(data.type==='create'||data.type==='join'){
        if(c.room)throw Error('Ya estás en una sala. Sal antes de crear o entrar en otra.');
        const details=this.details(data,prepared?prepared.user:this.store?.user(c.identity?.id));let room;
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
      if(data.type==='probe-ready'){
        if(room.phase!=='lobby')return;
        p.probe=data.ready===true;this.publishProbe(room);
      }else if(data.type==='probe-ping'){
        if(room.phase==='lobby'&&p.probe&&Number.isSafeInteger(data.id))this.send(c,{type:'probe-pong',id:data.id});
      }else if(data.type==='probe-signal'){
        const peer=room.players.get(data.to);
        if(room.phase!=='lobby'||!p.probe||!peer?.probe||peer===p)return;
        const {kind,value}=data;
        if(!['offer','answer','ice'].includes(kind)||typeof value!=='string'||value.length>1600)return;
        this.send(peer.client,{type:'probe-signal',from:c.id,kind,value});
      }else if(data.type==='direct-signal'){
        const peer=room.players.get(data.to),{kind,value}=data;
        if(room.phase!=='preparing'||data.runId!==room.runId||!peer||peer===p)return;
        if(!['offer','answer','ice'].includes(kind)||typeof value!=='string'||value.length>4000)return;
        this.send(peer.client,{type:'direct-signal',runId:room.runId,from:c.id,kind,value});
      }else if(data.type==='direct-report'){
        if(room.phase!=='preparing'||data.runId!==room.runId||room.directReports.has(c.id)||!Array.isArray(data.peers))return;
        const links=data.peers.slice(0,3).filter(link=>link&&room.players.has(link.id)&&link.id!==c.id&&Number.isFinite(link.p95)&&link.p95>=0&&Number.isInteger(link.sent)&&link.sent>=16&&link.sent<=30&&Number.isInteger(link.received)&&link.received>=0&&link.received<=link.sent);
        room.directReports.set(c.id,links);
        if(room.directReports.size===room.players.size)this.beginLoading(room,selectRaceHost([...room.players.keys()],room.directReports));
      }else if(data.type==='cancel-start'){
        if((room.phase==='preparing'||room.phase==='loading')&&data.runId===room.runId){
          this.abortDirect(room,`${p.name} canceló la salida. Vuelvan a marcar «Listo» para intentarlo otra vez.`);
        }
      }else if(data.type==='loaded'){
        if(room.phase!=='loading'||data.runId!==room.runId||p.loaded)return;
        if(now>=room.loadingEnds||data.failed===true){this.abortDirect(room,'La salida se canceló porque un piloto no pudo cargar la pista.');return;}
        p.loaded=true;
        if([...room.players.values()].every(pilot=>pilot.loaded))this.startPrepared(room);
        else this.publish(room);
      }else if(data.type==='direct-status'){
        if(room.transport!=='direct'||room.phase!=='racing'||data.runId!==room.runId)return;
        if(data.failed===true)this.abortDirect(room);
        else if(c.id===room.raceHost)room.hostHeartbeat=now;
      }else if(data.type==='direct-finish'){
        if(room.transport!=='direct'||room.phase!=='racing'||data.runId!==room.runId||c.id!==room.raceHost)return;
        this.finishDirect(room,data.results);
      }else if(data.type==='profile'){
        if(room.phase!=='lobby')throw Error('El coche queda bloqueado al comenzar.');Object.assign(p,this.details(data,prepared?prepared.user:this.store?.user(c.identity?.id)),{ready:false});this.publish(room);
      }else if(data.type==='ready'){
        if(room.phase!=='lobby')throw Error('La carrera ya comenzó.');p.ready=data.ready===true;
        if(p.ready){p.manual=data.manual===true;p.direct=data.direct===true;p.loadGate=data.loadGate===true;}
        this.publish(room);
      }else if(data.type==='config'){
        if(room.hostId!==c.id)throw Error('Solo el anfitrión puede elegir el circuito.');if(room.phase!=='lobby')throw Error('La carrera ya comenzó.');room.config=config(data.config||{});for(const other of room.players.values())other.ready=false;this.publish(room);
      }else if(data.type==='start'){
        this.checkStart(c,room);
        room.track=makeTrack(TRACKS.find(t=>t.id===room.config.track));room.runId=randomUUID();room.elapsed=0;room.firstFinish=null;room.finishOrder=[];let i=0;
        for(const other of room.players.values()){
          other.probe=false;other.loaded=false;
          const user=prepared?prepared.pilots.get(other.userId):this.store?.user(other.userId);
          if(user)other.build=buildFor(user,other.car);
          const focus=user?{focusType:user.focusType,focusEnabled:user.focusUnlocked.includes(user.focusType)}:{};
          placeOnlineCar(room,other,i++,now,focus);
        }
        if([...room.players.values()].every(p=>p.direct)){
          room.phase='preparing';room.transport='server';room.directReports=new Map();room.preparationEnds=now+13000;
          this.publish(room);
        }else this.beginLoading(room);
        return;
      }else if(data.type==='reposition'||data.type==='focus'){
        if(room.phase!=='racing'||p.dnf||p.race.finished)throw Error('La acción solo está disponible durante tu carrera.');
        if(room.transport==='direct')return;
        onlineAction(p,data.type);
        this.snapshot(room);
      }else if(data.type==='input'){
        if(room.phase!=='racing'||room.transport==='direct'||p.dnf||p.race.finished)return;
        onlineInput(p,data,now);
      }else if(data.type==='rematch'){
        if(room.hostId!==c.id)throw Error('Solo el anfitrión puede abrir la revancha.');if(room.phase!=='results')throw Error('La carrera todavía no terminó.');
        this.resetLobby(room);
      }else throw Error('Acción desconocida.');
  }
  beginLoading(room,raceHost=null){
    room.directReports=null;
    room.transport=raceHost?'direct':'server';room.raceHost=raceHost;
    // Pre-1.0 WebSocket clients did not send a load confirmation.
    if(![...room.players.values()].every(p=>p.loadGate)){this.startPrepared(room);return;}
    room.phase='loading';room.loadingEnds=this.now()+RACE_LOAD_TIMEOUT;
    this.publish(room);
  }
  startPrepared(room){
    room.phase='racing';
    room.hostHeartbeat=this.now();
    this.publish(room);this.snapshot(room);
  }
  resetLobby(room){
    room.phase='lobby';room.transport='server';room.raceHost=null;room.runId=null;room.directReports=null;
    for(const [id,p] of room.players){
      if(!p.connected){room.players.delete(id);continue;}
      p.race=null;p.ready=false;p.loaded=false;p.dnf=false;p.place=null;
    }
    this.publish(room);
  }
  abortDirect(room,message='Se perdió el enlace directo. Vuelvan a marcar «Listo» para iniciar por servidor o probar de nuevo.'){
    this.resetLobby(room);
    this.broadcast(room,{type:'error',message});
  }
  finishDirect(room,values){
    if(!Array.isArray(values)||values.length!==room.players.size)return;
    const results=[];
    for(const value of values){
      const p=room.players.get(value?.id);
      if(!p||results.some(result=>result.id===value.id))return;
      const place=Number.isInteger(value.place)&&value.place>0&&value.place<=values.length?value.place:null;
      if(place!==null&&(!Number.isFinite(value.time)||value.time<0||value.time>room.track.length/15+150||results.some(result=>result.place===place)))return;
      results.push({id:p.client.id,name:p.name,car:p.car,place,dnf:place===null,time:place===null?null:value.time,points:0});
    }
    room.phase='results';
    room.results=results.sort((a,b)=>(a.place??99)-(b.place??99));
    this.broadcast(room,{type:'results',results:room.results});this.publish(room);
  }
  saveRun(room,p){
    if(room.transport==='direct'||!this.store||!p.userId||p.saved)return;
    const id=room.runId+':'+p.userId,userId=p.userId,race=p.race,elapsed=p.finishTime??race.elapsed;
    race.netPlace=p.place;
    if(!this.store.remote){
      this.store.addRun(id,userId,race,'online',elapsed);p.saved=true;
      return;
    }
    // A retry keeps the same run ID even after a rematch replaces the race in the room.
    p.saved=true;
    const save=remaining=>{
      this.store.addRun(id,userId,race,'online',elapsed).catch(error=>{
        if(remaining&&isMongoError(error))setTimeout(()=>save(remaining-1),2000).unref();
        else console.warn('No se pudo guardar un resultado online.');
      });
    };
    save(2);
  }
  leave(c){
    const room=c.room;if(!room)return;c.room=null;const p=room.players.get(c.id);
    const beforeStart=room.phase==='preparing'||room.phase==='loading';
    const interrupted=beforeStart||(room.phase==='racing'&&room.transport==='direct');
    if(room.phase==='lobby'||interrupted)room.players.delete(c.id);else if(p){p.connected=false;p.dnf=!p.place;p.race.finished=true;p.input={...IDLE_INPUT};this.saveRun(room,p);}
    const connected=[...room.players.values()].filter(v=>v.connected);
    if(!connected.length){this.rooms.delete(room.code);return;}
    if(room.hostId===c.id)room.hostId=connected[0].client.id;
    if(interrupted){this.abortDirect(room,beforeStart?'La salida se canceló porque un piloto abandonó durante la preparación.':undefined);return;}
    this.publish(room);
    if(room.phase==='lobby'&&p?.probe)this.publishProbe(room);
  }
  disconnect(c){this.leave(c);this.clients.delete(c);}
  snapshot(room,replaceable=false){this.broadcast(room,onlineSnapshot(room,this.tickId),replaceable);}
  step(dt=1/120){
    this.tickId++;const now=this.now();
    for(const room of this.rooms.values()){
      if(room.phase==='preparing'&&now>=room.preparationEnds){this.beginLoading(room);continue;}
      if(room.phase==='loading'&&now>=room.loadingEnds){this.abortDirect(room,'Se agotó el tiempo de carga. Vuelvan a marcar «Listo» para intentarlo otra vez.');continue;}
      if(room.phase!=='racing')continue;
      if(room.transport==='direct'){
        if(now-room.hostHeartbeat>6000)this.abortDirect(room);
        continue;
      }
      if(stepOnlineRace(room,dt,now,p=>this.saveRun(room,p))){
        this.snapshot(room);this.broadcast(room,{type:'results',results:room.results});this.publish(room);
      }else if(this.tickId%6===0)this.snapshot(room,true);
    }
  }
  sweep(){const now=this.now();for(const room of this.rooms.values())if(room.phase!=='racing'&&now-room.lastActive>30*60*1000){this.broadcast(room,{type:'expired'});for(const p of room.players.values()){p.client.room=null;}this.rooms.delete(room.code);}}
}
export function attachOnline(server,{accounts=null,store=null}={}){
  const rooms=new OnlineRooms({store}),wss=new WebSocketServer({noServer:true,maxPayload:4600,perMessageDeflate:false});
  server.on('upgrade',async(req,socket,head)=>{
    const reject=code=>socket.end(`HTTP/1.1 ${code}\r\nConnection: close\r\n\r\n`);
    if(req.url!=='/online')return reject('404 Not Found');
    const allowed=sameOrigin(req);
    if(!allowed)return reject('403 Forbidden');if(wss.clients.size>=128)return reject('503 Service Unavailable');
    let session;
    if(accounts){
      const ignoreError=()=>{};socket.on('error',ignoreError);
      try{session=await accounts.session(req);}catch{return reject('503 Service Unavailable');}
      finally{socket.removeListener('error',ignoreError);}
      if(socket.destroyed)return;
      if(!session?.user?.onboarded)return reject('401 Unauthorized');
      if(wss.clients.size>=128)return reject('503 Service Unavailable');
    }
    wss.handleUpgrade(req,socket,head,ws=>{ws.sessionToken=session?.token;wss.emit('connection',ws,session?.user);});
  });
  wss.on('connection',(ws,identity)=>{
    ws.alive=true;const c=rooms.connect((message,replaceable)=>sendOnlineFrame(ws,message,replaceable),(code,reason)=>ws.close(code,reason),identity);
    ws.on('pong',()=>ws.alive=true);ws.on('error',()=>{});ws.on('close',()=>rooms.disconnect(c));
    ws.on('message',(raw,binary)=>{if(binary)return ws.close(1003,'Solo JSON');try{
      const data=JSON.parse(raw.toString());
      if(raw.length>2048&&data?.type!=='direct-signal')return ws.close(1009,'Mensaje demasiado grande');
      rooms.receive(c,data);
    }catch{ws.close(raw.length>2048?1009:1007,'JSON inválido');}});
  });
  let previous=performance.now(),accumulator=0;
  const timer=setInterval(()=>{const now=performance.now();accumulator+=Math.min((now-previous)/1000,.25);previous=now;let n=0;while(accumulator>=1/120&&n++<30){rooms.step();accumulator-=1/120;}},8);timer.unref();
  const heartbeat=setInterval(()=>{
    for(const ws of wss.clients){
      if(!ws.alive){ws.terminate();continue;}
      ws.alive=false;ws.ping();
      if(accounts)Promise.resolve(store.hasSession?store.hasSession(ws.sessionToken):store.session(ws.sessionToken))
        .then(valid=>{if(!valid)ws.terminate();}).catch(()=>ws.terminate());
    }
    rooms.sweep();
  },15000);heartbeat.unref();
  server.on('close',()=>{clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();});
  return {rooms,wss};
}
