import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {CampaignTargets} from '../server/campaign-targets.mjs';
import {calibrateRival,calibrationTrack,sampleRivalTime} from '../server/rival-calibration.mjs';
import {Runs} from '../server/runs.mjs';
import {Store} from '../server/store.mjs';
import {campaignEvent} from '../js/campaign-events.mjs';
import {ALL_TRACKS,rivalCar} from '../js/sim.mjs';

test('a configured rival uses style physics and follows a feasible clean target',async()=>{
  const track=calibrationTrack(ALL_TRACKS.find(track=>track.id==='akina'));
  const rival={...campaignEvent('kenji'),style:'Complete',targetTimeSec:285};
  const configured=await calibrateRival(track,rival,{});
  assert.ok(configured.targetTimeReachable);
  assert.ok(Math.abs(await sampleRivalTime(track,configured)-285)<.75);
  const other=rivalCar({...rival,car:'ae86'});
  const first=rivalCar(rival);
  for(const key of ['max','accel','grip','brakePower','profile','wheelbase'])assert.equal(other[key],first[key]);
  const impossible=await calibrateRival(track,{...rival,targetTimeSec:15},{});
  assert.equal(impossible.targetTimeReachable,false);
  assert.equal(impossible.targetPaceFactor,1);
  assert.ok(impossible.estimatedTimeSec>15);
});

test('trial edits apply to new attempts and grid settings belong to each driver',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'touge-targets-')),store=new Store(':memory:');
  const write=async(relative,data)=>{
    const filename=path.join(root,relative);
    await mkdir(path.dirname(filename),{recursive:true});
    await writeFile(filename,JSON.stringify(data));
  };
  try{
    const targets=new CampaignTargets(root),runs=new Runs(store,{targets});
    const player=await store.register('CourseTargets','testing password');
    store.updateProfile(player.id,{complete:true,defaultCar:'ae86'});
    const start=()=>runs.start(player.id,{mode:'campaign',car:'ae86',campaignRules:true,campaignStage:'trial-akina',targetTime:15});
    await write('akina/trial-akina/trial.json',{targetTimeSec:{dry:321.25}});
    const first=start();
    assert.equal(first.options.targetTime,321.25);
    await write('akina/trial-akina/trial.json',{targetTimeSec:{dry:300.5}});
    assert.equal(runs.pending.get(first.id).options.targetTime,321.25);
    assert.equal(start().options.targetTime,300.5);
    const grid=campaignEvent('odawara-grid'),[nozomi,kakeru]=grid.rivals;
    await write('odawara/odawara-grid/nozomi/rival.json',{style:'Balance',targetTimeSec:{dry:320}});
    assert.equal(targets.rival(grid,nozomi).style,'Complete');
    assert.equal(targets.rival(grid,nozomi).targetTimeSec,320);
    assert.equal(targets.rival(grid,kakeru).targetTimeSec,undefined);
  }finally{store.close();await rm(root,{recursive:true,force:true});}
});
