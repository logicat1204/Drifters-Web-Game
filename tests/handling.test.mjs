import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARS,TRACKS,makeTrack,createRace,updateRace,sample,cornerSpeed} from '../js/sim.mjs';
import {driverInput,referenceDrive} from './helpers/reference-driver.mjs';

function curveRace({curve=.035,speed=22,wet=false,car=CARS[0]}={}){
  const track=makeTrack(TRACKS[0]);track.length=900;track.points=Array.from({length:150},(_,i)=>{const s=i*8,h=curve*s;return {s,x:(1-Math.cos(h))/curve,z:Math.sin(h)/curve,y:0,heading:h,curve};});
  const r=createRace(car,track,{mode:'time',wet});r.countdown=0;r.lateral=0;r.speed=speed;return r;
}
test('the car keeps its world heading instead of automatically following a bend',()=>{
  const r=curveRace({speed:20}),before=sample(r.track,r.s).heading+r.yaw;
  for(let i=0;i<45;i++)updateRace(r,{steer:0},1/120);
  assert.ok(Math.abs(sample(r.track,r.s).heading+r.yaw-before)<.01);
  assert.ok(r.lateral<-.5);assert.ok(r.yaw<-.1);
});
test('steering alone does not activate the drift assist or award drift points',()=>{
  const r=curveRace({speed:18});for(let i=0;i<60;i++)updateRace(r,{steer:.35,throttle:true},1/120);
  assert.equal(r.driftAssist,0);assert.equal(r.driftPoints,0);
});
test('full throttle exceeds the hairpin grip limit even with corrective steering',()=>{
  for(const car of CARS){const r=curveRace({car,speed:42});let impact=false,loss=0;for(let i=0;i<180;i++){const input=driverInput(r,{brake:false});updateRace(r,input,1/120);impact||=r.collision>.9;loss=Math.max(loss,r.understeer);}assert.ok(impact,car.id);assert.ok(loss>.7,car.id);}
});
test('a correctly slowed entry stays inside the same hairpin with no handbrake',()=>{
  for(const car of CARS){const r=curveRace({car,speed:cornerSpeed(car,.035)*.75});let impact=false;for(let i=0;i<240;i++){updateRace(r,driverInput(r),1/120);impact||=r.collision>.9;}assert.equal(impact,false,car.id);assert.ok(Math.abs(r.lateral)<2.5);}
});
test('wet asphalt lowers the available cornering speed',()=>{
  for(const car of CARS)assert.ok(cornerSpeed(car,.035,true)<cornerSpeed(car,.035,false)*.9);
});
test('a simultaneous steering and handbrake press immediately releases the rear axle',()=>{
  const r=createRace(CARS[0],makeTrack(TRACKS[0]),{mode:'time'});r.countdown=0;r.speed=28;r.lateral=0;
  updateRace(r,{steer:1,handbrake:true},1/120);assert.equal(r.driftAssist,1);assert.ok(r.yawRate<0);
});
test('a short handbrake tap rotates the body; holding it sacrifices much more speed',()=>{
  function maneuver(hold){const r=createRace(CARS[0],makeTrack(TRACKS[0]),{mode:'time'});r.countdown=0;r.speed=27;r.lateral=0;let slip=0;for(let i=0;i<90;i++){updateRace(r,{steer:i<30?.35:0,handbrake:i<(hold?90:16)},1/120);slip=Math.max(slip,Math.abs(r.slipAngle));}return {r,slip};}
  const tap=maneuver(false),hold=maneuver(true);assert.ok(tap.slip>.09);assert.ok(hold.r.speed<tap.r.speed-5);
});
test('planned braking beats the full-throttle strategy on all seven courses',()=>{
  for(const cfg of TRACKS){const clean=referenceDrive(cfg,{mode:'time'}),flat=referenceDrive(cfg,{mode:'time',brake:false});assert.ok(clean.race.won&&flat.race.won,cfg.id);assert.equal(clean.impacts,0,cfg.id);assert.ok(clean.brakingFrames>0,cfg.id);assert.ok(flat.impacts>=3,cfg.id);assert.ok(flat.race.elapsed>clean.race.elapsed*1.02,cfg.id+' rewards never braking');}
});
