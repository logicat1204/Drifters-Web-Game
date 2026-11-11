import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARS,TRACKS,ALL_TRACKS,makeTrack,createRace,updateRace,rivalCar,sample} from '../js/sim.mjs';
import {CAMPAIGN_STAGES} from '../js/campaign.mjs';
import {createBossState,updateBossState,KANATA_COUNTER} from '../js/bosses.mjs';
import {Store} from '../server/store.mjs';
import {Runs} from '../server/runs.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
const stage=id=>CAMPAIGN_STAGES.find(s=>s.id===id);
function fixture(id){
 const rival=stage(id),r=createRace(CARS[1],makeTrack(ALL_TRACKS.find(t=>t.id===rival.track)),{rival});r.countdown=0;r.timeLeft=1000;
 r.opponent=createRace(rivalCar(rival),r.track,{mode:'time',aiDriver:rival,focusEnabled:false});
 Object.assign(r.opponent,{countdown:0,s:100,speed:40,lateral:.3,cornerSpeed:45});r.s=90;return r;
}
const windup=r=>{for(let i=0;i<100;i++)updateBossState(r,.05,0);};

test('Takumi D keeps Skiller while final Sawatari and Kanata use Complete; retired difficulty is absent',()=>{
 assert.equal(stage('takumi-project').style,'Skiller');assert.equal(stage('kanata-final').style,'Complete');assert.equal(stage('sawatari').style,'Complete');
 assert.equal(CAMPAIGN_STAGES.filter(s=>s.boss).length,5);
 assert.doesNotMatch(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/id="difficulty"/);
});
test('styles physically separate early braking, straight speed and controlled corner slip',()=>{
 const metrics={};
 for(const style of ['Grip','Complete','Skiller']){
  const r=createRace(CARS[0],makeTrack({...TRACKS[2],length:4000,elevation:0,layout:[[5,0],[2,110],[5,0]]}),{rival:{id:'comparison',car:'ae86',color:'#fff',level:4,style}});r.countdown=0;r.timeLeft=1000;
  let max=0,slip=0,n=0,firstBrake=null;
  for(let i=0;i<108000&&!r.finished;i++){updateRace(r,{},1/120);const o=r.opponent;max=Math.max(max,o.speed);if(o.braking)firstBrake??=o.s;if(Math.abs(sample(r.track,o.s).curve)>.003){slip+=Math.abs(o.slipAngle);n++;}}
  assert.ok(r.rivalFinished);metrics[style]={max,slip:slip/n,firstBrake};
 }
 const {Grip:g,Complete:c,Skiller:s}=metrics;
 assert.ok(g.max>c.max+3&&c.max>s.max+3);assert.ok(g.firstBrake<c.firstBrake-25&&c.firstBrake<s.firstBrake-20);
 assert.ok(s.slip>.14&&g.slip<.08&&c.slip<.08);
});
test('higher Skiller levels carry larger real slip angles and faster physical laps',()=>{
 const metrics=[];for(const level of [1,3,5]){const rival={...stage('takumi-project'),level},r=createRace(CARS[0],makeTrack(TRACKS[5]),{rival});r.countdown=0;r.timeLeft=1000;let slip=0,n=0;for(let i=0;i<108000&&!r.finished;i++){updateRace(r,{},1/120);if(Math.abs(sample(r.track,r.rivalS).curve)>.003){slip+=Math.abs(r.rivalSlip);n++;}}metrics.push({time:r.elapsed,slip:slip/n});}
 for(let i=1;i<metrics.length;i++){assert.ok(metrics[i].time<metrics[i-1].time);assert.ok(metrics[i].slip>metrics[i-1].slip+.04);}
});
test('Shinji lights completed bends, not straight driving; his ray fades',()=>{
 const r=fixture('shinji-campaign');updateBossState(r,.05,.004);r.opponent.s+=30;
 for(let i=0;i<5;i++)updateBossState(r,.05,0);assert.ok(r.boss.ray>0);assert.equal(r.boss.eventId,1);
 for(let i=0;i<30;i++)updateBossState(r,.05,0);assert.equal(r.boss.ray,0);assert.equal(r.boss.eventId,1);
});
test('Takumi blurs only at cornering limits and earns wings by overtaking the player',()=>{
 const r=fixture('takumi-project');r.s=110;updateBossState(r,.05,0);assert.equal(r.boss.wings,0);
 r.s=90;updateBossState(r,.05,0);assert.equal(r.boss.wings,1.7);
 r.boss.wings=0;r.s=110;updateBossState(r,.05,0);assert.equal(r.boss.wings,0);
 r.opponent.slipAngle=.22;for(let i=0;i<20;i++)updateBossState(r,.05,.004);assert.ok(r.boss.blur>.9);
 r.opponent.collision=.5;for(let i=0;i<30;i++)updateBossState(r,.05,.004);assert.ok(r.boss.blur<.01);
});
test('Keisuke needs sustained smooth speed in a bend; Beckenbauer always has his own signature',()=>{
 const r=fixture('keisuke-project');for(let i=0;i<25;i++)updateBossState(r,.05,0);assert.equal(r.boss.flow,0);
 for(let i=0;i<20;i++)updateBossState(r,.05,.004);assert.ok(r.boss.flow>1);assert.equal(r.boss.eventId,1);
 const b=createBossState(stage('beckenbauer'));assert.equal(b.id,'beckenbauer');assert.equal(createBossState(stage('kenji')),null);
});
test('Kanata waits five seconds before Fireball, without early aura or power and without stacking',()=>{
 const r=fixture('kanata-final');updateBossState(r,.01,0);assert.equal(r.boss.enraged,false);
 r.s=102;updateBossState(r,.01,0);assert.equal(r.boss.windup,0);
 r.s=105;updateBossState(r,.01,0);assert.equal(r.boss.enraged,false);assert.equal(r.boss.windup,5);assert.equal(r.boss.boostCount,1);assert.equal(r.boss.boost,0);
 for(let i=0;i<499;i++)updateBossState(r,.01,0);assert.equal(r.boss.enraged,false);assert.equal(r.boss.boost,0);assert.equal(r.opponent.aiDriver.counter,null);assert.equal(r.boss.eventId,0);
 updateBossState(r,.01,0);assert.equal(r.boss.enraged,true);assert.equal(r.boss.windup,0);assert.equal(r.boss.boost,7);assert.equal(r.opponent.aiDriver.counter,KANATA_COUNTER);assert.match(r.boss.message,/FIREBALL/);
 for(let i=0;i<30;i++){r.s=i%2?95:105;updateBossState(r,.05,0);}assert.equal(r.boss.boostCount,1);
 r.s=90;for(let i=0;i<100;i++)updateBossState(r,.01,0);assert.equal(r.boss.enraged,false);assert.equal(r.boss.boost,0);assert.equal(r.opponent.aiDriver.counter,null);
 r.s=105;updateBossState(r,.01,0);assert.equal(r.boss.boostCount,2);assert.equal(r.boss.windup,5);assert.equal(r.boss.enraged,false);
});

