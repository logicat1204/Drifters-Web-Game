import {test} from 'node:test';
import assert from 'node:assert/strict';
import {raceVisibility} from '../js/renderer.js';
import {CARS,ALL_TRACKS,createRace,makeTrack,updateRace} from '../js/sim.mjs';
import {CAMPAIGN_STAGES,CAMPAIGN_CHAPTERS} from '../js/campaign.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
test('Ashinoko has a much shorter visual range while other course atmospheres remain separate',()=>{
 const chapter=CAMPAIGN_CHAPTERS.find(c=>c.id==='ashinoko');assert.ok(chapter.wet&&chapter.fog);
 const ash=raceVisibility({fog:true,track:{id:'ashinoko'}},true),ordinary=raceVisibility({fog:true,track:{id:'akina'}},true);
 assert.ok(ash.far<ordinary.far/2);assert.ok(ash.near<ordinary.near/2);assert.ok(ash.fromCar);assert.equal(ordinary.fromCar,false);
 assert.ok(raceVisibility({fog:false,track:{id:'ashinoko'}},true).far>ash.far*10);
 assert.ok(raceVisibility({fog:false,track:{id:'manazuru'}},true).far>ash.far*10);
});
test('denser fog affects visibility only: wet player physics and rival pace are identical',()=>{
 const track=makeTrack(ALL_TRACKS.find(t=>t.id==='ashinoko'));
 for(const rival of CAMPAIGN_STAGES.filter(s=>s.chapter==='ashinoko')){
  const a=createRace(CARS[1],track,{rival,wet:true,fog:true,night:false}),b=createRace(CARS[1],track,{rival,wet:true,fog:false,night:false});a.countdown=b.countdown=0;
  for(let i=0;i<1800;i++){const input=driverInput(a,{line:-2.5});updateRace(a,input,1/120);updateRace(b,input,1/120);}
  for(const key of ['s','speed','lateral','yaw','elapsed','rivalS','rivalSpeed','rivalLateral','rivalYaw'])assert.equal(a[key],b[key],rival.id+' '+key);
 }
});
