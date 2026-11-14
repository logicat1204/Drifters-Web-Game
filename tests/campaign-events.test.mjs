import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {campaignEvent,campaignEvents,eventAvailable,worldSeasonAvailable} from '../js/campaign-events.mjs';
import {Store} from '../server/store.mjs';
import {Runs} from '../server/runs.mjs';
import {ALL_CARS,ALL_TRACKS,createRace,makeTrack,updateRace,sample} from '../js/sim.mjs';
import {RunRecorder} from '../js/replay.mjs';
import {driverInput} from './helpers/reference-driver.mjs';

test('the new campaign requires qualifiers and the final duel, and claims focus only from its chest',async()=>{
  const store=new Store(':memory:');
  try{
    const account=await store.register('RegionalPilot22','password-22'),id=account.id;
    store.updateProfile(id,{complete:true,defaultCar:'r32'});
    const events=campaignEvents(),clear=event=>{
      const track=makeTrack(ALL_TRACKS.find(t=>t.id===event.track)),r=createRace(ALL_CARS[2],track,{mode:'campaign',campaignRules:true,campaignStage:event.id});
      Object.assign(r,{s:track.length,elapsed:120,won:true,finished:true});
      store.addRun(randomUUID(),id,r);
    };
    const start=(campaignStage)=>new Runs(store).start(id,{mode:'campaign',campaignRules:true,car:'r32',campaignStage});
    assert.throws(()=>store.claimCampaignChest(id,'chest-akina'),/bloqueado/);
    for(const event of events.slice(0,3))clear(event);
    assert.deepEqual(store.user(id).focusUnlocked,[]);
    assert.equal(store.claimCampaignChest(id,'chest-akina').alreadyClaimed,false);
    assert.equal(store.claimCampaignChest(id,'chest-akina').alreadyClaimed,true);
    assert.deepEqual(store.user(id).focusUnlocked,['balance']);
    assert.throws(()=>start('shingo-myogi'),/bloqueado/);
    assert.throws(()=>store.markChapterStory(id,'map:akina','end'),/anteriores/);
    const runs=new Runs(store,{now:()=>now});let now=1;
    const attempt=runs.start(id,{mode:'campaign',campaignRules:true,car:'r32',campaignStage:'trial-akina',targetTime:1,wet:true});
    assert.ok(attempt.options.targetTime>1);assert.equal(attempt.options.wet,false);
    const r=createRace(ALL_CARS[2],makeTrack(ALL_TRACKS.find(t=>t.id===attempt.track)),attempt.options),recorder=new RunRecorder();
    for(let tick=0;tick<108000&&!r.finished;tick++)updateRace(r,recorder.capture(r,driverInput(r,{line:-1.7,gripUse:.9})),1/120);
    assert.ok(r.won);now=900000;
    const saved=await runs.submit(id,attempt.id,recorder.frames);
    assert.ok(saved.won&&saved.completed);
    assert.equal(saved.reward.stage,'trial-akina');
    assert.doesNotThrow(()=>start('shingo-myogi'));
    assert.throws(()=>start('kenta'),/bloqueado/);
    assert.doesNotThrow(()=>store.markChapterStory(id,'map:akina','end'));
    const cleared=events.slice(0,-1).map(event=>event.id);
    assert.equal(worldSeasonAvailable('ngplus',cleared),false);
    assert.equal(worldSeasonAvailable('ngplus',events.map(event=>event.id)),true);
  }finally{store.close();}
});

test('a grid retains race progress across the lap seam and simulates each rival',()=>{
  const event=campaignEvent('odawara-grid'),track=makeTrack(ALL_TRACKS.find(t=>t.id===event.track));
  const race=createRace(ALL_CARS[2],track,{mode:'campaign',eventKind:event.kind,laps:event.laps,rivals:event.rivals});
  const first=sample(track,16),second=sample(track,track.length+16);
  assert.ok(Math.hypot(first.x-second.x,first.z-second.z)<1e-6);
  assert.equal(eventAvailable(event,['nozomi','kakeru']),false);
  assert.equal(race.netOpponents.length,2);
  Object.assign(race,{countdown:0,s:track.length-.1,speed:25,checkpoints:3});
  updateRace(race,{throttle:true},1/120);
  assert.ok(race.s>track.length&&!race.finished);
  assert.equal(race.finishDistance,track.length*2);
  assert.ok(race.grid.every(o=>o.speed>0));
  assert.equal(race.checkpoints,4);
});
