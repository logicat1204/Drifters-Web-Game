import {randomUUID} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {CARS,TRACKS,createRace,makeTrack,updateRace,repositionRace} from '../js/sim.mjs';
import {activateFocus} from '../js/focus.mjs';
export class Runs {
  constructor(store,{now=()=>Date.now()}={}){this.store=store;this.now=now;this.pending=new Map();this.busy=0;}
  start(userId,data){
    for(const [id,run] of this.pending)if(this.now()-run.created>2*60*60*1000)this.pending.delete(id);
    for(const [id,run] of this.pending)if(run.userId===userId&&!run.busy)this.pending.delete(id);
    const car=CARS.find(c=>c.id===data.car),track=TRACKS.find(t=>t.id===data.track);
    if(!car||!track||!['time','battle','arcade'].includes(data.mode)||!['easy','normal','hard'].includes(data.difficulty))throw Error('Configuración de carrera inválida.');
    const options={mode:data.mode,difficulty:data.difficulty,manual:data.manual===true,wet:data.wet===true,night:data.night!==false},id=randomUUID();
    this.pending.set(id,{userId,car,track,options,created:this.now(),busy:false});return {id};
  }
  async submit(userId,id,frames){
    const existing=this.store.runResult(id,userId);if(existing)return existing;
    const attempt=this.pending.get(id);if(!attempt||attempt.userId!==userId)throw Object.assign(Error('La carrera no existe, caducó o pertenece a otro piloto.'),{status:404});
    if(attempt.busy||this.busy>=2)throw Object.assign(Error('El servidor está verificando carreras. Intenta guardar de nuevo en unos segundos.'),{status:429});
    if(!Array.isArray(frames)||frames.length===0||frames.length>108400)throw Error('Registro de controles inválido.');
    let ticks=0;for(const f of frames){if(!Array.isArray(f)||f.length!==5||!Number.isInteger(f[0])||f[0]<1||f[0]>108400||!Number.isFinite(f[1])||f[1]<-1||f[1]>1||!Number.isInteger(f[2])||f[2]<0||f[2]>15||!Number.isInteger(f[3])||f[3]<1||f[3]>5||!Number.isInteger(f[4])||f[4]<0||f[4]>3||f[4]&&f[0]!==1)throw Error('Registro de controles inválido.');ticks+=f[0];}if(ticks>108400)throw Error('Carrera demasiado larga.');
    attempt.busy=true;this.busy++;try{
      const r=createRace(attempt.car,makeTrack(attempt.track),attempt.options);let steps=0;
      for(const [n,steer,flags,gear,actions] of frames){
        if(r.finished)throw Error('Hay controles posteriores a la meta.');
        if(actions&1&&!activateFocus(r))throw Error('Activación de concentración inválida.');if(actions&2&&!repositionRace(r))throw Error('Recuperación inválida.');
        r.headlights=!!(flags&8);if(r.manual)r.gear=gear;
        for(let i=0;i<n;i++){if(r.finished)throw Error('Hay controles posteriores a la meta.');updateRace(r,{steer,throttle:!!(flags&1),brake:!!(flags&2),handbrake:!!(flags&4)},1/120);if(++steps%6000===0)await setImmediate();}
      }
      if(!r.finished)throw Error('El descenso no terminó.');
      if(this.now()-attempt.created+2000<r.elapsed*1000)throw Error('El tiempo de carrera no corresponde al reloj del servidor.');
      const saved=this.store.addRun(id,userId,r);this.pending.delete(id);return saved;
    }finally{attempt.busy=false;this.busy--;}
  }
}