test('starting ahead or recovering cannot manufacture Kanata counterattacks or Takumi wings',()=>{
 for(const id of ['kanata-final','takumi-project']){const r=fixture(id);r.s=110;updateBossState(r,.05,0);assert.equal(r.boss.boostCount,0);assert.equal(r.boss.wings,0);r.resetHold=.4;r.s=90;updateBossState(r,.05,0);r.s=110;updateBossState(r,.05,0);assert.equal(r.boss.boostCount,0);assert.equal(r.boss.wings,0);}
});
test('Kanata boost changes acceleration through physics without teleportation or unbounded speed',()=>{
 const r=fixture('kanata-final');updateBossState(r,.01,0);r.s=105;updateBossState(r,.01,0);windup(r);r.s=300;r.lateral=-2.5;
 // Isolate acceleration on a straight: on a technical road the faster car can
 // already be braking for the next hairpin at the comparison's final tick.
 r.track=makeTrack({...TRACKS[0],length:10000,elevation:0,layout:[[1,0]]});r.opponent.track=r.track;
 const boosted=structuredClone(r),normal=structuredClone(r);normal.boss.enraged=false;normal.boss.boost=0;normal.opponent.aiDriver.counter=null;
 for(let i=0;i<120;i++){const before=boosted.opponent.s;updateRace(boosted,{},1/120);updateRace(normal,{},1/120);assert.ok(boosted.opponent.s-before<=boosted.opponent.car.max*KANATA_COUNTER.topSpeed*1.05/120+.001);assert.ok(boosted.opponent.speed<=boosted.opponent.car.max*KANATA_COUNTER.topSpeed);}
 assert.ok(boosted.opponent.speed>normal.opponent.speed+1);assert.ok(boosted.opponent.s>normal.opponent.s+1);
});
test('a final-stretch pass can finish before Kanata responds, and same-tick finish order is fair',()=>{
 const r=fixture('kanata-final'),end=r.track.length;r.s=end-18;r.opponent.s=end-12;r.opponent.speed=20;r.speed=64;r.lateral=-2.5;r.boss.confirmedSide=-1;
 for(let i=0;i<120&&!r.finished;i++)updateRace(r,{throttle:true},1/120);assert.ok(r.won);assert.equal(r.boss.enraged,false);assert.ok(r.boss.windup>0);assert.equal(r.boss.boost,0);
 for(const playerFirst of [true,false]){const q=fixture('takumi-project');q.s=q.track.length-(playerFirst?.1:.35);q.opponent.s=q.track.length-(playerFirst?.35:.1);q.speed=q.opponent.speed=40;q.lateral=-2.5;updateRace(q,{throttle:true},.01);assert.ok(q.finished);assert.equal(q.won,playerFirst);}
});
test('server fixes rival identity and rejects client-only AI power fields',async()=>{
 const store=new Store(':memory:');try{const user=await store.register('BossSecurity24','password-2026');store.updateProfile(user.id,{complete:true});const run=new Runs(store).start(user.id,{car:'ae86',mode:'campaign',campaignStage:'kenji',difficulty:'easy',rival:{id:'kanata-final',level:0},aiDriver:{counter:KANATA_COUNTER},boss:{boost:999}});assert.equal(run.options.rival.id,'kenji');assert.equal(run.options.rival.level,1);for(const key of ['difficulty','aiDriver','boss'])assert.equal(run.options[key],undefined);}finally{store.close();}
});
test('Kanata aura and all counter power stop exactly one continuous second after he retakes the lead',()=>{
 const r=fixture('kanata-final');updateBossState(r,.01,0);r.s=105;updateBossState(r,.01,0);windup(r);
 assert.ok(r.boss.enraged&&r.boss.boost>0);r.s=90;
 for(let i=0;i<99;i++)updateBossState(r,.01,0);
 assert.ok(r.boss.enraged);assert.ok(r.boss.boost>0);assert.equal(r.opponent.aiDriver.counter,KANATA_COUNTER);
 updateBossState(r,.01,0);assert.equal(r.boss.enraged,false);assert.equal(r.boss.boost,0);assert.equal(r.boss.windup,0);assert.equal(r.opponent.aiDriver.counter,null);assert.ok(r.boss.cooldown>0);
});
test('temporary leads do not accumulate and a recovered-position cycle gives another full warning',()=>{
 const r=fixture('kanata-final');updateBossState(r,.01,0);r.s=105;updateBossState(r,.01,0);windup(r);
 r.s=99;for(let i=0;i<60;i++)updateBossState(r,.01,0);assert.ok(r.boss.enraged);
 r.s=101;updateBossState(r,.01,0);assert.equal(r.boss.leadTime,0);
 r.s=99;for(let i=0;i<99;i++)updateBossState(r,.01,0);assert.ok(r.boss.enraged);
 updateBossState(r,.01,0);assert.equal(r.boss.enraged,false);assert.equal(r.boss.confirmedSide,-1);
 r.s=105;updateBossState(r,.01,0);assert.equal(r.boss.enraged,false);assert.equal(r.boss.windup,5);assert.equal(r.boss.boostCount,2);windup(r);assert.ok(r.boss.enraged);
});

