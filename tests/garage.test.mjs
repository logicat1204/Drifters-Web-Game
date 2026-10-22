import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARS,CAR_PROFILES,TRACKS,makeTrack,createRace,updateRace} from '../js/sim.mjs';
import {CABINS} from '../js/cockpit.js';
import {Renderer} from '../js/renderer.js';
import {referenceDrive} from './helpers/reference-driver.mjs';

test('the seven-car roster covers all profiles, with cabins and separate original meshes',()=>{
  assert.equal(CARS.length,7);assert.equal(new Set(CARS.map(c=>c.id)).size,7);
  const uploads=[],renderer=Object.create(Renderer.prototype);renderer.cars={};renderer.gl={createBuffer:()=>({}),bindBuffer(){},bufferData(_target,data){assert.ok(data.every(Number.isFinite));uploads.push(data);},ARRAY_BUFFER:1,STATIC_DRAW:2};
  for(const car of CARS){assert.ok(CAR_PROFILES[car.profile]);assert.ok(CABINS[car.id]);renderer.setCar(car);assert.ok(renderer.cars[car.id].count>0);}
  renderer.setNetworkPlayers(CARS.map(car=>({car:car.id})));assert.equal(uploads.length,14);
  for(const car of CARS)assert.ok(renderer.cars['network-'+car.id].count>0);
  assert.equal(new Set(uploads.slice(0,7).map(data=>Array.from(data.filter((_,i)=>i%10<3)).join(','))).size,7,'each body has distinct geometry beyond paint');
});

function flatTrack(curve=0){const track=makeTrack(TRACKS[0]);track.length=20000;track.points=Array.from({length:2600},(_,i)=>{const s=i*8,h=curve*s;return {s,x:curve?(1-Math.cos(h))/curve:0,z:curve?Math.sin(h)/curve:s,y:0,heading:h,curve};});return track;}
function drive(car,curve,speed,seconds){const r=createRace(car,flatTrack(curve),{mode:'time'});Object.assign(r,{countdown:0,lateral:0,speed,timeLeft:1000});for(let i=0;i<seconds*120;i++)updateRace(r,{throttle:true,steer:curve?-.9:0},1/120);return r;}
test('agile cars turn more at equal speed while power cars accelerate harder and reach higher speeds',()=>{
  const results=CARS.map(car=>({car,turn:drive(car,.035,28,.35),launch:drive(car,0,0,3),straight:drive(car,0,0,45)}));
  const agile=results.filter(x=>x.car.profile==='agile'),balanced=results.filter(x=>x.car.profile==='balanced'),power=results.filter(x=>x.car.profile==='power');
  assert.ok(agile.every(a=>balanced.every(b=>a.turn.yaw>b.turn.yaw)), 'agility must affect actual turning');
  assert.ok(balanced.every(a=>power.every(b=>a.turn.yaw>b.turn.yaw)));
  for(const [slower,faster] of [[agile,balanced],[balanced,power]])for(const a of slower)for(const b of faster){assert.ok(a.launch.speed<b.launch.speed);assert.ok(a.straight.speed<b.straight.speed);}
});
test('every playable car can finish every course cleanly with braking, including wet hairpins',()=>{
  for(const car of CARS)for(const cfg of TRACKS){const {race,impacts}=referenceDrive(cfg,{car,mode:'time'});assert.ok(race.finished&&race.won,`${car.id}/${cfg.id}`);assert.equal(impacts,0,`${car.id}/${cfg.id}`);}
  for(const car of CARS){const {race,impacts}=referenceDrive(TRACKS[2],{car,mode:'time',wet:true});assert.ok(race.won,car.id);assert.equal(impacts,0,car.id);}
});
