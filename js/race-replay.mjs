import {angleMix} from './presentation.mjs';
import {worldAt,clamp} from './sim.mjs';

const step=1/30;
const poseFields=['s','lateral','yaw','speed','steer','rpm','elapsed','rivalS','rivalLateral','rivalYaw','rivalSpeed','rivalSteer','drift','collision'];
const angles=new Set(['yaw','rivalYaw']);
const states=['focus','boss','skill','draft'];
function snapshot(race){
  const view={};
  for(const [key,value] of Object.entries(race)){
    if(value===null||['number','string','boolean'].includes(typeof value))view[key]=value;
  }
  for(const key of states)if(race[key])view[key]=structuredClone(race[key]);
  if(race.netOpponents)view.netOpponents=structuredClone(race.netOpponents);
  return view;
}
function blend(a,b,t,fields=poseFields){
  const view={...a};
  for(const key of fields)if(Number.isFinite(a[key])&&Number.isFinite(b[key]))
    view[key]=angles.has(key)?angleMix(a[key],b[key],t):a[key]+(b[key]-a[key])*t;
  return view;
}

// A local recording of the rendered participants, independent of the saved result.
export class RaceReplay {
  constructor(race){
    this.scene={car:race.car,track:race.track,rival:race.rival};
    this.frames=[{at:0,state:snapshot(race)}];
    this.clock=0;this.next=step;this.sealed=false;
  }
  capture(race,dt){
    if(this.sealed)return;
    this.clock+=dt;
    if(this.clock+1e-8<this.next&&!race.finished)return;
    this.frames.push({at:this.clock,state:snapshot(race)});
    this.next=this.clock+step;
    if(race.finished)this.sealed=true;
  }
  finish(race){
    if(this.sealed)return;
    const frame={at:this.clock,state:snapshot(race)};
    if(this.frames.at(-1).at===this.clock)this.frames[this.frames.length-1]=frame;
    else this.frames.push(frame);
    this.sealed=true;
  }
  get duration(){return this.frames.at(-1).at;}
  sample(at){
    at=clamp(at,0,this.duration);
    let lo=0,hi=this.frames.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(this.frames[mid].at<=at)lo=mid;else hi=mid;}
    const a=this.frames[lo],b=this.frames[hi],t=b.at>a.at?clamp((at-a.at)/(b.at-a.at),0,1):0;
    if(t>=1)return {...this.scene,...b.state};
    // Recoveries are cuts. Interpolating through a reset would invent a sideways slide.
    const view=a.state.resetId!==b.state.resetId?{...a.state}:blend(a.state,b.state,t);
    if(a.state.netOpponents)view.netOpponents=a.state.netOpponents.map(prior=>{
      const next=b.state.netOpponents?.find(other=>other.id===prior.id);
      return next&&next.resetId===prior.resetId?blend(prior,next,t):{...prior};
    });
    return {...this.scene,...view};
  }
}

export class ReplayPlayer {
  constructor(clip){this.clip=clip;this.at=0;this.rate=1;this.paused=false;this.camera=0;}
  update(dt){
    if(!this.paused){this.at=Math.min(this.clip.duration,this.at+Math.max(0,dt)*this.rate);if(this.at>=this.clip.duration)this.paused=true;}
    return this.clip.sample(this.at);
  }
  seek(at){this.at=clamp(Number(at)||0,0,this.clip.duration);return this.clip.sample(this.at);}
  cameraPose(race,environment=null){
    const shot=Math.floor(this.at/5),first=this.clip.sample(shot*5),p=worldAt(race.track,race.s,race.lateral);
    const angle=p.heading+race.yaw,target=[p.x,p.y+.85,p.z];
    const lapS=race.track.closed?race.s%race.track.length:race.s;
    if(environment?.tunnels.some(tunnel=>lapS>=tunnel.start&&lapS<=tunnel.end)){
      const q=worldAt(race.track,race.s-7,0);
      return {id:'tunnel',label:'SEGUIMIENTO EN TÚNEL',eye:[q.x,q.y+2,q.z],target,fov:56};
    }
    if(this.camera===1)return {id:'chase',label:'SEGUIMIENTO',eye:[p.x-Math.sin(angle)*8,p.y+2.6,p.z-Math.cos(angle)*8],target,fov:52};
    if(this.camera===2)return {id:'aerial',label:'VISTA AÉREA',eye:[p.x+Math.cos(p.heading)*12,p.y+19,p.z-Math.sin(p.heading)*12],target,fov:55};
    const type=shot%4;
    if(type===2){
      const q=worldAt(race.track,race.s-5,-3.6);
      return {id:'tracking',label:'TRAVELLING',eye:[q.x,q.y+2,q.z],target,fov:60};
    }
    const ahead=clamp(first.speed*1.5+24,28,85),side=shot%2?1:-1;
    // The shoulder is inside the guardrail, clear of generated hillside scenery.
    const anchorS=clamp(first.s+ahead,0,race.finishDistance||race.track.length),anchor=worldAt(race.track,anchorS,side*4.25);
    const headingGap=Math.abs(Math.atan2(Math.sin(anchor.heading-p.heading),Math.cos(anchor.heading-p.heading)));
    if(Math.abs(anchorS-race.s)>65||headingGap>.65){
      const q=worldAt(race.track,race.s-7,side*3.8);
      return {id:'corner-'+shot,label:'SEGUIMIENTO DE CURVA',eye:[q.x,q.y+3.5,q.z],target,fov:56};
    }
    const height=type===3?6:2.2,distance=Math.hypot(anchor.x-p.x,anchor.z-p.z);
    return {id:'trackside-'+shot,label:type===3?'PANORÁMICA':'CÁMARA DE TRAMO',eye:[anchor.x,anchor.y+height,anchor.z],
      target,fov:clamp(20+100/Math.max(3,distance),24,65)};
  }
}
