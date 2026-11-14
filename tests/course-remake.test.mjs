import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_TRACKS,CARS,makeTrack,createRace,updateRace,cornerTechnique,HANDLING_VERSION} from '../js/sim.mjs';
import {EXPANSION_TRACKS} from '../js/expansion-courses.mjs';
import {campaignEvents} from '../js/campaign-events.mjs';
import {trackCrossings} from '../js/track-geometry.mjs';
import {Store} from '../server/store.mjs';
import {CAMPAIGN_STAGES} from '../js/campaign.mjs';

test('nine reference courses preserve requested distances, sectors and safe loop seams; Atami keeps its legacy road',()=>{
 const lengths={akina:7552,akagi:5804,iroha:5116,usui:3972,tsukuba:6808,tsubaki:7312,odawara:4420,ashinoko:8433,manazuru:3574};
 for(const [id,length] of Object.entries(lengths)){
  const track=makeTrack(ALL_TRACKS.find(t=>t.id===id));assert.equal(track.length,length);assert.equal(track.geometryVersion,'reference-v1');assert.equal(track.sectionEnds.at(-1),length);assert.deepEqual(trackCrossings(track),[],id);
  const end=track.points[track.renderSegments];assert.equal(end.s,length);
  if(track.closed){const start=track.points[0];assert.equal(start.x,end.x);assert.equal(start.z,end.z);assert.equal(start.y,end.y);assert.ok(Math.abs(Math.sin(end.heading-start.heading))<1e-8);}
  for(const p of track.points)assert.ok([p.x,p.y,p.z,p.curve,p.heading].every(Number.isFinite),id);
 }
 const atami=makeTrack(ALL_TRACKS.find(t=>t.id==='atami'));assert.equal(atami.length,13700);assert.equal(atami.step,8);assert.equal(atami.geometryVersion,undefined);
 const iroha=makeTrack(ALL_TRACKS.find(t=>t.id==='iroha'));assert.ok(Math.max(...iroha.points.map(p=>Math.abs(p.curve)))<1/9,'printed pin tips must be widened enough for a playable road');
});

test('Skiller corner technique needs a clean prepared slide, never a straight, held handbrake or wall scrape',()=>{
 const track=makeTrack({...ALL_TRACKS[0],layout:[[1,0]],elevation:0});
 const race=()=>Object.assign(createRace(CARS[0],track,{mode:'time'}),{countdown:0,lateral:0,speed:25,driftAssist:.8,slipAngle:.15,yaw:.15,travelYaw:0});
 const r=race();assert.ok(cornerTechnique(r,.02)>.9);assert.equal(cornerTechnique(r,0),0);assert.equal(cornerTechnique(r,.02,true),0);
 for(const props of [{collision:.1},{wallTouch:.1},{speed:5},{slipAngle:.7},{driftAssist:0},{lateral:4.65}])assert.equal(cornerTechnique(Object.assign(race(),props),.02),0);
 const clean=race(),held=race();for(let i=0;i<120;i++){updateRace(clean,{throttle:true},1/120);updateRace(held,{throttle:true,handbrake:true},1/120);}assert.ok(held.speed<clean.speed-8,'holding the handbrake must cost speed');
});

test('v9 best times stay out of v10 rankings while campaign clears, rewards and unlocks survive',async()=>{
 const store=new Store(':memory:');try{
  const account=await store.register('ReferenceDriver24','reference-password-24');store.updateProfile(account.id,{complete:true});
  const stage=CAMPAIGN_STAGES[2],track=makeTrack(ALL_TRACKS[0]),won=createRace(CARS[0],track,{mode:'campaign',campaignStage:stage.id,rival:stage});Object.assign(won,{finished:true,won:true,s:track.length,elapsed:80});won.skill.points=500;
  for(const earlier of CAMPAIGN_STAGES.slice(0,3)){won.campaignStage=earlier.id;won.rival=earlier;store.addRun('legacy-'+earlier.id,account.id,won);}store.db.prepare('UPDATE runs SET handling=?').run('v9');store.db.prepare('UPDATE campaign_progress SET handling=?').run('v9');
  const before=store.user(account.id);assert.ok(before.focusUnlocked.includes('balance'));assert.equal(before.campaign.find(s=>s.id===stage.id).bestTime,null);assert.equal(store.records().length,0);
  won.elapsed=240;store.addRun('reference-road',account.id,won);const after=store.user(account.id);assert.equal(after.campaign.find(s=>s.id===stage.id).bestTime,240);assert.equal(after.coins,before.coins+50,'only the normal level-3 replay reward is granted');assert.equal(store.stats(account.id).races,4);assert.equal(store.records()[0].time,240);assert.equal(store.db.prepare('SELECT handling FROM campaign_progress WHERE level_id=?').get(stage.id).handling,HANDLING_VERSION);
 }finally{store.close();}
});
test('all supplied expansion roads have continuous reference geometry and two rivals before their qualifier',()=>{
 for(const config of EXPANSION_TRACKS){
  const track=makeTrack(config);
  assert.equal(track.reference.image,config.referenceSheet);
  assert.equal(track.sectionEnds.at(-1),config.length);
  assert.deepEqual(trackCrossings(track),[],config.id);
  assert.ok(track.points[track.renderSegments].y<-200,config.id);
  assert.ok(track.points.every(p=>Number.isFinite(p.curve)&&Math.abs(p.curve)<.12),config.id);
  const events=campaignEvents().filter(event=>event.chapter===config.id);
  assert.deepEqual(events.map(event=>event.kind),['duel','duel','trial']);
  assert.ok(events[2].pace>0);
 }
});
