import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../server/store.mjs';
import {Runs} from '../server/runs.mjs';
import {campaignStages,campaignStage,stageAvailable,seasonUnlocked,campaignReward,campaignConditions} from '../js/campaign.mjs';
import {ALL_CARS,ALL_TRACKS,CARS,makeTrack,createRace,updateRace} from '../js/sim.mjs';
import {RunRecorder} from '../js/replay.mjs';
import {UPGRADES} from '../js/tuning.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
const stages=campaignStages();
const competitionCar=ALL_CARS.find(car=>car.id==='gt3rs');
const maxBuild={engine:3,chassis:3,brakes:3};
function prepare(store,id,car,target=maxBuild){
 for(const [system,level] of Object.entries(target)){
  const current=store.vehicleBuild(id,car)[system];
  for(let tier=current+1;tier<=level;tier++)store.upgradeVehicle(id,car,system,tier);
 }
}
function victory(store,id,stage,key=stage.id){
 const car=stage.ngplus?competitionCar:CARS[0];
 const track=makeTrack(ALL_TRACKS.find(t=>t.id===stage.track));
 const race=createRace(car,track,{...campaignConditions(stage),mode:'campaign',campaignStage:stage.id,rival:stage,build:store.vehicleBuild(id,car.id)});
 Object.assign(race,{s:track.length,elapsed:200,finished:true,won:true});
 race.skill.points=9000;
 return store.addRun(key,id,race);
}
async function fixture(){const store=new Store(':memory:'),u=await store.register('SeasonPilot24','season-password-24');store.updateProfile(u.id,{complete:true});return {store,id:u.id};}
test('three finite seasons unlock in order, preserve ownership and pay independent bounded rewards',async()=>{
 const {store,id}=await fixture();try{
  const runs=new Runs(store),start=(stage,car='ae86',extra={})=>runs.start(id,{mode:'campaign',car,campaignStage:stage,...extra});
  assert.throws(()=>start('rain:kenji'),/bloqueado/);assert.throws(()=>start('ngplus:kenji'),/bloqueado/);
  for(const s of stages)victory(store,id,s);const original=store.user(id);assert.equal(original.campaign.length,24);assert.ok(seasonUnlocked('rain',original.campaign.map(s=>s.id)));
  const retry=start('kenji');assert.equal(retry.options.wet,false);assert.equal(retry.options.rematch,false);
  const rain=start('rain:kenji');assert.equal(rain.options.wet,true);assert.equal(rain.options.rematch,true);assert.throws(()=>start('rain:takumi-initial'),/bloqueado/);
  for(const s of campaignStages('rain')){assert.ok(stageAvailable(s,store.user(id).campaign.map(s=>s.id)));const result=victory(store,id,s);assert.ok(result.reward.coins>campaignReward(stages[s.index],9000));assert.equal(victory(store,id,s).user.coins,result.user.coins);}
  const before=store.user(id);
  assert.equal(before.campaign.length,48);
  assert.throws(()=>start('ngplus:kenji'),/categoría 3/);
  assert.throws(()=>start('ngplus:kenji',competitionCar.id,{build:maxBuild}),/coche no comprado/);
  prepare(store,id,'ae86');
  assert.throws(()=>start('ngplus:kenji'),/categoría 3/,'a fully upgraded starter still lacks the competition category');
  store.buy(id,'car',competitionCar.id);
  assert.throws(()=>start('ngplus:kenji',competitionCar.id,{build:maxBuild}),/nivel 3/,'client data cannot turn a stock purchase into a max build');
  prepare(store,id,competitionCar.id,{...maxBuild,brakes:2});
  assert.throws(()=>start('ngplus:kenji',competitionCar.id,{build:maxBuild}),/nivel 3/,'all three systems need level 3');
  prepare(store,id,competitionCar.id);
  const equipped=store.user(id);
  const upgradeCost=Object.values(UPGRADES).flatMap(system=>system.prices).reduce((sum,price)=>sum+price,0);
  assert.equal(equipped.coins,before.coins-competitionCar.price-2*upgradeCost,'only garage and shop purchases spend coins');
  const ngplus=start('ngplus:kenji',competitionCar.id,{build:{engine:0,chassis:0,brakes:0},wet:true,rival:{ngplus:false}});
  assert.equal(ngplus.options.rival.ngplus,true);
  assert.equal(ngplus.options.wet,campaignConditions(campaignStage('ngplus:kenji')).wet);
  for(const [system,level] of Object.entries(maxBuild))assert.equal(ngplus.options.build[system],level);
  for(const s of campaignStages('ngplus')){
   const result=victory(store,id,s);
   assert.ok(result.reward.coins>campaignReward(campaignStage('rain:'+s.baseId),9000));
   assert.equal(victory(store,id,s).user.coins,result.user.coins);
  }
  const complete=store.user(id);
  assert.equal(complete.campaign.length,72);
  assert.ok(original.cars.every(car=>complete.cars.includes(car)));
  assert.deepEqual(complete.cars,equipped.cars);
  assert.deepEqual(complete.focusUnlocked,original.focusUnlocked);
  assert.deepEqual(complete.garage,equipped.garage);
  assert.ok(campaignStages('ngplus').every(s=>stageAvailable(s,complete.campaign.map(s=>s.id))));assert.equal(campaignStage('ngplus2:kenji'),undefined);assert.equal(campaignStages('ngplus2').length,0);
  const end=start('ngplus:kanata-final',competitionCar.id);assert.equal(end.options.rival.ngplus,true);assert.equal(end.options.rival.level,5);
  store.markChapterStory(id,'rain:akina','end');assert.ok(store.user(id).chapterStories.includes('rain:akina:end'));assert.ok(!store.user(id).chapterStories.includes('akina:end'));
 }finally{store.close();}
});
test('seasonal attempts use the server weather, car build and qualified stage when saving a replay',async()=>{
 const {store,id}=await fixture();let now=0;try{
  for(const s of stages)victory(store,id,s);
  store.buy(id,'car',competitionCar.id);
  prepare(store,id,competitionCar.id);
  const runs=new Runs(store,{now:()=>now});
  const attempt=runs.start(id,{mode:'campaign',car:competitionCar.id,campaignStage:'rain:kenji',wet:false,rematch:false,rival:{ngplus:true}});
  assert.equal(attempt.options.wet,true);assert.equal(attempt.options.rival.ngplus,false);
  const r=createRace(competitionCar,makeTrack(ALL_TRACKS[0]),attempt.options),recorder=new RunRecorder();
  for(let i=0;i<108000&&!r.finished;i++)updateRace(r,recorder.capture(r,driverInput(r,{line:-2.5,gripUse:.88})),1/120);
  assert.equal(r.won,true);now=900000;const saved=await runs.submit(id,attempt.id,recorder.frames);assert.equal(saved.reward.stage,'rain:kenji');assert.equal(saved.time,r.elapsed);assert.ok(saved.user.campaign.some(s=>s.id==='rain:kenji'));
  for(const stage of campaignStages('rain').slice(1))victory(store,id,stage);
  const beforeNgplus=store.user(id);
  const ngplus=runs.start(id,{mode:'campaign',car:competitionCar.id,campaignStage:'ngplus:kenji',wet:true,build:{brakes:0}});
  const ngplusStage=campaignStage('ngplus:kenji');
  assert.equal(ngplus.options.wet,campaignConditions(ngplusStage).wet);
  assert.equal(ngplus.options.rival.ngplus,true);
  assert.equal(ngplus.options.build.brakes,3);
  const ngplusRace=createRace(competitionCar,makeTrack(ALL_TRACKS[0]),ngplus.options);
  const ngplusRecorder=new RunRecorder();
  for(let i=0;i<108000&&!ngplusRace.finished;i++){
   const input=driverInput(ngplusRace,{line:-2.5,gripUse:.88});
   updateRace(ngplusRace,ngplusRecorder.capture(ngplusRace,input),1/120);
  }
  now+=900000;
  const ngplusResult=await runs.submit(id,ngplus.id,ngplusRecorder.frames);
  assert.equal(ngplusResult.time,ngplusRace.elapsed);
  assert.equal(ngplusResult.won,ngplusRace.won);
  assert.equal(ngplusResult.reward.stage,ngplusStage.id);
  assert.equal(ngplusResult.buildKey,'M3-C3-F3');
  const expectedCoins=ngplusResult.won?campaignReward(ngplusStage,ngplusResult.points):0;
  assert.equal(ngplusResult.reward.coins,expectedCoins);
  assert.equal(ngplusResult.user.coins,beforeNgplus.coins+expectedCoins);
  assert.equal(ngplusResult.user.campaign.some(stage=>stage.id===ngplusStage.id),ngplusResult.won);
  assert.deepEqual(ngplusResult.user.garage,beforeNgplus.garage);
  for(const s of campaignStages('ngplus'))assert.deepEqual(campaignConditions(s),campaignConditions(campaignStage(s.id)));
 }finally{store.close();}
});
test('rain and NG+ rivals complete their actual courses using the seasonal conditions',()=>{
 for(const season of ['rain','ngplus'])for(const stage of campaignStages(season)){
  const r=createRace(CARS[0],makeTrack(ALL_TRACKS.find(t=>t.id===stage.track)),{rival:stage,...campaignConditions(stage),focusEnabled:false});r.countdown=0;r.timeLeft=10000;let walls=0;
  for(let i=0;i<108000&&!r.finished;i++){const before=r.opponent?.wallCooldown??0;updateRace(r,{},1/120);if((r.opponent?.wallCooldown??0)>before+.1)walls++;}
  assert.ok(r.rivalFinished,stage.id);assert.equal(walls,0,stage.id+' must retain physical control');
 }
});
