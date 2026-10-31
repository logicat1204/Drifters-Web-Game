import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARS,TRACKS,makeTrack,createRace,rivalCar,rivalDriverInput,updateRace} from '../js/sim.mjs';
import {CAMPAIGN_STAGES} from '../js/campaign.mjs';
import {TRAFFIC_LEVELS,CRIMSON_TRAFFIC,trafficBehavior,PASSING} from '../js/rival-ai.mjs';
import {CONTACT} from '../js/traffic.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
const track=makeTrack({...TRACKS[0],length:10000,elevation:0,layout:[[1,0]]});
function fixture({level=5,gap=20,crimson=false,frontSpeed=45,aiSpeed=50}={}){
 const rival={...CAMPAIGN_STAGES.find(s=>s.id==='kanata-final'),level},r=createRace(CARS[1],track,{rival,night:false});Object.assign(r,{s:250,lateral:0,speed:frontSpeed,countdown:0,timeLeft:1000});
 r.opponent=createRace(rivalCar(rival),track,{mode:'time',aiDriver:rival,focusEnabled:false});Object.assign(r.opponent,{s:250-gap,lateral:0,speed:aiSpeed,countdown:0,timeLeft:1000});r.rivalS=r.opponent.s;r.boss.enraged=crimson;
 return r;
}
function drive(r,lane=0,speed=45){const input=driverInput({...r,lateral:r.lateral+r.lateralV*.45},{line:lane});input.brake||=r.speed>speed+.25;input.throttle=!input.brake&&r.speed<speed;updateRace(r,input,1/120);}
test('a committed attack keeps its lane when the player reacts, then uses an opposite opening',()=>{
 const r=fixture(),o=r.opponent;rivalDriverInput(r,o,.01);const p=o.aiDriver.passing,side=p.side,lane=p.lane,commit=p.commitRemaining;
 r.lateral=lane;r.lateralV=side*3;for(let i=0;i<Math.floor(commit*100)-2;i++)rivalDriverInput(r,o,.01);
 assert.equal(p.side,side);assert.equal(p.lane,lane);assert.ok(p.commitRemaining>0);
 for(let i=0;i<5;i++)rivalDriverInput(r,o,.01);assert.equal(p.side,-side);assert.equal(p.feints,1);assert.ok(p.commitRemaining>1);
});
test('once alongside, the rival holds its established line and throttle through a late closure',()=>{
 const r=fixture({gap:1}),o=r.opponent,p=o.aiDriver.passing;Object.assign(o,{lateral:2.5,targetLine:2.5});Object.assign(p,{phase:'overtake',side:1,lane:2.5});
 rivalDriverInput(r,o,.01);assert.ok(p.contesting);
 r.lateral=2.3;r.lateralV=3;const input=rivalDriverInput(r,o,.01);
 assert.ok(p.contesting);assert.equal(p.lane,2.5);assert.equal(p.side,1);assert.equal(input.brake,false);assert.equal(input.throttle,true);assert.ok(o.aiDriver.targetSpeed>r.speed+15);
 o.s=r.s-CONTACT.length-.2;rivalDriverInput(r,o,.01);assert.equal(p.contesting,false,'full loss of overlap ends priority');
});
test('higher levels keep closer pressure and crimson makes Kanata the most assertive',()=>{
 const targets=[];for(let level=1;level<=5;level++){const r=fixture({level,gap:8}),o=r.opponent;rivalDriverInput(r,o,.01);targets.push(o.aiDriver.targetSpeed);assert.equal(trafficBehavior(r,o),TRAFFIC_LEVELS[level]);}
 for(let i=1;i<targets.length;i++)assert.ok(targets[i]>=targets[i-1]);assert.ok(targets[4]>targets[0]+2);
 const r=fixture({gap:8,crimson:true});rivalDriverInput(r,r.opponent,.01);assert.equal(trafficBehavior(r,r.opponent),CRIMSON_TRAFFIC);assert.ok(r.opponent.aiDriver.targetSpeed>targets[4]);assert.ok(r.opponent.aiDriver.passing.commitRemaining>1.5);
});
test('a full frontal block still provokes real braking instead of collision immunity',()=>{
 const r=fixture({gap:4.3,frontSpeed:35,aiSpeed:60,crimson:true}),o=r.opponent,input=rivalDriverInput(r,o,.01);assert.equal(o.aiDriver.passing.contesting,false);assert.equal(input.brake,true);assert.ok(o.aiDriver.targetSpeed<=r.speed);
});
test('a blocked expert stays close and counter-attacks instead of opening a 22 m gap',()=>{
 const r=fixture({gap:12,frontSpeed:45,aiSpeed:46}),o=r.opponent;let side=0,blocked=false,peakGap=0,passed=false;
 for(let i=0;i<14*120;i++){
  const p=o.aiDriver.passing;if(!side&&p.side)side=p.side;
  // Hold the first selected side. The rival has to create its next opportunity.
  const lane=side?side*2.8:0;drive(r,lane);
  if(side&&Math.abs(r.lateral-side*2.8)<.3){blocked=true;if(r.s>o.s)peakGap=Math.max(peakGap,r.s-o.s);}
  if(o.s-r.s>PASSING.mergeGap)passed=true;
 }
 assert.ok(blocked);assert.ok(passed);assert.ok(o.aiDriver.passing.feints>0);assert.ok(peakGap<16,`unnecessary retreat: ${peakGap}`);
});
test('repeated visible blocking can be attacked with commitment and counter-changes',()=>{
 const r=fixture({gap:55,frontSpeed:40,aiSpeed:50});r.boss.confirmedSide=-1;let desired=0,reaction=0,passed=false,switches=0,minimumGap=Infinity;
 for(let i=0;i<20*120;i++){
  reaction-=1/120;const lateral=r.opponent.lateral;
  if(reaction<=0){const next=lateral>.7?3.1:lateral<-.7?-3.1:0;if(next!==desired){switches++;desired=next;}reaction=.35;}
  drive(r,desired,40);if(r.s>r.opponent.s)minimumGap=Math.min(minimumGap,r.s-r.opponent.s);
  if(r.opponent.s-r.s>PASSING.mergeGap){passed=true;break;}
 }
 assert.ok(switches>=2);assert.ok(minimumGap<8);assert.ok(passed,'Kanata must create a passing opportunity against visible reactive blocks');
});
test('a physical late closure remains a contact dispute and does not make the rival abandon its line',()=>{
 const r=fixture({gap:.5,frontSpeed:45,aiSpeed:46}),o=r.opponent;Object.assign(o,{lateral:2.5,targetLine:2.5,car:{...o.car,max:48}});Object.assign(o.aiDriver.passing,{phase:'overtake',side:1,lane:2.5});let contacts=0,attacks=0,passed=false,contestLane=null;
 for(let i=0;i<18*120;i++){
  const old=r.contactCooldown;drive(r,2.5);if(r.contactCooldown>old+.1)contacts++;
  if(o.aiDriver.passing.contesting){contestLane??=o.aiDriver.passing.lane;assert.equal(o.aiDriver.passing.lane,contestLane);if(!o.braking)attacks++;}else contestLane=null;
  if(o.s-r.s>PASSING.mergeGap)passed=true;
 }
 assert.ok(contacts>0,'contact physics must remain active');assert.ok(attacks>0);assert.ok(passed);
});