test('Kanata recovering before the warning ends cancels the pending Fireball with the usual one-second grace',()=>{
 const r=fixture('kanata-final');updateBossState(r,.01,0);r.s=105;updateBossState(r,.01,0);for(let i=0;i<60;i++)updateBossState(r,.05,0);
 r.s=99;for(let i=0;i<99;i++)updateBossState(r,.01,0);assert.ok(r.boss.windup>0);assert.equal(r.boss.enraged,false);
 updateBossState(r,.01,0);assert.equal(r.boss.windup,0);assert.equal(r.boss.boost,0);assert.equal(r.opponent.aiDriver.counter,null);
 for(let i=0;i<300;i++)updateBossState(r,.01,0);assert.equal(r.boss.enraged,false);assert.equal(r.boss.eventId,0);
});

test('Odawara uses Difficult Nozomi and Yashio followed by Professional Jackson',()=>{
 assert.deepEqual(CAMPAIGN_STAGES.filter(s=>s.chapter==='odawara').map(s=>[s.id,s.level,s.style]),[['nozomi',3,'Skiller'],['kakeru',3,'Grip'],['jackson',4,'Complete']]);
});

test('Fireball catches and passes a fully upgraded fast car on Manazuru without wall or bumper impacts',()=>{
 const rival=stage('kanata-final'),track=makeTrack(ALL_TRACKS.find(t=>t.id===rival.track)),r=createRace(CARS[2],track,{rival,mode:'campaign',build:{engine:3,chassis:3,brakes:3},focusEnabled:false,night:false});
 Object.assign(r,{s:2700,speed:25,lateral:0,countdown:0,timeLeft:1000});r.opponent=createRace(rivalCar(rival),track,{mode:'time',aiDriver:rival,focusEnabled:false});Object.assign(r.opponent,{s:2675,speed:25,lateral:0,countdown:0,timeLeft:1000});r.boss.confirmedSide=-1;
 let activeAt=null,passedAt=null,peak=0,hits=0,walls=0;
 for(let i=0;i<15*120;i++){const contact=r.contactCooldown,wall=r.opponent.wallCooldown;updateRace(r,driverInput(r,{line:0,gripUse:.82}),1/120);if(r.boss.enraged)activeAt??=r.elapsed;peak=Math.max(peak,r.rivalSpeed);if(r.contactCooldown>contact+.1)hits++;if(r.opponent.wallCooldown>wall+.1)walls++;if(r.rivalS>r.s+11){passedAt=r.elapsed;break;}}
 assert.ok(activeAt>=5&&activeAt<5.02);assert.ok(passedAt&&passedAt-activeAt<7,'the strengthened attack must recover before its impulse ends');assert.ok(peak>55,'Fireball must make a strong real acceleration run on the technical section');assert.equal(hits,0);assert.equal(walls,0);
});

