import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_TRACKS,CARS,makeTrack,createRace,updateRace,rivalCar,rivalDriverInput} from '../js/sim.mjs';
import {campaignStages,campaignConditions} from '../js/campaign.mjs';

test('every seasonal rival holds its line and the seasonal pace progresses on all courses',()=>{
 const tracks=new Map(ALL_TRACKS.map(t=>[t.id,makeTrack(t)]));
 const times=new Map();
 for(const season of ['dry','rain','ngplus'])for(const rival of campaignStages(season)){
  const r=createRace(CARS[0],tracks.get(rival.track),{rival,...campaignConditions(rival),focusEnabled:false});
  Object.assign(r,{countdown:0,timeLeft:10000});let walls=0,switches=0,braking=false,maxError=0,cornerSamples=0;
  for(let tick=0;tick<108000&&!r.finished;tick++){
   const cooldown=r.opponent?.wallCooldown??0;updateRace(r,{},1/120);const o=r.opponent;
   if(o.wallCooldown>cooldown+.1)walls++;
   if(o.braking!==braking){switches++;braking=o.braking;}
   // Skip the grid offset and measure the physical car, not just its target.
   const point=o.track.points[Math.floor(o.s/o.track.step)];
   if(o.s>100&&Math.abs(point.curve)>.002){maxError=Math.max(maxError,Math.abs(o.lateral-o.targetLine));cornerSamples++;}
  }
  assert.ok(r.rivalFinished,rival.id+' finishes');assert.equal(walls,0,rival.id+' avoids rails');
  assert.ok(cornerSamples>100,rival.id+' actually crosses technical bends');
  assert.ok(maxError<2,rival.id+' overshoots its line: '+maxError.toFixed(3)+' m');
  assert.ok(switches/r.elapsed<1.5,rival.id+' alternates brake too often: '+switches/r.elapsed+' /s');
  times.set(rival.id,r.elapsed);
 }
 for(const rival of campaignStages()){
  const dry=times.get(rival.id),rain=times.get('rain:'+rival.id),ng=times.get('ngplus:'+rival.id);
  assert.ok(rain>=dry&&rain<dry*1.025,rival.id+' keeps nearly the same pace in rain');
  assert.ok(ng<rain,rival.id+' increases pace for NG+');
 }
});

test('the three styles show distinct rotation and sustained pedal pressure on the same real Akina course',()=>{
 const track=makeTrack(ALL_TRACKS.find(t=>t.id==='akina')),metrics={};
 for(const style of ['Grip','Complete','Skiller']){
  const rival={id:'akina-'+style,style,car:'ae86',level:3,color:'#fff'},r=createRace(CARS[0],track,{rival,focusEnabled:false});
  Object.assign(r,{countdown:0,timeLeft:10000});let rotating=0,frames=0,entry=null;const bursts=[];
  for(let i=0;i<108000&&!r.finished;i++){
   updateRace(r,{},1/120);const o=r.opponent,p=o.track.points[Math.floor(o.s/o.track.step)];
   // Measure actual physical pressure, not only the brake-lamp display state.
   if(o.brakePressure>.075){entry??=r.elapsed;}else if(entry!==null){bursts.push(r.elapsed-entry);entry=null;}
   if(Math.abs(p.curve)>.009){rotating+=Math.abs(o.slipAngle);frames++;}
  }
  assert.ok(r.rivalFinished,style);assert.ok(bursts.length>10&&bursts.length<150,style+' uses purposeful entry braking');
  assert.ok(bursts.reduce((s,x)=>s+x,0)/bursts.length>.4,style+' holds the brake instead of tapping it');
  assert.ok(bursts.filter(x=>x<.15).length<bursts.length*.25,style+' avoids repeated tiny pulses');
  metrics[style]=rotating/frames;
 }
 assert.ok(metrics.Complete>metrics.Grip+.02,JSON.stringify(metrics));
 assert.ok(metrics.Skiller>metrics.Complete+.06,JSON.stringify(metrics));
});

test('AI partial pedals apply proportional force while player binary controls retain their original behavior',()=>{
 const track=makeTrack({...ALL_TRACKS[0],layout:[[1,0]],elevation:0}),rival={id:'pedals',style:'Grip',car:'r32',level:3};
 const make=ai=>Object.assign(createRace(CARS[2],track,{mode:'time',rival,...(ai?{aiDriver:rival}:{})}),{countdown:0,lateral:0,speed:25});
 const coast=make(true),partial=make(true),full=make(true),softBrake=make(true),hardBrake=make(true);
 updateRace(coast,{},.05);updateRace(partial,{throttle:.4},.05);updateRace(full,{throttle:1},.05);
 updateRace(softBrake,{brake:.25},.05);updateRace(hardBrake,{brake:1},.05);
 assert.ok(coast.speed<partial.speed&&partial.speed<full.speed);
 assert.ok(hardBrake.speed<softBrake.speed&&softBrake.speed<coast.speed);
 const a=make(false),b=make(false);updateRace(a,{throttle:.4},.05);updateRace(b,{throttle:true},.05);assert.equal(a.speed,b.speed);
});

test('Skiller prepares its slide before a hairpin and transitions it toward the following bend',()=>{
 const rival={id:'corner-fixture',style:'Skiller',level:5,car:'ae86',color:'#fff'};
 const track={length:500,width:10.6,step:1,points:Array.from({length:600},(_,s)=>({s,x:0,z:s,y:0,heading:0,curve:s>=100&&s<150?.035:s>=150?-.035:0}))};
 const o=createRace(rivalCar(rival),track,{mode:'time',rival,aiDriver:rival,focusEnabled:false});
 Object.assign(o,{s:98,speed:30,lateral:0,countdown:0});
 const player={rival,s:-1000,speed:0,lateral:0};
 const entry=rivalDriverInput(player,o,1/120);
 assert.ok(o.aiDriver.slide>0,'rear rotation is prepared before the bend');
 assert.ok(o.aiDriver.slip>0);assert.ok(entry.steer<0,'front wheels anticipate the upcoming turn');
 // The car is still on the first bend, but its next apex is in the opposite direction.
 o.s=148;for(let i=0;i<24;i++)rivalDriverInput(player,o,1/120);
 assert.ok(o.aiDriver.slip<0,'slide follows the next curve rather than fighting it');
});
