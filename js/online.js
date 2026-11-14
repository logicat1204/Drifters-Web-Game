import {ALL_CARS as CARS,ALL_TRACKS as TRACKS,createRace,makeTrack,updateRace,clamp,mix,sample,roadEdge} from './sim.mjs';
import {vehiclePose,resolveVehicleContact} from './traffic.mjs';
import {RaceSnapshotBuffer} from './presentation.mjs';
import {OnlineProbe} from './online-probe.js';
import {OnlineHost} from './online-host.js';
import {compactOnlineState} from './online-race.mjs';
const $=id=>document.getElementById(id);
export function roomCode(value){try{const url=new URL(value,location.origin);const code=url.searchParams.get('room')||value.trim();return /^[A-F\d]{8}$/i.test(code)?code.toUpperCase():null;}catch{return null;}}
export class OnlineClient {
  constructor(callbacks){
    this.callbacks=callbacks;this.id=null;this.room=null;this.ws=null;this.seq=0;this.snapshots=new RaceSnapshotBuffer();this.latency=0;this.input={};this.lastSend=0;this.pending=null;this.connection=0;this.lights=true;this.tab='public';this.roomsRequest=0;
    this.probe=new OnlineProbe({send:message=>this.send(message),render:report=>this.renderProbe(report)});
    this.direct=new OnlineProbe({send:message=>this.send({...message,type:'direct-signal',runId:this.room?.runId}),render:()=>this.directReady()});
    this.direct.onRaceMessage=(id,raw)=>this.receiveDirect(id,raw);
    this.resetDirect();
    $('online-probe-start').onclick=()=>{if(this.room?.phase==='lobby')this.probe.start(this.id);};
    for(const c of CARS){const option=new Option(`${c.brand} ${c.name} / ${c.code}`,c.id);$('online-car').add(option);}
    for(const t of TRACKS)$('online-track').add(new Option(t.name,t.id));
    $('online-create').onclick=()=>this.enter('create');$('online-join').onclick=()=>this.enter('join');
    document.querySelectorAll('[data-online-tab]').forEach(b=>b.onclick=()=>this.selectTab(b.dataset.onlineTab));$('online-refresh').onclick=()=>this.refreshRooms();
    $('online-profile').onsubmit=e=>{e.preventDefault();if(this.room)this.send({type:'profile',...this.profile()});};
    $('online-car').onchange=()=>{this.callbacks.onPreview?.($('online-car').value);if(this.room)this.send({type:'profile',...this.profile()});};
    $('online-direct').onchange=()=>{if(this.room?.players.find(p=>p.id===this.id)?.ready)this.send({type:'ready',ready:false});};
    $('online-ready').onclick=()=>{if(this.room)this.send({type:'ready',ready:!this.room.players.find(p=>p.id===this.id)?.ready,manual:this.callbacks.manual?.()===true,direct:$('online-direct').checked&&typeof RTCPeerConnection==='function'});};
    $('online-start').onclick=()=>this.send({type:'start',direct:$('online-direct').checked});$('online-leave').onclick=()=>this.leave();$('online-copy').onclick=()=>this.copy();
    for(const id of ['online-track','online-night','online-wet'])$(id).onchange=()=>this.send({type:'config',config:this.config()});
    this.pingTimer=setInterval(()=>{if(this.ws?.readyState===WebSocket.OPEN)this.send({type:'ping',at:performance.now()});},2500);
    this.roomsTimer=setInterval(()=>{if(!document.hidden&&!$('online').classList.contains('hidden')&&!this.room&&this.tab==='public')this.refreshRooms();},5000);
    this.refreshServer();
    this.render();
  }
  profile(){const user=this.callbacks.getUser?.();return {name:user?.displayName||'',car:user?.defaultCar||CARS[0].id};}
  refreshIdentity(){const user=this.callbacks.getUser?.();if(!user)return;$('online-name').value=user.displayName;$('online-car').value=user.defaultCar;$('online-driver-name').textContent=user.displayName+' / @'+user.username;$('online-driver-car').textContent=CARS.find(c=>c.id===user.defaultCar)?.code||'';$('online-portrait').src=user.portraitUrl;this.callbacks.onPreview?.(user.defaultCar);if(this.room?.phase==='lobby')this.send({type:'profile'});}
  selectTab(tab){this.tab=tab;for(const name of ['public','private','create']){$('online-'+name+'-pane').classList.toggle('hidden',name!==tab);document.querySelector(`[data-online-tab=${name}]`).setAttribute('aria-selected',String(name===tab));}this.render();if(tab==='public')this.refreshRooms();}
  async refreshRooms(){if(!this.callbacks.getUser?.()?.onboarded)return;const epoch=++this.roomsRequest;try{const data=await this.callbacks.request('/api/rooms');if(epoch!==this.roomsRequest)return;$('online-public-rooms').replaceChildren();for(const room of data.rooms){const row=document.createElement('div'),info=document.createElement('div'),title=document.createElement('b'),meta=document.createElement('small'),join=document.createElement('button');row.className='public-room';title.textContent=room.host;meta.textContent=`${TRACKS.find(t=>t.id===room.track)?.name} · ${room.night?'NOCHE':'AMANECER'} · ${room.wet?'MOJADO':'SECO'} · ${room.players}/4`;info.append(title,meta);join.className='secondary-button';join.textContent='UNIRME ↗';join.disabled=!!this.pending;join.onclick=()=>this.enter('join',room.code);row.append(info,join);$('online-public-rooms').append(row);}$('online-public-status').textContent=data.rooms.length?'La lista se actualiza cada cinco segundos.':'No hay salas públicas disponibles. Crea una para abrir la próxima salida.';}catch(error){$('online-public-status').textContent=error.message;}}
  refreshServer(){fetch('/api/online').then(r=>r.json()).then(info=>{if(info.online){this.serverInfo=info;this.updateInvite();}}).catch(()=>{});}
  config(){return {track:$('online-track').value,night:$('online-night').value==='night',wet:$('online-wet').value==='wet'};}
  status(text,error=false){$('online-status').textContent=text;$('online-status').classList.toggle('error',error);}
  async enter(type,invitation){
    if(this.pending||!this.callbacks.requireUser?.())return;this.pending={type};this.render();await this.callbacks.syncPreferences?.();if(!this.callbacks.getUser?.()?.onboarded){this.pending=null;this.render();return;}
    const code=roomCode(invitation||$('online-code').value);if(type==='join'&&!code){this.pending=null;this.render();this.status('Pega un enlace de invitación o un código de 8 caracteres.',true);return;}
    this.pending={type,code,config:this.config(),public:$('online-public').checked};this.status('Conectando con el servidor…');this.render();
    if(this.ws?.readyState===WebSocket.OPEN){this.send(this.pending);return;}
    const token=++this.connection;const ws=this.ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/online`);
    const timeout=setTimeout(()=>{if(token===this.connection&&ws.readyState!==WebSocket.OPEN){ws.close();this.pending=null;this.status('No se pudo conectar. Revisa que el servidor esté en marcha.',true);this.render();}},8000);
    ws.onopen=()=>{clearTimeout(timeout);if(token!==this.connection)return;this.refreshServer();this.send(this.pending);};
    ws.onmessage=e=>{if(token!==this.connection)return;let message;try{message=JSON.parse(e.data);}catch{return;}this.receive(message);};
    ws.onerror=()=>{if(token===this.connection)this.status('No se pudo conectar al modo online. Reinicia el servidor con JUGAR.bat.',true);};
    ws.onclose=()=>{clearTimeout(timeout);if(token!==this.connection)return;const was=this.room;this.ws=null;this.room=null;this.pending=null;this.snapshots.clear();this.resetProbe();this.resetDirect();this.render();this.status('Conexión cerrada. Puedes volver a crear una sala o entrar con un enlace.',true);if(was)this.callbacks.onLeft('Se perdió la conexión con el servidor.');};
  }
  send(data){if(data&&this.ws?.readyState===WebSocket.OPEN&&(data.type!=='input'||this.ws.bufferedAmount===0))this.ws.send(JSON.stringify(data));}
  receive(message){
    if(typeof message.type==='string'&&message.type.startsWith('probe-')){this.probe.receive(message);return;}
    if(message.type==='direct-signal'&&message.runId===this.room?.runId){this.direct.handleSignal(message);return;}
    if(message.type==='hello'){this.id=message.id;return;}
    if(message.type==='pong'){if(typeof message.at==='number')this.latency=performance.now()-message.at;return;}
    if(message.type==='error'){this.pending=null;this.status(message.message,true);this.render();this.callbacks.onError?.(message.message);return;}
    if(message.type==='room'){
      const previous=this.room;this.room=message;this.pending=null;
      if(message.phase!=='lobby')this.resetProbe();
      this.render();this.updateInvite();
      const url=new URL(location.href);url.searchParams.set('room',message.code);history.replaceState(null,'',url);
      this.callbacks.onRoom(message);
      if(message.phase==='preparing'){
        this.status('Midiendo enlaces entre pilotos para elegir al anfitrión de carrera…');
        this.direct.start(this.id,message.players.map(p=>p.id));
      }
      if(message.phase==='racing'&&previous?.phase!=='racing'){
        this.snapshots.clear();
        if(message.transport!=='direct')this.resetDirect();
        else this.direct.keepRacePeers(message.raceHost);
        this.directSeen=performance.now();
        const host=message.players.find(p=>p.id===message.raceHost);
        this.directLabel=host?(host.id===this.id?'DIRECTA · TÚ ALOJAS':`DIRECTA · ${host.name}`):'SERVIDOR';
        this.callbacks.onStart(message);
      }
      if(message.phase==='lobby'||message.phase==='results')this.resetDirect();
      if(message.phase==='lobby')this.status(message.hostId===this.id?`Tu sala ${message.public?'pública':'privada'} está abierta. Espera a que todos estén listos.`:'Ya estás en la sala con tu coche predeterminado. Pulsa LISTO.');return;
    }
    if(message.type==='snapshot'){
      if(!this.room)return;
      if(this.room.transport==='direct'){
        if(this.directStarted)return;
        this.directStarted=true;
        if(this.room.raceHost===this.id)this.raceHost=new OnlineHost(this.room,makeTrack(TRACKS.find(t=>t.id===this.room.config.track)),message,performance.now());
      }
      this.receiveSnapshot(message);return;
    }
    if(message.type==='results'){this.results=message.results;this.callbacks.onResults(message.results);return;}
    if(message.type==='expired'){this.leave();this.status('La sala caducó por inactividad.',true);}
  }
  resetDirect(){this.direct.cancel();this.raceHost=null;this.directStarted=false;this.directTick=-1;this.directElapsed=0;this.directReported=false;this.directFailed=false;this.directHeartbeat=0;}
  directReady(){
    if(this.room?.phase!=='preparing'||!this.direct.finished||this.directReported)return;
    this.directReported=true;
    const peers=this.direct.report().peers.map(({id,p95,sent,received})=>({id,p95,sent,received}));
    this.send({type:'direct-report',runId:this.room.runId,peers});
  }
  receiveSnapshot(message){
    this.snapshots.push(message,performance.now());this.callbacks.onSnapshot(message);
  }
  raceAction(type){
    if(this.room?.transport!=='direct'){this.send({type});return;}
    if(this.raceHost){this.applyDirectAction(this.id,type);return;}
    const data={type:'action',action:type,runId:this.room.runId};
    if(!this.direct.sendRace(this.room.raceHost,JSON.stringify(data),true))this.callbacks.onError?.('Espera a que se restablezca el enlace directo.');
  }
  applyDirectAction(id,action){
    if(!['focus','reposition'].includes(action))return;
    try{this.raceHost.action(id,action);}catch(error){
      if(id===this.id)this.callbacks.onError?.(error.message);
      else this.direct.sendRace(id,JSON.stringify({type:'action-error',runId:this.room.runId,message:error.message}),true);
    }
  }
  receiveDirect(id,raw){
    const room=this.room;
    if(!this.directStarted||room?.phase!=='racing'||room.transport!=='direct')return;
    let message;
    try{message=JSON.parse(raw);}catch{return;}
    if(message?.runId!==room.runId)return;
    if(this.raceHost&&message.type==='input')this.raceHost.input(id,message,performance.now());
    if(this.raceHost&&message.type==='action')this.applyDirectAction(id,message.action);
    if(id===room.raceHost&&message.type==='action-error'&&typeof message.message==='string')this.callbacks.onError?.(message.message.slice(0,200));
    if(this.raceHost||id!==room.raceHost||message.type!=='snapshot'||!Number.isSafeInteger(message.tick)||message.tick<=this.directTick)return;
    if(!Array.isArray(message.players)||message.players.length!==room.players.length||!Number.isFinite(message.elapsed)||message.elapsed<this.directElapsed)return;
    const players=room.players.map(p=>{
      const value=message.players.find(other=>other?.id===p.id);
      const r=value?.state;
      if(!r||![r.s,r.speed,r.lateral,r.yaw,r.elapsed,r.countdown,r.resetId].every(Number.isFinite))return null;
      if(![r.focus,r.skill,r.draft].every(v=>v&&typeof v==='object'&&!Array.isArray(v)))return null;
      return {...p,dnf:value.dnf===true,place:Number.isInteger(value.place)?value.place:null,state:compactOnlineState(r)};
    });
    if(players.includes(null))return;
    this.directTick=message.tick;
    this.directElapsed=message.elapsed;
    this.directSeen=performance.now();
    this.receiveSnapshot({...message,players});
  }
  directFrame(now){
    if(!this.directStarted||this.directFailed)return;
    const runId=this.room.runId;
    if(!this.raceHost){
      if(now-this.directSeen>3000){this.directFailed=true;this.send({type:'direct-status',runId,failed:true});}
      return;
    }
    if(now-this.directHeartbeat>1000){
      this.directHeartbeat=now;
      this.send({type:'direct-status',runId});
    }
    const state=this.raceHost.step(now);
    if(!state)return;
    const raw=JSON.stringify({...state,runId});
    for(const p of this.room.players)if(p.id!==this.id)this.direct.sendRace(p.id,raw);
    this.receiveSnapshot(state);
    if(state.phase==='results'){
      const results=this.raceHost.room.results.map(({id,place,time})=>({id,place,time}));
      this.send({type:'direct-finish',runId,results});
    }
  }
  resetProbe(){this.probe.cancel();this.renderProbe();$('online-probe').open=false;}
  renderProbe(report=this.probe.report()){
    $('online-probe-start').disabled=!!report.active;
    const status=report.active?'Midiendo conexión…':report.server?'Prueba terminada.': '';
    if($('online-probe-status').textContent!==status)$('online-probe-status').textContent=status;
    const list=$('online-probe-results');
    const rows=[];
    const details=result=>`${result.median===null?'sin respuesta':`${result.median} ms medianos · p95 ${result.p95} ms`} · ${result.received}/${result.sent} respuestas`;
    if(report.server)rows.push(`Servidor · ${details(report.server)}`);
    for(const peer of report.peers){
      const name=this.room?.players.find(p=>p.id===peer.id)?.name||'Piloto';
      const result=peer.sent?details(peer):peer.status==='connecting'&&report.active?'conectando…':'sin enlace directo medido';
      rows.push(`${name} · ${result}`);
    }
    if(report.server&&!report.peers.length)rows.push('Otro piloto de la sala debe pulsar «Probar conexión».');
    list.replaceChildren(...rows.map(text=>{const item=document.createElement('li');item.textContent=text;return item;}));
  }
  leave(){
    const was=this.room;this.send({type:'leave'});this.connection++;this.ws?.close();this.ws=null;this.pending=null;this.room=null;this.snapshots.clear();this.resetProbe();this.resetDirect();this.results=null;
    const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);this.render();this.status('Crea una sala o entra con un enlace de invitación.');if(was)this.callbacks.onLeft();
  }
  updateInvite(){
    if(!this.room)return;let base=location.origin;
    if(this.serverInfo?.publicUrl)base=this.serverInfo.publicUrl;else if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&this.serverInfo?.lanUrl)base=this.serverInfo.lanUrl;
    const url=new URL('/',base);url.searchParams.set('room',this.room.code);$('online-invite').value=url.href;
    $('online-link-note').textContent=base===this.serverInfo?.lanUrl?'Enlace para tu red local. Para Internet, ejecuta este servidor en un dominio accesible con HTTPS.':'Comparte este enlace. El servidor debe seguir abierto durante la partida.';
  }
  async copy(){try{await navigator.clipboard.writeText($('online-invite').value);this.status('Enlace de invitación copiado.');}catch{$('online-invite').focus();$('online-invite').select();this.status('Enlace seleccionado: pulsa Ctrl+C para copiarlo.');}}
  render(){
    const room=this.room,inRoom=!!room,host=room?.hostId===this.id,lobby=room?.phase==='lobby';
    $('online-entry').classList.toggle('hidden',inRoom);$('online-room').classList.toggle('hidden',!inRoom);$('online-profile-save').classList.toggle('hidden',!inRoom);
    $('online-create').disabled=$('online-join').disabled=!!this.pending;$('online-name').disabled=$('online-car').disabled=true;
    $('online-course').classList.toggle('hidden',inRoom?!host||!lobby:this.tab!=='create');
    for(const id of ['online-track','online-night','online-wet'])$(id).disabled=inRoom&&(!host||!lobby);
    $('online-direct').disabled=!lobby||typeof RTCPeerConnection!=='function';
    $('online-direct-choice').classList.toggle('hidden',!lobby);
    if(!room)return;
    $('online-code-label').textContent=room.code;$('online-count').textContent=`${room.players.filter(p=>p.connected).length} / 4`;
    $('online-track').value=room.config.track;$('online-night').value=room.config.night?'night':'day';$('online-wet').value=room.config.wet?'wet':'dry';
    $('online-roster').replaceChildren();
    for(let i=0;i<4;i++){
      const p=room.players[i],row=document.createElement('li');row.className='online-player'+(p?.id===this.id?' is-you':'');
      const number=document.createElement('span');number.className='online-slot';number.textContent=String(i+1).padStart(2,'0');row.append(number);
      if(p?.portraitUrl){const image=document.createElement('img');image.src=p.portraitUrl;image.alt='';image.className='online-player-portrait';row.append(image);}
      const details=document.createElement('div'),name=document.createElement('b'),car=document.createElement('small');name.textContent=p?p.name+(p.id===this.id?' · TÚ':''):'ESPERANDO CONDUCTOR';car.textContent=p?`${CARS.find(c=>c.id===p.car)?.code||''}${room.hostId===p.id?' / ANFITRIÓN':''}`:'Comparte la invitación';details.append(name,car);row.append(details);
      const state=document.createElement('span');state.className='online-player-state'+(p?.ready?' ready':'');state.textContent=p?!p.connected?'DESCONECTADO':lobby?p.ready?'LISTO':'PREPARANDO':'EN PISTA':'—';row.append(state);$('online-roster').append(row);
    }
    const me=room.players.find(p=>p.id===this.id);$('online-ready').textContent=me?.ready?'CANCELAR LISTO':'ESTOY LISTO';$('online-ready').setAttribute('aria-pressed',String(!!me?.ready));$('online-ready').disabled=!lobby;
    $('online-start').classList.toggle('hidden',!host);$('online-start').disabled=!lobby||room.players.length<2||room.players.some(p=>!p.ready);$('online-wait-host').classList.toggle('hidden',host);
  }
  controls(input,race,active){
    this.input=active?input:{steer:0,throttle:false,brake:true,handbrake:false};const now=performance.now();
    if(this.room?.phase!=='racing')return;
    const direct=this.room.transport==='direct';
    if(now-this.lastSend>=1000/30){
      this.lastSend=now;
      const controls={type:'input',seq:++this.seq,...this.input,headlights:this.lights,gear:active&&race.manual?race.requestedGear??race.gear:undefined,gearEpoch:race.resetId};
      if(!direct)this.send(controls);
      else if(this.raceHost)this.raceHost.input(this.id,controls,now);
      else this.direct.sendRace(this.room.raceHost,JSON.stringify({...controls,runId:this.room.runId}));
    }
    if(direct)this.directFrame(now);
  }
  predict(r,input,dt,players=this.snapshots.frames.at(-1)?.players||[]){
    // Predict from current authoritative traffic, independently of the 100 ms
    // interpolation used to draw remote cars. Contact copies never mutate snapshots.
    const traffic=players.filter(p=>p.id!==this.id&&p.connected&&!p.dnf&&!p.state.finished).map(p=>{
      const state=p.state,o={...vehiclePose(state),track:r.track,timeLeft:state.timeLeft,contactCooldown:state.contactCooldown};
      const advance=clamp(r.elapsed-state.elapsed,0,.15),curve=sample(r.track,o.s).curve;
      o.progress=o.speed*Math.max(.12,Math.cos(o.travelYaw))/clamp(1-curve*o.lateral,.65,1.35);
      o.s+=o.progress*advance;o.lateral=clamp(o.lateral+(state.lateralV||0)*advance,-roadEdge(r.track),roadEdge(r.track));return o;
    });
    const before=vehiclePose(r);
    const gear=r.requestedGear??input.gear;
    updateRace(r,{...input,gear,gearEpoch:r.resetId},dt,traffic);
    for(const o of traffic){const old=vehiclePose(o);o.s+=o.progress*dt;resolveVehicleContact(r,o,before,old);}
  }
  reconcile(r,track,message){
    const self=message.players.find(p=>p.id===this.id);if(!self)return;
    const state=structuredClone(self.state),predicted=createRace(r.car,track,{mode:'time',manual:r.manual,night:r.night,wet:r.wet});Object.assign(predicted,state);
    const resetChanged=state.resetId!==r.resetId;
    if(!resetChanged)predicted.requestedGear=r.requestedGear;
    else r.requestedGear=1;
    let ahead=clamp(r.elapsed-state.elapsed,0,.15);if(state.countdown>0||resetChanged||state.resetHold>0)ahead=0;while(ahead>0&&!predicted.finished){const dt=Math.min(1/120,ahead);this.predict(predicted,this.input,dt,message.players);ahead-=dt;}
    const old={s:r.s,lateral:r.lateral,yaw:r.yaw};Object.assign(r,predicted,{online:true,headlights:this.lights});
    if(!resetChanged&&state.resetHold===0&&state.collision===0&&Math.abs(old.s-r.s)<10&&Math.abs(old.lateral-r.lateral)<2&&!state.finished&&state.countdown===0){r.s=mix(old.s,r.s,.45);r.lateral=mix(old.lateral,r.lateral,.45);r.yaw=mix(old.yaw,r.yaw,.45);}
    r.netPlace=self.place;r.netDnf=self.dnf;r.netFinished=state.finished;r.netPlayers=message.players;
  }
  opponents(track=null){
    return this.snapshots.poses(performance.now(),track).filter(p=>p.id!==this.id);
  }
}
