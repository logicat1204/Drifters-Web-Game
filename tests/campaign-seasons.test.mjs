import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../server/store.mjs';
import {Runs} from '../server/runs.mjs';
import {campaignStages,campaignStage,stageAvailable,seasonUnlocked,campaignReward,campaignConditions} from '../js/campaign.mjs';
import {ALL_TRACKS,CARS,makeTrack,createRace,updateRace} from '../js/sim.mjs';
import {RunRecorder} from '../js/replay.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
const stages=campaignStages();
function victory(store,id,stage,key=stage.id){const r=createRace(CARS[0],makeTrack(ALL_TRACKS.find(t=>t.id===stage.track)),{mode:'campaign',campaignStage:stage.id,rival:stage});Object.assign(r,{s:r.track.length,elapsed:200,finished:true,won:true});r.skill.points=9000;return store.addRun(key,id,r);}
async function fixture(){const store=new Store(':memory:'),u=await store.register('SeasonPilot24','season-password-24');store.updateProfile(u.id,{complete:true});return {store,id:u.id};}
test('three finite seasons unlock in order, preserve ownership and pay independent bounded rewards',async()=>{
 const {store,id}=await fixture();try{
  const runs=new Runs(store),start=stage=>runs.start(id,{mode:'campaign',car:'ae86',campaignStage:stage});
  assert.throws(()=>start('rain:kenji'),/bloqueado/);assert.throws(()=>start('ngplus:kenji'),/bloqueado/);
  for(const s of stages)victory(store,id,s);const original=store.user(id);assert.equal(original.campaign.length,24);assert.ok(seasonUnlocked('rain',original.campaign.map(s=>s.id)));
  const retry=start('kenji');assert.equal(retry.options.wet,false);assert.equal(retry.options.rematch,false);
  const rain=start('rain:kenji');assert.equal(rain.options.wet,true);assert.equal(rain.options.rematch,true);assert.throws(()=>start('rain:takumi-initial'),/bloqueado/);
  for(const s of campaignStages('rain')){assert.ok(stageAvailable(s,store.user(id).campaign.map(s=>s.id)));const result=victory(store,id,s);assert.ok(result.reward.coins>campaignReward(stages[s.index],9000));assert.equal(victory(store,id,s).user.coins,result.user.coins);}
  assert.equal(store.user(id).campaign.length,48);assert.equal(start('ngplus:kenji').options.rival.ngplus,true);
  for(const s of campaignStages('ngplus'))victory(store,id,s);const complete=store.user(id);assert.equal(complete.campaign.length,72);assert.deepEqual(complete.cars,original.cars);assert.deepEqual(complete.focusUnlocked,original.focusUnlocked);assert.deepEqual(complete.garage,original.garage);
  assert.ok(campaignStages('ngplus').every(s=>stageAvailable(s,complete.campaign.map(s=>s.id))));assert.equal(campaignStage('ngplus2:kenji'),undefined);assert.equal(campaignStages('ngplus2').length,0);
  const end=start('ngplus:kanata-final');assert.equal(end.options.rival.ngplus,true);assert.equal(end.options.rival.level,5);
  store.markChapterStory(id,'rain:akina','end');assert.ok(store.user(id).chapterStories.includes('rain:akina:end'));assert.ok(!store.user(id).chapterStories.includes('akina:end'));
 }finally{store.close();}
});
test('weather and NG+ identity are fixed by server; wet-season attempts reproduce and save by qualified stage',async()=>{
 const {store,id}=await fixture();let now=0;try{
  for(const s of stages)victory(store,id,s);const runs=new Runs(store,{now:()=>now});const attempt=runs.start(id,{mode:'campaign',car:'ae86',campaignStage:'rain:kenji',wet:false,rematch:false,rival:{ngplus:true}});
  assert.equal(attempt.options.wet,true);assert.equal(attempt.options.rival.ngplus,false);
  const r=createRace(CARS[0],makeTrack(ALL_TRACKS[0]),attempt.options),recorder=new RunRecorder();
  for(let i=0;i<108000&&!r.finished;i++)updateRace(r,recorder.capture(r,driverInput(r,{line:-2.5,gripUse:.88})),1/120);
  assert.equal(r.won,true);now=900000;const saved=await runs.submit(id,attempt.id,recorder.frames);assert.equal(saved.reward.stage,'rain:kenji');assert.equal(saved.time,r.elapsed);assert.ok(saved.user.campaign.some(s=>s.id==='rain:kenji'));
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
