import {CARS,TRACKS,createRace,updateRace,clamp,mix} from './sim.mjs';
const $=id=>document.getElementById(id);
export function roomCode(value){try{const url=new URL(value,location.origin);const code=url.searchParams.get('room')||value.trim();return /^[A-F\d]{8}$/i.test(code)?code.toUpperCase():null;}catch{return null;}}
export class OnlineClient {
  constructor(callbacks){
    this.callbacks=callbacks;this.id=null;this.room=null;this.ws=null;this.seq=0;this.snapshots=[];this.latency=0;this.input={};this.lastSend=0;this.pending=null;this.connection=0;this.lights=true;this.tab='public';this.roomsRequest=0;
    for(const c of CARS){const option=new Option(`${c.brand} ${c.name} / ${c.code}`,c.id);$('online-car').add(option);}
    for(const t of TRACKS)$('online-track').add(new Option(t.name,t.id));
    $('online-create').onclick=()=>this.enter('create');$('online-join').onclick=()=>this.enter('join');
    document.querySelectorAll('[data-online-tab]').forEach(b=>b.onclick=()=>this.selectTab(b.dataset.onlineTab));$('online-refresh').onclick=()=>this.refreshRooms();
    $('online-profile').onsubmit=e=>{e.preventDefault();if(this.room)this.send({type:'profile',...this.profile()});};
    $('online-car').onchange=()=>{this.callbacks.onPreview?.($('online-car').value);if(this.room)this.send({type:'profile',...this.profile()});};
    $('online-ready').onclick=()=>{if(this.room)this.send({type:'ready',ready:!this.room.players.find(p=>p.id===this.id)?.ready});};
    $('online-start').onclick=()=>this.send({type:'start'});$('online-leave').onclick=()=>this.leave();$('online-copy').onclick=()=>this.copy();
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
    ws.onclose=()=>{clearTimeout(timeout);if(token!==this.connection)return;const was=this.room;this.ws=null;this.room=null;this.pending=null;this.snapshots=[];this.render();this.status('Conexión cerrada. Puedes volver a crear una sala o entrar con un enlace.',true);if(was)this.callbacks.onLeft('Se perdió la conexión con el servidor.');};
  }
  send(data){if(data&&this.ws?.readyState===WebSocket.OPEN&&this.ws.bufferedAmount<16384)this.ws.send(JSON.stringify(data));}
  receive(message){
    if(message.type==='hello'){this.id=message.id;return;}
    if(message.type==='pong'){if(typeof message.at==='number')this.latency=performance.now()-message.at;return;}
    if(message.type==='error'){this.pending=null;this.status(message.message,true);this.render();this.callbacks.onError?.(message.message);return;}
    if(message.type==='room'){
      const previous=this.room;this.room=message;this.pending=null;this.render();this.updateInvite();
      const url=new URL(location.href);url.searchParams.set('room',message.code);history.replaceState(null,'',url);
      this.callbacks.onRoom(message);
      if(message.phase==='racing'&&previous?.phase!=='racing'){this.snapshots=[];this.callbacks.onStart(message);}
      if(message.phase==='lobby')this.status(message.hostId===this.id?`Tu sala ${message.public?'pública':'privada'} está abierta. Espera a que todos estén listos.`:'Ya estás en la sala con tu coche predeterminado. Pulsa LISTO.');return;
    }
    if(message.type==='snapshot'){
      if(!this.room)return;this.snapshots.push({...message,received:performance.now()});if(this.snapshots.length>12)this.snapshots.shift();this.callbacks.onSnapshot(message);return;
    }
    if(message.type==='results'){this.results=message.results;this.callbacks.onResults(message.results);return;}
    if(message.type==='expired'){this.leave();this.status('La sala caducó por inactividad.',true);}
  }
  leave(){
    const was=this.room;this.send({type:'leave'});this.connection++;this.ws?.close();this.ws=null;this.pending=null;this.room=null;this.snapshots=[];this.results=null;
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
    if(this.room?.phase==='racing'&&now-this.lastSend>=1000/30){this.lastSend=now;this.send({type:'input',seq:++this.seq,...this.input,headlights:this.lights});}
  }
  reconcile(r,track,message){
    const self=message.players.find(p=>p.id===this.id);if(!self)return;
    const state=structuredClone(self.state),predicted=createRace(r.car,track,{mode:'time',night:r.night,wet:r.wet});Object.assign(predicted,state);
    const resetChanged=state.resetId!==r.resetId;
    let ahead=clamp(r.elapsed-state.elapsed,0,.15);if(state.countdown>0||resetChanged||state.resetHold>0)ahead=0;while(ahead>0&&!predicted.finished){const dt=Math.min(1/120,ahead);updateRace(predicted,this.input,dt);ahead-=dt;}
    const old={s:r.s,lateral:r.lateral,yaw:r.yaw};Object.assign(r,predicted,{online:true,headlights:this.lights});
    if(!resetChanged&&state.resetHold===0&&Math.abs(old.s-r.s)<10&&Math.abs(old.lateral-r.lateral)<2&&!state.finished&&state.countdown===0){r.s=mix(old.s,r.s,.45);r.lateral=mix(old.lateral,r.lateral,.45);r.yaw=mix(old.yaw,r.yaw,.45);}
    r.netPlace=self.place;r.netDnf=self.dnf;r.netFinished=state.finished;r.netPlayers=message.players;
  }
  opponents(){
    if(!this.snapshots.length)return [];const at=performance.now()-100,frames=this.snapshots;let a=frames[0],b=frames.at(-1);
    for(let i=1;i<frames.length;i++)if(frames[i].received>=at){a=frames[i-1];b=frames[i];break;}
    const t=b.received>a.received?clamp((at-a.received)/(b.received-a.received),0,1):1;
    return b.players.filter(p=>p.id!==this.id&&p.connected&&!p.dnf).map(p=>{const prev=a.players.find(v=>v.id===p.id)?.state||p.state;return {...p,...p.state,s:mix(prev.s,p.state.s,t),lateral:mix(prev.lateral,p.state.lateral,t),yaw:mix(prev.yaw,p.state.yaw,t),carId:p.car};});
  }
}
