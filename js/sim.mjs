import { COURSE_LAYOUTS, TRACKS, RIVALS } from './courses.mjs';
import {createSkillState,updateCornerSkill} from './skill.mjs';
import {FOCUS,createFocus,cancelFocus,updateFocus} from './focus.mjs';
export { TRACKS, RIVALS };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const HANDLING_VERSION='v5';
export function steeringAngle(speed){return .5/(1+Math.max(0,speed)*.045);}
export function lateralGrip(car,wet=false){return 18*car.grip*(wet?.75:1);}
export function cornerSpeed(car,curve,wet=false){return Math.sqrt(lateralGrip(car,wet)/Math.max(.00001,Math.abs(curve)));}
export function toggleHeadlights(r){r.headlights=!r.headlights;return r.headlights;}
export function repositionRace(r){
  if(r.finished||r.countdown>0||r.resetCooldown>0)return false;
  cancelFocus(r);
  Object.assign(r,{lateral:0,speed:0,yaw:0,yawRate:0,travelYaw:0,lateralV:0,steer:0,gripUsage:0,understeer:0,driftAssist:0,slipAngle:0,drift:0,combo:0,gear:1,rpm:1000,handbrakeDown:false,braking:true,collision:0,wallCooldown:0,wallContact:0,wallTouch:0,wallSlow:0,blindArmed:false,blindTime:0,resetHold:.45,resetCooldown:2,resetId:(r.resetId||0)+1});
  Object.assign(r.skill,{chain:0,intensity:0,level:0,corner:false,clean:false,quiet:0,cornerPoints:0,peak:0,award:null,flash:0});
  return true;
}
export const CAR_PROFILES={
  agile:{name:'ÁGIL',description:'Más agarre en curvas; menor aceleración y velocidad punta.'},
  balanced:{name:'EQUILIBRADO',description:'Buen compromiso entre curvas, aceleración y velocidad punta.'},
  power:{name:'POTENCIA',description:'Más aceleración y punta; frena antes para tomar las curvas.'}
};
export const CARS = [
  { id:'ae86',name:'SPRINTER TRUENO',code:'AE86',brand:'TOYOTA',year:'1983',drive:'FR',power:'130',weight:'940',color:'#e5e5dc',accel:13.8,max:62,grip:1.16,profile:'agile',label:'El maestro de las curvas' },
  { id:'rx7',name:'RX-7 TYPE R',code:'FD3S',brand:'MAZDA',year:'1991',drive:'FR',power:'255',weight:'1260',color:'#e7b948',accel:15.3,max:68,grip:1.10,profile:'balanced',label:'El equilibrio rotativo' },
  { id:'r32',name:'SKYLINE GT-R',code:'BNR32',brand:'NISSAN',year:'1989',drive:'4WD',power:'280',weight:'1430',color:'#8794a2',accel:16.1,max:71,grip:1.04,profile:'power',label:'Potencia en las rectas' },
  { id:'mr2',name:'MR2 G-LIMITED',code:'SW20',brand:'TOYOTA',year:'1989',drive:'MR',power:'165',weight:'1180',color:'#e5e2d5',accel:13.9,max:61,grip:1.18,profile:'agile',label:'Precisión de motor central' },
  { id:'s2000',name:'S2000',code:'AP1',brand:'HONDA',year:'1999',drive:'FR',power:'250',weight:'1240',color:'#bf3e37',accel:14.2,max:63,grip:1.17,profile:'agile',label:'Agilidad a altas vueltas' },
  { id:'silvia',name:"SILVIA K’S",code:'S13',brand:'NISSAN',year:'1989',drive:'FR',power:'175',weight:'1120',color:'#6e9796',accel:15.0,max:67,grip:1.11,profile:'balanced',label:'Control y respuesta turbo' },
  { id:'supra',name:'SUPRA RZ',code:'JZA80',brand:'TOYOTA',year:'1993',drive:'FR',power:'280',weight:'1490',color:'#bdc4c8',accel:16.4,max:73,grip:1.02,profile:'power',label:'El empuje del biturbo' }
].map(car=>({...car,stats:[Math.round(car.accel/17*100),Math.round(car.grip/1.20*100),Math.round(car.max/75*100)]}));
export function makeTrack(config) {
  const step = 8, points = [];
  const recipe=COURSE_LAYOUTS[config.id],total=recipe.reduce((sum,p)=>sum+p[0],0);
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
  const mode=opts.mode||'battle',rival=RIVALS[track.rival];
  return { car, track, rival, s: 12, lateral: -1.7, speed: 0, yaw: 0, yawRate:0, travelYaw:0, lateralV: 0, steer: 0, gripUsage:0, understeer:0, cornerSpeed:car.max, handbrakeDown:false, driftAssist:0, slipAngle:0, gear: 1, rpm: 1000, elapsed: 0, countdown: 3, rivalS: 24, rivalSpeed: 0, rivalLateral:1.5,rivalYaw:0,rivalFinished:false, opponent:null,rivalBraking:false,rivalSteer:0,headlights:true,night:opts.night!==false,blindTime:0,blindPasses:0,blindAward:0,blindArmed:false,braking:false,skill:createSkillState(),focus:createFocus(),resetId:0,resetHold:0,resetCooldown:0,wallContact:0,wallTouch:0,wallSlow:0, drift: 0, driftPoints: 0, combo: 0, bestCombo: 0, wallCooldown: 0, collision: 0, checkpoints: 0, timeLeft: Math.ceil(track.length/32)+25, finished: false, won: false, manual: !!opts.manual, wet: !!opts.wet, mode, difficulty: opts.difficulty || 'normal' };
}
export function rivalCar(rival){
  const base=CARS.find(c=>c.id===rival.car)||CARS[0];
  // Rivals keep their calibrated setups independently of the playable garage.
  const tune={ae86:{max:62,accel:13.8,grip:1.08},rx7:{max:68,accel:15.3,grip:1.12},mr2:{max:62,accel:14,grip:1.09},sileighty:{max:62,accel:13.8,grip:1.08},s2000:{max:64,accel:14.1,grip:1.12},ae86coupe:{max:62,accel:13.8,grip:1.09},gt86:{max:64,accel:14.3,grip:1.12}}[rival.car]||{};
  return {...base,...tune,id:rival.car,color:rival.color};
}
export function rivalDriverInput(r,o,dt){
  const level=r.difficulty,tune={keisuke:.85,godhand:.87,kanata:.91}[r.rival.id]??.92,baseGrip=r.rival.id==='keisuke'?.61:.67;
  const gripUse=baseGrip+(level==='easy'?-.09:level==='hard'?.12:0),maxUse=clamp(tune+(level==='easy'?-.07:level==='hard'?.075:0),.7,1);
  const grip=lateralGrip(o.car,o.wet),p=sample(o.track,o.s),v=o.speed;
  let target=o.car.max*maxUse;
  for(let ahead=0;ahead<=210;ahead+=10){const c=Math.abs(sample(o.track,o.s+ahead).curve),safe=Math.sqrt(grip*gripUse/Math.max(.0001,c));target=Math.min(target,Math.sqrt(safe*safe+2*13* ahead));}
  const gap=o.s-r.s,visible=!r.night||r.headlights;
  let line=clamp(.15+sample(o.track,o.s+22).curve*38,-.9,1.2);
  if(visible&&gap>4&&gap<25&&r.speed>v+1)line=clamp(line+(r.lateral-line)*.18,-1.25,1.25);
  o.targetLine=(o.targetLine??o.lateral)+(line-(o.targetLine??o.lateral))*(1-Math.exp(-dt*1.2));
  const brake=v>target+.3,throttle=!brake&&v<target+.15;
  const desiredTravel=clamp(-(o.lateral-o.targetLine)*.055,-.18,.18),roadRate=p.curve*v*Math.cos(o.travelYaw)/clamp(1-p.curve*o.lateral,.65,1.35);
  const travelRate=roadRate+(desiredTravel-o.travelYaw)*3.3,alignment=(brake&&Math.abs(o.steer)>.32?6.2:9.5)*(1-o.driftAssist*.28),desiredBody=o.travelYaw+travelRate/alignment;
  const bodyRate=roadRate+(desiredBody-o.yaw)*9,wheelbase=o.car.id==='r32'?2.62:o.car.id==='rx7'?2.43:2.4;
  return {steer:-clamp(Math.atan(bodyRate*wheelbase/Math.max(2,v))/steeringAngle(v),-1,1),throttle,brake,handbrake:false};
}
export function updateRace(r, input, dt) {
  if (r.finished) return;
  dt = clamp(dt, 0, .05);
  if (r.countdown > 0) { r.countdown = Math.max(0, r.countdown - dt); return; }
  r.elapsed += dt; r.timeLeft -= dt; r.collision = Math.max(0, r.collision - dt * 2); r.wallCooldown -= dt;
  const resetHeld=r.resetHold>0;r.resetHold=Math.max(0,r.resetHold-dt);r.resetCooldown=Math.max(0,r.resetCooldown-dt);
  if(resetHeld)input={steer:0,throttle:false,brake:true,handbrake:false};
  r.wallSlow=Math.max(0,r.wallSlow-dt);r.wallTouch=Math.max(0,r.wallTouch-dt);if(r.wallTouch===0)r.wallContact=0;
  const concentrating=r.focus.remaining>0&&r.collision===0,maxSpeed=r.car.max*(concentrating?FOCUS.topSpeed:1);
  const p = sample(r.track, r.s), speed = r.speed;
  // The +Z camera sees world +X on its left; positive player input is screen-right.
  const targetSteer = -clamp(input.steer || 0, -1, 1);
  r.steer = mix(r.steer, targetSteer, 1 - Math.exp(-dt * 16));
  const handbrake=!!input.handbrake&&speed>8,braking=!!input.brake;
  r.braking=braking;
  const baseGrip=lateralGrip(r.car,r.wet),grip=baseGrip*(concentrating?FOCUS.grip:1),wheelbase=r.car.id==='r32'?2.62:r.car.id==='rx7'?2.43:2.4;
  const brakeInitiation=braking&&Math.abs(r.steer)>.32&&speed>16;
  if(handbrake&&!r.handbrakeDown&&Math.abs(targetSteer)>.15){r.driftAssist=1;r.yawRate+=Math.sign(targetSteer)*1.1;}
  if(handbrake&&Math.abs(r.steer)>.15)r.driftAssist=1;
  else if(brakeInitiation)r.driftAssist=Math.max(r.driftAssist,.45);
  r.handbrakeDown=handbrake;
  if(!handbrake)r.driftAssist=Math.max(0,r.driftAssist-dt*1.25);
  // The friction budget limits the *velocity direction*, independently of body
  // rotation. More steering cannot create more lateral force at excessive speed.
  const budget=grip*(input.throttle?.91:braking?.96:1)*(handbrake?.66:1);
  const requestedRate=speed/wheelbase*Math.tan(r.steer*steeringAngle(speed));
  const yawBudget=budget/Math.max(6,speed)*(1+r.driftAssist*.75);
  const bodyRate=clamp(requestedRate,-yawBudget,yawBudget);
  r.yawRate=mix(r.yawRate,bodyRate,1-Math.exp(-dt*(r.driftAssist>0?12:10)));
  const alignment=(handbrake?2.7:brakeInitiation?6.2:9.5)*(1-r.driftAssist*.28)*(concentrating?1.15:1);
  const travelRate=clamp((r.yaw-r.travelYaw)*alignment,-budget/Math.max(6,speed),budget/Math.max(6,speed));
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
  const gearMax = [0, 20, 33, 44, 55, maxSpeed];
  if (!r.manual) { while (r.gear < 5 && speed > gearMax[r.gear] * .91) r.gear++; while (r.gear > 1 && speed < gearMax[r.gear - 1] * .72) r.gear--; }
  const accel = r.car.accel * Math.max(.15, 1 - speed / (maxSpeed * 1.13))*(concentrating?FOCUS.acceleration:1);
  const overrev = r.manual && speed > gearMax[r.gear] ? 0 : 1;
  r.speed += ((input.throttle&&!braking ? accel * overrev : -1.05) - (braking ? 19 : 0) - (handbrake ? 13 : 0) - .00048 * speed * speed - r.understeer*3.2 - Math.abs(r.slipAngle)*speed*.10 - r.drift*1.2) * dt;
  if (Math.abs(r.lateral) > 4.1) r.speed -= dt * 5;
  const wallSide=Math.sign(r.lateral),scraping=r.wallTouch>0&&r.wallContact===wallSide&&Math.abs(r.lateral)>4.45&&wallSide*(r.travelYaw+r.yaw)>0;
  if (Math.abs(r.lateral)>=4.65 || scraping) {
    const fresh=r.wallContact!==wallSide||r.wallTouch===0;
    r.lateral=wallSide*Math.min(Math.abs(r.lateral),4.65);
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
  r.speed = clamp(r.speed, 0, maxSpeed);
  r.rpm = clamp(1000 + r.speed / gearMax[r.gear] * 7000, 900, 8500);
  r.s+=r.speed*Math.max(.12,Math.cos(r.travelYaw))/clamp(1-p.curve*r.lateral,.65,1.35)*dt;
  if (r.drift > .25 && Math.abs(r.slipAngle)>.09 && r.speed > 12 && Math.abs(r.lateral) < 4.2) { r.combo += dt * r.speed * r.drift * 7; r.driftPoints += dt * r.speed * r.drift * 7; r.bestCombo = Math.max(r.bestCombo, r.combo); } else r.combo = Math.max(0, r.combo - dt * 180);
  const checkpoint = Math.min(3, Math.floor(r.s / (r.track.length / 4)));
  if (checkpoint > r.checkpoints) { r.timeLeft += 14; r.checkpoints = checkpoint; }
  updateCornerSkill(r,dt,p.curve,grip);
  updateFocus(r,dt,p.curve,baseGrip);
  r.blindAward=Math.max(0,r.blindAward-dt);
  if(r.mode!=='time'){
    if(!r.opponent){r.opponent=createRace(rivalCar(r.rival),r.track,{mode:'time',wet:r.wet,night:r.night});Object.assign(r.opponent,{s:24,lateral:1.25,countdown:0,timeLeft:10000});}
    const previousGap=r.rivalS-r.s;
    updateRace(r.opponent,rivalDriverInput(r,r.opponent,dt),dt);
    const o=r.opponent;r.rivalS=o.s;r.rivalSpeed=o.speed;r.rivalLateral=o.lateral;r.rivalYaw=o.yaw;r.rivalBraking=o.braking;r.rivalSteer=o.steer;r.rivalFinished=o.finished;
    if(r.night&&!r.headlights&&r.speed>18&&previousGap>4.5&&previousGap<45&&r.collision===0){r.blindTime+=dt;if(r.blindTime>1)r.blindArmed=true;}
    else r.blindTime=Math.max(0,r.blindTime-dt*2);
    if(r.blindArmed&&!r.headlights&&r.night&&r.s>r.rivalS+6&&r.collision===0){r.blindPasses++;r.blindAward=2.5;r.skill.points+=600;r.blindArmed=false;}
    if(r.headlights||!r.night||r.collision>0||r.rivalS-r.s>65){r.blindArmed=false;r.blindTime=0;}
    if(!resetHeld&&Math.abs(r.s-r.rivalS)<4.1&&Math.abs(r.lateral-r.rivalLateral)<1.7&&r.wallCooldown<=0){r.speed*=.87;o.speed*=.94;r.lateral+=r.lateral>r.rivalLateral?.35:-.35;r.collision=.55;r.wallCooldown=1;}
  }
  if (r.s >= r.track.length || r.timeLeft <= 0 || (r.mode!=='time'&&r.rivalFinished)) { r.finished = true; r.won = r.s >= r.track.length && (r.mode === 'time' || !r.rivalFinished); }
}
