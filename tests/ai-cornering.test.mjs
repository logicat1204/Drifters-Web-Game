import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_TRACKS,CARS,makeTrack,createRace,updateRace,rivalCar,rivalDriverInput} from '../js/sim.mjs';
import {campaignStages,campaignConditions} from '../js/campaign.mjs';

test('every seasonal rival holds a controlled line through the reference-course bends without brake chatter',()=>{
 const tracks=new Map(ALL_TRACKS.map(t=>[t.id,makeTrack(t)]));
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
  assert.ok(switches/r.elapsed<8,rival.id+' alternates brake too often: '+switches/r.elapsed+' /s');
 }
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
