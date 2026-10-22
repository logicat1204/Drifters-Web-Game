import {cornerQuality} from './skill.mjs';

export const FOCUS=Object.freeze({capacity:100,minimum:30,maxDuration:5,rechargeRate:6,cooldown:3,grip:1.22,topSpeed:1.06,acceleration:1.10});
export function createFocus(){return {charge:0,remaining:0,duration:0,cooldown:0,activations:0};}
export function activateFocus(r){
  const f=r.focus;
  if(!f||r.finished||r.countdown>0||r.resetHold>0||r.collision>0||r.wallTouch>0||f.remaining>0||f.cooldown>0||f.charge<FOCUS.minimum)return false;
  f.duration=FOCUS.maxDuration*Math.min(1,f.charge/FOCUS.capacity);f.remaining=f.duration;f.charge=0;f.activations++;return true;
}
export function cancelFocus(r){if(r.focus?.remaining>0){r.focus.remaining=0;r.focus.cooldown=FOCUS.cooldown;}}
export function updateFocus(r,dt,curve,grip){
  const f=r.focus;if(!f)return;
  if(r.collision>0||r.resetHold>0){cancelFocus(r);return;}
  if(f.remaining>0){f.remaining=Math.max(0,f.remaining-dt);if(f.remaining===0)f.cooldown=FOCUS.cooldown;return;}
  if(f.cooldown>0){f.cooldown=Math.max(0,f.cooldown-dt);return;}
  const quality=cornerQuality({curve,grip,speed:r.speed,lateral:r.lateral,slipAngle:r.slipAngle,travelYaw:r.travelYaw,collision:r.collision});
  f.charge=Math.min(FOCUS.capacity,f.charge+dt*FOCUS.rechargeRate*quality);
}
