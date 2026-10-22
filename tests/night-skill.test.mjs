import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARS,TRACKS,makeTrack,createRace,updateRace,toggleHeadlights,rivalDriverInput,lateralGrip,worldAt} from '../js/sim.mjs';
import {createSkillState,cornerQuality,updateCornerSkill} from '../js/skill.mjs';
import {rearCameraPose} from '../js/renderer.js';

test('corner intensity rewards speed near grip, never straights, crawling or overspeed',()=>{
  const base={curve:.015,speed:30,grip:lateralGrip(CARS[0]),lateral:0};
  const q=cornerQuality(base);assert.ok(q>.75);assert.ok(q>cornerQuality({...base,speed:21}));
  for(const overrides of [{curve:0},{speed:0},{speed:50},{collision:.2},{lateral:4.7},{slipAngle:.8},{travelYaw:.6}])assert.equal(cornerQuality({...base,...overrides}),0);
});
test('clean linked corners build grades and a collision breaks the chain',()=>{
  const r={skill:createSkillState(),speed:30,lateral:0,slipAngle:.03,travelYaw:0,collision:0};
  const run=(curve,seconds)=>{for(let i=0;i<seconds*120;i++)updateCornerSkill(r,1/120,curve,19.44);};
  run(.015,2);assert.equal(r.skill.level,3);assert.ok(r.skill.points>150);
  run(0,.5);assert.equal(r.skill.chain,1);assert.equal(r.skill.award.grade,'PERFECT APEX');
  run(-.015,2);run(0,.5);assert.equal(r.skill.chain,2);
  r.collision=1;run(.015,.2);assert.equal(r.skill.chain,0);assert.equal(r.skill.clean,false);
});
test('visual rewards and headlight switches give no handling or speed boost',()=>{
  const track=makeTrack(TRACKS[0]),a=createRace(CARS[0],track,{mode:'time'}),b=createRace(CARS[0],track,{mode:'time'});a.countdown=b.countdown=0;b.skill.points=10000;toggleHeadlights(b);
  for(let i=0;i<600;i++){const input={throttle:true,steer:i>550?.2:0};updateRace(a,input,1/120);updateRace(b,input,1/120);}
  for(const key of ['s','speed','yaw','lateral'])assert.equal(a[key],b[key]);assert.equal(a.headlights,true);assert.equal(b.headlights,false);assert.equal(toggleHeadlights(b),true);
});
function overtake({night=true,lights=false,collision=0}={}){
  const track=makeTrack(TRACKS[0]),r=createRace(CARS[0],track,{night});
  Object.assign(r,{countdown:0,s:100,speed:40,lateral:-2.5,headlights:lights,rivalS:130,collision});
  r.opponent=createRace({...CARS[0],accel:0,max:22},track,{mode:'time'});Object.assign(r.opponent,{countdown:0,s:130,speed:22,lateral:1.25,timeLeft:10000});
  for(let i=0;i<3.5*120;i++)updateRace(r,{throttle:true},1/120);return r;
}
test('blind attack requires a sustained clean unlit night approach and an actual pass',()=>{
  const r=overtake();assert.ok(r.s>r.rivalS+6);assert.equal(r.blindPasses,1);assert.ok(r.skill.points>=600);
  assert.equal(overtake({night:false}).blindPasses,0);assert.equal(overtake({lights:true}).blindPasses,0);
  const fresh=createRace(CARS[0],makeTrack(TRACKS[0]));fresh.countdown=0;fresh.headlights=false;fresh.s=160;fresh.rivalS=130;updateRace(fresh,{},1/120);assert.equal(fresh.blindPasses,0);
});
test('contact or switching the lamps back on cancels a prepared blind attack',()=>{
  for(const cancel of ['contact','lamps']){const r=createRace(CARS[0],makeTrack(TRACKS[0]));Object.assign(r,{countdown:0,blindArmed:true,blindTime:1.2,headlights:cancel==='lamps',collision:cancel==='contact'?.8:0});updateRace(r,{},1/120);assert.equal(r.blindArmed,false);assert.equal(r.blindTime,0);assert.equal(r.blindPasses,0);}
});
test('a driver visible in the mirrors provokes a defensive line; darkness removes that cue',()=>{
  const track=makeTrack(TRACKS[0]),r=createRace(CARS[0],track);r.s=100;r.speed=40;r.lateral=-2.5;
  const make=()=>{const o=createRace(CARS[0],track,{mode:'time'});Object.assign(o,{s:115,speed:25,lateral:.15});return o;};
  const visible=make(),hidden=make();rivalDriverInput(r,visible,.05);r.headlights=false;rivalDriverInput(r,hidden,.05);assert.ok(visible.targetLine<hidden.targetLine);
  r.night=false;const day=make();rivalDriverInput(r,day,.05);assert.equal(day.targetLine,visible.targetLine);
});
test('rear camera points behind the actual car including yaw and road elevation',()=>{
  const track=makeTrack(TRACKS[2]),r=createRace(CARS[0],track);r.s=1500;r.lateral=1.8;r.yaw=.17;
  const p=worldAt(track,r.s,r.lateral),a=p.heading+r.yaw,{eye,target}=rearCameraPose(track,r);
  const forward=[Math.sin(a),Math.cos(a)];assert.ok((target[0]-eye[0])*forward[0]+(target[2]-eye[2])*forward[1]<-31.9);
  assert.ok(Math.abs((eye[0]-p.x)*forward[0]+(eye[2]-p.z)*forward[1]+1.1)<1e-6);assert.ok(eye[1]>p.y+1);
});
