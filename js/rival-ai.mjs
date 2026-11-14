import {draftSpeedMultiplier,CONTACT,SLIPSTREAM} from './traffic.mjs';
import {rivalRoute,routeSample} from './rival-route.mjs';
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
  Grip:{pedal:23,steeringLead:.17,slip:0},
  Complete:{pedal:15,steeringLead:.17,slip:.10},
  Skiller:{pedal:19,steeringLead:.14,slip:0}
};
// Pace reserves per road: a dry/rain baseline, then NG+ on dry and wet stages.
// Applied to the planned speed/forces, never to race progress or the clock.
const COURSE_PACE={akina:[.89,.87,.855],akagi:[.88,.88,.82],iroha:[.88,.86,.80],usui:[.87,.87,.81],tsukuba:[.89,.88,.82],tsubaki:[.84,.815,.774],odawara:[.86,.86,.80],ashinoko:[.84,.80,.79],manazuru:[.86,.84,.79]};
// Calibrated against runs with stock and prepared cars on the new layouts.
const EXPANSION_PACE={
 myogi:[.91,.865,.915],momiji:[.885,.805,.875],nanamagari:[.90,.84,.818],nagao:[.88,.82,.853],
 happogahara:[.845,.796,.817],sadamine:[.91,.844,.83],turnpike:[.92,.86,.915],enna:[.90,.855,.90],
 tsuchisaka:[.865,.79,.78],yabitsu:[.895,.817,.89]
};
const RIVAL_PACE_ADJUSTMENTS={
 'daiki-happogahara':.94,'nobuhiko-sadamine':.974,'tachi-enna':.972,
 'ichijo-tsuchisaka':.974,'kobayakawa-yabitsu':.953
};
function paceFor(track,rival,wet){
 const expansion=track.geometryVersion&&EXPANSION_PACE[track.id];
 if(expansion){
  const id=rival.baseId||rival.id,adjust=RIVAL_PACE_ADJUSTMENTS[id]||1;
  return expansion[rival.ngplus?2:wet?1:0]*adjust;
 }
 const row=track.geometryVersion&&COURSE_PACE[track.id];
 if(!row)return 1;
 return row[rival.ngplus?wet?2:1:0]*(!rival.ngplus&&rival.level===1?.96:1);
}
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
  const paceAdvantage=target-r.speed;
  if(!r.finished&&state.phase==='cruise'&&state.switchCooldown===0&&distance>0&&distance<look&&(closing>.6||paceAdvantage>.8)){
    // In bends the parallel lane costs speed and distance. Keep the racing
    // line until the time needed to move across fits the closing gap.
    const setupDistance=clamp(14+Math.max(0,closing)*1.5,19,39);
    const clearRoad=distance<setupDistance||[0,20,40,60].every(offset=>Math.abs(sample(o.track,o.s+offset).curve)<.006);
    if(clearRoad){const pass=choose();if(pass)commit(pass);}
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
    else if(!state.contesting&&state.commitRemaining===0&&distance>CONTACT.length+12&&closing<.5&&paceAdvantage<1){
      // Recover the racing line when there is no closing pace and both cars
      // are still separated. A committed pass at the door keeps its lane.
      state.phase='cruise';state.side=0;state.switchCooldown=.75;state.blockedTime=0;
    }
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
  if(state.phase==='cruise'&&(!r.night||r.headlights)&&distance<-10&&distance>-25&&r.speed>o.speed+1)line=clamp(line+(r.lateral-line)*.18,-limit,limit);
  return {line,target,maneuver:state.phase!=='cruise',reserve:behavior.reserve,laneRate:behavior.laneRate,
    emergency:distance>0&&actualCrossing&&!state.contesting&&closing>.2&&free<1+closing*behavior.reaction};
}
export function driveRival(r,o,dt,{sample,lateralGrip,steeringAngle,steeringAlignment,clamp}){
  o.aiDriver??=createAIDriver(r.rival);
  const driver=o.aiDriver,styleName=driver.style,style=AI_STYLES[styleName],level=AI_LEVELS[driver.level],v=o.speed,p=sample(o.track,o.s);
  const boost=driver.counter;
  if(!driver.route||driver.routeBoost!==boost){
    const car=boost?{...o.car,max:o.car.max*boost.topSpeed,accel:o.car.accel*boost.acceleration,grip:o.car.grip*boost.grip,brakePower:(o.car.brakePower||1)*boost.braking}:o.car;
    driver.route=rivalRoute(o.track,car,r.rival,o.wet);driver.routeBoost=boost;
  }
  const route=driver.route,ref=routeSample(route,o.s),draft=draftSpeedMultiplier(o),paceLimit=paceFor(o.track,r.rival,o.wet)*(r.rival.gridPace||1);
  const routeSpeed=ref.speed*paceLimit;
  const plan=planRivalTraffic(r,o,dt,ref.line,routeSpeed*(ref.phase==='straight'?draft:1),{sample,clamp});
  const grip=lateralGrip(o.car,o.wet)*(boost?.grip||1),followingRoute=!plan.maneuver;
  let target=plan.target;
  // A pass uses a parallel lane rather than the optimal line. Reserve real
  // lateral force for that lane change, especially on the inside of a bend.
  if(plan.maneuver&&Math.abs(p.curve)>.002){
    const inside=clamp(1-p.curve*o.lateral,.7,1.2);
    const use=(styleName==='Skiller'?1.10:styleName==='Grip'?.86:.96)*plan.reserve;
    target=Math.min(target,Math.sqrt(grip*use*inside/Math.abs(p.curve)));
  }
  const edge=o.track.width/2-.65,projected=o.lateral+o.lateralV*.32;
  const recovering=Math.abs(projected)>edge-.28&&o.lateral*o.lateralV>0;
  if(recovering)target=Math.min(target,Math.max(9,v*.89));
  driver.targetSpeed=target;
  driver.phase=ref.phase;
  const change=(plan.line-(o.targetLine??o.lateral))*(1-Math.exp(-dt*2.6));
  o.targetLine=recovering?clamp(plan.line,-edge+1.3,edge-1.3):followingRoute?plan.line:(o.targetLine??o.lateral)+clamp(change,-plan.laneRate*dt,plan.laneRate*dt);
  // The feed-forward command is the road plan's acceleration, not the
  // derivative of traffic corrections, draft or steering error.
  const error=target-v;
  const profileAcceleration=target<routeSpeed-1.2&&ref.acceleration>0?0:ref.acceleration*(ref.acceleration<0?paceLimit*paceLimit:1);
  const pace=profileAcceleration<0?profileAcceleration*clamp(1-error/1.5,0,1):profileAcceleration;
  const drag=.00048*v*v*(1-(o.draft?.strength||0)*SLIPSTREAM.dragReduction);
  const coast=-1.05-drag-o.understeer*3.2-(Math.abs(o.slipAngle)*v*.10+o.drift*1.2)*.7;
  const acceleration=o.car.accel*Math.max(.15,1-v/(o.car.max*(boost?.topSpeed||1)*draft*1.13))*(boost?.acceleration||1);
  const demand=pace+error*(plan.maneuver?4.8:3.6);
  const wantedBrake=clamp((coast-demand)/(19*(o.car.brakePower||1)*(boost?.braking||1)),0,1);
  const wantedThrottle=wantedBrake>.025?0:clamp((demand-coast)/(acceleration+1.05),0,1);
  const emergency=target<1||v>target+6;
  const wantedPedal=plan.emergency?-1:wantedBrake>.025?-wantedBrake:wantedThrottle;
  driver.pedal=emergency||plan.emergency?wantedPedal:driver.pedal+(wantedPedal-driver.pedal)*(1-Math.exp(-dt*style.pedal));
  driver.brake=driver.pedal<-.025?-driver.pedal:0;
  driver.throttle=driver.pedal>0?driver.pedal:0;
  const brake=driver.brake,throttle=driver.throttle;
  const preview=routeSample(route,o.s+v*style.steeringLead);
  const bend=routeSample(route,o.s+Math.max(1,v*.22)).roadCurve;
  const slide=styleName==='Skiller'&&v>10&&!recovering?clamp(Math.abs(bend)/.009,0,1):0;
  driver.slide+=(slide-driver.slide)*(1-Math.exp(-dt*(slide?7:10)));
  const alignment=steeringAlignment(o,brake),slipRoom=Math.max(0,.11+level.slip*.68-Math.abs(preview.curve*v)/alignment);
  const oldSlip=driver.slip,slipGoal=Math.sign(bend)*(styleName==='Skiller'?slipRoom*driver.slide:level.slip*style.slip*clamp(Math.abs(bend)/.018,0,1));
  driver.slip+=(slipGoal-driver.slip)*(1-Math.exp(-dt*11));
  driver.slipRate=(driver.slip-oldSlip)/Math.max(.0001,dt);
  const laneAngle=followingRoute?Math.atan2(ref.lineSlope,clamp(1-p.curve*ref.line,.65,1.35)):0;
  const lateralError=o.lateral-o.targetLine;
  const lateralRateError=o.lateralV-v*Math.sin(laneAngle);
  const gain=plan.maneuver?Math.min(.14,.062*Math.max(1,25/Math.max(10,v))):.095;
  const desiredTravel=clamp(laneAngle-(lateralError+lateralRateError*(plan.maneuver?.45:.29))*gain,-.30,.30);
  const corner=plan.maneuver?sample(o.track,o.s+v*.08).curve:preview.curve;
  const previewRate=corner*v*(plan.maneuver?Math.cos(o.travelYaw)/clamp(1-corner*o.lateral,.65,1.35):1);
  const travelRate=previewRate+(desiredTravel-o.travelYaw)*(level.response+.35);
  const desiredBody=o.travelYaw+travelRate/alignment+(driver?.slip||0);
  const bodyRate=previewRate+(desiredBody-o.yaw)*9+driver.slipRate*.75,wheelbase=o.car.id==='r32'?2.62:o.car.id==='rx7'?2.43:2.4;
  return {steer:-clamp(Math.atan(bodyRate*wheelbase/Math.max(2,v))/steeringAngle(v),-1,1),throttle,brake,handbrake:false};
}
