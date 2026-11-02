import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RacePresentation,PHYSICS_STEP,presentationPose,angleMix,remotePoses} from '../js/presentation.mjs';
import {CARS,TRACKS,createRace,makeTrack,updateRace,repositionRace} from '../js/sim.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
const ready=()=>{const r=createRace(CARS[0],makeTrack(TRACKS[0]),{mode:'time'});r.countdown=0;return r;};

test('visual positions advance smoothly between 120 Hz steps at 60, 75, 144 and 240 Hz',()=>{
 for(const hz of [60,75,90,120,144,165,240]){
  const r=ready(),p=new RacePresentation();Object.assign(r,{s:0,speed:50,rivalS:20,rivalSpeed:50});p.reset(r);let accumulator=0,t=0,last=-1;
  for(let frame=0;frame<hz*3;frame++){
   const dt=1/hz;t+=dt;accumulator+=dt;while(accumulator>=PHYSICS_STEP){p.beforeStep(r);r.s+=50*PHYSICS_STEP;r.rivalS+=50*PHYSICS_STEP;accumulator-=PHYSICS_STEP;}
   const view=p.sample(r,accumulator/PHYSICS_STEP,dt);
   if(t>.03)assert.ok(Math.abs(view.s-(t-PHYSICS_STEP)*50)<1e-8,hz+' Hz');
   assert.ok(view.s>=last-1e-9);assert.ok(Math.abs(view.rivalS-view.s-20)<1e-8);last=view.s;
  }
 }
});

test('interpolation removes alternating position steps with uneven display intervals',()=>{
 const r=ready(),p=new RacePresentation();Object.assign(r,{s:0,speed:60});p.reset(r);let accumulator=0,t=0,previous=null;const raw=[],smooth=[];
 for(let i=0;i<700;i++){
  const dt=[.011,.023,.016,.007,.033,.004,.02][i%7];t+=dt;accumulator+=dt;while(accumulator>=PHYSICS_STEP){p.beforeStep(r);r.s+=r.speed*PHYSICS_STEP;accumulator-=PHYSICS_STEP;}
  const view=p.sample(r,accumulator/PHYSICS_STEP,dt);
  if(previous&&t>.1){raw.push((r.s-previous.raw)/dt);smooth.push((view.s-previous.visual)/dt);}
  previous={raw:r.s,visual:view.s};
 }
 const deviation=values=>Math.sqrt(values.reduce((n,v)=>n+(v-60)**2,0)/values.length);
 assert.ok(deviation(raw)>10);assert.ok(deviation(smooth)<1e-7);
});

test('rendering a pose never changes driving, contacts, timer or replay input state',()=>{
 const a=ready(),b=ready(),p=new RacePresentation();p.reset(a);
 for(let i=0;i<3600;i++){const input=driverInput(a);p.beforeStep(a);updateRace(a,input,PHYSICS_STEP);updateRace(b,input,PHYSICS_STEP);p.sample(a,(i%11)/11,PHYSICS_STEP);}
 assert.deepEqual(a,b);
});

test('player and rival orientation follow the short arc and reset/finish events snap immediately',()=>{
 const r=ready(),p=new RacePresentation();Object.assign(r,{yaw:3.13,rivalYaw:3.13,lateral:4,speed:30,s:300});p.reset(r);p.beforeStep(r);r.yaw=r.rivalYaw=-3.13;
 const view=p.sample(r,.5);assert.ok(Math.abs(view.yaw-Math.PI)<.00001);assert.equal(view.yaw,view.rivalYaw);assert.ok(Math.abs(angleMix(3.13,-3.13,.5)-Math.PI)<.00001);
 repositionRace(r);const reset=p.sample(r,.2);assert.equal(reset.lateral,0);assert.equal(reset.speed,0);assert.equal(reset.s,r.s);
 p.beforeStep(r);r.s+=1;r.finished=true;assert.equal(p.sample(r,0).s,r.s);
 r.finished=false;p.reset(r);p.beforeStep(r);r.s+=1;assert.equal(p.sample(r,0,0,false).s,r.s);assert.equal(p.sample(null,0),null);assert.equal(p.lastView,null);
});

test('small online corrections are eased only in the image; large corrections and recovery snap',()=>{
 const r=ready(),p=new RacePresentation();Object.assign(r,{s:100,lateral:1,yaw:0});p.reset(r);const before=presentationPose(r);r.s+=.6;r.lateral+=.2;p.correct(r,before);
 assert.equal(r.s,100.6);assert.equal(r.lateral,1.2);assert.ok(Math.abs(p.sample(r,1,1/60).s-100)<1e-9);
 for(let i=0;i<40;i++)p.sample(r,1,1/60);assert.ok(Math.abs(p.sample(r,1).s-r.s)<.001);
 const old=presentationPose(r);r.s+=30;p.correct(r,old);assert.equal(p.sample(r,0).s,r.s);
 const oldReset=presentationPose(r);r.resetId++;r.lateral=0;r.speed=0;p.correct(r,oldReset);assert.equal(p.sample(r,.4).lateral,0);
 r.lateral=4.5;p.reset(r);const nearWall=presentationPose(r);r.lateral=4.1;p.correct(r,nearWall);p.beforeStep(r);r.lateral=4.65;assert.ok(p.sample(r,1).lateral<=4.65,'visual correction cannot push the car through a guardrail');
});

test('remote cars interpolate, fill at most 75 ms of a late packet gap and leave snapshots intact',()=>{
 const state=(s,more={})=>({s,lateral:0,yaw:0,speed:40,travelYaw:0,lateralV:0,resetId:0,countdown:0,finished:false,...more});
 const frame=(received,s,more={})=>({received,players:[{id:'rival',car:'rx7',connected:true,state:state(s,more)}]}),frames=[frame(0,100),frame(50,102)],before=structuredClone(frames);
 assert.equal(remotePoses(frames,25)[0].s,101);assert.equal(remotePoses(frames,-10)[0].s,100);
 assert.equal(remotePoses(frames,75)[0].s,103);assert.equal(remotePoses(frames,125)[0].s,105);assert.equal(remotePoses(frames,500)[0].s,105);
 assert.deepEqual(frames,before);
});

test('remote reposition never sweeps through the road and finish/held recovery never extrapolate',()=>{
 const player=(s,lateral,resetId,extra={})=>({id:'remote',car:'ae86',connected:true,state:{s,lateral,resetId,yaw:0,speed:40,countdown:0,...extra}}),frames=[{received:0,players:[player(100,4.5,0)]},{received:50,players:[player(100,0,1,{speed:0,resetHold:.45})]}];
 assert.equal(remotePoses(frames,25)[0].lateral,4.5);assert.equal(remotePoses(frames,50)[0].lateral,0);assert.equal(remotePoses(frames,500)[0].s,100);
 const finished=[{received:0,players:[player(500,0,0,{finished:true})]}];assert.equal(remotePoses(finished,75)[0].s,500);
});
