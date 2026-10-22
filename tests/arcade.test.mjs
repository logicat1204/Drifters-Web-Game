import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS,TRACKS,RIVALS,makeTrack,createRace,updateRace,sample,clamp } from '../js/sim.mjs';
import { createRoadIndex } from '../js/scenery.mjs';
import { Renderer } from '../js/renderer.js';
import { CABINS } from '../js/cockpit.js';
import {referenceDrive as driveWithGrip} from './helpers/reference-driver.mjs';

test('seven home courses have the requested drivers and matching machines',()=>{
  assert.deepEqual(TRACKS.map(t=>[t.id,t.rival]),[['akina','takumi'],['akagi','keisuke'],['iroha','kai'],['usui','mako'],['tsukuba','godhand'],['tsubaki','shinji'],['atami','kanata']]);
  assert.equal(RIVALS.mako.car,'sileighty');assert.equal(RIVALS.godhand.car,'s2000');assert.equal(RIVALS.kanata.car,'gt86');
  assert.ok(new Set(CARS.map(c=>CABINS[c.id].shape)).size>=3);
});
const rivalLaps=new Map();
function rivalLap(cfg,difficulty='normal',wet=false){
  const key=cfg.id+'-'+difficulty+'-'+wet;if(rivalLaps.has(key))return rivalLaps.get(key);
  const r=createRace(CARS[0],makeTrack(cfg),{difficulty,wet});r.countdown=0;r.timeLeft=10000;
  let braking=0,steering=0,impacts=0;
  for(let i=0;i<900*120&&!r.finished;i++){const cooldown=r.opponent?.wallCooldown??0;updateRace(r,{},1/120);braking+=r.rivalBraking?1:0;steering+=Math.abs(r.rivalSteer)>.1?1:0;if((r.opponent?.wallCooldown??0)>cooldown+.1)impacts++;}
  const result={race:r,braking,steering,impacts};rivalLaps.set(key,result);return result;
}
test('all seven rivals physically steer, brake, and complete their course without walls',()=>{
  for(const cfg of TRACKS){const {race:r,braking,steering,impacts}=rivalLap(cfg);assert.ok(r.rivalFinished,cfg.id);assert.ok(braking>120,cfg.id+' must brake');assert.ok(steering>600,cfg.id+' must steer');assert.equal(impacts,0,cfg.id);assert.ok(r.elapsed>=r.rival.pace*.99&&r.elapsed<r.rival.pace*1.07,cfg.id+' calibration');}
});
test('race clock cannot teleport the rival and distant player pace never changes it',()=>{
  const track=makeTrack(TRACKS[0]),a=createRace(CARS[0],track),b=createRace(CARS[2],track);a.countdown=b.countdown=0;a.s=0;b.s=5000;a.elapsed=500;b.elapsed=20;a.timeLeft=b.timeLeft=1000;
  for(let i=0;i<20*120;i++){updateRace(a,{},1/120);updateRace(b,{},1/120);assert.equal(a.rivalS,b.rivalS);assert.equal(a.rivalSpeed,b.rivalSpeed);}assert.ok(a.rivalS<track.length/3);
});
test('AI physically reaching the line ends duel and arcade, never time attack',()=>{
  for(const mode of ['battle','arcade','time']){const r=createRace(CARS[0],makeTrack(TRACKS[3]),{mode});r.countdown=0;r.timeLeft=500;updateRace(r,{},.01);if(r.opponent){r.opponent.s=r.track.length-.1;r.opponent.speed=30;}updateRace(r,{},.01);assert.equal(r.finished,mode!=='time');assert.equal(r.won,false);}
});

test('a player crossing first wins a duel, without exposing the rival schedule',()=>{
  const r=createRace(CARS[0],makeTrack(TRACKS[0]));r.countdown=0;r.s=r.track.length-.1;r.speed=40;r.elapsed=r.rival.pace-5;updateRace(r,{throttle:true},.01);assert.ok(r.finished);assert.ok(r.won);assert.equal(r.rivalFinished,false);
});
test('straight-line acceleration is preserved and countersteering reverses rotation promptly',()=>{
  for(const car of CARS){const r=createRace(car,makeTrack(TRACKS[0]),{mode:'time'});r.countdown=0;r.lateral=0;for(let i=0;i<3*120;i++)updateRace(r,{throttle:true},1/120);assert.ok(r.speed*3.6>100);r.speed=25;for(let i=0;i<20;i++)updateRace(r,{steer:1,throttle:true},1/120);assert.ok(r.yaw<0);assert.ok(r.yawRate<-.2);for(let i=0;i<20;i++)updateRace(r,{steer:-1,throttle:true},1/120);assert.ok(r.yawRate>.2);}
});
test('generated hills, foliage, buildings and landmarks never occupy any road corridor',()=>{
  for(const config of TRACKS){const track=makeTrack(config),index=createRoadIndex(track);const renderer=Object.create(Renderer.prototype);renderer.gl={createBuffer:()=>({}),bindBuffer(){},bufferData(){},deleteBuffer(){},ARRAY_BUFFER:1,STATIC_DRAW:2};renderer.setTrack(track);assert.ok(renderer.sceneryBounds.length>20);for(const object of renderer.sceneryBounds){assert.ok(index.distance(object.x,object.z,object.radius+32)>track.width/2+object.radius+1.79,`${config.id}: blocked corridor`);}assert.ok(renderer.scene.count>0);}
});
test('all seven authored roads have no non-neighbor centerline crossings',()=>{
  const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  for(const cfg of TRACKS){const p=makeTrack(cfg).points;for(let i=0;i<p.length-1;i++)for(let j=i+12;j<p.length-1;j++){const a=p[i],b=p[i+1],c=p[j],d=p[j+1];if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.z,b.z)<Math.min(c.z,d.z)||Math.max(c.z,d.z)<Math.min(a.z,b.z))continue;assert.ok(!(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0),cfg.id);}}
});
test('normal rivals leave a modest winning margin for a clean attacking AE86 lap',()=>{
  for(const cfg of TRACKS){const {race:r}=driveWithGrip(cfg,{mode:'time'}),ai=rivalLap(cfg).race;const margin=(ai.elapsed-r.elapsed)/ai.elapsed;assert.ok(margin>.01,cfg.id+' should allow a clean win');assert.ok(margin<.09,cfg.id+' should remain competitive');}
});
test('legend remains beatable by a clean attacking GT-R lap',()=>{
  for(const cfg of TRACKS){const {race:r}=driveWithGrip(cfg,{car:CARS[2],mode:'time'}),ai=rivalLap(cfg,'hard').race;assert.ok(ai.elapsed>r.elapsed,cfg.id+' legend impossible');}
});
test('all levels have distinct physical pace and rain also slows the rival',()=>{
  for(const cfg of TRACKS){const easy=rivalLap(cfg,'easy').race,normal=rivalLap(cfg).race,hard=rivalLap(cfg,'hard').race,wet=rivalLap(cfg,'normal',true).race;assert.ok(easy.elapsed>normal.elapsed*1.025,cfg.id);assert.ok(normal.elapsed>hard.elapsed*1.02,cfg.id);assert.ok(wet.elapsed>normal.elapsed*1.025,cfg.id);}
});