test('Complete keeps its straight-speed advantage while technical Manazuru remains competitive for Skiller',()=>{
 for(const id of ['sawatari','kanata-final']){
  const metrics=[];for(const style of ['Skiller','Complete']){
   const rival={...stage(id),style},r=createRace(CARS[0],makeTrack(ALL_TRACKS.find(t=>t.id===rival.track)),{rival});r.countdown=0;r.timeLeft=1000;let peak=0,hits=0;
   for(let i=0;i<108000&&!r.finished;i++){const old=r.opponent?.wallCooldown||0;updateRace(r,{},1/120);peak=Math.max(peak,r.rivalSpeed);if(r.opponent.wallCooldown>old+.1)hits++;}
   assert.ok(r.rivalFinished);assert.equal(hits,0,id);metrics.push({time:r.elapsed,peak,max:r.opponent.car.max});
  }
  assert.ok(Math.abs(metrics[1].time-metrics[0].time)<metrics[0].time*.08,id+' must not be decided by style alone');assert.ok(metrics[1].max>metrics[0].max+4,id);assert.ok(metrics.every(m=>m.peak>35&&m.peak<=m.max*1.02));
 }
});
test('a winning Kanata cannot leave his chase aura frozen in the results scene',()=>{
 const r=fixture('kanata-final');updateBossState(r,.01,0);r.s=105;updateBossState(r,.01,0);r.s=90;r.opponent.finished=true;updateBossState(r,.01,0);
 assert.equal(r.boss.enraged,false);assert.equal(r.boss.windup,0);assert.equal(r.boss.boost,0);assert.equal(r.opponent.aiDriver.counter,null);
});
