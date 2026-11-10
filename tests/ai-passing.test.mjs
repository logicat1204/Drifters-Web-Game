import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARS,ALL_TRACKS,TRACKS,makeTrack,createRace,updateRace,rivalCar} from '../js/sim.mjs';
import {CAMPAIGN_STAGES} from '../js/campaign.mjs';
import {PASSING} from '../js/rival-ai.mjs';
import {CONTACT} from '../js/traffic.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
import {Store} from '../server/store.mjs';
import {Runs} from '../server/runs.mjs';
import {RunRecorder} from '../js/replay.mjs';
import {activateFocus} from '../js/focus.mjs';
const flat=makeTrack({...TRACKS[0],length:10000,elevation:0,layout:[[1,0]]});
function ready(rival,{track=flat,playerS=250,gap=45,lane=0,aiLane=lane,playerSpeed=40,aiSpeed=50,berserk=false}={}){
 const r=createRace(CARS[1],track,{mode:'campaign',rival,night:false,focusEnabled:false});Object.assign(r,{s:playerS,speed:playerSpeed,lateral:lane,countdown:0,timeLeft:1000});
 r.opponent=createRace(rivalCar(rival),track,{mode:'time',aiDriver:rival,focusEnabled:false});Object.assign(r.opponent,{s:playerS-gap,speed:aiSpeed,lateral:aiLane,countdown:0,timeLeft:1000});r.rivalS=r.opponent.s;r.rivalLateral=aiLane;
 if(berserk)r.boss.confirmedSide=-1;
 return r;
}
function tick(r,lane=0,speed=40){
 const input=driverInput({...r,lateral:r.lateral+r.lateralV*.45},{line:lane});
 if(speed!==null){input.brake||=r.speed>speed+.25;input.throttle=!input.brake&&r.speed<speed;}
 updateRace(r,input,1/120);
}
function runPass(r,{lane=0,speed=40,seconds=25}={}){
 let hits=0,walls=0,passed=false,alongside=0,boost=false,side=null;
 for(let i=0;i<seconds*120&&!r.finished;i++){
  const previous=r.contactCooldown,wall=r.opponent.wallCooldown;tick(r,lane,speed);const o=r.opponent;
  if(r.contactCooldown>previous+.1)hits++;if(o.wallCooldown>wall+.1)walls++;if(r.boss?.boost>0)boost=true;
  if(o.aiDriver.passing.side)side??=o.aiDriver.passing.side;
  if(Math.abs(r.s-o.s)<CONTACT.length){alongside++;assert.ok(Math.abs(r.lateral-o.lateral)>=CONTACT.width-.01,'physical clearance while alongside');}
  if(o.s-r.s>PASSING.mergeGap)passed=true;
 }
 return {hits,walls,passed,alongside,boost,side};
}
test('all campaign rivals pass a slower centered car using a real side lane without bumper or wall impacts',()=>{
 for(const rival of CAMPAIGN_STAGES){const r=ready(rival),result=runPass(r);assert.ok(result.passed,rival.id);assert.ok(result.alongside>0,rival.id);assert.equal(result.hits,0,rival.id);assert.equal(result.walls,0,rival.id);assert.ok(Math.abs(r.opponent.lateral)<.6,rival.id+' returns to normal line after clearing');}
});
test('Kanata chooses the open side near either barrier, including with the crimson counterattack',()=>{
 const rival=CAMPAIGN_STAGES.find(s=>s.id==='kanata-final');
 for(const lane of [-3.5,0,3.5]){const r=ready(rival,{lane,aiLane:0,gap:200,berserk:true}),result=runPass(r,{lane});assert.ok(result.passed);assert.ok(result.boost);assert.equal(result.hits,0);assert.equal(result.walls,0);if(lane<0)assert.equal(result.side,1);if(lane>0)assert.equal(result.side,-1);assert.equal(r.boss.enraged,false);}
});
test('a close faster rival brakes and makes room instead of repeatedly shoving the player',()=>{
 const rival=CAMPAIGN_STAGES.find(s=>s.id==='kanata-final'),r=ready(rival,{gap:9,playerSpeed:40,aiSpeed:45,berserk:true});const result=runPass(r);assert.ok(result.passed);assert.equal(result.hits,0);assert.equal(result.walls,0);
});
test('a rival already held behind by a previous contact can recover into a side pass',()=>{
 const rival=CAMPAIGN_STAGES.find(s=>s.id==='keisuke-project'),r=ready(rival,{gap:CONTACT.length+.001,aiSpeed:39.95});r.contactCooldown=r.opponent.contactCooldown=.6;r.collision=r.opponent.collision=.4;
 const result=runPass(r);assert.ok(result.passed);assert.equal(result.hits,0);assert.equal(result.walls,0);
});
test('the overtaking side stays committed until there is full longitudinal clearance',()=>{
 const r=ready(CAMPAIGN_STAGES.find(s=>s.id==='kanata-final'));let side=0,seenAlongside=false;
 for(let i=0;i<20*120;i++){tick(r);const o=r.opponent,p=o.aiDriver.passing;if(p.phase==='overtake'){side||=p.side;assert.equal(p.side,side);}if(Math.abs(o.s-r.s)<CONTACT.length){seenAlongside=true;assert.equal(p.phase,'overtake');assert.ok(Math.abs(o.lateral-r.lateral)>=CONTACT.width);}if(p.phase==='return'){assert.ok(o.s-r.s>PASSING.mergeGap);break;}}
 assert.ok(seenAlongside);
});
test('a moving player blocking the chosen side makes the rival yield and select another opening',()=>{
 const r=ready(CAMPAIGN_STAGES.find(s=>s.id==='kanata-final'),{gap:70,aiSpeed:50}),sides=new Set();let chosen=0,blockStart=null,hits=0,passed=false;
 for(let i=0;i<35*120;i++){
  const p=r.opponent.aiDriver.passing;if(p.phase==='overtake'&&!chosen){chosen=p.side;blockStart=i;}
  const lane=chosen&&i-blockStart<7*120?chosen*3.2:0,previous=r.contactCooldown;tick(r,lane);if(r.contactCooldown>previous+.1)hits++;
  if(p.side)sides.add(p.side);if(r.opponent.s>r.s+PASSING.mergeGap)passed=true;
 }
 assert.ok(chosen);assert.ok(passed);assert.equal(hits,0);assert.ok(sides.size<=2);
});
test('all three AI styles can pass through an actual course bend while respecting guardrails',()=>{
 const track=makeTrack(ALL_TRACKS.find(t=>t.id==='manazuru'));
 for(const style of ['Grip','Complete','Skiller']){const rival={...CAMPAIGN_STAGES.find(s=>s.id==='kanata-final'),id:'curve-pass',boss:null,style},r=ready(rival,{track,playerS:900,gap:45,playerSpeed:35,aiSpeed:42});const result=runPass(r,{speed:35,seconds:30});assert.ok(result.passed,style);assert.equal(result.hits,0,style);assert.equal(result.walls,0,style);}
});
test('campaign rivals also pass on their own real roads and keep control after merging',()=>{
 for(const rival of CAMPAIGN_STAGES){const track=makeTrack(ALL_TRACKS.find(t=>t.id===rival.track)),r=ready(rival,{track,playerS:260,gap:45,playerSpeed:30,aiSpeed:38});const result=runPass(r,{speed:30,seconds:40});assert.ok(result.passed,rival.id);assert.equal(result.hits,0,rival.id);assert.equal(result.walls,0,rival.id);}
});
test('an early detected stationary player can be passed without using the bumper or guardrail',()=>{
 const r=ready(CAMPAIGN_STAGES.find(s=>s.id==='kanata-final'),{gap:65,playerSpeed:0,aiSpeed:35});const result=runPass(r,{speed:0});assert.ok(result.passed);assert.equal(result.hits,0);assert.equal(result.walls,0);
});
test('a real pass, return to center and Kanata counter-pass replay identically on the server',async()=>{
 const store=new Store(':memory:');let now=0;
 try{
  const user=await store.register('PassingReplay24','passing-password-24');
  store.updateProfile(user.id,{complete:true,defaultCar:'r32'});
  for(const stage of CAMPAIGN_STAGES.slice(0,-1)){
   const won=createRace(CARS[2],makeTrack(ALL_TRACKS.find(t=>t.id===stage.track)),{mode:'campaign',campaignStage:stage.id,rival:stage});Object.assign(won,{s:won.track.length,elapsed:150,finished:true,won:true});store.addRun('pass-seed-'+stage.id,user.id,won);
  }
  for(const system of ['engine','chassis','brakes'])for(let tier=1;tier<=3;tier++)store.upgradeVehicle(user.id,'r32',system,tier);
  store.updateProfile(user.id,{focusType:'time'});const runs=new Runs(store,{now:()=>now}),attempt=runs.start(user.id,{car:'r32',mode:'campaign',campaignStage:'kanata-final'}),r=createRace(CARS[2],makeTrack(ALL_TRACKS.find(t=>t.id===attempt.track)),attempt.options),recorder=new RunRecorder();
  let playerPassed=false,settled=false,aiPassed=false,maneuver=false,impacts=0;
  for(let i=0;i<108000&&!r.finished;i++){
   if(!playerPassed&&r.s-r.rivalS>27)playerPassed=true;
   if(playerPassed&&Math.abs(r.lateral)<.25&&Math.abs(r.lateralV)<.5)settled=true;
   if(!settled&&r.focus.charge>=60&&activateFocus(r))recorder.action(1);
   // A clean attacking lane and pace are needed to establish the lead before
   // this integration fixture tests the return and counter-pass. Holding the
   // outside rail at .82 no longer outruns a rival that anticipates the bends.
   const input=driverInput(r,{line:playerPassed?0:-2.65,gripUse:.90});
   if(settled){input.brake||=r.speed>26.25;input.throttle=!input.brake&&r.speed<26;}
   // Evaluate AI-initiated contacts during its counter-pass. The attacking
   // player fixture can understeer into the rival in the opening hairpins;
   // those contacts are still captured and verified by the server replay.
   const old=r.contactCooldown;updateRace(r,recorder.capture(r,input),1/120);if(settled&&r.contactCooldown>old+.1)impacts++;
   maneuver||=settled&&r.opponent?.aiDriver.passing.phase==='overtake';aiPassed||=settled&&r.rivalS-r.s>PASSING.mergeGap;
  }
  assert.ok(playerPassed&&settled&&maneuver&&aiPassed);assert.equal(impacts,0);assert.ok(r.finished);assert.equal(r.won,false);now=900000;
  const saved=await runs.submit(user.id,attempt.id,recorder.frames);assert.equal(saved.won,r.won);assert.equal(saved.time,r.elapsed);assert.equal(saved.reward.coins,0);
 }finally{store.close();}
});
