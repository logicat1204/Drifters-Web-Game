import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaceReplay,ReplayPlayer} from '../js/race-replay.mjs';
import {CARS,ALL_TRACKS,createRace,makeTrack,updateRace} from '../js/sim.mjs';
import {driverInput} from './helpers/reference-driver.mjs';

const scene=()=>createRace(CARS[0],makeTrack(ALL_TRACKS[0]),{mode:'time',wet:true});
test('replay captures actual poses, interpolates short angles and preserves isolated effects and resets',()=>{
  const race=scene(),clip=new RaceReplay(race);
  Object.assign(race,{s:30,yaw:Math.PI-.02});clip.capture(race,1/30);
  race.focus.charge=80;Object.assign(race,{s:34,yaw:-Math.PI+.02});clip.capture(race,1/30);
  const halfway=clip.sample(.05);
  assert.ok(Math.abs(halfway.s-32)<1e-8);
  assert.ok(Math.abs(Math.abs(halfway.yaw)-Math.PI)<1e-8);
  assert.equal(clip.frames[0].state.focus.charge,0);
  Object.assign(race,{resetId:1,s:35,lateral:0});clip.capture(race,1/30);
  assert.equal(clip.sample(.09).resetId,0);
  assert.equal(clip.sample(.1).resetId,1);
  const before=JSON.stringify(race);
  const player=new ReplayPlayer(clip);player.update(.03);player.seek(.07);player.cameraPose(player.update(.01));
  assert.equal(JSON.stringify(race),before);
});
test('replay preserves online opponents and cuts their recoveries without changing the recording',()=>{
  const race=scene();race.online=true;
  race.netOpponents=[{id:'other',carId:'rx7',s:30,lateral:1,yaw:0,resetId:0}];
  const clip=new RaceReplay(race);
  race.netOpponents[0].s=34;clip.capture(race,1/30);
  assert.equal(clip.sample(1/60).netOpponents[0].s,32);
  race.netOpponents[0].resetId=1;race.netOpponents[0].lateral=0;clip.capture(race,1/30);
  assert.equal(clip.sample(.05).netOpponents[0].lateral,1);
  assert.equal(clip.frames[0].state.netOpponents[0].s,30);
});
test('playback speed, seek, pause, restart and the final frame stay within the recording',()=>{
  const race=scene(),clip=new RaceReplay(race);
  clip.capture(race,1);race.finished=true;clip.capture(race,1);
  const count=clip.frames.length;clip.capture(race,1);clip.finish(race);
  assert.equal(clip.frames.length,count);
  const player=new ReplayPlayer(clip);
  player.rate=2;player.update(.25);assert.equal(player.at,.5);
  player.paused=true;player.update(10);assert.equal(player.at,.5);
  player.seek(-10);assert.equal(player.at,0);
  player.paused=false;player.update(10);assert.equal(player.at,clip.duration);assert.equal(player.paused,true);
  assert.equal(clip.sample(1000).finished,true);
  const view=clip.sample(0);
  for(let camera=0;camera<3;camera++){
    player.camera=camera;
    assert.equal(player.cameraPose(view,{tunnels:[{start:0,end:100}]}).id,'tunnel');
  }
});
test('a complete physical lap retains its final pose and all camera views remain finite',()=>{
  const race=scene(),clip=new RaceReplay(race);
  for(let tick=0;tick<108000&&!race.finished;tick++){
    updateRace(race,driverInput(race),1/120);
    clip.capture(race,1/120);
  }
  clip.finish(race);
  assert.equal(race.finished,true);
  const last=clip.sample(clip.duration);
  assert.equal(last.s,race.s);assert.equal(last.elapsed,race.elapsed);
  assert.ok(clip.frames.length<clip.duration*31+2);
  const player=new ReplayPlayer(clip);
  for(let at=0;at<=clip.duration;at+=.73){
    const view=player.seek(at);
    for(let camera=0;camera<3;camera++){
      player.camera=camera;const pose=player.cameraPose(view);
      assert.ok([...pose.eye,...pose.target,pose.fov].every(Number.isFinite));
      assert.ok(Math.hypot(...pose.eye.map((value,i)=>value-pose.target[i]))>1);
    }
  }
});
