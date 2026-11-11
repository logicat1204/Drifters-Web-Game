import { COURSE_LAYOUTS, TRACKS, RIVALS } from './courses.mjs';
import {createSkillState,updateCornerSkill} from './skill.mjs';
import {FOCUS,focusType,createFocus,cancelFocus,updateFocus} from './focus.mjs';
import {EXTRA_CARS} from './vehicles.mjs';
import {CAMPAIGN_TRACKS} from './campaign.mjs';
import {createBossState,updateBossState} from './bosses.mjs';
import {driveRival,createAIDriver,rivalLevel,rivalStyle} from './rival-ai.mjs';
import {createDraft,clearDraft,updateSlipstream,draftSpeedMultiplier,SLIPSTREAM,vehiclePose,resolveVehicleContact} from './traffic.mjs';
import {applyBuild} from './tuning.mjs';
import {AUTHORED_COURSES as TRACED_COURSES} from './authored-courses.mjs';
import {ASHINOKO_COURSE} from './ashinoko-course.mjs';
import {buildAuthoredTrack} from './track-geometry.mjs';
const AUTHORED_COURSES={...TRACED_COURSES,ashinoko:ASHINOKO_COURSE};
export { TRACKS, RIVALS };
export const ALL_TRACKS=[...TRACKS,...CAMPAIGN_TRACKS];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const HANDLING_VERSION='v10';
export function steeringAngle(speed){return .5/(1+Math.max(0,speed)*.045);}
export function steeringAlignment(r,brake=0,handbrake=false){
  const turning=Math.abs(r.steer)>.32&&r.speed>16;
  const alignment=r.aiDriver?9.5-(turning&&r.aiDriver.style!=='Grip'?3.3*brake:0):turning&&brake?6.2:9.5;
  return (handbrake?2.7:alignment)*(1-r.driftAssist*.28);
}
export const HANDLING_PROFILES=Object.freeze({
  power:Object.freeze({grip:1.16,throttleGrip:.97,driftGrip:.03,steering:18,driftDecay:1.35,slideLoss:1.08,handbrakeDrag:21}),
  balanced:Object.freeze({grip:1.02,throttleGrip:.94,driftGrip:.17,steering:19,driftDecay:.85,slideLoss:.82,handbrakeDrag:20}),
  agile:Object.freeze({grip:.95,throttleGrip:.95,driftGrip:.36,steering:22,driftDecay:.55,slideLoss:.55,handbrakeDrag:19})
});
const handling=car=>HANDLING_PROFILES[car.profile]||HANDLING_PROFILES.balanced;
export function lateralGrip(car,wet=false){return 20*car.grip*handling(car).grip*(wet?(car.aiWetGripRetention??.75):1);}
export function cornerSpeed(car,curve,wet=false){return Math.sqrt(lateralGrip(car,wet)/Math.max(.00001,Math.abs(curve)));}
export function roadEdge(track){return Math.max(1.8,(track.width||10.6)/2-.65);}
export function cornerTechnique(r,curve,handbrake=false){
  if(handbrake||r.driftAssist<=.08||r.speed<12||r.collision>0||r.wallTouch>0||Math.abs(curve)<.0012)return 0;
  const slip=Math.abs(r.slipAngle||0),entry=clamp((slip-.025)/.10,0,1),control=clamp((.48-slip)/.20,0,1);
  const alignment=clamp((.24-Math.abs(r.travelYaw||0))/.14,0,1);
  const space=clamp((roadEdge(r.track)-.25-Math.abs(r.lateral))/.6,0,1);
  return entry*control*alignment*space;
}
export function toggleHeadlights(r){r.headlights=!r.headlights;return r.headlights;}
export function repositionRace(r){
  if(r.finished||r.countdown>0||r.resetCooldown>0)return false;
  cancelFocus(r);clearDraft(r);r.contactCooldown=0;
  Object.assign(r,{lateral:0,speed:0,yaw:0,yawRate:0,travelYaw:0,lateralV:0,steer:0,gripUsage:0,understeer:0,driftAssist:0,slipAngle:0,drift:0,combo:0,gear:1,rpm:1000,handbrakeDown:false,handbrakeTime:0,braking:true,collision:0,wallCooldown:0,wallContact:0,wallTouch:0,wallSlow:0,blindArmed:false,blindTime:0,resetHold:.45,resetCooldown:2,resetId:(r.resetId||0)+1});
  Object.assign(r.skill,{chain:0,intensity:0,level:0,corner:false,clean:false,quiet:0,cornerPoints:0,peak:0,award:null,flash:0});
  return true;
}
export const CAR_PROFILES={
  agile:{name:'SKILLER',description:'Ligero y técnico. Conserva más impulso con un derrape preparado y limpio; menor velocidad punta.'},
  balanced:{name:'BALANCE',description:'Adherencia, derrape y aceleración equilibrados para enlazar todo tipo de curvas.'},
  power:{name:'GRIP',description:'Potencia y adherencia al volante. Gira con estabilidad, frena antes del vértice y acelera fuerte al salir.'}
};
export const CARS = [
  { id:'ae86',price:750,name:'SPRINTER TRUENO',code:'AE86',brand:'TOYOTA',year:'1983',drive:'FR',power:'130',weight:'940',color:'#e5e5dc',accel:13.8,max:62,grip:1.16,profile:'agile',label:'El maestro de las curvas' },
  { id:'rx7',price:1100,name:'RX-7 TYPE R',code:'FD3S',brand:'MAZDA',year:'1991',drive:'FR',power:'255',weight:'1260',color:'#e7b948',accel:15.3,max:68,grip:1.10,profile:'balanced',label:'El equilibrio rotativo' },
  { id:'r32',price:1200,name:'SKYLINE GT-R',code:'BNR32',brand:'NISSAN',year:'1989',drive:'4WD',power:'280',weight:'1430',color:'#8794a2',accel:16.1,max:71,grip:1.04,profile:'power',label:'Potencia en las rectas' },
  { id:'mr2',price:850,name:'MR2 G-LIMITED',code:'SW20',brand:'TOYOTA',year:'1989',drive:'MR',power:'165',weight:'1180',color:'#e5e2d5',accel:13.9,max:61,grip:1.18,profile:'agile',label:'Precisión de motor central' },
  { id:'s2000',price:950,name:'S2000',code:'AP1',brand:'HONDA',year:'1999',drive:'FR',power:'250',weight:'1240',color:'#bf3e37',accel:14.2,max:63,grip:1.17,profile:'agile',label:'Agilidad a altas vueltas' },
  { id:'silvia',price:850,name:"SILVIA K’S",code:'S13',brand:'NISSAN',year:'1989',drive:'FR',power:'175',weight:'1120',color:'#6e9796',accel:15.0,max:67,grip:1.11,profile:'balanced',label:'Control y respuesta turbo' },
  { id:'supra',price:1300,name:'SUPRA RZ',code:'JZA80',brand:'TOYOTA',year:'1993',drive:'FR',power:'280',weight:'1490',color:'#bdc4c8',accel:16.4,max:73,grip:1.02,profile:'power',label:'El empuje del biturbo' }
].map(car=>({...car,stats:[Math.round(car.accel/17*100),Math.round(car.grip/1.20*100),Math.round(car.max/75*100)]}));
export const ALL_CARS=[...CARS,...EXTRA_CARS];
export const STARTER_CARS=CARS.slice(0,3);
export function makeTrack(config) {
  const authored=config.referencePath||(!config.layout&&AUTHORED_COURSES[config.id]);
  if(authored)return buildAuthoredTrack(config,authored);
  const step = 8, points = [];
  const recipe=config.layout||COURSE_LAYOUTS[config.id],total=recipe.reduce((sum,p)=>sum+p[0],0);
  let cursor=0;const sectors=recipe.map(([weight,degrees])=>{const start=cursor,length=weight/total*config.length;cursor+=length;return {start,end:cursor,length,radians:degrees*Math.PI/180};});
  let x = 0, z = 0, heading = 0;
  for (let i = 0; i <= Math.ceil(config.length / step) + 80; i++) {
    const s = i * step;
    const sector=sectors.find(p=>s>=p.start&&s<p.end);
    const t=sector?(s-sector.start)/sector.length:0;
    const curve=sector?sector.radians/sector.length*(1-Math.cos(t*Math.PI*2)):0;
    heading += curve * step;
    x += Math.sin(heading) * step;
    z += Math.cos(heading) * step;
    const y = -s * config.elevation / config.length + Math.sin(s / 210) * 2.5;
    points.push({ x, y, z, heading, curve, s });
  }
  const result={ ...config, step, points, width: 10.6 };
  return result;
}
export function sample(track, s) {
  const f = clamp(s / track.step, 0, track.points.length - 1.001), i = Math.floor(f), t = f - i;
  const a = track.points[i], b = track.points[i + 1];
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t), heading: mix(a.heading, b.heading, t), curve: mix(a.curve, b.curve, t) };
}
export function worldAt(track, s, lateral = 0) {
  const p = sample(track, s);
  p.x += Math.cos(p.heading) * lateral; p.z -= Math.sin(p.heading) * lateral;
  return p;
}
export function createRace(car, track, opts = {}) {
  if(opts.build)car=applyBuild(car,opts.build);
  const mode=opts.mode||'battle',rival=opts.rival||RIVALS[track.rival];
  return { car, track, rival,draft:createDraft(),contactCooldown:0,boss:createBossState(rival),aiDriver:opts.aiDriver?createAIDriver(opts.aiDriver):null, campaignStage:opts.campaignStage||null,rematch:opts.rematch===true,fog:!!opts.fog,s: 12, lateral: -1.7, speed: 0, yaw: 0, yawRate:0, travelYaw:0, lateralV: 0, steer: 0, gripUsage:0, understeer:0, cornerSpeed:car.max, handbrakeDown:false,handbrakeTime:0, driftAssist:0, slipAngle:0, gear: 1, rpm: 1000, elapsed: 0, countdown: 3, rivalS: 24, rivalSpeed: 0, rivalLateral:1.5,rivalYaw:0,rivalFinished:false, opponent:null,rivalBraking:false,rivalSteer:0,headlights:true,night:opts.night!==false,blindTime:0,blindPasses:0,blindAward:0,blindArmed:false,braking:false,skill:createSkillState(),focus:createFocus(opts.focusType,opts.focusEnabled!==false),resetId:0,resetHold:0,resetCooldown:0,wallContact:0,wallTouch:0,wallSlow:0, drift: 0, driftPoints: 0, combo: 0, bestCombo: 0, wallCooldown: 0, collision: 0, checkpoints: 0, timeLeft: Math.ceil(track.length/22)+35, finished: false, won: false, manual: !!opts.manual, wet: !!opts.wet, mode, rivalLevel:rivalLevel(rival) };
}
export function rivalCar(rival){
 const base=ALL_CARS.find(c=>c.id===rival.car)||CARS[0],style=rivalStyle(rival);
 const tune={Grip:{accel:1.15,max:1.09,grip:1,brakes:1.30},Complete:{accel:1.09,max:1.025,grip:1.04,brakes:1.16},Skiller:{accel:1.055,max:.96,grip:1.08,brakes:1.08}}[style];
 const ng=rival.ngplus;
 return {...base,accel:base.accel*tune.accel*(ng?1.22:1),max:base.max*tune.max*(ng?1.10:1),grip:base.grip*tune.grip*(ng?1.16:1),brakePower:(base.brakePower||1)*tune.brakes*(ng?1.20:1),aiWetGripRetention:.96,color:rival.color||base.color};
}
export function rivalDriverInput(r,o,dt){return driveRival(r,o,dt,{sample,lateralGrip,steeringAngle,steeringAlignment,clamp});}
export function updateRace(r, input, dt, traffic=null) {
  if (r.finished) return;
  dt = clamp(dt, 0, .05);
  if (r.countdown > 0) { r.countdown = Math.max(0, r.countdown - dt); return; }
  const beforePlayer=vehiclePose(r),frameStartS=r.s;
  if(r.mode!=='time'&&!r.opponent){r.opponent=createRace(rivalCar(r.rival),r.track,{mode:'time',wet:r.wet,night:r.night,focusEnabled:false,aiDriver:r.rival});Object.assign(r.opponent,{s:24,lateral:1.25,countdown:0,timeLeft:10000});}
  const beforeOpponent=r.opponent?vehiclePose(r.opponent):null;
  r.contactCooldown=Math.max(0,(r.contactCooldown||0)-dt);
  updateSlipstream(r,traffic||(r.opponent?[beforeOpponent]:[]),dt,worldAt);
  r.elapsed += dt; r.timeLeft -= dt; r.collision = Math.max(0, r.collision - dt * 2); r.wallCooldown -= dt;
  const resetHeld=r.resetHold>0;r.resetHold=Math.max(0,r.resetHold-dt);r.resetCooldown=Math.max(0,r.resetCooldown-dt);
  if(resetHeld)input={steer:0,throttle:false,brake:true,handbrake:false};
  r.wallSlow=Math.max(0,r.wallSlow-dt);r.wallTouch=Math.max(0,r.wallTouch-dt);if(r.wallTouch===0)r.wallContact=0;
  const concentrating=r.focus.remaining>0&&r.focus.enabled!==false&&r.collision===0,power=focusType(r),counter=r.aiDriver?.counter,undraftedMax=r.car.max*(concentrating?power.topSpeed:1)*(counter?.topSpeed||1),maxSpeed=undraftedMax*draftSpeedMultiplier(r);
  const p = sample(r.track, r.s), speed = r.speed,profile=handling(r.car),edge=roadEdge(r.track);
  // The +Z camera sees world +X on its left; positive player input is screen-right.
  const targetSteer = -clamp(input.steer || 0, -1, 1);
  r.steer = mix(r.steer, targetSteer, 1 - Math.exp(-dt * profile.steering));
  const ai=!!r.aiDriver,throttle=ai?clamp(Number(input.throttle)||0,0,1):Number(!!input.throttle),brake=ai?clamp(Number(input.brake)||0,0,1):Number(!!input.brake);
  const handbrake=!!input.handbrake&&speed>8,braking=brake>0;
  r.handbrakeTime=handbrake?(r.handbrakeTime||0)+dt:0;
  r.braking=ai?brake>(r.braking?.035:.075):braking;
  r.brakePressure=brake;r.throttlePressure=throttle;
  const baseGrip=lateralGrip(r.car,r.wet)*(counter?.grip||1),technique=cornerTechnique(r,p.curve,handbrake);
  const driftGrip=r.aiDriver?.style==='Skiller'?Math.max(.32,profile.driftGrip):profile.driftGrip;
  const grip=baseGrip*(1+driftGrip*technique)*(concentrating?power.grip:1),wheelbase=r.car.id==='r32'?2.62:r.car.id==='rx7'?2.43:2.4;
  const brakeInitiation=(ai?brake>.18&&r.aiDriver.style!=='Grip':braking)&&Math.abs(r.steer)>.32&&speed>16;
  if(handbrake&&!r.handbrakeDown&&Math.abs(targetSteer)>.15){r.driftAssist=1;r.yawRate+=Math.sign(targetSteer)*1.1;}
  if(handbrake&&Math.abs(r.steer)>.15)r.driftAssist=1;
  else if(brakeInitiation)r.driftAssist=Math.max(r.driftAssist,ai&&r.aiDriver.style==='Complete'?.2:.45);
  r.handbrakeDown=handbrake;
  if(r.aiDriver?.style==='Skiller')r.driftAssist=Math.max(r.driftAssist,r.aiDriver.slide*.85);
  if(!handbrake)r.driftAssist=Math.max(0,r.driftAssist-dt*profile.driftDecay);
  // The friction budget limits the *velocity direction*, independently of body
  // rotation. More steering cannot create more lateral force at excessive speed.
  const budget=grip*(ai?1-throttle*(1-profile.throttleGrip)-brake*.04:input.throttle?profile.throttleGrip:braking?.96:1)*(handbrake?.66:1);
  const requestedRate=speed/wheelbase*Math.tan(r.steer*steeringAngle(speed));
  const yawBudget=budget/Math.max(6,speed)*(1+r.driftAssist*(r.aiDriver?.style==='Skiller'?1.35:.75));
  const bodyRate=clamp(requestedRate,-yawBudget,yawBudget);
  r.yawRate=mix(r.yawRate,bodyRate,1-Math.exp(-dt*(r.aiDriver?.style==='Skiller'?24:r.aiDriver?.style==='Complete'?18:r.driftAssist>0?14:11)));
  const alignment=steeringAlignment(r,brake,handbrake)*(concentrating?power.alignment:1);
  const travelRate=clamp((r.yaw-r.travelYaw-(r.aiDriver?.slip||0))*alignment,-budget/Math.max(6,speed),budget/Math.max(6,speed));
  const progressRate=speed*Math.cos(r.travelYaw)/clamp(1-p.curve*r.lateral,.65,1.35);
  const roadRate=p.curve*Math.max(0,progressRate);
  r.yaw=clamp(r.yaw+(r.yawRate-roadRate)*dt,-1.4,1.4);
  r.travelYaw=clamp(r.travelYaw+(travelRate-roadRate)*dt,-1.4,1.4);
  r.slipAngle=r.yaw-r.travelYaw;
  // Sliding requires a rear-axle release. Ordinary steering is grip driving.
  const slide=clamp((Math.abs(r.slipAngle)-.08)*4,0,1);
  r.drift=mix(r.drift,r.driftAssist>0?Math.max(slide,r.driftAssist*.65):slide*.3,1-Math.exp(-dt*8));
  r.gripUsage=Math.abs(requestedRate)*speed/Math.max(1,budget);
  const roadDemand=Math.abs(p.curve)*speed*speed/Math.max(1,budget);
  r.understeer=mix(r.understeer,clamp(Math.max(roadDemand-1,(r.gripUsage-1)*.35),0,1),1-Math.exp(-dt*8));
  r.cornerSpeed=Math.sqrt(grip/Math.max(.00001,Math.abs(p.curve)));
  r.lateralV=Math.sin(r.travelYaw)*speed;
  r.lateral+=r.lateralV*dt;
  if(r.manual&&input.gearEpoch===r.resetId&&Number.isInteger(input.gear)&&input.gear>=1&&input.gear<=5)r.gear=input.gear;
  const gearMax = [0, 20, 33, 44, 55, maxSpeed];
  if (!r.manual) { while (r.gear < 5 && speed > gearMax[r.gear] * .91) r.gear++; while (r.gear > 1 && speed < gearMax[r.gear - 1] * .72) r.gear--; }
  const accel = r.car.accel * Math.max(.15, 1 - speed / (maxSpeed * 1.13))*(concentrating?power.acceleration:1)*(counter?.acceleration||1);
  const overrev = r.manual && speed > gearMax[r.gear] ? 0 : 1;
  const handbrakeDrag=handbrake?(r.handbrakeTime<=.18?6:profile.handbrakeDrag):0;
  const slideLoss=profile.slideLoss*(1-technique*.45)*(r.aiDriver?.style==='Skiller'?1-r.aiDriver.level*.08:1);
  const driveForce=ai?throttle*(accel*overrev+1.05)-1.05:input.throttle&&!braking?accel*overrev:-1.05;
  r.speed += (driveForce - (braking ? brake*19*(r.car.brakePower||1)*(concentrating?power.braking:1)*(counter?.braking||1) : 0) - handbrakeDrag - .00048 * speed * speed * (1-r.draft.strength*SLIPSTREAM.dragReduction) - r.understeer*3.2 - (Math.abs(r.slipAngle)*speed*.10+r.drift*1.2)*slideLoss) * dt;
  if (Math.abs(r.lateral) > edge-.55) r.speed -= dt * 5;
  const wallSide=Math.sign(r.lateral),scraping=r.wallTouch>0&&r.wallContact===wallSide&&Math.abs(r.lateral)>edge-.2&&wallSide*(r.travelYaw+r.yaw)>0;
  if (Math.abs(r.lateral)>=edge || scraping) {
    const fresh=r.wallContact!==wallSide||r.wallTouch===0;
    r.lateral=wallSide*Math.min(Math.abs(r.lateral),edge);
    if(fresh&&r.wallCooldown<=0){r.speed*=.69;r.collision=1;r.wallCooldown=.85;r.wallSlow=2.5;}
    r.wallContact=wallSide;r.wallTouch=.18;
    // Scraping remains slower than a clean corner, without reducing progress to
    // zero. This also prevents using the barrier as a full-throttle turn assist.
    r.speed=Math.min(r.speed,Math.max(9,Math.min(r.car.max*.72,Math.sqrt(baseGrip/Math.max(.00001,Math.abs(p.curve)))*.60)));
    // Slide along the barrier: discard only motion and rotation into the wall.
    // Keeping an outward body yaw used to turn every correction back into it.
    r.travelYaw=wallSide*Math.min(0,wallSide*r.travelYaw);r.yaw=wallSide*Math.min(0,wallSide*r.yaw);r.yawRate=wallSide*Math.min(0,wallSide*r.yawRate);
    r.lateralV=Math.sin(r.travelYaw)*Math.max(0,r.speed);r.slipAngle=r.yaw-r.travelYaw;r.driftAssist=0;r.drift=Math.min(r.drift,.15);r.understeer=Math.min(r.understeer,.35);
  }
  if(r.wallSlow>0){const bend=Math.max(Math.abs(p.curve),Math.abs(sample(r.track,r.s+32).curve));r.speed=Math.min(r.speed,Math.max(9,Math.min(r.car.max*.5,Math.sqrt(baseGrip/Math.max(.00001,bend))*.6)));}
  // Leaving the wake removes its force, not the momentum already earned.
  // Extra speed coasts down; it cannot grow or exceed the 5% draft ceiling.
  const draftCoast=r.draft.strength>0?Math.min(undraftedMax*(1+SLIPSTREAM.topSpeed),speed-dt*.25):0;
  r.speed = clamp(r.speed, 0, Math.max(maxSpeed,draftCoast));
  r.rpm = clamp(1000 + r.speed / gearMax[r.gear] * 7000, 900, 8500);
  r.s+=r.speed*Math.max(.12,Math.cos(r.travelYaw))/clamp(1-p.curve*r.lateral,.65,1.35)*dt;
  if (r.drift > .25 && Math.abs(r.slipAngle)>.09 && r.speed > 12 && Math.abs(r.lateral) < edge-.45) { r.combo += dt * r.speed * r.drift * 7; r.driftPoints += dt * r.speed * r.drift * 7; r.bestCombo = Math.max(r.bestCombo, r.combo); } else r.combo = Math.max(0, r.combo - dt * 180);
  const checkpoint = r.track.sectionEnds?r.track.sectionEnds.slice(0,-1).filter(s=>r.s>=s).length:Math.min(3,Math.floor(r.s/(r.track.length/4)));
  if (checkpoint > r.checkpoints) { r.timeLeft += 14; r.checkpoints = checkpoint; }
  updateCornerSkill(r,dt,p.curve,grip);
  updateFocus(r,dt,p.curve,baseGrip);
  r.blindAward=Math.max(0,r.blindAward-dt);
  if(r.mode!=='time'){
    const previousGap=r.rivalS-r.s;
    const opponentStartS=r.opponent.s;
    const sensedPlayer={...beforePlayer,lateralV:Math.sin(beforePlayer.travelYaw)*beforePlayer.speed,rival:r.rival,boss:r.boss,night:r.night,headlights:r.headlights,rematch:r.rematch};
    updateRace(r.opponent,rivalDriverInput(sensedPlayer,r.opponent,dt),dt,[beforePlayer]);
    resolveVehicleContact(r,r.opponent,beforePlayer,beforeOpponent);
    const o=r.opponent;r.rivalS=o.s;r.rivalSpeed=o.speed;r.rivalLateral=o.lateral;r.rivalYaw=o.yaw;r.rivalBraking=o.braking;r.rivalSteer=o.steer;r.rivalFinished=o.finished;r.rivalFinishFraction=o.s>=r.track.length?clamp((r.track.length-opponentStartS)/Math.max(.00001,o.s-opponentStartS),0,1):1;r.rivalDrift=o.drift;r.rivalSlip=o.slipAngle;updateBossState(r,dt,sample(o.track,o.s).curve);
    if(r.night&&!r.headlights&&r.speed>18&&previousGap>4.5&&previousGap<45&&r.collision===0){r.blindTime+=dt;if(r.blindTime>1)r.blindArmed=true;}
    else r.blindTime=Math.max(0,r.blindTime-dt*2);
    if(r.blindArmed&&!r.headlights&&r.night&&r.s>r.rivalS+6&&r.collision===0){r.blindPasses++;r.blindAward=2.5;r.skill.points+=600;r.blindArmed=false;}
    if(r.headlights||!r.night||r.collision>0||r.rivalS-r.s>65){r.blindArmed=false;r.blindTime=0;}
  }
  if (r.s >= r.track.length || r.timeLeft <= 0 || (r.mode!=='time'&&r.rivalFinished)) { r.finished = true; r.won = r.s >= r.track.length && (r.mode === 'time' || !r.rivalFinished || (r.track.length-frameStartS)/Math.max(.00001,r.s-frameStartS)<r.rivalFinishFraction); }
}
