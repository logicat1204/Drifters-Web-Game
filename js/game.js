import {drawNavigation} from './minimap.mjs';
import {RACE_INTRO_SECONDS,raceIntroCamera} from './race-intro.mjs';
import {StoryPageAudio} from './story-audio.mjs';
import {DrivingControls} from './driving-controls.js';
import {DrivingAudio,musicDucking} from './driving-audio.js';
import {PlayMenu} from './play-menu.js';
import {Ranking} from './ranking.js';
import {applyBuild} from './tuning.mjs';
import {Workshop} from './workshop.js';
import { ALL_CARS as CARS, CAR_PROFILES, ALL_TRACKS as TRACKS, RIVALS, makeTrack, createRace, updateRace, toggleHeadlights, repositionRace, clamp } from './sim.mjs';
import { Renderer } from './renderer.js';
import { Cockpit } from './cockpit.js';
import { CornerEffects } from './effects.js';
import {OnlineClient} from './online.js';
import {focusType,activateFocus} from './focus.mjs';
import {AccountClient} from './account.js';
import {ProgressionClient} from './progression.js';
import {campaignEvent} from './campaign-events.mjs';
import {RunRecorder} from './replay.mjs';
import {RaceReplay,ReplayPlayer} from './race-replay.mjs';
import {FrameMonitor,AdaptiveResolution} from './render-performance.mjs';
import {RacePresentation,PHYSICS_STEP,presentationPose} from './presentation.mjs';

