import { CARS, CAR_PROFILES, TRACKS, RIVALS, HANDLING_VERSION, makeTrack, createRace, updateRace, toggleHeadlights, repositionRace, sample, clamp } from './sim.mjs';
import { Renderer } from './renderer.js';
import { Cockpit } from './cockpit.js';
import { CornerEffects } from './effects.js';
import {OnlineClient} from './online.js';
import {FOCUS,activateFocus} from './focus.mjs';

const $ = id => document.getElementById(id);
let stored={};try{stored=JSON.parse(localStorage.getItem('touge-settings')||'{}');}catch{}
const settings={car:0,track:0,arcadeStage:0,camera:'0',transmission:'auto',daytime:'night',weather:'dry',difficulty:'normal',quality:'1.4',musicVolume:50,engineVolume:35,shake:true,song:'synth',...stored};
settings.car=clamp(Number(settings.car)||0,0,CARS.length-1);settings.track=clamp(Number(settings.track)||0,0,TRACKS.length-1);
function save(){try{localStorage.setItem('touge-settings',JSON.stringify(settings));}catch{}}
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.add('hidden'),4200);}
const fmtTime=s=>{const ms=Math.floor(Math.max(0,s)*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}′${String(Math.floor(ms/1000)%60).padStart(2,'0')}″${String(ms%1000).padStart(3,'0')}`;};
let renderer;
try{renderer=new Renderer($('world'));}catch(e){$('fatal').classList.remove('hidden');$('fatal').textContent=e.message;throw e;}
let track=makeTrack(TRACKS[settings.track]),race=null,screen='home',modal=null,returnFocus=null;
renderer.setTrack(track);renderer.setCar(CARS[settings.car]);renderer.quality=Number(settings.quality);renderer.cameraMode=clamp(Number(settings.camera)||0,0,3);
const cockpit=new Cockpit($('cockpit'));
const cornerEffects=new CornerEffects($('race-fx'));
let net;
const keys=new Set(),touch=new Set();

class SoundSystem {
  constructor(){this.audio=new Audio();this.audio.preload='metadata';this.audio.loop=true;this.playing=false;this.muted=false;this.song=null;this.step=0;this.next=0;this.isDriving=false;this.preview=false;this.audio.addEventListener('error',()=>{if(this.song?.url){toast('No se pudo reproducir este archivo. Prueba MP3, OGG o WAV.');this.stop();renderSongs();}});}
  ensure(){
    if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try{
      const ctx=this.ctx=new AC();const compressor=ctx.createDynamicsCompressor();compressor.connect(ctx.destination);
      this.musicGain=ctx.createGain();this.musicGain.connect(compressor);
      this.engineGain=ctx.createGain();this.engineGain.gain.value=0;this.engineGain.connect(compressor);
      this.fxGain=ctx.createGain();this.fxGain.connect(compressor);
      const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;filter.Q.value=.8;filter.connect(this.engineGain);this.engineFilter=filter;
      this.engine=ctx.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=40;this.engine.connect(filter);this.engine.start();
      this.engine2=ctx.createOscillator();this.engine2.type='triangle';this.engine2.frequency.value=81;this.engine2.connect(filter);this.engine2.start();
      const noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      this.noiseBuffer=noise;const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=1400;source.connect(high);this.tireGain=ctx.createGain();this.tireGain.gain.value=0;high.connect(this.tireGain);this.tireGain.connect(compressor);source.start();
      setInterval(()=>this.schedule(),70);this.volume();
    }catch{toast('El audio no está disponible en este navegador.');}
  }
  volume(){const v=this.muted?0:settings.musicVolume/100;this.audio.volume=clamp(v,0,1);if(this.musicGain)this.musicGain.gain.value=v*.24;}
  note(freq,t,duration,vol=.15,type='sawtooth',slide=0){if(!this.ctx)return;const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.musicGain);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
  reward(blind=false){if(!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;this.fxGain.gain.setValueAtTime(settings.engineVolume/100*.13,t);for(const [i,f] of (blind?[554,830,1108]:[660,880,1320]).entries()){const o=ctx.createOscillator(),g=ctx.createGain(),at=t+i*.065;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.001,at);g.gain.exponentialRampToValueAtTime(.45,at+.012);g.gain.exponentialRampToValueAtTime(.001,at+.24);o.connect(g);g.connect(this.fxGain);o.start(at);o.stop(at+.25);o.onended=()=>{o.disconnect();g.disconnect();};}}
  schedule(){
    if(!this.ctx||!this.playing||this.song?.id!=='synth'||this.ctx.state!=='running')return;
    const ctx=this.ctx;if(this.next<ctx.currentTime)this.next=ctx.currentTime+.025;
    const beat=60/154,notes=[0,7,12,7,10,7,3,7,0,7,15,12,10,7,3,-2],roots=[45,41,48,43];
    while(this.next<ctx.currentTime+.16){const n=this.step,t=this.next,root=roots[Math.floor(n/32)%4],midi=(m)=>440*2**((m-69)/12);
      if(n%4===0)this.note(135,t,.13,.9,'sine',38);
      if(n%8===4){const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=this.noiseBuffer;g.gain.setValueAtTime(.32,t);g.gain.exponentialRampToValueAtTime(.001,t+.11);s.connect(g);g.connect(this.musicGain);s.start(t);s.stop(t+.12);s.onended=()=>{s.disconnect();g.disconnect();};}
      if(n%2===0){const s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();s.buffer=this.noiseBuffer;f.type='highpass';f.frequency.value=8500;g.gain.setValueAtTime(.09,t);g.gain.exponentialRampToValueAtTime(.001,t+.035);s.connect(f);f.connect(g);g.connect(this.musicGain);s.start(t);s.stop(t+.04);s.onended=()=>{s.disconnect();g.disconnect();f.disconnect();};}
      if(n%2===0)this.note(midi(root),t,beat*.39,.24,'sawtooth');
      if(n%2===0)this.note(midi(root+24+notes[(n/2)%16]),t,beat*.43,.105,'sawtooth');
      if(n%16===0)for(const interval of [0,3,7])this.note(midi(root+12+interval),t,beat*1.7,.045,'triangle');
      this.next+=beat/4;this.step++;
    }
  }
  async play(song,preview=false){this.ensure();this.stop();this.song=song;this.preview=preview;if(song.id==='none')return;this.playing=true;this.volume();if(song.url){this.audio.src=song.url;try{await this.audio.play();}catch(e){if(e.name!=='AbortError'){this.playing=false;toast('No se pudo iniciar el audio. Vuelve a pulsar reproducir.');}}}else{this.next=this.ctx?.currentTime||0;this.step=0;}renderSongs();}
  stop(){this.playing=false;this.audio.pause();this.preview=false;}
  pause(){this.wasPlaying=this.playing;this.playing=false;this.audio.pause();if(this.engineGain)this.engineGain.gain.setTargetAtTime(0,this.ctx.currentTime,.05);if(this.tireGain)this.tireGain.gain.setTargetAtTime(0,this.ctx.currentTime,.05);}
  resume(){if(!this.wasPlaying)return;this.ensure();this.playing=true;if(this.song?.url)this.audio.play().catch(()=>{});this.next=this.ctx?.currentTime||0;}
  update(r,active){if(!this.ctx)return;const t=this.ctx.currentTime,accelerating=keys.has('ArrowUp')||keys.has('KeyW')||touch.has('throttle');this.engineGain.gain.setTargetAtTime(active?settings.engineVolume/100*(.026+(accelerating ? .025 : .008)):0,t,.06);this.tireGain.gain.setTargetAtTime(active&&r.speed>12?Math.max(r.drift,r.understeer*.65)*.034:0,t,.08);if(active){this.engine.frequency.setTargetAtTime(r.rpm/30,t,.07);this.engine2.frequency.setTargetAtTime(r.rpm/15+1,t,.07);this.engineFilter.frequency.setTargetAtTime(450+r.rpm*.14,t,.08);}}
}
const sound=new SoundSystem();
const builtin=[{id:'synth',name:'Midnight Transmission',detail:'ORIGINAL SYNTH EUROBEAT · 154 BPM'},{id:'none',name:'Solo el sonido del motor',detail:'SIN MÚSICA'}];
let folderSongs=[],importedSongs=[];
const allSongs=()=>[...builtin,...folderSongs,...importedSongs];
function chosenSong(){return allSongs().find(s=>s.id===settings.song)||builtin[0];}
function updateSongLabels(){for(const id of ['selected-track-name','now-playing'])$(id).textContent=chosenSong().name;}
function renderSongs(){
  const list=$('song-list');list.replaceChildren();
  allSongs().forEach((song,i)=>{const row=document.createElement('div');row.className='song-row'+(settings.song===song.id?' selected':'');const num=document.createElement('span');num.className='song-num';num.textContent=settings.song===song.id?'↗':String(i+1).padStart(2,'0');const info=document.createElement('button');info.className='song-info';const b=document.createElement('b');b.textContent=song.name;const small=document.createElement('small');small.textContent=song.detail||'SONGS/ · '+song.id.split('.').pop().toUpperCase();info.append(b,small);info.addEventListener('click',()=>selectSong(song));const preview=document.createElement('button');preview.className='song-preview';const playing=sound.playing&&sound.song?.id===song.id;preview.textContent=playing?'Ⅱ':'▶';preview.setAttribute('aria-label',(playing?'Pausar ':'Escuchar ')+song.name);preview.addEventListener('click',()=>{if(playing){sound.stop();renderSongs();}else{selectSong(song);sound.play(song,true);}});row.append(num,info);if(song.id!=='none')row.append(preview);list.append(row);});
  updateSongLabels();
}
function selectSong(song){settings.song=song.id;save();if(sound.playing)sound.play(song,true);renderSongs();}
async function refreshSongs(notify=false){
  try{const response=await fetch('/api/songs',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.songs))throw Error();const nextSongs=data.songs.filter(s=>typeof s.id==='string'&&typeof s.name==='string'&&typeof s.url==='string'&&s.url.startsWith('/songs/'));const changed=JSON.stringify(folderSongs)!==JSON.stringify(nextSongs);folderSongs=nextSongs;
    const status=`${folderSongs.length} ${folderSongs.length===1?'canción detectada':'canciones detectadas'} · actualización automática`;if($('folder-status').textContent!==status)$('folder-status').textContent=status;
    if(!allSongs().some(s=>s.id===settings.song)){settings.song='synth';save();}
    if(notify)toast(`${folderSongs.length} canciones encontradas en songs/.`);if(changed)renderSongs();else updateSongLabels();
  }catch{$('folder-status').textContent='Inicia con JUGAR.bat o npm start para leer songs/.';if(notify)toast('Servidor no disponible. También puedes agregar archivos desde el botón.');}
}
$('import-music').addEventListener('click',()=>$('music-files').click());
$('music-files').addEventListener('change',event=>{const files=[...event.target.files];for(const file of files){if(!/\.(mp3|ogg|wav|m4a|aac|flac|opus|webm)$/i.test(file.name)&&!file.type.startsWith('audio/'))continue;const id='local-'+file.name+'-'+file.size;if(importedSongs.some(s=>s.id===id))continue;importedSongs.push({id,name:file.name.replace(/\.[^.]+$/,''),url:URL.createObjectURL(file),detail:'ARCHIVO LOCAL · ESTA SESIÓN'});}renderSongs();toast('Archivos listos. Elige tu canción antes de correr.');event.target.value='';});
$('refresh-music').addEventListener('click',()=>refreshSongs(true));
refreshSongs();setInterval(()=>{if(screen!=='race')refreshSongs();},8000);

function drawTrackCards(){
  $('track-picker').replaceChildren();TRACKS.forEach((t,i)=>{const b=document.createElement('button'),mini=makeTrack(t),pts=mini.points.filter((p,j)=>j%12===0&&p.s<=t.length),xs=pts.map(p=>p.x),zs=pts.map(p=>p.z),minX=Math.min(...xs),minZ=Math.min(...zs),sx=58/(Math.max(...xs)-minX||1),sz=49/(Math.max(...zs)-minZ||1),scale=Math.min(sx,sz);const shape=pts.map((p,j)=>`${j?'L':'M'}${(10+(p.x-minX)*scale).toFixed(1)} ${(58-(p.z-minZ)*scale).toFixed(1)}`).join('');b.className='track-card'+(i===settings.track?' active':'');b.setAttribute('aria-pressed',String(i===settings.track));b.innerHTML=`<span class="track-index">0${i+1} / ${t.difficulty}</span><svg viewBox="0 0 80 65" aria-hidden="true"><path d="${shape}"/></svg><h3>${t.name}</h3><small>${(t.length/1000).toFixed(1)} KM &nbsp; / &nbsp; ${RIVALS[t.rival].short}</small><span class="track-jp">${t.jp}</span>`;b.title=t.subtitle;b.addEventListener('click',()=>{if($('mode').value==='arcade'){$('mode').value='battle';updateModeDescription();}selectCourse(i);});$('track-picker').append(b);});$('track-number').textContent=String(settings.track+1).padStart(2,'0');$('track-total').textContent=String(TRACKS.length).padStart(2,'0');
}
function selectCourse(index){settings.track=clamp(index,0,TRACKS.length-1);save();track=makeTrack(TRACKS[settings.track]);renderer.setTrack(track);drawTrackCards();updateSceneLabels();$('track-picker').querySelector('.active')?.scrollIntoView({block:'nearest',inline:'nearest'});}
function updateModeDescription(){const mode=$('mode').value;$('mode-description').textContent=mode==='arcade'?`ARCADE · DUELO ${clamp(Number(settings.arcadeStage)||0,0,6)+1} / 7`:mode==='time'?'TU MÁQUINA CONTRA EL RELOJ':'UN MAPA. SU RIVAL. UNA OPORTUNIDAD.';}
function cycleCamera(){renderer.cameraMode=(renderer.cameraMode+1)%4;settings.camera=String(renderer.cameraMode);$('camera').value=settings.camera;save();renderer.resetCamera=true;toast(['Cámara de persecución','Cámara de capó','Cámara cercana','Cabina '+CARS[settings.car].code+' · volante reactivo'][renderer.cameraMode]);}
function updateSceneLabels(){const c=CARS[settings.car],rival=RIVALS[track.rival];$('scene-car').textContent=`${c.year} ${c.brand} ${c.name}`;$('scene-car-sub').textContent=`${c.code} · ${c.drive} · ${c.power} CV`;$('car-brand').textContent=`${c.brand} / ${c.year}`;$('car-code').textContent=c.code;$('car-fullname').textContent=c.name;$('car-power').textContent=c.power;$('car-weight').textContent=c.weight;$('car-drive').textContent=c.drive;$('car-profile').textContent=CAR_PROFILES[c.profile].name;$('car-profile').dataset.profile=c.profile;$('car-profile-description').textContent=CAR_PROFILES[c.profile].description;$('car-stats').innerHTML=c.stats.map((v,i)=>`<div class="stat"><span>${['ACELERACIÓN','CURVAS','VELOCIDAD PUNTA'][i]}</span><div class="stat-track"><i style="width:${v}%"></i></div><b>${v}</b></div>`).join('');$('course-region').textContent=track.region+' / JAPAN';$('course-subtitle').textContent=track.subtitle;$('rival-intro-name').textContent=rival.name;$('rival-intro-car').textContent=rival.code+' · '+rival.team;}
function drawCarCards(){
  const scroll=$('car-picker').scrollLeft;$('car-picker').replaceChildren();CARS.forEach((c,i)=>{const b=document.createElement('button');b.className='car-card'+(i===settings.car?' active':'');b.setAttribute('aria-pressed',String(i===settings.car));b.setAttribute('aria-label',`${c.brand} ${c.name} ${c.code} · ${CAR_PROFILES[c.profile].name}`);b.innerHTML=`<small>${c.brand} · ${CAR_PROFILES[c.profile].name}</small><b>${c.code}</b><span>${c.label.toUpperCase()}</span><i class="car-swatch" style="background:${c.color}"></i>`;b.addEventListener('click',()=>{settings.car=i;save();renderer.setCar(c);drawCarCards();updateSceneLabels();});$('car-picker').append(b);});$('car-picker').scrollLeft=scroll;
}
drawTrackCards();drawCarCards();updateSceneLabels();updateModeDescription();renderSongs();
$('mode').addEventListener('change',()=>{if($('mode').value==='arcade')selectCourse(clamp(Number(settings.arcadeStage)||0,0,6));updateModeDescription();});
for(const [id,direction] of [['track-prev',-1],['track-next',1]])$(id).addEventListener('click',()=>$('track-picker').scrollBy({left:direction*320,behavior:'smooth'}));

function showScreen(name){screen=name;if(name==='online')renderer.setCar(CARS.find(c=>c.id===$('online-car').value)||CARS[settings.car]);else if(['home','garage'].includes(name))renderer.setCar(CARS[settings.car]);for(const id of ['home','garage','online','race'])$(id).classList.toggle('hidden',name!==id&&!(id==='race'&&['paused','results'].includes(name)));document.body.classList.toggle('racing',['race','paused','results'].includes(name));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.action===name));renderer.resetCamera=true;}
function openModal(name){returnFocus=document.activeElement;modal=name;$('modal-backdrop').classList.remove('hidden');for(const id of ['music','settings','controls','pause','results','online-results'])$(id+'-panel').classList.toggle('hidden',id!==name);const first=[...$(name+'-panel').querySelectorAll('button,select,input')].find(el=>!el.disabled&&el.getClientRects().length);first?.focus();if(name==='music')refreshSongs();}
function closeModal(){const was=modal;modal=null;$('modal-backdrop').classList.add('hidden');for(const id of ['music','settings','controls','pause','results','online-results'])$(id+'-panel').classList.add('hidden');if(was==='music'&&sound.preview&&screen!=='race')sound.stop();returnFocus?.focus();}
function pause(){if(screen!=='race')return;keys.clear();touch.clear();showScreen('paused');sound.pause();$('pause-title').textContent=race.online?'MENÚ ONLINE':'EN PAUSA.';$('pause-panel').querySelector('.eyebrow').textContent=race.online?'LA CARRERA CONTINÚA. TU COCHE FRENA.':'RESPIRA. LA MONTAÑA SIGUE AHÍ.';$('pause-panel').querySelector('[data-action=restart]').classList.toggle('hidden',!!race.online);$('pause-panel').querySelector('[data-action=quit]').textContent=race.online?'ABANDONAR SALA':'VOLVER AL GARAJE';openModal('pause');}
function resume(){if(screen!=='paused')return;closeModal();showScreen('race');sound.resume();}
function quit(){if(race?.online){net.leave();return;}closeModal();sound.stop();sound.update(race,false);showScreen('home');race=null;keys.clear();touch.clear();}
function startRace(){if(net?.room){showScreen('online');toast('Sal de la sala online antes de iniciar una carrera individual.');return;}closeModal();keys.clear();touch.clear();const mode=$('mode').value;if(mode==='arcade')selectCourse(clamp(Number(settings.arcadeStage)||0,0,6));race=createRace(CARS[settings.car],track,{mode,manual:settings.transmission==='manual',wet:settings.weather==='wet',night:settings.daytime==='night',difficulty:settings.difficulty});renderer.setRival(race.rival);renderer.particles=[];showScreen('race');sound.play(chosenSong());$('track-hud-name').textContent=track.name;$('total-distance').textContent=(track.length/1000).toFixed(2);$('transmission-label').textContent=race.manual?'MT':'AT';$('race-mode-label').textContent=mode==='time'?'TIME ATTACK':mode==='arcade'?`ARCADE / ${settings.track+1} OF 7`:'SPECIAL DUEL';$('driver-car').textContent=CARS[settings.car].code;$('rival-name').textContent=race.rival.short;$('rival-car').textContent=race.rival.code;$('driver-cards').classList.toggle('hidden',mode==='time');$('race-message').textContent=mode==='time'?'':`${race.rival.jp} / ${race.rival.short}`;messageUntil=performance.now()+4800;lastLandmark=-1;lastCheckpoint=0;lastCount=4;lastAward=0;lastBlind=0;awardUntil=0;zoneWasActive=false;lastZoneCue=-10;lastFocusActivation=0;$('zone-award').textContent='';hud();}
function nextArcade(){if(!race?.won||race.mode!=='arcade')return;settings.arcadeStage=settings.track===TRACKS.length-1?0:settings.track+1;save();updateModeDescription();if(settings.track===TRACKS.length-1){quit();return;}startRace();}
const actions={home:()=>{closeModal();showScreen('home');},garage:()=>{closeModal();showScreen('garage');},music:()=>openModal('music'),settings:()=>openModal('settings'),controls:()=>openModal('controls'),online:()=>{closeModal();showScreen('online');},'online-rematch':()=>net.send({type:'rematch'}),'online-exit':()=>net.leave(),camera:cycleCamera,headlights:switchLights,reposition:repositionPlayer,focus:useFocus,next:nextArcade,close:closeModal,pause,resume,restart:startRace,quit,fullscreen:()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>toast('La pantalla completa no está disponible.'));},mute:()=>{sound.muted=!sound.muted;sound.volume();toast(sound.muted?'Música silenciada. Pulsa M para activarla.':'Música activada.');}};
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>actions[b.dataset.action]?.()));$('start').addEventListener('click',startRace);$('modal-backdrop').addEventListener('click',()=>{if(!['pause','results','online-results'].includes(modal))closeModal();});
for(const [id,key] of [['transmission','transmission'],['camera','camera'],['daytime','daytime'],['weather','weather'],['difficulty','difficulty'],['quality','quality']]){$(id).value=settings[key];$(id).addEventListener('change',()=>{settings[key]=$(id).value;save();renderer.quality=Number(settings.quality);renderer.cameraMode=Number(settings.camera);renderer.resetCamera=true;});}
$('music-volume').value=settings.musicVolume;$('volume-label').textContent=settings.musicVolume+'%';$('music-volume').addEventListener('input',e=>{settings.musicVolume=Number(e.target.value);$('volume-label').textContent=settings.musicVolume+'%';sound.volume();save();});$('engine-volume').value=settings.engineVolume;$('engine-volume').addEventListener('input',e=>{settings.engineVolume=Number(e.target.value);save();});$('camera-shake').checked=settings.shake;$('camera-shake').addEventListener('change',e=>{settings.shake=e.target.checked;save();});

window.addEventListener('keydown',e=>{
  const form=['INPUT','SELECT'].includes(document.activeElement?.tagName);
  if(modal&&e.key==='Tab'){const items=[...$(modal+'-panel').querySelectorAll('button,input:not([hidden]),select')].filter(el=>!el.disabled&&el.getClientRects().length);if(items.length){const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
  if(e.code==='Escape'){e.preventDefault();if(screen==='race')pause();else if(screen==='paused')resume();else if(modal&&!['results','online-results'].includes(modal))closeModal();else if(screen==='garage')showScreen('home');return;}
  if(form||modal)return;
  if(screen==='race'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);}
  if(e.repeat)return;
  if(e.code==='KeyM')actions.mute();
  if(screen==='home'&&e.code==='Enter'){e.preventDefault();startRace();}
  if(screen==='race'){
    if(e.code==='KeyC')cycleCamera();
    if(e.code==='KeyH')switchLights();
    if(e.code==='KeyX'&&!e.ctrlKey&&!e.metaKey&&!e.altKey)useFocus();
    if(e.code==='KeyZ'&&!e.ctrlKey&&!e.metaKey&&!e.altKey)repositionPlayer();
    if(e.code==='KeyE'&&race.manual)race.gear=Math.min(5,race.gear+1);
    if(e.code==='KeyQ'&&race.manual)race.gear=Math.max(1,race.gear-1);
    if(e.code==='KeyR'&&!race.online)startRace();
  }
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();touch.clear();if(screen==='race')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='race')pause();});
for(const b of document.querySelectorAll('[data-input]')){const release=e=>{e.preventDefault();touch.delete(b.dataset.input);b.classList.remove('pressed');};b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.input);b.classList.add('pressed');});b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);}
let padOld=[];
function getInput(){let steer=(keys.has('ArrowRight')||keys.has('KeyD')||touch.has('right')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')||touch.has('left')?1:0),throttle=keys.has('ArrowUp')||keys.has('KeyW')||touch.has('throttle'),brake=keys.has('ArrowDown')||keys.has('KeyS')||touch.has('brake'),handbrake=keys.has('Space')||touch.has('handbrake');
  const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);if(pad){const axis=pad.axes[0]||0;if(Math.abs(axis)>.12)steer=axis;throttle||=pad.buttons[7]?.value>.15;brake||=pad.buttons[6]?.value>.15;handbrake||=pad.buttons[0]?.pressed;const buttons=pad.buttons.map(b=>b.pressed);if(buttons[9]&&!padOld[9]){if(screen==='race')pause();else if(screen==='paused')resume();}if(screen==='race'){if(buttons[3]&&!padOld[3])cycleCamera();if(buttons[2]&&!padOld[2])switchLights();if(buttons[1]&&!padOld[1])useFocus();if(buttons[11]&&!padOld[11])repositionPlayer();if(race.manual){if(buttons[5]&&!padOld[5])race.gear=Math.min(5,race.gear+1);if(buttons[4]&&!padOld[4])race.gear=Math.max(1,race.gear-1);}}padOld=buttons;}else padOld=[];
  return {steer,throttle,brake,handbrake};
}

// Tachometer labels are generated once; HUD text updates at 20 Hz.
const svgNS='http://www.w3.org/2000/svg';for(let i=0;i<=9;i++){const angle=(-210+i*26.666)*Math.PI/180;const mark=document.createElementNS(svgNS,'line');mark.setAttribute('x1',120+Math.cos(angle)*87);mark.setAttribute('y1',110+Math.sin(angle)*87);mark.setAttribute('x2',120+Math.cos(angle)*95);mark.setAttribute('y2',110+Math.sin(angle)*95);$('gauge-marks').append(mark);const text=document.createElementNS(svgNS,'text');text.setAttribute('x',120+Math.cos(angle)*75-3);text.setAttribute('y',113+Math.sin(angle)*75);text.textContent=i;$('gauge-marks').append(text);}
let lastCheckpoint=0,lastCount=4,messageUntil=0,lastLandmark=-1,lastAward=0,lastBlind=0,awardUntil=0,zoneWasActive=false,lastZoneCue=-10,lastFocusActivation=0;
function repositionNotice(){$('race-message').textContent='CENTRO DE PISTA / 0 KM/H';messageUntil=performance.now()+1800;hud();}
function repositionPlayer(){
  if(!race||!['race','paused'].includes(screen))return;
  if(race.online){net.send({type:'reposition'});return;}
  if(repositionRace(race)){keys.clear();touch.clear();renderer.resetCamera=true;repositionNotice();}
}
function useFocus(){
  if(!race||screen!=='race')return;
  if(race.online){net.send({type:'focus'});return;}
  if(activateFocus(race))hud();else toast('Necesitas 30% de concentración, sin impacto ni recuperación activa.');
}
function focusHud(){
  const f=race.focus,active=f.remaining>0,percent=active?f.remaining/f.duration*100:f.charge;
  $('focus-panel').classList.toggle('active',active);$('focus-panel').classList.toggle('ready',!active&&f.charge>=FOCUS.minimum&&f.cooldown===0);
  $('focus-value').textContent=active?f.remaining.toFixed(1)+' s':Math.floor(f.charge)+'%';$('focus-fill').style.width=percent.toFixed(1)+'%';
  $('focus-gauge').setAttribute('aria-valuenow',String(Math.floor(percent)));$('focus-gauge').setAttribute('aria-label',active?'Tiempo de Superconcentración restante':'Carga de Superconcentración');
  $('focus-activate').disabled=active||f.charge<FOCUS.minimum||f.cooldown>0||race.countdown>0||race.resetHold>0||race.collision>0||race.wallTouch>0||race.finished;
  $('focus-activate').textContent=active?'SUPERCONCENTRACIÓN ACTIVA':'ACTIVAR · X';
  $('focus-status').textContent=active?'+22% AGARRE · +6% VELOCIDAD MÁX.':f.cooldown>0?'RECUPERANDO · '+f.cooldown.toFixed(1)+' s':f.charge>=FOCUS.minimum?'LISTA · '+(f.charge/100*FOCUS.maxDuration).toFixed(1)+' s':'CURVAS LIMPIAS → CARGA · MÍN. 30%';
  if(f.activations>lastFocusActivation){lastFocusActivation=f.activations;sound.reward(true);}
  document.body.classList.toggle('super-focus',active);
  document.querySelectorAll('[data-action=reposition]').forEach(b=>b.disabled=race.finished||race.countdown>0||race.resetCooldown>0);
}
function switchLights(){if(!race||!['race','paused'].includes(screen))return;const on=toggleHeadlights(race);if(race.online)net.lights=on;updateLights();toast(on?'Faros encendidos.':race.night?'Faros apagados · BLIND ATTACK · memoriza la trazada.':'Faros apagados. El blind attack requiere una carrera nocturna.');}
function updateLights(){if(!race)return;$('headlight-toggle').setAttribute('aria-pressed',String(race.headlights));$('headlight-state').textContent=race.headlights?'◉ FAROS ON':race.night?'○ FAROS OFF / BLIND':'○ FAROS OFF';}
function skillHud(){
  const s=race.skill;$('zone-display').dataset.level=String(s.level);$('zone-level').textContent=['BUSCA EL VÉRTICE','CLEAN LINE','APEX FLOW','FUJIWARA ZONE'][s.level];$('zone-meter').style.width=(s.intensity*100).toFixed(1)+'%';$('zone-points').textContent=Math.floor(s.points).toLocaleString()+' PTS';$('zone-chain').textContent=s.chain?'×'+s.chain:'';
  if(s.level===3&&!zoneWasActive&&race.elapsed-lastZoneCue>4){sound.reward();lastZoneCue=race.elapsed;}zoneWasActive=s.level===3;
  if(s.awardId!==lastAward){lastAward=s.awardId;if(s.award){awardUntil=race.elapsed+2.5;$('zone-award').textContent=s.award.grade+' +'+s.award.points+'\n'+s.award.chain+' CURVAS EN CADENA';}else $('zone-award').textContent='';}
  if(race.blindPasses!==lastBlind){lastBlind=race.blindPasses;sound.reward(true);awardUntil=race.elapsed+3;$('zone-award').textContent='BLIND ATTACK +600\nADELANTAMIENTO A OSCURAS';}
  if(race.elapsed>awardUntil)$('zone-award').textContent='';updateLights();focusHud();
}
function hud(){
  if(!race)return;
  $('speed').textContent=Math.round(race.speed*3.6);$('gear').textContent=race.gear;$('elapsed').textContent=fmtTime(race.elapsed);$('time-left').textContent=Math.max(0,Math.ceil(race.timeLeft));$('time-left').style.color=race.timeLeft<20?'#ef7955':'';$('checkpoint').textContent=`SECTION 0${race.checkpoints+1} / 04`;
  $('distance').textContent=(Math.min(race.s,track.length)/1000).toFixed(2);const gap=race.s-race.rivalS;$('position').innerHTML=race.mode==='time'?`<span>TIME</span>`:`${gap>=0?'1':'2'}<span>/ 2</span>`;$('advantage').textContent=race.mode==='time'?`DRIFT ${Math.floor(race.driftPoints).toLocaleString()}`:`${gap>=0?'+':'−'}${Math.abs(gap).toFixed(1)} m`;
  $('rpm-bar').style.width=(race.rpm/8500*100)+'%';$('rpm-bar').style.background=race.rpm>7300?'#ef7955':'#e6e2c7';$('rpm-value').textContent=(race.rpm/1000).toFixed(1);$('rpm-needle').style.transform=`rotate(${race.rpm/9000*240}deg)`;
  const count=race.countdown>0?Math.ceil(race.countdown):race.elapsed<.85?'GO!':'';$('countdown').textContent=count;$('countdown').classList.toggle('go',count==='GO!');
  if(race.countdown>0&&count!==lastCount){lastCount=count;if(sound.ctx)sound.note(440,sound.ctx.currentTime,.08,.07,'sine');}if(count==='GO!'&&lastCount!==0){lastCount=0;if(sound.ctx)sound.note(880,sound.ctx.currentTime,.18,.1,'sine');}
  $('drift-display').classList.toggle('hidden',race.combo<35);$('drift-score').textContent=Math.floor(race.combo).toLocaleString();
  if(race.checkpoints>lastCheckpoint){lastCheckpoint=race.checkpoints;$('race-message').textContent='CHECKPOINT  /  +14 SEC';messageUntil=performance.now()+2200;}
  if(race.collision>.8){$('race-message').textContent='GUARDRAIL / SPEED PENALTY';messageUntil=performance.now()+900;}
  const landmark=track.landmarks.findIndex(p=>race.s/track.length>=p.at&&race.s/track.length<p.at+.025);if(landmark>=0&&landmark!==lastLandmark){lastLandmark=landmark;$('race-message').textContent=track.landmarks[landmark].name;messageUntil=performance.now()+2500;}
  if(performance.now()>messageUntil){const bend=sample(track,race.s+75).curve;if(race.understeer>.45&&race.speed>race.cornerSpeed)$('race-message').textContent='UNDERSTEER / TOO FAST';else if(race.speed>22&&Math.abs(bend)>.015)$('race-message').textContent=(bend>0?'LEFT':'RIGHT')+' HAIRPIN  /  BRAKE';else $('race-message').textContent='';}
  if(race.online)onlineHud();skillHud();drawMinimap();
}
function drawMinimap(){const canvas=$('minimap'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,180,190);const points=track.points.filter((_,i)=>i%3===0).filter(p=>p.s<=track.length);let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}const scale=Math.min(135/(maxX-minX||1),148/(maxZ-minZ||1));const coords=p=>[90+(p.x-(minX+maxX)/2)*scale,95-(p.z-(minZ+maxZ)/2)*scale];ctx.lineWidth=2;ctx.lineJoin='round';ctx.strokeStyle='#cedcc180';ctx.beginPath();for(const [i,p] of points.entries()){const [x,y]=coords(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();for(const [s,color,radius] of [[race.s,'#ed8059',4.3],...(race.online?(race.netOpponents||[]).map(p=>[p.s,'#c5d9e9',2.8]):race.mode!=='time'?[[race.rivalS,'#e5e4c3',2.8]]:[])]){const p=sample(track,Math.min(s,track.length)),[x,y]=coords(p);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=7;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}const end=coords(sample(track,track.length));ctx.fillStyle='#e5e4c3';ctx.fillRect(end[0]-3,end[1]-2,6,4);}
function finish(){showScreen('results');sound.update(race,false);const completed=race.s>=track.length;const key=`touge-${HANDLING_VERSION}-best-${track.id}-${race.car.id}-${race.manual?'mt':'at'}-${race.wet?'wet':'dry'}`;let best=null;try{best=Number(localStorage.getItem(key))||null;if(completed&&(!best||race.elapsed<best)){best=race.elapsed;localStorage.setItem(key,String(best));}}catch{}const champion=race.mode==='arcade'&&race.won&&settings.track===TRACKS.length-1;$('result-eyebrow').textContent=champion?'ARCADE ALL CLEAR':race.won?'DUEL COMPLETE':race.rivalFinished?'RIVAL FINISHED':'TIME OVER';$('results-title').innerHTML=champion?'LEYENDA DEL <em>TOUGE.</em>':race.won?'NOCHE <em>PERFECTA.</em>':'UNA CURVA <em>MÁS.</em>';$('result-message').textContent=champion?'Takumi, Keisuke, Kogashiwa, Mako, God Hand, Shinji y Kanata: ruta completa.':race.won?(race.mode==='time'?'Descenso completado. Busca tu mejor trazada.':`Has vencido a ${race.rival.name}. ${race.mode==='arcade'?'El siguiente rival te espera.':'Esta noche, la montaña fue tuya.'}`):race.rivalFinished?`${race.rival.name} cruzó la meta primero. Afina las frenadas y vuelve a desafiarlo.`:'Se agotó el tiempo. Busca los puntos de control.';$('result-time').textContent=fmtTime(race.elapsed);$('result-drift').textContent=Math.floor(race.driftPoints).toLocaleString();$('result-apex').textContent=Math.floor(race.skill.points).toLocaleString();$('result-best').textContent=best?fmtTime(best):'—';$('next-arcade').classList.toggle('hidden',race.mode!=='arcade'||!race.won);$('next-arcade-label').textContent=champion?'RUTA COMPLETADA':`SIGUIENTE / ${TRACKS[Math.min(6,settings.track+1)].name}`;openModal('results');}
let previous=performance.now(),accumulator=0,hudTimer=0;
function restoreSoloScene(){track=makeTrack(TRACKS[settings.track]);renderer.setTrack(track);renderer.setCar(CARS[settings.car]);updateSceneLabels();}
function onlineHud(){
  const players=[...(race.netPlayers||[])].sort((a,b)=>(a.dnf?1:0)-(b.dnf?1:0)||(a.place??99)-(b.place??99)||b.state.s-a.state.s),position=players.findIndex(p=>p.id===net.id)+1;
  $('position').textContent=`${position||1} / ${net.room?.players.length||2}`;$('race-mode-label').textContent='ONLINE / '+(net.room?.code||'');
  const leader=players.find(p=>!p.dnf),following=players.find(p=>p.id!==net.id&&!p.dnf),gap=leader?.id===net.id?race.s-(following?.state.s??race.s):(leader?.state.s??race.s)-race.s;
  $('advantage').textContent=race.netDnf?'RETIRADO':race.netFinished?'META / ESPERANDO':leader?`${leader.id===net.id?'+':'−'}${Math.abs(gap).toFixed(1)} m`:'';
  $('online-standings').replaceChildren();const caption=document.createElement('small');caption.textContent=`EN PISTA · ${Math.round(net.latency)} ms`;$('online-standings').append(caption);
  players.forEach((p,i)=>{const row=document.createElement('div');row.className=p.id===net.id?'you':'';const place=document.createElement('span'),name=document.createElement('b'),state=document.createElement('span');place.textContent=String(i+1).padStart(2,'0');name.textContent=p.name;state.textContent=p.dnf?'DNF':p.place?'META':CARS.find(c=>c.id===p.car)?.code;row.append(place,name,state);$('online-standings').append(row);});
  if(race.netFinished)$('race-message').textContent=race.netDnf?'FIN DE TU CARRERA / ESPERA LOS RESULTADOS':'META / ESPERANDO AL RESTO';
}
function startOnline(room){
  closeModal();keys.clear();touch.clear();sound.ensure();track=makeTrack(TRACKS.find(t=>t.id===room.config.track));const me=room.players.find(p=>p.id===net.id),car=CARS.find(c=>c.id===me.car);
  race=createRace(car,track,{mode:'time',night:room.config.night,wet:room.config.wet});race.online=true;race.netPlayers=[];race.netOpponents=[];net.lights=true;
  renderer.setTrack(track);renderer.setCar(car);renderer.setNetworkPlayers(room.players);renderer.particles=[];showScreen('race');sound.play(chosenSong());
  $('track-hud-name').textContent=track.name;$('total-distance').textContent=(track.length/1000).toFixed(2);$('transmission-label').textContent='AT';$('driver-cards').classList.add('hidden');$('online-standings').classList.remove('hidden');$('race-message').textContent='SALIDA ONLINE / TODOS A LA VEZ';
  messageUntil=performance.now()+4000;lastLandmark=-1;lastCheckpoint=0;lastCount=4;lastAward=0;lastBlind=0;awardUntil=0;zoneWasActive=false;lastZoneCue=-10;lastFocusActivation=0;$('zone-award').textContent='';hud();
}
function onlineResults(results){
  if(!race?.online)return;closeModal();showScreen('results');sound.update(race,false);$('online-result-board').replaceChildren();
  for(const p of results){const row=document.createElement('div'),place=document.createElement('em'),name=document.createElement('b'),time=document.createElement('span');place.textContent=p.dnf?'—':String(p.place).padStart(2,'0');name.textContent=p.name+(p.id===net.id?' · TÚ':'');time.textContent=p.dnf?'DNF':fmtTime(p.time);row.append(place,name,time);$('online-result-board').append(row);}
  updateRematch();openModal('online-results');
}
function updateRematch(){const host=net?.room?.hostId===net?.id;$('online-rematch').classList.toggle('hidden',!host);$('online-rematch-note').textContent=host?'Todos deberán confirmar «listo» de nuevo.':'Espera a que el anfitrión abra la revancha o sal de la sala.';}
net=new OnlineClient({
  onError:message=>{if(race?.online)toast(message);},
  onPreview:id=>{if(screen==='online')renderer.setCar(CARS.find(c=>c.id===id)||CARS[settings.car]);},
  onRoom:room=>{if(room.phase==='lobby'&&race?.online){closeModal();sound.stop();race=null;keys.clear();touch.clear();restoreSoloScene();showScreen('online');}if(room.phase==='results')updateRematch();},
  onStart:startOnline,
  onSnapshot:message=>{if(race?.online){const before=race.resetId;net.reconcile(race,track,message);if(race.resetId!==before){keys.clear();touch.clear();renderer.resetCamera=true;repositionNotice();}}},
  onResults:onlineResults,
  onLeft:message=>{closeModal();sound.stop();sound.update(race,false);race=null;keys.clear();touch.clear();$('online-standings').classList.add('hidden');restoreSoloScene();showScreen('online');if(message)toast(message);}
});
$('online-car').value=CARS[settings.car].id;$('online-track').value=track.id;$('online-night').value=settings.daytime;$('online-wet').value=settings.weather;
const invitation=new URL(location.href).searchParams.get('room');if(invitation){$('online-code').value=invitation;showScreen('online');net.status('Invitación recibida. Escribe tu nombre, elige tu coche y entra en la sala.');}
function frame(now){
  const dt=Math.min((now-previous)/1000,.1);previous=now;const input=getInput();
  if(race?.online){net.controls(input,race,screen==='race'&&!race.netFinished);race.netOpponents=net.opponents();}
  if(screen==='race'&&race){accumulator+=dt;while(accumulator>=1/120){updateRace(race,input,1/120);accumulator-=1/120;}hudTimer+=dt;if(hudTimer>.05){hud();hudTimer=0;}if(race.finished&&!race.online)finish();}else accumulator=0;
  sound.update(race,screen==='race'&&race?.countdown===0&&!race.finished);
  renderer.render(race,screen,Math.min(dt,.05),{day:race?.online?!race.night:settings.daytime==='day',shake:settings.shake});
  cockpit.draw(race,['race','paused','results'].includes(screen)&&renderer.cameraMode===3,Math.min(dt,.05),{song:chosenSong().name,mirror:renderer.mirrorReady?renderer.mirrorCanvas:null});
  cornerEffects.draw(race,['race','paused','results'].includes(screen),screen==='race'?Math.min(dt,.05):0,settings.shake);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only diagnostics for local QA and performance inspection.
window.touge={get state(){return {screen,modal,car:CARS[settings.car].id,track:track.id,race:race?{s:race.s,speed:race.speed,gear:race.gear,countdown:race.countdown,elapsed:race.elapsed,lateral:race.lateral,driftPoints:race.driftPoints,finished:race.finished}:null,songs:allSongs().length,vertices:renderer.scene?.count,webgl:!!renderer.gl};}};
