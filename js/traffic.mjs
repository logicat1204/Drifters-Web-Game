import {cancelFocus} from './focus.mjs';

export const SLIPSTREAM=Object.freeze({minGap:5,maxGap:48,minSpeed:20,width:1.65,build:2.2,fade:1.6,dragReduction:.65,topSpeed:.05});
export const CONTACT=Object.freeze({length:4.2,width:1.78,cooldown:.65});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
export const createDraft=()=>({strength:0,target:0,distance:0});
export const draftSpeedMultiplier=r=>1+(r.draft?.strength||0)*SLIPSTREAM.topSpeed;
export function clearDraft(r){Object.assign(r.draft||(r.draft=createDraft()),{strength:0,target:0,distance:0});}
// Immutable poses let every driver read the same start-of-tick traffic online.
export function vehiclePose(r){return {s:r.s,lateral:r.lateral,speed:r.speed,yaw:r.yaw,travelYaw:r.travelYaw,finished:r.finished,countdown:r.countdown,resetHold:r.resetHold};}
export function updateSlipstream(r,others,dt,worldAt){
 const d=r.draft||(r.draft=createDraft());
 if(r.finished||r.countdown>0||r.resetHold>0||r.collision>0||r.wallTouch>0||r.speed<SLIPSTREAM.minSpeed){clearDraft(r);return;}
 const p=worldAt(r.track,r.s,r.lateral),heading=p.heading+r.travelYaw;let best=0,distance=0;
 for(const o of others){
  const gap=o.s-r.s;if(o.finished||o.countdown>0||o.resetHold>0||o.speed<SLIPSTREAM.minSpeed||gap<SLIPSTREAM.minGap||gap>SLIPSTREAM.maxGap)continue;
  const q=worldAt(r.track,o.s,o.lateral),forward=q.heading+(o.travelYaw||0),dx=p.x-q.x,dz=p.z-q.z;
  const behind=-(dx*Math.sin(forward)+dz*Math.cos(forward)),across=Math.abs(dx*Math.cos(forward)-dz*Math.sin(forward));
  // A wake follows the leader's actual motion, not another leg of a hairpin.
  if(behind<SLIPSTREAM.minGap||behind>SLIPSTREAM.maxGap||across>SLIPSTREAM.width||Math.abs(p.y-q.y)>7)continue;
  const alignment=clamp(1-Math.abs(angle(heading-forward))/.32,0,1),centering=clamp(1-(across/SLIPSTREAM.width)**2,0,1);
  const near=clamp((behind-SLIPSTREAM.minGap)/3,0,1),far=clamp((SLIPSTREAM.maxGap-behind)/28,0,1),speed=clamp((Math.min(r.speed,o.speed)-SLIPSTREAM.minSpeed)/15,0,1);
  const strength=near*far*centering*alignment*speed;if(strength>best){best=strength;distance=gap;}
 }
 d.target=best;d.distance=distance;d.strength+=(best-d.strength)*(1-Math.exp(-dt*(best>d.strength?SLIPSTREAM.build:SLIPSTREAM.fade)));
 if(d.strength<.001)d.strength=0;
}

// Continuous separation is independent of the impact cooldown. Cooldown limits
// repeated penalties only; it never permits driving through the other vehicle.
export function resolveVehicleContact(a,b,previousA=vehiclePose(a),previousB=vehiclePose(b)){
 if(a.countdown>0||b.countdown>0||a.resetHold>0||b.resetHold>0||(a.finished&&previousA.finished)||(b.finished&&previousB.finished))return false;
 const gap=a.s-b.s,oldGap=previousA.s-previousB.s,lateral=a.lateral-b.lateral;
 const swept=Math.abs(oldGap)>=CONTACT.length&&Math.sign(oldGap)!==Math.sign(gap);
 if((Math.abs(gap)>=CONTACT.length&&!swept)||Math.abs(lateral)>=CONTACT.width)return false;
 const fresh=(a.contactCooldown||0)<=0&&(b.contactCooldown||0)<=0;
 const rearEnd=Math.abs(oldGap)>=CONTACT.length||Math.abs(gap)>=2;
 if(rearEnd){
  const aLeads=Math.abs(oldGap)>=CONTACT.length?oldGap>0:gap>=0,front=aLeads?a:b,rear=aLeads?b:a;
  const closing=Math.max(0,rear.speed-front.speed);
  rear.s=Math.min(rear.s,front.s-CONTACT.length-.001);
  if(fresh){rear.speed*=1-clamp(.04+closing*.008,.04,.25);front.speed*=1-clamp(closing*.001,0,.025);}
  rear.speed=Math.min(rear.speed,Math.max(0,front.speed-.05));
 }else{
  const direction=lateral===0?1:Math.sign(lateral),edge=Math.min(a.track.width/2-.7,b.track.width/2-.7,4.6);
  const overlap=CONTACT.width-Math.abs(lateral)+.002;
  const moveA=Math.min(overlap/2,edge-direction*a.lateral),moveB=Math.min(overlap-moveA,edge+direction*b.lateral);
  a.lateral=clamp(a.lateral+direction*(overlap-moveB),-edge,edge);b.lateral=clamp(b.lateral-direction*moveB,-edge,edge);
  if(fresh){a.speed*=.96;b.speed*=.96;}
 }
 if(fresh){a.contactCooldown=b.contactCooldown=CONTACT.cooldown;a.collision=b.collision=.55;cancelFocus(a);cancelFocus(b);}
 clearDraft(a);clearDraft(b);
 for(const r of [a,b])if(r.finished&&r.s<(r.finishDistance||r.track.length)&&r.timeLeft>0){r.finished=false;r.won=false;}
 return true;
}
