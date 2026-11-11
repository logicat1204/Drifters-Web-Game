import {draftSpeedMultiplier,CONTACT,SLIPSTREAM} from './traffic.mjs';
// Fixed per-rival levels. There is no player-selectable easy/normal/hard modifier.
export const AI_LEVELS=Object.freeze([
  null,
  {grip:.63,speed:.85,response:3.2,slip:.09},
  {grip:.69,speed:.90,response:3.5,slip:.13},
  {grip:.75,speed:.94,response:3.8,slip:.17},
  {grip:.81,speed:.98,response:4.1,slip:.21},
  {grip:.87,speed:1,response:4.4,slip:.25}
]);
export const AI_STYLES={
  Grip:{corner:.88,preview:260,brakePlan:10.5,line:.5},
  Complete:{corner:.95,preview:225,brakePlan:13.5,line:.45},
  Skiller:{corner:.99,preview:200,brakePlan:15,line:.65}
};
export function rivalLevel(rival){return Math.max(1,Math.min(5,Math.round(rival.level||3)));}
export function rivalStyle(rival){return AI_STYLES[rival.style]?rival.style:'Complete';}
export const PASSING=Object.freeze({clearance:CONTACT.width+.72,minimumClearance:CONTACT.width+.37,mergeGap:11,followingGap:8,laneLimit:3.6,laneRate:2.4});
export const TRAFFIC_LEVELS=Object.freeze([
  null,
  {gap:8,commit:.85,reaction:.72,prediction:.45,margin:.37,reserve:.88,laneRate:2.0},
  {gap:7.4,commit:1.0,reaction:.64,prediction:.40,margin:.34,reserve:.89,laneRate:2.2},
  {gap:6.7,commit:1.15,reaction:.56,prediction:.34,margin:.30,reserve:.90,laneRate:2.4},
  {gap:6.1,commit:1.35,reaction:.46,prediction:.26,margin:.26,reserve:.92,laneRate:2.6},
  {gap:5.6,commit:1.55,reaction:.38,prediction:.20,margin:.22,reserve:.94,laneRate:2.8}
]);
export const CRIMSON_TRAFFIC=Object.freeze({gap:5.1,commit:1.7,reaction:.32,prediction:.16,margin:.18,reserve:.96,laneRate:3.0});
export function trafficBehavior(r,o){return r.boss?.id==='kanata-final'&&r.boss.enraged?CRIMSON_TRAFFIC:TRAFFIC_LEVELS[o.aiDriver?.level||rivalLevel(r.rival)];}
export function createAIDriver(rival){return {style:rivalStyle(rival),level:rivalLevel(rival),slide:0,slip:0,brake:0,throttle:0,pedal:0,targetSlope:0,counter:null,targetSpeed:0,passing:{phase:'cruise',side:0,lane:0,switchCooldown:0,yielding:false,commitRemaining:0,contesting:false,blockedTime:0,feints:0}};}
export function planRivalTraffic(r,o,dt,normalLine,target,{sample,clamp}){
  const state=o.aiDriver.passing,behavior=trafficBehavior(r,o),distance=r.s-o.s,closing=o.speed-r.speed;
  const limit=Math.min(PASSING.laneLimit,o.track.width/2-1.25),velocity=r.lateralV||0;
  const roadLimit=o.track.width/2-.7;
  const predicted=clamp(r.lateral+clamp(velocity*behavior.prediction,-1.1,1.1),-roadLimit,roadLimit);
  const corridor=CONTACT.width+.12+(behavior.margin-.12)*clamp(o.speed/20,0,1);
  const candidate=side=>{
    const edge=side>0?Math.max(r.lateral,predicted):Math.min(r.lateral,predicted);
    const lane=clamp(side>0?Math.max(normalLine,edge+PASSING.clearance):Math.min(normalLine,edge-PASSING.clearance),-limit,limit);
    return side*(lane-edge)>=PASSING.minimumClearance?lane:null;
  };
  const choose=()=>{
    const curve=sample(o.track,o.s+35).curve;
    return [-1,1].map(side=>({side,lane:candidate(side)})).filter(p=>p.lane!==null).sort((a,b)=>{
      const score=p=>Math.abs(p.lane-o.lateral)+Math.abs(p.lane-normalLine)*.16-(Math.sign(curve)===p.side?.12:0);
      return score(a)-score(b);
    })[0];
  };
  const commit=pass=>{
    state.phase='overtake';state.side=pass.side;state.lane=pass.lane;
    state.commitRemaining=behavior.commit;state.switchCooldown=behavior.commit;state.blockedTime=0;
  };
  state.commitRemaining=Math.max(0,state.commitRemaining-dt);state.switchCooldown=Math.max(0,state.switchCooldown-dt);
  const look=clamp(24+Math.max(0,closing)*3.5+o.speed*.22,38,115);
  if(r.finished||distance>140){state.phase='cruise';state.side=0;state.contesting=false;state.commitRemaining=0;}
  if(!r.finished&&state.phase==='cruise'&&distance>0&&distance<look&&(closing>.6||target>r.speed+.8)){
    const pass=choose();if(pass)commit(pass);
  }
  if(state.phase==='overtake'){
    // Once it reaches the player's door, the rival owns its established lane.
    // A late lateral closure is resolved by ordinary contact physics, not surrender.
    if(Math.abs(distance)<2&&Math.abs(o.lateral-r.lateral)>CONTACT.width-.25)state.contesting=true;
    if(distance>CONTACT.length-.1)state.contesting=false;
    const blocked=Math.abs(state.lane-r.lateral)<corridor;
    state.blockedTime=blocked&&distance>0?state.blockedTime+dt:0;
    const projectedLead=-distance-Math.max(0,r.speed-o.speed)*1.2;
    if(projectedLead>PASSING.mergeGap){state.phase='return';state.contesting=false;}
    else if(blocked&&!state.contesting&&state.commitRemaining===0&&distance>CONTACT.length+.2+Math.max(0,closing)*.25){
      const pass=choose();
      if(pass&&(pass.side!==state.side||Math.abs(pass.lane-state.lane)>.35)){if(pass.side!==state.side)state.feints++;commit(pass);}
      // Keep the chosen lane if there is no better opening. Never chase a blocking
      // player laterally all the way to the barrier or give up 22 metres to retry.
    }
  }
  if(state.phase==='return'){
    if(-distance<PASSING.mergeGap&&distance<look)state.phase='overtake';
    else if(Math.abs(o.lateral-normalLine)<.25&&Math.abs(o.lateralV)<.5){state.phase='cruise';state.side=0;state.blockedTime=0;}
  }
  state.yielding=false;
  let line=state.phase==='overtake'?state.lane:normalLine;
  if(state.phase!=='cruise')line=clamp(line,-limit,limit);
  const actualCrossing=Math.abs(o.lateral-r.lateral)<corridor;
  const futureCrossing=Math.abs(o.lateral-predicted)<corridor;
  const free=Math.max(0,distance-CONTACT.length),ttc=closing>.1?free/closing:Infinity;
  const emergency=actualCrossing&&distance>0&&ttc<behavior.reaction;
  const mustFollow=actualCrossing||futureCrossing&&(state.commitRemaining===0||emergency);
  if(distance>0&&distance<look&&!state.contesting&&mustFollow){
    const gap=Math.max(5,behavior.gap-Math.min(.4,state.blockedTime*.12));
    const spare=Math.max(0,distance-gap-Math.max(0,closing)*behavior.reaction),front=Math.max(0,r.speed);
    // Relative closing speed matters. Matching the front car keeps pressure;
    // the previous absolute-speed envelope forced an unnecessary retreat.
    target=Math.min(target,front+Math.sqrt(2*12*spare));
    if(distance<gap)target=Math.min(target,front);
    if(distance<CONTACT.length+.35)target=Math.min(target,Math.max(0,front-(CONTACT.length+.35-distance)*2));
  }
  if(state.phase==='cruise'&&(!r.night||r.headlights)&&distance<-10&&distance>-25&&r.speed>o.speed+1)line=clamp(line+(r.lateral-line)*.18,-1,1);
  return {line,target,maneuver:state.phase!=='cruise',reserve:behavior.reserve,laneRate:behavior.laneRate,
    emergency:distance>0&&actualCrossing&&!state.contesting&&closing>.2&&free<1+closing*behavior.reaction};
}
export function driveRival(r,o,dt,{sample,lateralGrip,steeringAngle,steeringAlignment,clamp}){
  o.aiDriver??=createAIDriver(r.rival);
  const baseline=AI_LEVELS[rivalLevel(r.rival)],level=r.rival.ngplus?{...baseline,grip:baseline.grip*1.025,response:baseline.response+.2}:baseline,styleName=rivalStyle(r.rival),style=AI_STYLES[styleName],driver=o.aiDriver;
  const boost=driver?.counter,grip=lateralGrip(o.car,o.wet)*(boost?.grip||1),p=sample(o.track,o.s),v=o.speed;
  // Rematch rivals use more of the available wet grip and brake closer to the bend.
  const technique=styleName==='Skiller'?1.24:styleName==='Complete'?1.06:1;
  const cornerGrip=level.grip*style.corner*technique*(r.rematch?(styleName==='Skiller'?1.06:1.12):1);
  const brakePlan=style.brakePlan*(r.rematch?1.14:1)*(boost?.braking||1);
  let target=o.car.max*level.speed*(boost?.topSpeed||1)*draftSpeedMultiplier(o);
  for(let ahead=0;ahead<=style.preview;ahead+=Math.min(4,o.track.step)){const bend=Math.abs(sample(o.track,o.s+ahead).curve),safe=Math.sqrt(grip*cornerGrip/Math.max(.0001,bend));target=Math.min(target,Math.sqrt(safe*safe+2*brakePlan*ahead));}
  if(driver){
    // Prepare the slide and reverse its sign before the next S-bend, matching
    // the wheel preview instead of countersteering against the previous bend.
    const driftCurve=sample(o.track,o.s+v*.12).curve;
    const slide=styleName!=='Grip'&&Math.abs(driftCurve)>.0014&&v>15?Math.min(1,Math.abs(driftCurve)/.004)*(styleName==='Skiller'?1:.65):0;
    driver.slide+=(slide-driver.slide)*(1-Math.exp(-dt*(slide?5:7)));
    const oldSlip=driver.slip;
    driver.slip+=(Math.sign(driftCurve)*level.slip*(styleName==='Skiller'?.6:.35)*driver.slide-driver.slip)*(1-Math.exp(-dt*12));
    driver.slipRate=(driver.slip-oldSlip)/Math.max(.0001,dt);
  }
  // Set up outside the entry, then clip toward the apex. Each style has its
  // own width; traffic still owns the line while committing to an overtake.
  const nearCurve=sample(o.track,o.s+v*.22).curve,farCurve=sample(o.track,o.s+v*.9+15).curve;
  const turn=Math.sign(Math.abs(nearCurve)>.0014?nearCurve:farCurve);
  const incoming=Math.sign(farCurve)===turn?Math.abs(farCurve):0;
  const normalLine=turn*style.line*clamp((Math.abs(nearCurve)-incoming*.7)/.012,-1,1);
  const plan=planRivalTraffic(r,o,dt,normalLine,target,{sample,clamp});
  target=plan.target;
  // Correct an outward drift before it reaches the rail. This spends speed and
  // steering grip, rather than snapping the rival back onto its racing line.
  const outward=Math.sign(o.lateral)*o.lateralV;
  if(!plan.maneuver&&outward>1){const overshoot=Math.abs(o.lateral+o.lateralV*.45)-2.7;target*=1-clamp(overshoot*.16,0,.28);}
  if(!plan.maneuver){const error=Math.abs(o.lateral-(o.targetLine??normalLine));target*=Math.sqrt(1-clamp((error-.45)*.34,0,.4));}
  if(plan.maneuver&&Math.abs(plan.line-o.lateral)>.3&&Math.abs(p.curve)>.001)target=Math.min(target,Math.sqrt(grip*cornerGrip*plan.reserve/Math.abs(p.curve)));
  driver.targetSpeed=target;
  const change=(plan.line-(o.targetLine??o.lateral))*(1-Math.exp(-dt*(plan.maneuver?2.6:1.4)));
  o.targetLine=(o.targetLine??o.lateral)+(plan.maneuver?clamp(change,-plan.laneRate*dt,plan.laneRate*dt):change);
  // Follow the speed envelope with pedal pressure, not repeated full-brake
  // taps. Its slope supplies the entry deceleration; speed error corrects it.
  const slope=driver.previousTarget===undefined?0:clamp((target-driver.previousTarget)/Math.max(.0001,dt),-30,20);
  driver.previousTarget=target;
  driver.targetSlope=(driver.targetSlope||0)+(slope-(driver.targetSlope||0))*(1-Math.exp(-dt*10));
  const drag=.00048*v*v*(1-(o.draft?.strength||0)*SLIPSTREAM.dragReduction);
  const coast=-1.05-drag-o.understeer*3.2-(Math.abs(o.slipAngle)*v*.10+o.drift*1.2);
  const acceleration=o.car.accel*Math.max(.15,1-v/(o.car.max*(boost?.topSpeed||1)*draftSpeedMultiplier(o)*1.13))*(boost?.acceleration||1);
  // A falling future limit is not a reason to keep braking when the car is
  // already below it (notably just after a hairpin or a Fireball transition).
  const slopeDemand=driver.targetSlope<0?driver.targetSlope*clamp(1-(target-v)/1.2,0,1):driver.targetSlope;
  const demand=slopeDemand+(target-v)*3;
  const wantedBrake=clamp((coast-demand)/(19*(o.car.brakePower||1)*(boost?.braking||1)),0,1);
  const wantedThrottle=wantedBrake>.025?0:clamp((demand-coast)/(acceleration+1.05),0,1);
  const emergency=target<1||v>target+6;
  const wantedPedal=plan.emergency?-1:wantedBrake>.025?-wantedBrake:wantedThrottle;
  driver.pedal=emergency||plan.emergency?wantedPedal:(driver.pedal||0)+(wantedPedal-(driver.pedal||0))*(1-Math.exp(-dt*20));
  driver.brake=driver.pedal<-.025?-driver.pedal:0;
  driver.throttle=driver.pedal>0?driver.pedal:0;
  const brake=driver.brake,throttle=driver.throttle;
  const anticipated=o.lateral+o.lateralV*(plan.maneuver?.45:.32);
  const positionGain=plan.maneuver?Math.min(.14,.062*Math.max(1,25/Math.max(10,v))):.075;
  const desiredTravel=clamp(-(anticipated-o.targetLine)*positionGain,-.18,.18);
  // Steering and body yaw both have inertia in the current handling model.
  // Aim through that response delay, rather than waiting to enter a bend or
  // its reversal before asking the front wheels to turn.
  const preview=sample(o.track,o.s+v*(plan.maneuver?.08:.18)),previewRate=preview.curve*v*Math.cos(o.travelYaw)/clamp(1-preview.curve*o.lateral,.65,1.35);
  const travelRate=previewRate+(desiredTravel-o.travelYaw)*level.response;
  const alignment=steeringAlignment(o,brake);
  const desiredBody=o.travelYaw+travelRate/alignment+(driver?.slip||0);
  const bodyRate=previewRate+(desiredBody-o.yaw)*9+(driver?.slipRate||0)*.55,wheelbase=o.car.id==='r32'?2.62:o.car.id==='rx7'?2.43:2.4;
  return {steer:-clamp(Math.atan(bodyRate*wheelbase/Math.max(2,v))/steeringAngle(v),-1,1),throttle,brake,handbrake:false};
}
