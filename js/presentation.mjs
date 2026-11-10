// Render-only poses. The 120 Hz simulation, contacts, replays and server state
// never consume these interpolated values.
import {sample as courseSample,roadEdge} from './sim.mjs';
export const PHYSICS_STEP=1/120;
const fields=['s','lateral','yaw','speed','steer','rivalS','rivalLateral','rivalYaw','rivalSpeed','rivalSteer'];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const mix=(a,b,t)=>a+(b-a)*t;
export const angleMix=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export function presentationPose(r,p={}){p.resetId=r.resetId||0;for(const k of fields)p[k]=Number.isFinite(r[k])?r[k]:0;return p;}

export class RacePresentation {
  constructor(){this.race=null;this.view={};this.offset={s:0,lateral:0,yaw:0};}
  reset(r){if(this.race!==r)this.view={};this.race=r;this.previous=r?presentationPose(r):null;this.epoch=r?.resetId||0;this.offset.s=this.offset.lateral=this.offset.yaw=0;this.lastView=r;this.alpha=1;}
  ensure(r){if(this.race!==r||this.epoch!==(r?.resetId||0))this.reset(r);}
  beforeStep(r){this.ensure(r);presentationPose(r,this.previous);}
  correct(r,before){
    if(this.race!==r||this.epoch!==(r.resetId||0)){this.reset(r);return;}
    const ds=r.s-before.s,dl=r.lateral-before.lateral,dy=Math.atan2(Math.sin(r.yaw-before.yaw),Math.cos(r.yaw-before.yaw));
    if(before.resetId!==(r.resetId||0)||r.finished||r.countdown>0||r.collision>.4||Math.abs(ds)>6||Math.abs(dl)>1.25||Math.abs(this.offset.s-ds)>3||Math.abs(this.offset.lateral-dl)>.75||Math.abs(this.offset.yaw-dy)>.35){this.reset(r);return;}
    this.previous.s+=ds;this.previous.lateral+=dl;this.previous.yaw+=dy;
    this.offset.s-=ds;this.offset.lateral-=dl;this.offset.yaw-=dy;
  }
  sample(r,alpha,dt=0,active=true){
    if(!r){if(this.race)this.reset(null);return r;}this.ensure(r);
    if(!active||r.finished){this.reset(r);return r;}
    const v=Object.assign(this.view,r),a=clamp(alpha,0,1),prev=this.previous;this.lastView=v;this.alpha=a;
    for(const k of fields){const current=Number.isFinite(r[k])?r[k]:0;v[k]=k==='yaw'||k==='rivalYaw'?angleMix(prev[k],current,a):mix(prev[k],current,a);}
    v.s+=this.offset.s;v.lateral=clamp(v.lateral+this.offset.lateral,-roadEdge(r.track),roadEdge(r.track));v.yaw+=this.offset.yaw;
    const decay=Math.exp(-Math.max(0,dt)*14);this.offset.s*=decay;this.offset.lateral*=decay;this.offset.yaw*=decay;
    return v;
  }
}

export function remotePoses(frames,at,track=null){
  if(!frames.length)return [];
  let a=frames[0],b=frames.at(-1);
  if(at<=a.received)b=a;
  else if(at>=b.received)a=b;
  else for(let i=1;i<frames.length;i++)if(frames[i].received>=at){a=frames[i-1];b=frames[i];break;}
  const t=b.received>a.received?clamp((at-a.received)/(b.received-a.received),0,1):1;
  return b.players.filter(p=>p.connected&&!p.dnf).map(p=>{
    const current=p.state,prior=a.players.find(v=>v.id===p.id)?.state||current;
    const cut=prior.resetId!==current.resetId||Math.abs(current.s-prior.s)>20||Math.abs(current.lateral-prior.lateral)>6;
    const state=cut&&t<1?prior:current,blend=cut?1:t;
    const view={...p,...state,s:mix(prior.s,state.s,blend),lateral:mix(prior.lateral,state.lateral,blend),yaw:angleMix(prior.yaw,state.yaw,blend),carId:p.car};
    // Fill only a short late-packet gap; then hold instead of inventing motion.
    // An explicit reset, countdown or finish is always shown at the server pose.
    const ahead=clamp((at-b.received)/1000,0,.075);
    if(a===b&&ahead>0&&!current.finished&&!(current.resetHold>0)&&!(current.countdown>0)){
      const curve=track?courseSample(track,current.s).curve:0;
      view.s+=Math.max(0,current.speed||0)*Math.max(.12,Math.cos(current.travelYaw??current.yaw??0))/clamp(1-curve*current.lateral,.65,1.35)*ahead;
      view.lateral=clamp(view.lateral+(current.lateralV||0)*ahead,-roadEdge(track||{width:10.6}),roadEdge(track||{width:10.6}));
    }
    return view;
  });
}
