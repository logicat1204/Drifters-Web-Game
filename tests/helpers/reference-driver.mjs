import {CARS,makeTrack,createRace,updateRace,sample,steeringAngle,lateralGrip,clamp} from '../../js/sim.mjs';

export function driverInput(r,{brake=true,attack=true,avoidRival=true,handbrake=false}={}){
  const v=r.speed,p=sample(r.track,r.s),base=lateralGrip(r.car,r.wet);
  let target=r.car.max;
  if(brake)for(let distance=0;distance<=210;distance+=10){
    const bend=Math.abs(sample(r.track,r.s+distance).curve),safe=Math.sqrt(base*(attack?.80:.62)/Math.max(.0001,bend));
    target=Math.min(target,Math.sqrt(safe*safe+2*14*distance));
  }
  if(!attack)target=Math.min(target,48);
  const braking=brake&&v>target+.25,throttle=!braking&&v<target+.05;
  const gap=r.rivalS-r.s,lane=avoidRival&&r.mode!=='time'&&gap>-15&&gap<80?(r.rivalLateral>=0?-2.65:2.65):0;
  const desiredTravel=clamp(-(r.lateral-lane)*.065,-.22,.22);
  const roadRate=p.curve*v*Math.cos(r.travelYaw)/clamp(1-p.curve*r.lateral,.65,1.35);
  const travelRate=roadRate+(desiredTravel-r.travelYaw)*3.3;
  const alignment=(braking&&Math.abs(r.steer)>.32?6.2:9.5)*(1-r.driftAssist*.28);
  const desiredBody=r.travelYaw+travelRate/alignment;
  const bodyRate=roadRate+(desiredBody-r.yaw)*9;
  const wheelbase=r.car.id==='r32'?2.62:r.car.id==='rx7'?2.43:2.4;
  const steer=-clamp(Math.atan(bodyRate*wheelbase/Math.max(v,2))/steeringAngle(v),-1,1);
  return {steer,throttle,brake:braking,handbrake};
}
export function referenceDrive(cfg,{car=CARS[0],difficulty='normal',attack=true,brake=true,mode='battle',wet=false}={}){
  const track=makeTrack(cfg),r=createRace(car,track,{mode,difficulty,wet});r.countdown=0;r.lateral=0;r.timeLeft=1000;
  let impacts=0,brakingFrames=0;
  for(let i=0;i<120*900&&!r.finished;i++){
    const input=driverInput(r,{attack,brake});if(input.brake)brakingFrames++;
    const cooldown=r.wallCooldown;updateRace(r,input,1/120);if(r.wallCooldown>cooldown+.1)impacts++;
  }
  return {race:r,impacts,brakingFrames};
}