const $ = id => document.getElementById(id);
let stored={};try{stored=JSON.parse(localStorage.getItem('touge-settings')||'{}');}catch{}
const settings={car:0,track:0,arcadeStage:0,camera:'0',transmission:'auto',daytime:'night',weather:'dry',quality:'1.4',autoQuality:true,performanceDisplay:'compact',musicVolume:50,engineVolume:55,tireVolume:60,weatherVolume:35,shake:true,cabinMotion:65,cabinFov:65,cabinHands:true,stableHorizon:true,song:'synth',...stored};
if(!['off','compact','detailed'].includes(settings.performanceDisplay))settings.performanceDisplay='compact';
settings.autoQuality=settings.autoQuality!==false;
settings.cabinMotion=clamp(Number(settings.cabinMotion)||0,0,100);settings.cabinFov=clamp(Number(settings.cabinFov)||65,55,80);settings.cabinHands=settings.cabinHands!==false;settings.stableHorizon=settings.stableHorizon!==false;
delete settings.difficulty;
settings.car=clamp(Number(settings.car)||0,0,CARS.length-1);settings.track=clamp(Number(settings.track)||0,0,TRACKS.length-1);
function save(){try{localStorage.setItem('touge-settings',JSON.stringify(settings));}catch{}}
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.add('hidden'),4200);}
const fmtTime=s=>{const ms=Math.floor(Math.max(0,s)*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}′${String(Math.floor(ms/1000)%60).padStart(2,'0')}″${String(ms%1000).padStart(3,'0')}`;};
let renderer;
try{renderer=new Renderer($('world'));}catch(e){$('fatal').classList.remove('hidden');$('fatal').textContent=e.message;throw e;}
let track=makeTrack(TRACKS[settings.track]),race=null,screen='title',modal=null,returnFocus=null;
let optionsReturn='menu';
let replayPlayer=null;
renderer.setTrack(track);renderer.setCar(CARS[settings.car]);renderer.quality=Number(settings.quality);renderer.cameraMode=clamp(Number(settings.camera)||0,0,3);
const cockpit=new Cockpit($('cockpit'));
const cornerEffects=new CornerEffects($('race-fx'));
const frameMonitor=new FrameMonitor(),adaptiveResolution=new AdaptiveResolution();
const racePresentation=new RacePresentation();
let performanceAt=0,performanceSnapshot={};
function performanceDisplay(){
  const detailed=settings.performanceDisplay==='detailed',m=performanceSnapshot;
  $('performance-overlay').classList.toggle('hidden',settings.performanceDisplay==='off');
  $('performance-overlay').classList.toggle('detailed',detailed);$('performance-details').hidden=!detailed;
  $('performance-fps').textContent=m.samples?`${Math.round(m.fps)} FPS`:'MIDIENDO FPS';
  $('performance-time').textContent=m.samples?`${m.frameMs.toFixed(1)} ms`:'OBJETIVO 60';
  $('performance-overlay').dataset.slow=String(m.samples>30&&m.fps<55);
  if(detailed&&m.samples)$('performance-details').textContent=`P95 ${m.p95Ms.toFixed(1)} ms · CPU ${m.cpuMs.toFixed(1)} ms\n${m.width} × ${m.height} · ESCALA ${Math.round(m.scale*100)}%${settings.autoQuality?' AUTO':''}\n${m.drawCalls} DIBUJOS · ${Math.round(m.vertices/1000)}k VÉRTICES`;
}
$('performance-display').value=settings.performanceDisplay;$('auto-quality').checked=settings.autoQuality;
$('performance-display').addEventListener('change',e=>{settings.performanceDisplay=e.target.value;performanceDisplay();save();});
$('auto-quality').addEventListener('change',e=>{settings.autoQuality=e.target.checked;adaptiveResolution.reset();renderer.resolutionScale=1;save();});
performanceDisplay();
window.addEventListener('keydown',e=>{if(e.code==='F8'&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();const modes=['off','compact','detailed'];settings.performanceDisplay=modes[(modes.indexOf(settings.performanceDisplay)+1)%modes.length];$('performance-display').value=settings.performanceDisplay;performanceDisplay();save();}},true);
let net,account,progression,workshop,playMenu,ranking,currentCampaign=null,lastAccountId=null;
const keys=new Set();
const driving=new DrivingControls(settings,{
  save,shift:shiftGear,race:()=>screen==='race'?race:null,action:id=>actions[id]?.(),
  changeMode:()=>{if(net?.room?.phase==='lobby')net.send({type:'ready',ready:false});}
});
function shiftGear(value, relative){
  if(screen!=='race'||!race?.manual||race.finished||race.countdown>0||race.resetHold>0)return;
  const next=clamp(relative?(race.requestedGear??race.gear)+value:value,1,5);
  if(race.online)race.requestedGear=next;
  else race.gear=next;
  driving.renderGear();
}

class SoundSystem {
  constructor(){this.pageAudio=new StoryPageAudio();this.audio=new Audio();this.audio.preload='metadata';this.audio.loop=true;this.playing=false;this.muted=false;this.song=null;this.step=0;this.next=0;this.isDriving=false;this.musicDuck=1;this.preview=false;this.audio.addEventListener('error',()=>{if(this.song?.url){toast('No se pudo reproducir este archivo. Prueba MP3, OGG o WAV.');this.stop();renderSongs();}});}
  ensure(){
    if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try{
      const ctx=this.ctx=new AC();const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-6;compressor.knee.value=8;compressor.ratio.value=5;compressor.attack.value=.008;compressor.release.value=.18;compressor.connect(ctx.destination);this.output=compressor;
      this.musicGain=ctx.createGain();this.musicGain.gain.value=0;this.musicGain.connect(compressor);
      this.fileGain=ctx.createGain();this.fileGain.gain.value=0;this.fileGain.connect(compressor);
      this.fileSource=ctx.createMediaElementSource(this.audio);this.fileSource.connect(this.fileGain);
      this.fxGain=ctx.createGain();this.fxGain.connect(compressor);
      this.driving=new DrivingAudio(ctx,compressor);
      this.noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const musicNoise=this.noiseBuffer.getChannelData(0);for(let i=0;i<musicNoise.length;i++)musicNoise[i]=Math.random()*2-1;
      setInterval(()=>this.schedule(),70);this.volume();
    }catch{toast('El audio no está disponible en este navegador.');}
  }
  volume(){
    this.pageAudio.setVolume(this.muted?0:settings.engineVolume/100);
    const volume=this.muted?0:clamp(settings.musicVolume/100,0,1),level=volume*this.musicDuck,time=this.ctx?.currentTime||0;
    this.audio.volume=this.fileGain?1:level*.58;
    this.fileGain?.gain.setTargetAtTime(level*.58,time,.12);
    this.musicGain?.gain.setTargetAtTime(level*.24,time,.12);
  }
  note(freq,t,duration,vol=.15,type='sawtooth',slide=0){if(!this.ctx)return;const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.musicGain);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
  reward(blind=false){if(!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;this.fxGain.gain.setValueAtTime(settings.engineVolume/100*.30,t);for(const [i,f] of (blind?[554,830,1108]:[660,880,1320]).entries()){const o=ctx.createOscillator(),g=ctx.createGain(),at=t+i*.065;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.001,at);g.gain.exponentialRampToValueAtTime(.45,at+.012);g.gain.exponentialRampToValueAtTime(.001,at+.24);o.connect(g);g.connect(this.fxGain);o.start(at);o.stop(at+.25);o.onended=()=>{o.disconnect();g.disconnect();};}}
  schedule(){
    if(!this.ctx||!this.playing||!['synth','hakone-night'].includes(this.song?.id)||this.ctx.state!=='running')return;
    const ctx=this.ctx;if(this.next<ctx.currentTime)this.next=ctx.currentTime+.025;
    const hakone=this.song.id==='hakone-night',beat=60/(hakone?142:154),notes=hakone?[0,7,12,15,12,10,7,3,0,3,7,10,7,5,3,-2]:[0,7,12,7,10,7,3,7,0,7,15,12,10,7,3,-2],roots=hakone?[50,46,53,48]:[45,41,48,43];
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
  stop(){this.pageAudio.stop();this.playing=false;this.audio.pause();this.preview=false;}
  pause(){this.driving?.silence();this.wasPlaying=this.playing;this.playing=false;this.audio.pause();}
  resume(){if(!this.wasPlaying)return;this.ensure();this.playing=true;if(this.song?.url)this.audio.play().catch(()=>{});this.next=this.ctx?.currentTime||0;}
  gearClick(){if(!this.ctx||!this.output)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(170,t);o.frequency.exponentialRampToValueAtTime(65,t+.055);g.gain.setValueAtTime(settings.engineVolume/100*.09,t);g.gain.exponentialRampToValueAtTime(.0001,t+.07);o.connect(g);g.connect(this.output);o.start(t);o.stop(t+.075);o.onended=()=>{o.disconnect();g.disconnect();};}
  bump(){
    if(!this.ctx||!this.output||!settings.engineVolume)return;
    const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type='triangle';o.frequency.setValueAtTime(96,t);o.frequency.exponentialRampToValueAtTime(41,t+.105);
    g.gain.setValueAtTime(settings.engineVolume/100*.08,t);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    o.connect(g);g.connect(this.output);o.start(t);o.stop(t+.125);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  update(r,active,input={}){
    if(active&&this.lastDrivingGear!==undefined&&r.gear!==this.lastDrivingGear)this.gearClick();
    this.lastDrivingGear=active?r.gear:undefined;this.driving?.update(r,active,settings,input);
    const duck=musicDucking(this.driving?.mix,active);
    if(Math.abs(duck-this.musicDuck)>.015){this.musicDuck=duck;this.volume();}
  }
}
const sound=new SoundSystem();
const builtin=[{id:'synth',name:'Midnight Transmission',detail:'ORIGINAL SYNTH EUROBEAT · 154 BPM'},{id:'none',name:'Solo el sonido del motor',detail:'SIN MÚSICA'}];
let folderSongs=[],importedSongs=[],songsRequest=0;
const allSongs=()=>[...builtin,...folderSongs,...importedSongs];
function chosenSong(){return allSongs().find(s=>s.id===settings.song)||builtin[0];}
function raceSong(){const stageId=['race','paused','results','replay'].includes(screen)?race?.campaignStage:screen==='campaign'?currentCampaign:null;const stage=progression?.catalog?.stages.find(s=>s.id===stageId);return stage?progression.musicFor(stage):chosenSong();}
function updateSongLabels(){for(const id of ['selected-track-name','now-playing'])$(id).textContent=raceSong().name;}
function renderSongs(){
  const list=$('song-list');list.replaceChildren();
  allSongs().forEach((song,i)=>{const row=document.createElement('div');row.className='song-row'+(settings.song===song.id?' selected':'');const num=document.createElement('span');num.className='song-num';num.textContent=settings.song===song.id?'↗':String(i+1).padStart(2,'0');const info=document.createElement('button');info.className='song-info';const b=document.createElement('b');b.textContent=song.name;const small=document.createElement('small');small.textContent=song.detail||'SONGS/ · '+song.id.split('.').pop().toUpperCase();info.append(b,small);info.addEventListener('click',()=>selectSong(song));const preview=document.createElement('button');preview.className='song-preview';const playing=sound.playing&&sound.song?.id===song.id;preview.textContent=playing?'Ⅱ':'▶';preview.setAttribute('aria-label',(playing?'Pausar ':'Escuchar ')+song.name);preview.addEventListener('click',()=>{if(playing){sound.stop();renderSongs();}else{selectSong(song);sound.play(song,true);}});row.append(num,info);if(song.id!=='none')row.append(preview);list.append(row);});
  updateSongLabels();
}
function selectSong(song){settings.song=song.id;save();if(sound.playing)sound.play(song,true);renderSongs();}
async function refreshSongs(notify=false){
  const request=++songsRequest;try{const response=await fetch('/api/songs',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(request!==songsRequest)return;if(!Array.isArray(data.songs))throw Error();const nextSongs=data.songs.filter(s=>typeof s.id==='string'&&typeof s.name==='string'&&typeof s.url==='string'&&(s.url.startsWith('/songs/')||s.url.startsWith('/api/music/')));if(account?.user?.music.includes('hakone-night'))nextSongs.push({id:'hakone-night',name:'Hakone nocturno',detail:'BANDA SONORA · PREMIO DE CAMPAÑA'});const changed=JSON.stringify(folderSongs)!==JSON.stringify(nextSongs);folderSongs=nextSongs;
    const status=`${folderSongs.length} ${folderSongs.length===1?'canción detectada':'canciones detectadas'} · actualización automática`;if($('folder-status').textContent!==status)$('folder-status').textContent=status;
    if(!allSongs().some(s=>s.id===settings.song)){settings.song='synth';save();}
    if(notify)toast(`${folderSongs.length} canciones encontradas en songs/.`);if(changed){renderSongs();progression?.refreshMusicControls();}else updateSongLabels();
  }catch{$('folder-status').textContent='Inicia con JUGAR.bat o npm start para leer songs/.';if(notify)toast('Servidor no disponible. También puedes agregar archivos desde el botón.');}
}
$('import-music').addEventListener('click',()=>$('music-files').click());
$('music-files').addEventListener('change',event=>{const files=[...event.target.files];for(const file of files){if(!/\.(mp3|ogg|wav|m4a|aac|flac|opus|webm)$/i.test(file.name)&&!file.type.startsWith('audio/'))continue;const id='local-'+file.name+'-'+file.size;if(importedSongs.some(s=>s.id===id))continue;importedSongs.push({id,name:file.name.replace(/\.[^.]+$/,''),url:URL.createObjectURL(file),detail:'ARCHIVO LOCAL · ESTA SESIÓN'});}renderSongs();progression?.refreshMusicControls();toast('Archivos listos. Elige tu canción antes de correr.');event.target.value='';});
$('refresh-music').addEventListener('click',()=>refreshSongs(true));
refreshSongs();setInterval(()=>{if(screen!=='race')refreshSongs();},8000);

function drawTrackCards(){
  $('track-picker').replaceChildren();TRACKS.forEach((t,i)=>{const b=document.createElement('button'),mini=makeTrack(t),pts=mini.points.filter((p,j)=>j%12===0&&p.s<=t.length),xs=pts.map(p=>p.x),zs=pts.map(p=>p.z),minX=Math.min(...xs),minZ=Math.min(...zs),sx=58/(Math.max(...xs)-minX||1),sz=49/(Math.max(...zs)-minZ||1),scale=Math.min(sx,sz);const shape=pts.map((p,j)=>`${j?'L':'M'}${(10+(p.x-minX)*scale).toFixed(1)} ${(58-(p.z-minZ)*scale).toFixed(1)}`).join('');b.className='track-card'+(i===settings.track?' active':'');b.setAttribute('aria-pressed',String(i===settings.track));b.innerHTML=`<span class="track-index">0${i+1} / ${t.difficulty}</span><svg viewBox="0 0 80 65" aria-hidden="true"><path d="${shape}"/></svg><h3>${t.name}</h3><small>${(t.length/1000).toFixed(1)} KM &nbsp; / &nbsp; TIME ATTACK</small><span class="track-jp">${t.jp}</span>`;b.title=t.subtitle;b.addEventListener('click',()=>{if($('mode').value==='arcade'){$('mode').value='battle';updateModeDescription();}selectCourse(i);});$('track-picker').append(b);});$('track-number').textContent=String(settings.track+1).padStart(2,'0');$('track-total').textContent=String(TRACKS.length).padStart(2,'0');
}
function selectCourse(index){
  settings.track=clamp(index,0,TRACKS.length-1);save();
  const config=TRACKS[settings.track];
  if(track.id!==config.id){track=makeTrack(config);renderer.setTrack(track);}
  const cards=[...$('track-picker').querySelectorAll('.track-card')];
  for(const [i,card] of cards.entries()){
    card.classList.toggle('active',i===settings.track);
    card.setAttribute('aria-pressed',String(i===settings.track));
  }
  $('track-number').textContent=String(settings.track+1).padStart(2,'0');
  updateSceneLabels();cards[settings.track]?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function updateModeDescription(){const mode=$('mode').value;$('mode-description').textContent=mode==='arcade'?`ARCADE · DUELO ${clamp(Number(settings.arcadeStage)||0,0,6)+1} / 7`:mode==='time'?'TU MÁQUINA CONTRA EL RELOJ':'UN MAPA. SU RIVAL. UNA OPORTUNIDAD.';}
function cycleCamera(){renderer.cameraMode=(renderer.cameraMode+1)%4;settings.camera=String(renderer.cameraMode);$('camera').value=settings.camera;save();renderer.resetCamera=true;toast(['Cámara de persecución','Cámara de capó','Cámara cercana','Cabina '+CARS[settings.car].code+' · volante reactivo'][renderer.cameraMode]);}
function updateSceneLabels(){updateMenuCar();const c=ownedCar(),rival=RIVALS[track.rival];$('scene-car').textContent=`${c.year} ${c.brand} ${c.name}`;$('scene-car-sub').textContent=`${c.code} · ${c.drive} · ${c.power} CV`;$('car-brand').textContent=`${c.brand} / ${c.year}`;$('car-code').textContent=c.code;$('car-fullname').textContent=c.name;$('car-power').textContent=c.power;$('car-weight').textContent=c.weight;$('car-drive').textContent=c.drive;$('car-profile').textContent=CAR_PROFILES[c.profile].name;$('car-profile').dataset.profile=c.profile;$('car-profile-description').textContent=CAR_PROFILES[c.profile].description;$('car-stats').innerHTML=c.stats.map((v,i)=>`<div class="stat"><span>${['ACELERACIÓN','CURVAS','VELOCIDAD PUNTA'][i]}</span><div class="stat-track"><i style="width:${Math.min(100,v)}%"></i></div><b>${v}</b></div>`).join('');$('course-region').textContent=track.region+' / JAPAN';$('course-subtitle').textContent=track.subtitle;$('rival-intro-name').textContent=rival.name;$('rival-intro-car').textContent=rival.code+' · '+rival.team;}
function ownedCar(base=CARS[settings.car]){return applyBuild(base,account?.user?.garage?.[base.id]?.build);}
function drawCarCards(){
  const scroll=$('car-picker').scrollLeft;$('car-picker').replaceChildren();CARS.forEach((base,i)=>{const c=ownedCar(base);if(account?.user&&!account.user.cars.includes(c.id))return;const b=document.createElement('button');b.className='car-card'+(i===settings.car?' active':'');b.setAttribute('aria-pressed',String(i===settings.car));b.setAttribute('aria-label',`${c.brand} ${c.name} ${c.code} · ${CAR_PROFILES[c.profile].name}`);b.innerHTML=`<small>${c.brand} · ${CAR_PROFILES[c.profile].name}</small><b>${c.code}</b><span>${c.label.toUpperCase()}</span><i class="car-swatch" style="background:${c.color}"></i>`;b.addEventListener('click',()=>{settings.car=i;save();account?.preferences({defaultCar:c.id});renderer.setCar(c);drawCarCards();updateSceneLabels();});$('car-picker').append(b);});$('car-picker').scrollLeft=scroll;
}
drawTrackCards();drawCarCards();updateSceneLabels();updateModeDescription();renderSongs();
$('mode').addEventListener('change',()=>{if($('mode').value==='arcade')selectCourse(clamp(Number(settings.arcadeStage)||0,0,6));updateModeDescription();});
for(const [id,direction] of [['track-prev',-1],['track-next',1]])$(id).addEventListener('click',()=>$('track-picker').scrollBy({left:direction*320,behavior:'smooth'}));

function updateMenuCar(){const car=CARS[settings.car];$('menu-car-code').textContent=car.code;$('menu-car-name').textContent=car.brand+' '+car.name;$('menu-car-year').textContent=car.year+' / '+car.drive;}
async function updateMenuIdentity(user){
  $('menu-driver-name').textContent=user.displayName;
  $('menu-portrait').src=user.portraitUrl;
  const background=await account.applyBackground(document.querySelector('.menu-pilot'),user.licenseBackground);
  if(background&&account.user===user&&user.portraitMode==='avatar')$('menu-portrait').src=user.portraitUrl+'&transparent=1';
}
function navigateBack(){
  if(screen==='results'&&race?.awaitingRecord)return;
  closeModal();
  if(screen==='campaign'){progression.backCampaign();return;}
  if(screen==='shop'||screen==='garage'||screen==='play'){showScreen('menu');return;}
  if(screen==='workshop'){showScreen('garage');return;}
  if(screen==='online'&&net.room){net.leave();return;}
  showScreen('play');
}
function selectMenuButton(button){if(!button)return;for(const b of $('main-menu-actions').querySelectorAll('button'))b.classList.toggle('selected',b===button);$('menu-description').textContent=button.dataset.description;}
function moveMenu(code){const buttons=[...$('main-menu-actions').querySelectorAll('button')],current=buttons.findIndex(b=>b.classList.contains('selected'));const index=code==='Home'?0:code==='End'?buttons.length-1:(current+(code==='ArrowUp'?-1:1)+buttons.length)%buttons.length;selectMenuButton(buttons[index]);buttons[index].focus({preventScroll:true});}
function openRaceSetup(){currentCampaign=null;closeModal();$('setup-title').textContent='Time Attack';$('setup-eyebrow').textContent='TU MÁQUINA / EL CRONÓMETRO';$('setup-description').textContent='Practica y mejora tus tiempos. Deja tu nombre en el ranking.';$('mode').value='time';updateModeDescription();showScreen('home');}

function enterGame(){if(screen!=='title')return;sound.ensure();if(account?.user?.onboarded&&settings.autoFullscreen)requestFullscreen(true);showScreen('menu');if(account?.user&&!account.user.onboarded)account.open(true);else if(account?.user?.onboarded){if(invitation){$('online-code').value=invitation;invitation=null;net.selectTab('private');showScreen('online');}else $('main-menu-actions').querySelector('.selected')?.focus({preventScroll:true});}}
function leaveToTitle(){closeModal();if(net?.room)net.leave();sound.stop();sound.update(race,false);race=null;keys.clear();driving.clear();showScreen('title');$('title-enter').focus({preventScroll:true});}
window.addEventListener('keydown',e=>{if(screen==='title'&&!e.repeat&&!['Shift','Control','Alt','Meta'].includes(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();enterGame();}},true);
$('title-screen').addEventListener('click',enterGame);
for(const button of $('main-menu-actions').querySelectorAll('button')){button.addEventListener('pointerenter',()=>selectMenuButton(button));button.addEventListener('focus',()=>selectMenuButton(button));}

function showScreen(name){if(name!=='replay')replayPlayer=null;$('replay-controls').classList.toggle('hidden',name!=='replay');playMenu?.cancelHover();racePresentation.reset(race);accumulator=0;frameMonitor.reset();adaptiveResolution.reset();renderer.resolutionScale=1;performanceSnapshot={};screen=name;document.body.dataset.screen=name;document.body.classList.toggle('title-screen',name==='title');document.body.classList.toggle('menu-screen',name==='menu');$('title-screen').classList.toggle('hidden',name!=='title');$('app').inert=['title','online-loading','settings'].includes(name);$('settings-panel').classList.toggle('hidden',name!=='settings');$('auth-gate').inert=name==='title';if(name==='menu')selectMenuButton($('main-menu-actions').querySelector('.selected')||$('main-menu-actions').querySelector('button'));if(name==='online'){net?.refreshIdentity();if(net?.tab==='public')net.refreshRooms();renderer.setCar(ownedCar(CARS.find(c=>c.id===$('online-car').value)||CARS[settings.car]));}else if(['menu','play','home','garage','title','campaign','shop'].includes(name))renderer.setCar(ownedCar());for(const id of ['main-menu','play-screen','home','garage','workshop','online','race','campaign','shop'])$(id).classList.toggle('hidden',(id==='main-menu'?name!=='menu':id==='play-screen'?name!=='play':name!==id)&&!(id==='race'&&['paused','results'].includes(name)));document.body.classList.toggle('racing',['race','paused','results','replay'].includes(name));driving.clear();driving.sync();document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.action===name));renderer.resetCamera=true;}
const gameDialogs=['music','controls','control-layout','gamepad-config','pause','results','online-results','exit','mode','ranking'];
function openModal(name){
  if(name==='settings'){openOptions();return;}
  returnFocus=document.activeElement;modal=name;$('modal-backdrop').classList.remove('hidden');
  for(const id of gameDialogs)$(id+'-panel').classList.toggle('hidden',id!==name);
  $('settings-panel').inert=screen==='settings';
  const first=[...$(name+'-panel').querySelectorAll('button,select,input')].find(el=>!el.disabled&&el.getClientRects().length);first?.focus();if(name==='music')refreshSongs();
}
function closeModal(){
  const was=modal;modal=null;$('modal-backdrop').classList.add('hidden');
  for(const id of gameDialogs)$(id+'-panel').classList.add('hidden');
  $('settings-panel').inert=false;
  if(was==='gamepad-config')driving.cancelBinding();
  if(was==='music'&&sound.preview&&screen!=='race')sound.stop();
  if(was)returnFocus?.focus();
}
function openOptions(){
  if(screen==='settings')return;
  optionsReturn=screen;
  closeModal();showScreen('settings');driving.updateDevices();
  document.querySelector('[data-settings-tab][aria-pressed=true]').focus();
}
function closeOptions(){
  driving.cancelBinding();showScreen(optionsReturn==='settings'?'menu':optionsReturn);
  if(screen==='menu')document.querySelector('#main-menu-actions [data-action=settings]')?.focus();
}
function requestFullscreen(automatic=false){
  if(automatic&&document.fullscreenElement)return;
  const pending=document.fullscreenElement?document.exitFullscreen?.():document.fullscreenEnabled?document.documentElement.requestFullscreen?.():null;
  if(!automatic&&!pending)toast('La pantalla completa no está disponible.');
  pending?.catch(()=>{if(!automatic)toast('La pantalla completa no está disponible.');});
}
for(const button of document.querySelectorAll('[data-settings-tab]'))button.onclick=()=>{
  driving.cancelBinding();
  for(const item of document.querySelectorAll('[data-settings-tab]'))item.setAttribute('aria-pressed',String(item===button));
  for(const page of document.querySelectorAll('[data-settings-page]'))page.hidden=page.dataset.settingsPage!==button.dataset.settingsTab;
  $('settings-panel').scrollTop=0;
};
function pause(){if(screen!=='race')return;keys.clear();driving.clear();showScreen('paused');sound.pause();$('pause-title').textContent=race.online?'MENÚ ONLINE':'EN PAUSA.';$('pause-panel').querySelector('.eyebrow').textContent=race.online?'LA CARRERA CONTINÚA. TU COCHE FRENA.':'RESPIRA. LA MONTAÑA SIGUE AHÍ.';$('pause-panel').querySelector('[data-action=restart]').classList.toggle('hidden',!!race.online);$('pause-panel').querySelector('[data-action=quit]').textContent=race.online?'ABANDONAR SALA':'VOLVER AL MENÚ';openModal('pause');}
function resume(){if(screen!=='paused')return;closeModal();showScreen('race');sound.resume();}
function quit(){if(race?.awaitingRecord)return;if(race?.online){net.leave();return;}closeModal();sound.stop();sound.update(race,false);showScreen('menu');race=null;keys.clear();driving.clear();}
function sealReplay(){
  race?.watchReplay?.finish(race);
  for(const button of document.querySelectorAll('[data-action=replay]'))button.disabled=!race?.watchReplay?.duration;
}
function startReplay(){
  if(screen!=='results'||race?.awaitingRecord||!race?.watchReplay?.duration||progression?.comicOpen)return;
  closeModal();showScreen('replay');replayPlayer=new ReplayPlayer(race.watchReplay);
  renderer.setCar(race.car);renderer.setRival(race.rival);renderer.particles=[];
  $('replay-course').textContent=race.track.name+' · '+race.car.code;
  $('replay-seek').max=String(replayPlayer.clip.duration);
  $('replay-duration').textContent=fmtTime(Math.max(0,replayPlayer.clip.duration-3));
  $('replay-speed').value='1';$('replay-camera').textContent='CÁMARA TV';
  sound.play(race.replaySong||raceSong());updateReplayControls();
  $('replay-pause').focus();
}
function stopReplay(){
  if(screen!=='replay')return;
  replayPlayer=null;sound.stop();sound.update(race,false);renderer.particles=[];
  showScreen('results');openModal(race.online?'online-results':'results');
  if(race.campaignStage&&race.savedRecord?.won&&race.savedRecord?.completed&&!race.endingShown){
    race.endingShown=true;progression.ending(race.campaignStage);
  }
}
function updateReplayControls(){
  if(!replayPlayer)return;
  $('replay-seek').value=String(replayPlayer.at);
  $('replay-time').textContent=fmtTime(Math.max(0,replayPlayer.at-3));
  $('replay-pause').textContent=replayPlayer.paused?'REPRODUCIR ▶':'PAUSAR Ⅱ';
  $('replay-pause').setAttribute('aria-label',replayPlayer.paused?'Reproducir repetición':'Pausar repetición');
}
function toggleReplay(){
  if(!replayPlayer)return;
  if(replayPlayer.at>=replayPlayer.clip.duration)seekReplay(0);
  replayPlayer.paused=!replayPlayer.paused;
  if(replayPlayer.paused)sound.pause();else sound.resume();
  updateReplayControls();
}
function seekReplay(at){
  if(!replayPlayer)return;
  replayPlayer.seek(at);renderer.particles=[];renderer.resetCamera=true;sound.update(null,false);
  updateReplayControls();
}
function cycleReplayCamera(){
  if(!replayPlayer)return;
  replayPlayer.camera=(replayPlayer.camera+1)%3;
  $('replay-camera').textContent=['CÁMARA TV','SEGUIMIENTO','VISTA AÉREA'][replayPlayer.camera];
  renderer.resetCamera=true;
}
$('replay-seek').addEventListener('input',event=>seekReplay(event.target.value));
$('replay-speed').addEventListener('change',event=>{if(replayPlayer)replayPlayer.rate=Number(event.target.value);});
async function startRace(){
  if(race?.awaitingRecord||!account?.require()||startRace.busy)return;if(net?.room){showScreen('online');toast('Sal de la sala online antes de iniciar una carrera individual.');return;}
  startRace.busy=true;document.body.classList.add('starting-race');$('start').disabled=true;
  try{await account.preferenceTail;const stage=campaignEvent(currentCampaign),mode=stage?'campaign':'time';if(stage)selectCourse(TRACKS.findIndex(t=>t.id===stage.track));else if(mode==='arcade')selectCourse(clamp(Number(settings.arcadeStage)||0,0,6));const transmissionMode=driving.choice,car=CARS[settings.car],course=track,opts={mode,manual:transmissionMode!=='auto',wet:settings.weather==='wet',night:settings.daytime==='night',...(stage?{campaignStage:stage.id}:{})};const attempt=await account.request('/api/runs/start',{method:'POST',body:JSON.stringify({car:car.id,track:course.id,...opts})});
    closeModal();keys.clear();driving.clear();
    race=createRace(car,course,attempt.options||opts);race.transmissionMode=transmissionMode;race.attempt=attempt.id;
    race.recorder=new RunRecorder();race.watchReplay=new RaceReplay(race);
    renderer.setCar(race.car);renderer.setRival(race.rival);
    if(race.grid)renderer.setNetworkPlayers(race.grid.map(o=>({id:'grid-'+o.rival.id,car:o.car.id,build:{color:o.car.color}})));
    renderer.particles=[];showScreen('race');race.replaySong=raceSong();sound.play(race.replaySong);
    $('track-hud-name').textContent=course.name;$('total-distance').textContent=(race.finishDistance/1000).toFixed(2);
    $('transmission-label').textContent=race.manual?'MT':'AT';
    const stageMedia=progression.catalog?.stages.find(s=>s.id===stage?.id)?.media,isDuel=stage?.kind==='duel';
    $('race-mode-label').textContent=stage?.kind==='trial'?'CAMPAÑA / TIME TRIAL':race.grid?'CAMPAÑA / CARRERA MÚLTIPLE':isDuel?'CAMPAÑA / NIVEL '+stage.level:'TIME ATTACK';
    const details=progression.catalog?.stages.find(s=>s.id===stage?.id);
    const rivals=race.grid?details.rivals:isDuel?[{...race.rival,portrait:stageMedia.driverPortrait}]:[];
    prepareRaceHud(rivals);
    if(stage)showRaceIntro(rivals);
    hud();
  }catch(error){toast(error.message);if(screen==='campaign')$('campaign-status').textContent=error.message;if(error.status===401){await account.init();}}finally{startRace.busy=false;document.body.classList.remove('starting-race');$('start').disabled=false;}
}
function nextArcade(){if(race?.campaignStage){const next=progression.nextStage(race.campaignStage);if(next)progression.begin(next);else{quit();showScreen('campaign');progression.backCampaign();}return;}if(!race?.won||race.mode!=='arcade')return;settings.arcadeStage=settings.track===TRACKS.length-1?0:settings.track+1;save();account.preferences({arcadeStage:settings.arcadeStage});updateModeDescription();if(settings.track===TRACKS.length-1){quit();return;}startRace();}
const actions={replay:startReplay,'replay-exit':stopReplay,'replay-pause':toggleReplay,'replay-restart':()=>{seekReplay(0);if(replayPlayer?.paused)toggleReplay();},'replay-camera':cycleReplayCamera,play:()=>{currentCampaign=null;closeModal();showScreen('play');document.querySelector('[data-play-mode]')?.focus();},ranking:()=>ranking.open(),home:()=>{closeModal();showScreen('menu');},back:navigateBack,campaign:()=>{closeModal();progression.openCampaign();},shop:()=>{account.close();closeModal();progression.openShop();},offline:()=>openRaceSetup('offline'),profile:()=>{if(account?.require())account.open();},exit:()=>openModal('exit'),'exit-confirm':leaveToTitle,garage:()=>{closeModal();showScreen('garage');},workshop:()=>{closeModal();workshop.open(CARS[settings.car]);},music:()=>openModal('music'),settings:openOptions,'gamepad-config':()=>{if(driving.gamepad)openModal('gamepad-config');},controls:()=>openModal('controls'),'control-layout':()=>{driving.openEditor();openModal('control-layout');},online:()=>{closeModal();showScreen('online');},'online-rematch':()=>net.send({type:'rematch'}),'online-exit':()=>net.leave(),camera:cycleCamera,headlights:switchLights,reposition:repositionPlayer,focus:useFocus,next:nextArcade,close:()=>screen==='settings'&&!modal?closeOptions():closeModal(),pause,resume,restart:()=>{if(race?.awaitingRecord)return;if(race?.campaignStage)progression.begin(progression.catalog.stages.find(s=>s.id===race.campaignStage));else startRace();},quit,fullscreen:()=>requestFullscreen(),mute:()=>{sound.muted=!sound.muted;sound.volume();toast(sound.muted?'Música silenciada. Pulsa M para activarla.':'Música activada.');}};
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>actions[b.dataset.action]?.()));$('start').addEventListener('click',startRace);$('modal-backdrop').addEventListener('click',()=>{if(!['pause','results','online-results'].includes(modal))closeModal();});
for(const [id,key] of [['camera','camera'],['daytime','daytime'],['quality','quality']]){$(id).value=settings[key];$(id).addEventListener('change',()=>{settings[key]=$(id).value;save();if(id==='quality'){adaptiveResolution.reset();renderer.resolutionScale=1;frameMonitor.reset();}renderer.quality=Number(settings.quality);renderer.cameraMode=Number(settings.camera);renderer.resetCamera=true;});}
for(const [id,key]of [['cabin-motion','cabinMotion'],['cabin-fov','cabinFov']]){$(id).value=settings[key];$(id).addEventListener('input',e=>{settings[key]=Number(e.target.value);save();});}for(const [id,key]of [['cabin-hands','cabinHands'],['stable-horizon','stableHorizon']]){$(id).checked=settings[key];$(id).addEventListener('change',e=>{settings[key]=e.target.checked;save();});}
$('time-weather').value=settings.weather;
$('time-weather').onchange=event=>{settings.weather=event.target.value;save();};
settings.autoFullscreen=settings.autoFullscreen===true;
$('auto-fullscreen').checked=settings.autoFullscreen;
$('auto-fullscreen').onchange=event=>{settings.autoFullscreen=event.target.checked;save();};
settings.minimapSize=['small','large'].includes(settings.minimapSize)?settings.minimapSize:'normal';
function applyMinimapSize(){
  $('minimap-size').value=settings.minimapSize;
  $('minimap').closest('.navigation').dataset.size=settings.minimapSize;
}
applyMinimapSize();
$('minimap-size').onchange=event=>{settings.minimapSize=event.target.value;applyMinimapSize();save();};
$('options-music-volume').value=settings.musicVolume;
$('options-music-volume').oninput=event=>{$('music-volume').value=event.target.value;$('music-volume').dispatchEvent(new Event('input'));};
$('music-volume').addEventListener('input',event=>{$('options-music-volume').value=event.target.value;});
$('music-volume').value=settings.musicVolume;$('volume-label').textContent=settings.musicVolume+'%';$('music-volume').addEventListener('input',e=>{settings.musicVolume=Number(e.target.value);$('volume-label').textContent=settings.musicVolume+'%';sound.volume();save();});$('engine-volume').value=settings.engineVolume;$('engine-volume').addEventListener('input',e=>{settings.engineVolume=Number(e.target.value);save();});for(const [id,key]of [['tire-volume','tireVolume'],['weather-volume','weatherVolume']]){$(id).value=settings[key];$(id).oninput=e=>{settings[key]=Number(e.target.value);save();};}$('camera-shake').checked=settings.shake;$('camera-shake').addEventListener('change',e=>{settings.shake=e.target.checked;save();});

window.addEventListener('keydown',e=>{
  if(screen==='title'||!account?.user?.onboarded||!$('account-panel').classList.contains('hidden')||document.querySelector('dialog[open]'))return;
  const form=['INPUT','SELECT'].includes(document.activeElement?.tagName);
  if(modal&&e.key==='Tab'){const items=[...$(modal+'-panel').querySelectorAll('button,input:not([hidden]),select')].filter(el=>!el.disabled&&el.getClientRects().length);if(items.length){const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
  if(screen==='settings'&&!modal&&driving.captureKey(e))return;
  if((screen==='settings'&&!modal&&driving.binding!=null||screen==='race'&&!modal&&!form)&&driving.handleKey(e))return;
  if(screen==='settings'&&!modal&&e.code==='Escape'){e.preventDefault();closeOptions();return;}
  if(e.code==='Escape'&&(screen!=='race'||driving.keyMatches('pause',e.code))){e.preventDefault();if(screen==='replay')stopReplay();else if(screen==='race')pause();else if(screen==='paused')resume();else if(modal&&!['results','online-results'].includes(modal))closeModal();else if(['garage','home','online','campaign','workshop','shop','play'].includes(screen))navigateBack();return;}
  if(screen==='replay'&&!modal&&document.activeElement?.tagName!=='SELECT'){if(['Space','ArrowLeft','ArrowRight','KeyC'].includes(e.code))e.preventDefault();if(e.code==='Space'&&!e.repeat)toggleReplay();if(e.code==='KeyC'&&!e.repeat)cycleReplayCamera();if(e.code==='ArrowLeft')seekReplay(replayPlayer.at-5);if(e.code==='ArrowRight')seekReplay(replayPlayer.at+5);return;}
  if(form||modal)return;
  if(screen==='menu'&&['ArrowUp','ArrowDown','Home','End'].includes(e.code)){e.preventDefault();moveMenu(e.code);return;}
  if(screen==='race'&&['throttle','brake','left','right','handbrake'].some(action=>driving.keyMatches(action,e.code))){e.preventDefault();keys.add(e.code);}
  if(e.repeat)return;
  if(e.code==='KeyM')actions.mute();
  if(screen==='home'&&e.code==='Enter'){e.preventDefault();startRace();}
  if(screen==='race'){
    if(driving.keyMatches('camera',e.code))cycleCamera();
    if(driving.keyMatches('headlights',e.code))switchLights();
    if(driving.keyMatches('focus',e.code)&&!e.ctrlKey&&!e.metaKey&&!e.altKey)useFocus();
    if(driving.keyMatches('reposition',e.code)&&!e.ctrlKey&&!e.metaKey&&!e.altKey)repositionPlayer();
    if(driving.keyMatches('pause',e.code))pause();
    if(e.code==='KeyR'&&!race.online)actions.restart();
  }
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();driving.clear();if(screen==='race')pause();else if(screen==='replay'&&!replayPlayer?.paused)toggleReplay();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)return;if(screen==='race')pause();else if(screen==='replay'&&!replayPlayer?.paused)toggleReplay();});
let padOld=[];
function getInput(){const pressed=action=>driving.has(action)||[...keys].some(code=>driving.keyMatches(action,code));let steer=driving.steering||Number(pressed('right'))-Number(pressed('left')),throttle=pressed('throttle'),brake=pressed('brake'),handbrake=pressed('handbrake');
  const pad=driving.gamepad;if(pad){const buttons=pad.buttons.map(b=>b.pressed),map=driving.settings.gamepadBindings;const edge=action=>buttons[map[action]]&&!padOld[map[action]];if(modal==='gamepad-config'&&driving.pendingBinding?.device==='gamepad'){const button=buttons.findIndex((down,i)=>down&&!padOld[i]);if(button>=0)driving.assignBinding(button);padOld=buttons;return {steer,throttle,brake,handbrake};}if(!settings.enableGamepad){padOld=buttons;return {steer,throttle,brake,handbrake};}const axis=pad.axes[0]||0;if(Math.abs(axis)>.12)steer=axis;throttle||=pad.buttons[map.throttle]?.value>.15;brake||=pad.buttons[map.brake]?.value>.15;handbrake||=buttons[map.handbrake];if(screen==='title'&&buttons.some((down,i)=>down&&!padOld[i]))enterGame();else if(screen==='menu'&&!modal&&account?.user?.onboarded&&$('account-panel').classList.contains('hidden')){if(buttons[12]&&!padOld[12])moveMenu('ArrowUp');if(buttons[13]&&!padOld[13])moveMenu('ArrowDown');if(buttons[0]&&!padOld[0])$('main-menu-actions').querySelector('.selected')?.click();}else if(screen==='replay'){if(buttons[0]&&!padOld[0])toggleReplay();if(buttons[1]&&!padOld[1])stopReplay();if(buttons[3]&&!padOld[3])cycleReplayCamera();if(buttons[14]&&!padOld[14])seekReplay(replayPlayer.at-5);if(buttons[15]&&!padOld[15])seekReplay(replayPlayer.at+5);}else if(progression?.comicOpen||screen==='campaign'){progression?.controller(buttons,padOld);}else if(screen==='play'){if(modal==='mode'){if(buttons[0]&&!padOld[0])$('mode-enter').click();if(buttons[1]&&!padOld[1])closeModal();}else if(!modal){const cards=[...document.querySelectorAll('[data-play-mode]')],i=Math.max(0,cards.indexOf(document.activeElement));if((buttons[13]&&!padOld[13])||(buttons[15]&&!padOld[15]))cards[(i+1)%3].focus();if((buttons[12]&&!padOld[12])||(buttons[14]&&!padOld[14]))cards[(i+2)%3].focus();if(buttons[0]&&!padOld[0])cards[i].click();if(buttons[1]&&!padOld[1])showScreen('menu');}}if(edge('pause')){if(screen==='race')pause();else if(screen==='paused')resume();}if(screen==='race'){if(edge('camera'))cycleCamera();if(edge('headlights'))switchLights();if(edge('focus'))useFocus();if(edge('reposition'))repositionPlayer();if(driving.mode==='sequential'){if(edge('up'))shiftGear(1,true);if(edge('down'))shiftGear(-1,true);}}padOld=buttons;}else padOld=[];
  return {steer,throttle,brake,handbrake};
}

// Tachometer labels are generated once; HUD text updates at 20 Hz.
const svgNS='http://www.w3.org/2000/svg';for(let i=0;i<=9;i++){const angle=(-210+i*26.666)*Math.PI/180;const mark=document.createElementNS(svgNS,'line');mark.setAttribute('x1',120+Math.cos(angle)*87);mark.setAttribute('y1',110+Math.sin(angle)*87);mark.setAttribute('x2',120+Math.cos(angle)*95);mark.setAttribute('y2',110+Math.sin(angle)*95);$('gauge-marks').append(mark);const text=document.createElementNS(svgNS,'text');text.setAttribute('x',120+Math.cos(angle)*75-3);text.setAttribute('y',113+Math.sin(angle)*75);text.textContent=i;$('gauge-marks').append(text);}
let lastCount=4,lastAward=0,lastBlind=0,awardUntil=0,zoneWasActive=false,lastZoneCue=-10,lastFocusActivation=0,lastWallContact=false;
function driverCard(name,portrait,car){
  const card=document.createElement('div');card.className='driver-card rival-extra';
  const title=document.createElement('b'),picture=document.createElement('div'),label=document.createElement('span');
  title.textContent=name;picture.className='driver-avatar';label.textContent=CARS.find(item=>item.id===car)?.code||car;
  if(portrait){const img=document.createElement('img');img.src=portrait;img.alt='';picture.append(img);}
  else picture.textContent=name.slice(0,2).toUpperCase();
  card.append(title,picture,label);return card;
}
function prepareRaceHud(rivals){
  const user=account.user;
  $('driver-name').textContent=user.displayName;$('driver-portrait').src=user.portraitUrl;$('driver-car').textContent=race.car.code;
  const first=rivals[0],card=document.querySelector('.driver-card.rival');
  card.classList.toggle('hidden',!first);
  if(first){
    $('rival-name').textContent=first.name;
    $('rival-car').textContent=CARS.find(car=>car.id===first.car)?.code||first.code;
    $('rival-initials').textContent=first.name.slice(0,2).toUpperCase();
    $('rival-portrait').classList.toggle('hidden',!first.portrait);
    if(first.portrait)$('rival-portrait').src=first.portrait;
  }
  $('additional-rivals').replaceChildren(...rivals.slice(1).map(rival=>driverCard(rival.name,rival.portrait,rival.car)));
  $('online-standings').classList.add('hidden');
  lastCount=4;lastAward=0;lastBlind=0;awardUntil=0;zoneWasActive=false;lastZoneCue=-10;lastFocusActivation=0;lastWallContact=false;
  $('zone-award').textContent='';$('race-intro').classList.add('hidden');$('race').classList.remove('intro-active');
}
function showRaceIntro(rivals,seconds=RACE_INTRO_SECONDS){
  $('race-intro-title').textContent=race.track.name;
  $('race-intro-conditions').textContent=[race.night?'Noche':'Día',race.wet?'Lluvia':'Asfalto seco',race.fog?'Niebla':null,race.laps>1?race.laps+' vueltas':null].filter(Boolean).join(' · ');
  $('race-intro-roster').replaceChildren(...[{name:account.user.displayName,car:race.car.id},...rivals].map(driver=>{
    const row=document.createElement('div'),name=document.createElement('b'),car=document.createElement('small');
    name.textContent=driver.name;car.textContent=CARS.find(item=>item.id===driver.car)?.code||driver.code;
    row.append(name,car);return row;
  }));
  race.introActive=true;race.introDuration=seconds;race.introRemaining=seconds;
  $('race-intro').classList.remove('hidden');$('race').classList.add('intro-active');
}
function repositionPlayer(){
  if(!race||!['race','paused'].includes(screen))return;
  if(race.online){net.raceAction('reposition');return;}
  if(repositionRace(race)){race.recorder?.action(2);racePresentation.reset(race);keys.clear();driving.clear();renderer.resetCamera=true;hud();}
}
function useFocus(){
  if(!race||screen!=='race'||race.introRemaining>0)return;
  if(race.online){net.raceAction('focus');return;}
  if(activateFocus(race)){race.recorder?.action(1);hud();}
}
function focusHud(){
  const f=race.focus,power=focusType(race),active=f.remaining>0;
  const percent=f.enabled===false?0:active?f.remaining/f.duration*100:f.charge,gauge=$('focus-gauge');
  gauge.style.setProperty('--focus-color',power.color);gauge.style.setProperty('--focus-aura',power.aura);
  gauge.style.setProperty('--focus-fill',percent+'%');gauge.dataset.active=String(active);
  gauge.setAttribute('aria-valuenow',String(Math.floor(percent)));
  gauge.setAttribute('aria-label',active?'Superconcentración activa':'Carga de Superconcentración');
  if(f.activations>lastFocusActivation){lastFocusActivation=f.activations;sound.reward(true);}
  document.body.classList.toggle('super-focus',active);
}
function switchLights(){if(!race||!['race','paused'].includes(screen))return;const on=toggleHeadlights(race);if(race.online)net.lights=on;}
function skillHud(){
  const s=race.skill;$('zone-display').dataset.level=String(s.level);$('zone-level').textContent=['','Trazada limpia','Buen vértice','Apex Flow'][s.level];$('zone-chain').textContent=s.chain?'×'+s.chain:'';
  if(s.level===3&&!zoneWasActive&&race.elapsed-lastZoneCue>4){sound.reward();lastZoneCue=race.elapsed;}zoneWasActive=s.level===3;
  if(s.awardId!==lastAward){lastAward=s.awardId;if(s.award){awardUntil=race.elapsed+2.5;$('zone-award').textContent=s.award.grade+' +'+s.award.points+'\n'+s.award.chain+' CURVAS EN CADENA';}else $('zone-award').textContent='';}
  if(race.blindPasses!==lastBlind){lastBlind=race.blindPasses;sound.reward(true);awardUntil=race.elapsed+3;$('zone-award').textContent='BLIND ATTACK +600\nADELANTAMIENTO A OSCURAS';}
  if(race.elapsed>awardUntil)$('zone-award').textContent='';
  $('zone-display').classList.toggle('hidden',!s.level&&!$('zone-award').textContent);
  const wallContact=race.collision>.8;
  if(wallContact&&!lastWallContact)sound.bump();
  lastWallContact=wallContact;focusHud();
}
function hud(){
  if(!race)return;
  const draft=race.draft,strength=draft?.strength||0,visible=strength>.04;
  $('draft-panel').classList.toggle('draft-active',visible);$('draft-panel').setAttribute('aria-hidden',String(!visible));
  $('draft-fill').style.width=(strength*100).toFixed(1)+'%';$('draft-value').textContent=Math.round(strength*100)+'%';
  $('draft-label').textContent=draft?.target>.03?'REBUFO':'IMPULSO DE SALIDA';
  driving.renderGear();
  $('speed').textContent=Math.round(race.speed*3.6);$('gear').textContent=race.gear;$('elapsed').textContent=fmtTime(race.elapsed);$('time-left').textContent=Math.max(0,Math.ceil(race.timeLeft));$('time-left').style.color=race.timeLeft<20?'#ef7955':'';$('checkpoint').textContent=`SECTION 0${race.checkpoints+1} / 04`;
  $('distance').textContent=(Math.min(race.s,track.length)/1000).toFixed(2);const gap=race.s-race.rivalS;$('position').innerHTML=race.mode==='time'?`<span>TIME</span>`:`${gap>=0?'1':'2'}<span>/ 2</span>`;$('advantage').textContent=race.mode==='time'?`DRIFT ${Math.floor(race.driftPoints).toLocaleString()}`:`${gap>=0?'+':'−'}${Math.abs(gap).toFixed(1)} m`;
  $('rpm-bar').style.width=(race.rpm/8500*100)+'%';$('rpm-bar').style.background=race.rpm>7300?'#ef7955':'#e6e2c7';$('rpm-value').textContent=(race.rpm/1000).toFixed(1);$('rpm-needle').style.transform=`rotate(${race.rpm/9000*240}deg)`;
  const count=race.introRemaining>0?'':race.countdown>0?Math.ceil(race.countdown):race.elapsed<.85?'GO!':'';$('countdown').textContent=count;$('countdown').classList.toggle('go',count==='GO!');
  if(race.countdown>0&&count&&count!==lastCount){lastCount=count;if(sound.ctx)sound.note(440,sound.ctx.currentTime,.08,.07,'sine');}if(count==='GO!'&&lastCount!==0){lastCount=0;if(sound.ctx)sound.note(880,sound.ctx.currentTime,.18,.1,'sine');}
  $('drift-display').classList.toggle('hidden',race.combo<35);$('drift-score').textContent=Math.floor(race.combo).toLocaleString();
  if(race.eventKind==='trial'){$('position').textContent='TIME';$('advantage').textContent='META '+fmtTime(race.targetTime);}
  if(race.eventKind==='grid'){
    $('position').textContent=race.place+' / '+race.fieldSize;
    $('advantage').textContent='VUELTA '+Math.min(race.laps,Math.floor(race.s/track.length)+1)+' / '+race.laps;
    $('distance').textContent=(Math.min(race.s,race.finishDistance)/1000).toFixed(2);
    $('checkpoint').textContent='SECTOR '+(race.checkpoints%4+1)+' / 4';
  }
  if(race.online)onlineHud();skillHud();drawMinimap();
}
function drawMinimap(){drawNavigation($('minimap'),track,race);}
function finish(){sealReplay();if(race.campaignStage){finishCampaign();return;}showScreen('results');sound.update(race,false);const champion=race.mode==='arcade'&&race.won&&settings.track===TRACKS.length-1;$('result-eyebrow').textContent=champion?'ARCADE ALL CLEAR':race.won?'DUEL COMPLETE':race.rivalFinished?'RIVAL FINISHED':'TIME OVER';$('results-title').innerHTML=champion?'LEYENDA DEL <em>TOUGE.</em>':race.won?'NOCHE <em>PERFECTA.</em>':'UNA CURVA <em>MÁS.</em>';$('result-message').textContent=champion?'Takumi, Keisuke, Kogashiwa, Mako, God Hand, Shinji y Kanata: ruta completa.':race.won?(race.mode==='time'?'Descenso completado. Busca tu mejor trazada.':`Has vencido a ${race.rival.name}. ${race.mode==='arcade'?'El siguiente rival te espera.':'Esta noche, la montaña fue tuya.'}`):race.rivalFinished?`${race.rival.name} cruzó la meta primero. Afina las frenadas y vuelve a desafiarlo.`:'Se agotó el tiempo. Busca los puntos de control.';$('result-time').textContent=fmtTime(race.elapsed);$('result-drift').textContent=Math.floor(race.driftPoints).toLocaleString();$('result-apex').textContent=Math.floor(race.skill.points).toLocaleString();$('result-best').textContent='VERIFICANDO…';$('next-arcade').classList.toggle('hidden',race.mode!=='arcade'||!race.won);$('next-arcade-label').textContent=champion?'RUTA COMPLETADA':`SIGUIENTE / ${TRACKS[Math.min(6,settings.track+1)].name}`;openModal('results');saveRun(race);}
function lockResult(r,locked){
  r.awaitingRecord=locked;
  const panel=$('results-panel');
  panel.classList.toggle('record-pending',locked);
  for(const button of panel.querySelectorAll('[data-action]'))button.disabled=locked||
    (button.dataset.action==='next'&&!(r.savedRecord?.won??r.won))||
    (button.dataset.action==='replay'&&!r.watchReplay?.duration);
}
async function saveRun(r){
  if(!r.attempt||r.saving)return;
  r.saving=true;
  if(race===r){
    lockResult(r,true);$('retry-record').classList.add('hidden');
    $('record-save-status').textContent='Verificando tu conducción y guardando tu marca…';$('record-save-status').focus();
  }
  try{
    const saved=await account.request('/api/runs/finish',{method:'POST',body:JSON.stringify({id:r.attempt,frames:r.recorder.frames})});
    r.savedRecord=saved;account.accept({user:saved.user});
    if(race!==r)return;
    $('result-reward').textContent=r.campaignStage?(saved.completed&&saved.won?
      '◈ +'+saved.reward.coins+' MONEDAS':'Supera el objetivo para desbloquear el siguiente evento.'):'';
    $('result-time').textContent=fmtTime(saved.time);$('result-best').textContent=saved.personalBest?fmtTime(saved.personalBest):'—';
    $('record-save-status').textContent=saved.completed?'Marca verificada y guardada en tu licencia.':'Puntuación verificada y guardada. Completa el recorrido para registrar un tiempo.';
    lockResult(r,false);
    $('results-panel').querySelector('button:not(.hidden):not(:disabled)')?.focus();
    if(r.campaignStage&&saved.won&&saved.completed&&!r.endingShown){r.endingShown=true;progression.ending(r.campaignStage);}
  }catch(error){
    if(race!==r)return;
    $('record-save-status').textContent='Guardado pendiente. '+error.message;
    $('retry-record').classList.remove('hidden');$('retry-record').focus();$('result-best').textContent='PENDIENTE';
  }finally{r.saving=false;}
}
$('retry-record').onclick=()=>race&&saveRun(race);

let previous=performance.now(),accumulator=0,hudTimer=0;
function prepareCampaign(stage){if(race?.awaitingRecord)return false;if(net?.room){toast('Sal de la sala online antes de iniciar la campaña.');return false;}currentCampaign=stage.id;closeModal();sound.stop();sound.update(race,false);race=null;keys.clear();driving.clear();showScreen('campaign');return true;}
function finishCampaign(){
  showScreen('results');sound.stop();sound.update(race,false);
  const stage=campaignEvent(race.campaignStage),next=progression.nextStage(stage.id),reached=race.s>=race.finishDistance;
  $('result-eyebrow').textContent=(stage.season==='ngplus'?'NG+ / ':stage.season==='rain'?'TEMPORADA LLUVIOSA / ':'')+stage.chapter.toUpperCase();
  $('results-title').textContent=race.won?'EVENTO SUPERADO.':stage.kind==='trial'?'SIGUE BUSCANDO TU MARCA.':'VUELVE AL VÉRTICE.';
  $('result-message').textContent=stage.kind==='trial'?'Marca exigida '+fmtTime(race.targetTime):
    stage.kind==='grid'?(reached?'Posición final '+race.place+' de '+race.fieldSize:'Tiempo agotado.'):
    race.won?'Has vencido a '+stage.name+'.':stage.name+' cruzó primero.';
  $('result-time').textContent=fmtTime(race.elapsed);$('result-drift').textContent=Math.floor(race.driftPoints).toLocaleString();
  $('result-apex').textContent=Math.floor(race.skill.points).toLocaleString();$('result-best').textContent='VERIFICANDO…';
  $('result-reward').textContent='';$('next-arcade').classList.toggle('hidden',!race.won);$('next-arcade').disabled=true;
  $('next-arcade-label').textContent=next?'SIGUIENTE / '+next.short:'VOLVER AL MAPA';
  openModal('results');saveRun(race);
}
function restoreSoloScene(){track=makeTrack(TRACKS[settings.track]);renderer.setTrack(track);renderer.setCar(ownedCar());updateSceneLabels();}
function onlineHud(){
  const players=[...(race.netPlayers||[])].sort((a,b)=>(a.dnf?1:0)-(b.dnf?1:0)||(a.place??99)-(b.place??99)||b.state.s-a.state.s),position=players.findIndex(p=>p.id===net.id)+1;
  $('position').textContent=`${position||1} / ${net.room?.players.length||2}`;$('race-mode-label').textContent='ONLINE / '+(net.room?.code||'');
  const leader=players.find(p=>!p.dnf),following=players.find(p=>p.id!==net.id&&!p.dnf),gap=leader?.id===net.id?race.s-(following?.state.s??race.s):(leader?.state.s??race.s)-race.s;
  $('advantage').textContent=race.netDnf?'RETIRADO':race.netFinished?'META / ESPERANDO':leader?`${leader.id===net.id?'+':'−'}${Math.abs(gap).toFixed(1)} m`:'';
  $('online-standings').replaceChildren();const caption=document.createElement('small');caption.textContent=net.room?.transport==='direct'?net.directLabel:`SERVIDOR · ${Math.round(net.latency)} ms`;$('online-standings').append(caption);
  players.forEach((p,i)=>{const row=document.createElement('div');row.className=p.id===net.id?'you':'';const place=document.createElement('span'),name=document.createElement('b'),state=document.createElement('span');place.textContent=String(i+1).padStart(2,'0');name.textContent=p.name;state.textContent=p.dnf?'DNF':p.place?'META':CARS.find(c=>c.id===p.car)?.code;row.append(place,name,state);$('online-standings').append(row);});
}
let onlineLoadedRun=null;
function prepareOnlineScene(room){
  track=makeTrack(TRACKS.find(t=>t.id===room.config.track));
  const me=room.players.find(p=>p.id===net.id),car=CARS.find(c=>c.id===me.car);
  race=createRace(car,track,{mode:'time',manual:!!me.manual,build:me.build,night:room.config.night,wet:room.config.wet});
  race.online=true;race.transmissionMode=me.manual?(driving.choice==='auto'?'sequential':driving.choice):'auto';race.netPlayers=[];race.netOpponents=[];net.lights=true;
  const grid=room.players.map((driver,i)=>({id:driver.id,carId:driver.car,s:24-Math.floor(i/2)*7,lateral:i%2?2:-2,yaw:0,headlights:true}));
  const position=grid.find(driver=>driver.id===net.id);
  race.s=position.s;race.lateral=position.lateral;race.gridPreview=grid.filter(driver=>driver!==position);
  renderer.setTrack(track);renderer.setCar(race.car);document.querySelector('.driver-card.rival').classList.remove('hidden');renderer.setNetworkPlayers(room.players);renderer.particles=[];
}
async function loadOnline(room){
  // Let the loading screen paint before generating the road and GPU buffers.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(net.room?.runId!==room.runId||net.room.phase!=='loading')return;
  prepareOnlineScene(room);
  const models=Promise.all([...new Set(room.players.map(p=>p.car))].map(id=>renderer.vehicleModels.load(id)));
  // The game already has lightweight fallback meshes if a GLB takes longer.
  let deadline;
  try{await Promise.race([models,new Promise(resolve=>{deadline=setTimeout(resolve,4500);})]);}
  finally{clearTimeout(deadline);}
  if(net.room?.runId===room.runId&&net.room.phase==='loading')onlineLoadedRun=room.runId;
}
function startOnline(room){
  closeModal();keys.clear();driving.clear();sound.ensure();
  if(!onlineLoadedRun||onlineLoadedRun!==room.runId)prepareOnlineScene(room);
  onlineLoadedRun=null;
  race.watchReplay=new RaceReplay(race);race.replaySong=chosenSong();showScreen('race');sound.play(chosenSong());
  const rivals=room.players.filter(p=>p.id!==net.id).map(p=>({...p,portrait:p.portraitUrl}));
  $('track-hud-name').textContent=track.name;$('total-distance').textContent=(track.length/1000).toFixed(2);
  $('transmission-label').textContent=race.manual?'MT':'AT';
  prepareRaceHud(rivals);
  if(room.introSeconds>0){race.countdown=3+room.introSeconds;showRaceIntro(rivals,room.introSeconds);}
  hud();
}
function onlineResults(results){
  if(!race?.online)return;sealReplay();closeModal();showScreen('results');sound.update(race,false);$('online-result-board').replaceChildren();
  for(const p of results){const row=document.createElement('div'),place=document.createElement('em'),name=document.createElement('b'),time=document.createElement('span');place.textContent=p.dnf?'—':String(p.place).padStart(2,'0');name.textContent=p.name+(p.id===net.id?' · TÚ':'');time.textContent=p.dnf?'DNF':fmtTime(p.time);row.append(place,name,time);$('online-result-board').append(row);}
  updateRematch();openModal('online-results');
}
function updateRematch(){const host=net?.room?.hostId===net?.id;$('online-rematch').classList.toggle('hidden',!host);$('online-rematch-note').textContent=host?'Todos deberán confirmar «listo» de nuevo.':'Espera a que el anfitrión abra la revancha o sal de la sala.';}
net=new OnlineClient({
  manual:()=>driving.choice!=='auto',
  getUser:()=>account?.user,requireUser:()=>account?.require(),request:(...args)=>account.request(...args),syncPreferences:()=>account?.preferenceTail,
  onError:message=>{if(race?.online)toast(message);},
  onPreview:id=>{if(screen==='online')renderer.setCar(ownedCar(CARS.find(c=>c.id===id)||CARS[settings.car]));},
  onRoom:room=>{
    if(room.phase==='preparing'||room.phase==='loading'){
      if(screen!=='online-loading'){closeModal();sound.stop();showScreen('online-loading');$('online-loading').focus({preventScroll:true});}
    }else if(room.phase==='lobby'&&(race?.online||screen==='online-loading')){
      closeModal();sound.stop();race=null;onlineLoadedRun=null;keys.clear();driving.clear();restoreSoloScene();showScreen('online');
    }
    if(room.phase==='results')updateRematch();
  },
  activeTrack:()=>track,
  onLoad:loadOnline,
  onStart:startOnline,
  onSnapshot:message=>{if(race?.online){const before=presentationPose(race);net.reconcile(race,track,message);racePresentation.correct(race,before);if(race.resetId!==before.resetId){keys.clear();driving.clear();renderer.resetCamera=true;hud();}}},
  onResults:onlineResults,
  onLeft:message=>{closeModal();sound.stop();sound.update(race,false);race=null;onlineLoadedRun=null;keys.clear();driving.clear();$('online-standings').classList.add('hidden');restoreSoloScene();showScreen('online');if(message)toast(message);}
});
$('online-car').value=CARS[settings.car].id;$('online-track').value=track.id;$('online-night').value=settings.daytime;$('online-wet').value=settings.weather;
let invitation=new URL(location.href).searchParams.get('room');
account=new AccountClient({
  onWelcome:user=>{
    const dialog=$('welcome-dialog');
    dialog.returnValue='';
    $('welcome-heading').textContent=`Te damos la bienvenida, ${user.displayName}`;
    dialog.showModal();
  },
  onUser:user=>{if(!user)return;if(user.onboarded&&user.id!==lastAccountId&&screen!=='title'&&settings.autoFullscreen)requestFullscreen(true);settings.car=Math.max(0,CARS.findIndex(c=>c.id===user.defaultCar));settings.arcadeStage=user.arcadeStage;save();renderer.setCar(ownedCar());drawCarCards();updateSceneLabels();net.refreshIdentity();updateMenuIdentity(user);progression?.setUser(user);workshop?.setUser(user);refreshSongs();if(user.id!==lastAccountId){if(lastAccountId){net.leave();quit();}lastAccountId=user.id;if(screen!=='title')showScreen('menu');}if(invitation&&user.onboarded&&screen!=='title'){$('online-code').value=invitation;invitation=null;net.selectTab('private');showScreen('online');net.status('Invitación recibida. Ingresa con tu licencia y tu coche predeterminado.');}},
  onPreferences:()=>net.refreshIdentity(),onError:toast,onSessionLost:()=>{if(net.room)net.leave();if(screen==='race')pause();},onLogout:()=>{net.leave();quit();lastAccountId=null;}
});
$('welcome-dialog').addEventListener('close',event=>{if(event.currentTarget.returnValue==='options')openModal('settings');});
progression=new ProgressionClient(account,{screen:showScreen,car:ownedCar,garage:()=>workshop.open(CARS[settings.car]),prepare:prepareCampaign,start:()=>startRace(),preview:car=>renderer.setCar(car),songs:allSongs,refreshSongs,selectSong:id=>{const song=allSongs().find(s=>s.id===id);if(song)selectSong(song);},storyPage:file=>{sound.pageAudio.setVolume(sound.muted?0:settings.engineVolume/100);sound.pageAudio.play(file);},storyAudio:song=>{sound.stop();if(song)sound.play(song);},storyStop:()=>sound.stop()});
playMenu=new PlayMenu({openModal,closeModal,active:()=>screen==='play'&&!modal,enter:mode=>mode==='campaign'?progression.openCampaign():mode==='time'?openRaceSetup():showScreen('online')});
ranking=new Ranking(account,{openModal,cars:CARS,config:()=>({track:track.id,name:track.name,night:settings.daytime==='night',wet:settings.weather==='wet',manual:driving.choice!=='auto'})});
workshop=new Workshop(account,{screen:showScreen,active:()=>screen==='workshop',preview:car=>renderer.setCar(car)});
function frame(now){
  const workStart=performance.now();
  const dt=Math.min((now-previous)/1000,.1);previous=now;const input=getInput();
  if(race?.online){
    net.controls(input,race,screen==='race'&&!race.netFinished&&!race.introRemaining);
    const opponents=net.opponents(track);race.netOpponents=opponents.length||!race.introRemaining?opponents:race.gridPreview;
  }
  if(screen==='race'&&race?.introRemaining>0){
    race.introRemaining=Math.max(0,race.online?race.countdown-3:race.introRemaining-dt);
    if(race.introRemaining===0){race.introActive=false;$('race-intro').classList.add('hidden');$('race').classList.remove('intro-active');renderer.resetCamera=true;}
    if(!race.online)accumulator=0;
  }
  if(screen==='race'&&race&&(!race.introRemaining||race.online)){accumulator+=dt;while(accumulator>=PHYSICS_STEP&&!race.finished){racePresentation.beforeStep(race);const controls=race.recorder?race.recorder.capture(race,input):input;if(race.online)net.predict(race,controls,PHYSICS_STEP);else updateRace(race,controls,PHYSICS_STEP);race.watchReplay?.capture(race,PHYSICS_STEP);accumulator-=PHYSICS_STEP;}hudTimer+=dt;if(hudTimer>.05){hud();hudTimer=0;}if(race.finished&&!race.online)finish();}else accumulator=0;
  let visualRace=racePresentation.sample(race,accumulator/PHYSICS_STEP,dt,screen==='race'),replayCamera=null,renderDt=Math.min(dt,.05);
  if(screen==='replay'&&replayPlayer){
    const wasPaused=replayPlayer.paused;
    visualRace=replayPlayer.update(document.hidden?0:dt);
    if(!wasPaused&&replayPlayer.paused)sound.pause();
    replayCamera=replayPlayer.cameraPose(visualRace,renderer.environment);
    $('replay-shot').textContent=replayCamera.label;
    updateReplayControls();renderDt=replayPlayer.paused?0:renderDt*replayPlayer.rate;
  }
  const replayActive=screen==='replay'&&!replayPlayer?.paused&&!document.hidden;
  sound.update(visualRace,replayActive||screen==='race'&&race?.countdown===0&&!race.finished&&!document.hidden,replayActive?{throttle:!visualRace.braking&&visualRace.speed>0,brake:visualRace.braking}:input);
  const introCamera=screen==='race'&&race?.introActive?raceIntroCamera(race,race.introDuration-race.introRemaining):null;
  if(screen!=='campaign'&&screen!=='online-loading')renderer.render(visualRace,screen,renderDt,{day:race?!race.night:settings.daytime==='day',shake:settings.shake,cabinMotion:settings.cabinMotion,cabinFov:settings.cabinFov,cabinHands:settings.cabinHands,stableHorizon:settings.stableHorizon,song:raceSong().name,replayCamera,introCamera});
  else{renderer.cabinActive=false;document.body.classList.remove('cabin-3d');renderer.stats={...renderer.stats,drawCalls:0,vertices:0,mirrorPasses:0};}
  cockpit.draw(visualRace,['race','paused','results'].includes(screen)&&!race?.introRemaining&&renderer.cameraMode===3,Math.min(dt,.05),{song:raceSong().name,gpuMirror:renderer.mirrorReady,time:renderer.time});
  cornerEffects.draw(visualRace,['race','paused','results'].includes(screen),screen==='race'?Math.min(dt,.05):0,settings.shake,renderer.cameraMode===3,renderer.time,renderer.cabinActive?renderer.cabin.mirrorBounds:null);
  if(document.hidden)frameMonitor.reset();else frameMonitor.record(now,performance.now()-workStart,renderer.stats);
  if(now-performanceAt>=250){performanceAt=now;performanceSnapshot=frameMonitor.snapshot();if(settings.autoQuality)renderer.resolutionScale=adaptiveResolution.update(now,performanceSnapshot,screen==='race'&&race?.countdown===0&&!race?.finished);performanceDisplay();}
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{frameMonitor.reset();performanceSnapshot={};adaptiveResolution.last=null;previous=performance.now();accumulator=0;racePresentation.reset(race);});
showScreen('title');
requestAnimationFrame(frame);
// Read-only diagnostics for local QA and performance inspection.
window.touge={get audio(){return sound.driving?.diagnostics||{status:'idle'};},get cabin(){return {active:renderer.cabinActive,status:renderer.cabin.status,error:renderer.cabin.error||null,car:renderer.cabin.car,triangles:renderer.cabin.triangles,draws:renderer.cabin.frameDraws,cache:renderer.cabin.cache.size,pose:renderer.driverCamera.pose?{...renderer.driverCamera.pose}:null};},get models(){return {status:renderer.vehicleModels.status,error:renderer.vehicleModels.error||null,draws:renderer.vehicleModels.draws,assets:[...renderer.vehicleModels.assets.values()].map(a=>({file:a.file,status:a.status,error:a.error||null})),instances:[...renderer.vehicleModels.instances].map(([key,state])=>({key,lod:state.lod,opening:state.opening}))};},get presentation(){const p=racePresentation.lastView;return p?{s:p.s,lateral:p.lateral,yaw:p.yaw,rivalS:p.rivalS,alpha:racePresentation.alpha}:null;},get performance(){return {...performanceSnapshot,automatic:settings.autoQuality,display:settings.performanceDisplay};},get state(){return {screen,modal,car:CARS[settings.car].id,track:track.id,race:race?{s:race.s,speed:race.speed,gear:race.gear,manual:race.manual,wet:race.wet,rematch:race.rematch,countdown:race.countdown,elapsed:race.elapsed,lateral:race.lateral,driftPoints:race.driftPoints,finished:race.finished,focus:structuredClone(race.focus),campaignStage:race.campaignStage,draft:structuredClone(race.draft),build:race.car.build||null,boss:race.boss?structuredClone(race.boss):null,rival:{s:race.rivalS,speed:race.rivalSpeed,yaw:race.rivalYaw,drift:race.rivalDrift,slip:race.rivalSlip}}:null,songs:allSongs().length,vertices:renderer.scene?.count,webgl:!!renderer.gl,menuScene:!!renderer.menuGround,menuCar:renderer.car?.id,showcase:{status:renderer.menuModel?.status||'idle',active:!!renderer.showcaseActive,triangles:renderer.menuModel?.model?.triangles||0,draws:renderer.menuModel?.draws||0,error:renderer.menuModel?.error||null},vehicleBuild:renderer.car?.build||null,vehicleColor:renderer.car?.color};}};
