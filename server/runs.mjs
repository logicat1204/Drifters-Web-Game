import {randomUUID} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {ALL_CARS as CARS,ALL_TRACKS as TRACKS,campaignRivalStart,createRace,makeTrack,updateRace,repositionRace} from '../js/sim.mjs';
import {activateFocus} from '../js/focus.mjs';
import {campaignStage,stageAvailable,CAMPAIGN_CHAPTERS,campaignConditions} from '../js/campaign.mjs';
import {campaignEvent,eventAvailable} from '../js/campaign-events.mjs';
import {stockBuild,campaignPreparationIssue} from '../js/tuning.mjs';
import {CampaignTargets} from './campaign-targets.mjs';
import {calibrateRival,calibrationTrack} from './rival-calibration.mjs';
export class Runs {
  constructor(store,{now=()=>Date.now(),targets=new CampaignTargets()}={}){this.store=store;this.now=now;this.targets=targets;this.pending=new Map();this.starting=new Set();this.busy=0;}
  start(userId,data){
    if(this.starting.has(userId))throw Object.assign(Error('Se está preparando tu carrera.'),{status:409});
    const user=this.store.user(userId);
    const attempt=this.store.remote?user.then(pilot=>this.prepareStart(userId,data,pilot)):this.prepareStart(userId,data,user);
    if(!(attempt instanceof Promise))return attempt;
    this.starting.add(userId);
    return attempt.finally(()=>this.starting.delete(userId));
  }
  prepareStart(userId,data,user){
    for(const [id,run] of this.pending)if(this.now()-run.created>2*60*60*1000)this.pending.delete(id);
    for(const [id,run] of this.pending)if(run.userId===userId&&!run.busy)this.pending.delete(id);
    const eventRules=data.campaignRules===true,lookup=eventRules?campaignEvent:campaignStage,available=eventRules?eventAvailable:stageAvailable;
    const stage=data.mode==='campaign'?lookup(data.campaignStage):null;
    if(data.mode==='campaign'&&!available(stage,user.campaign.map(s=>s.id)))throw Error('Nivel de campaña bloqueado.');
    const car=CARS.find(c=>c.id===data.car),track=TRACKS.find(t=>t.id===(stage?.track||data.track));
    if(!car||!user.cars.includes(car.id)||!track||!['time','battle','arcade','campaign'].includes(data.mode))throw Error('Configuración de carrera inválida o coche no comprado.');
    const preparationIssue=campaignPreparationIssue(stage,car,user.garage[car.id]?.build||stockBuild());
    if(preparationIssue)throw Error(preparationIssue);
    const chapter=stage?CAMPAIGN_CHAPTERS.find(c=>c.id===stage.chapter):null;
    const conditions=stage?campaignConditions(stage):null,rematch=!!conditions?.rematch;
    const driver=(rival,index)=>{
      const details={...(eventRules?this.targets.rival(stage,rival):rival),code:CARS.find(c=>c.id===rival.car).code};
      if(details.targetTimeSec==null)return details;
      const {s,lateral}=campaignRivalStart(index);
      return calibrateRival(calibrationTrack(track),details,{wet:conditions.wet,laps:stage.laps||1,startS:s,lane:lateral});
    };
    const register=raceEvent=>{
      const options={build:user.garage[car.id]?.build||stockBuild(),mode:data.mode,manual:data.manual===true,wet:stage?conditions.wet:data.wet===true,night:stage?conditions.night:data.night!==false,focusType:user.focusType,focusEnabled:user.focusUnlocked.includes(user.focusType),
        ...(stage?{campaignStage:stage.id,rematch,fog:!!chapter.fog,eventKind:stage.kind,campaignRules:eventRules,...raceEvent}:{})},id=randomUUID();
      this.pending.set(id,{userId,car,track,options,created:this.now(),busy:false});return {id,track:track.id,options};
    };
    if(!stage)return register({});
    if(stage.kind==='trial')return register({targetTime:this.targets.trial(stage,track.length)});
    if(stage.kind==='grid'){
      const rivals=stage.rivals.map(driver);
      const grid=resolved=>register({rivals:resolved,laps:stage.laps});
      return rivals.some(rival=>rival instanceof Promise)?Promise.all(rivals).then(grid):grid(rivals);
    }
    const rival=driver(stage);
    return rival instanceof Promise?rival.then(resolved=>register({rival:resolved})):register({rival});
  }
  async submit(userId,id,frames){
    const existing=await this.store.runResult(id,userId);if(existing)return existing;
    const attempt=this.pending.get(id);if(!attempt||attempt.userId!==userId)throw Object.assign(Error('La carrera no existe, caducó o pertenece a otro piloto.'),{status:404});
    if(attempt.busy||this.busy>=2)throw Object.assign(Error('El servidor está verificando carreras. Intenta guardar de nuevo en unos segundos.'),{status:429});
    if(!Array.isArray(frames)||frames.length===0||frames.length>108400)throw Error('Registro de controles inválido.');
    let ticks=0;for(const f of frames){if(!Array.isArray(f)||f.length!==5||!Number.isInteger(f[0])||f[0]<1||f[0]>108400||!Number.isFinite(f[1])||f[1]<-1||f[1]>1||!Number.isInteger(f[2])||f[2]<0||f[2]>15||!Number.isInteger(f[3])||f[3]<1||f[3]>5||!Number.isInteger(f[4])||f[4]<0||f[4]>3||f[4]&&f[0]!==1)throw Error('Registro de controles inválido.');ticks+=f[0];}if(ticks>108400)throw Error('Carrera demasiado larga.');
    const isGrid=attempt.options.eventKind==='grid',logGrid=isGrid&&process.env.NODE_ENV==='production';
    const started=performance.now();let phase='verification';
    attempt.busy=true;this.busy++;try{
      if(logGrid)console.info('[race-save] verifying grid',{event:attempt.options.campaignStage,ticks});
      const track=isGrid?calibrationTrack(attempt.track):makeTrack(attempt.track);
      const r=createRace(attempt.car,track,attempt.options);let steps=0,sliceStart=performance.now();
      for(const [n,steer,flags,gear,actions] of frames){
        if(r.finished)throw Error('Hay controles posteriores a la meta.');
        if(actions&1&&!activateFocus(r))throw Error('Activación de concentración inválida.');if(actions&2&&!repositionRace(r))throw Error('Recuperación inválida.');
        r.headlights=!!(flags&8);if(r.manual)r.gear=gear;
        const input={steer,throttle:!!(flags&1),brake:!!(flags&2),handbrake:!!(flags&4)};
        for(let i=0;i<n;i++){
          if(r.finished)throw Error('Hay controles posteriores a la meta.');
          updateRace(r,input,1/120);
          if(++steps%256===0&&performance.now()-sliceStart>=12){await setImmediate();sliceStart=performance.now();}
        }
      }
      if(!r.finished)throw Error('El descenso no terminó.');
      if(this.now()-attempt.created+2000<r.elapsed*1000)throw Error('El tiempo de carrera no corresponde al reloj del servidor.');
      phase='database';
      if(logGrid)console.info('[race-save] writing grid',{event:attempt.options.campaignStage,simulationMs:Math.round(performance.now()-started)});
      const saved=await this.store.addRun(id,userId,r);this.pending.delete(id);
      if(logGrid)console.info('[race-save] saved grid',{event:attempt.options.campaignStage,totalMs:Math.round(performance.now()-started)});
      return saved;
    }catch(error){
      if(logGrid)console.warn('[race-save] grid failed',{event:attempt.options.campaignStage,phase,
        error:error.name,code:typeof error.code==='number'?error.code:undefined});
      throw error;
    }finally{attempt.busy=false;this.busy--;}
  }
}
