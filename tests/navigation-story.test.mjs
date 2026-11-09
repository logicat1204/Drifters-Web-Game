import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimapView} from '../js/minimap.mjs';
import {StoryPageAudio} from '../js/story-audio.mjs';
import {pageSounds} from '../server/media.mjs';
import {CARS,ALL_TRACKS,RIVALS,makeTrack,createRace,worldAt} from '../js/sim.mjs';
import {campaignStage} from '../js/campaign.mjs';

test('Kai uses Skiller in campaign and home-course duels',()=>{
  assert.equal(campaignStage('kai-campaign').style,'Skiller');
  assert.equal(RIVALS.kai.style,'Skiller');
});
test('local navigation stays centered on the driver and rotates upcoming bends toward the top',()=>{
  for(const cfg of ALL_TRACKS){
    const track=makeTrack(cfg),race=createRace(CARS[0],track,{mode:'time'});
    for(const s of [12,400,track.length*.5,track.length-10]){
      Object.assign(race,{s,speed:50});
      const view=minimapView(track,race,170,180),point=view.project(worldAt(track,s,race.lateral));
      assert.ok(Math.abs(point.x-85)<1e-8);
      assert.ok(Math.abs(point.y-180*.77)<1e-8);
      assert.ok(view.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
      assert.ok(view.points.every(p=>p.s>=Math.max(0,s-130)&&p.s<=Math.min(track.length,s+370)));
      const next=view.project(worldAt(track,Math.min(s+10,track.length),race.lateral));
      assert.ok(next.y<=point.y);
    }
  }
});
test('four close online drivers get visible distinct ranked markers and offscreen rivals remain indicated',()=>{
  const track=makeTrack(ALL_TRACKS[0]),race=createRace(CARS[0],track,{mode:'time'});
  Object.assign(race,{online:true,s:200,speed:40,netOpponents:[{id:'a',s:201,lateral:1},{id:'b',s:202,lateral:-1},{id:'c',s:203,lateral:0}]});
  const view=minimapView(track,race,122,142);
  assert.equal(view.drivers.length,4);
  assert.equal(new Set(view.drivers.map(p=>p.rank)).size,4);
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.hypot(view.drivers[i].x-view.drivers[j].x,view.drivers[i].y-view.drivers[j].y)>10);
  race.netOpponents[0].s=2000;
  assert.equal(minimapView(track,race,122,142).drivers[1].distant,true);
});
test('minimap bends and driver arrow agree with the left and right of the forward 3D camera',()=>{
  for(const cfg of ALL_TRACKS){
    const track=makeTrack(cfg),race=createRace(CARS[0],track,{mode:'time'});
    for(let s=20;s<track.length-20;s+=90){
      Object.assign(race,{s,lateral:0,speed:40,yaw:.2});
      const view=minimapView(track,race,170,180),origin=worldAt(track,s);
      // lookAt uses forward × world-up for its horizontal screen axis.
      const rightX=-Math.cos(origin.heading),rightZ=Math.sin(origin.heading);
      for(const point of [worldAt(track,s,3),worldAt(track,s,-3),worldAt(track,s+20)]){
        const screenOffset=(point.x-origin.x)*rightX+(point.z-origin.z)*rightZ;
        assert.ok(Math.abs(view.project(point).x-(85+screenOffset*view.scale))<1e-7);
      }
      assert.ok(view.project(worldAt(track,s,3)).x<85);
      assert.ok(view.project(worldAt(track,s,-3)).x>85);
      assert.equal(view.drivers[0].rotation,-.2);
    }
  }
});
test('comic sounds match names or numbers while missing pages keep their own silent slot',()=>{
  const pages=['/story/001.webp','/story/002.webp','/story/010.webp','/story/20%25.webp'];
  const files=[{name:'001_motor.wav',url:'/first'},{name:'10.mp3',url:'/tenth'},{name:'20%.wav',url:'/percent'}];
  assert.deepEqual(pageSounds(pages,files).map(sound=>sound?.url??null),['/first',null,'/tenth','/percent']);
  assert.equal(pageSounds(['/story/001.webp'],[{name:'001_description.mp3',url:'/description'},{name:'001.wav',url:'/exact'}])[0].url,'/exact');
});
test('changing comic pages replaces its short sound and closing clears it without controlling the soundtrack',async()=>{
  const calls=[],audio={volume:1,src:'',pause(){calls.push('pause');},removeAttribute(){this.src='';},load(){calls.push('load');},play(){calls.push(this.src);return Promise.resolve();}};
  const player=new StoryPageAudio(audio);
  player.setVolume(.4);player.play({url:'/first.wav'});player.play({url:'/second.wav'});
  assert.equal(audio.volume,.4);
  assert.equal(audio.src,'/second.wav');
  assert.deepEqual(calls,['pause','load','/first.wav','pause','load','/second.wav']);
  player.play(null);assert.equal(audio.src,'');
  audio.play=()=>Promise.reject(Error('missing file'));
  player.play({url:'/missing.wav'});
  await new Promise(resolve=>setImmediate(resolve));
});
