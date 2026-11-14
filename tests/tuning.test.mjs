import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../server/store.mjs';
import {Runs} from '../server/runs.mjs';
import {OnlineRooms} from '../server/online.mjs';
import {CARS,ALL_CARS,TRACKS,createRace,makeTrack,updateRace} from '../js/sim.mjs';
import {Renderer} from '../js/renderer.js';
import {UPGRADES,VEHICLE_PARTS,stockBuild,applyBuild,validateBuild,buildKey,appearanceKey} from '../js/tuning.mjs';
import {RunRecorder} from '../js/replay.mjs';
import {driverInput,kanataLateInput} from './helpers/reference-driver.mjs';
import {CAMPAIGN_STAGES} from '../js/campaign.mjs';
import {ALL_TRACKS} from '../js/sim.mjs';
import {activateFocus} from '../js/focus.mjs';
async function fixture(filename=':memory:'){const store=new Store(filename),user=await store.register('TuningPilot24','tuning-password-24');store.updateProfile(user.id,{complete:true});return {store,user:store.user(user.id)};}
const fund=(store,user,n=20000)=>store.db.prepare('UPDATE wallets SET balance=? WHERE user_id=?').run(n,user.id);
test('stock preparation leaves actual physics unchanged; max upgrades are bounded and keep car profiles',()=>{
 const track=makeTrack(TRACKS[0]);for(const car of ALL_CARS){const original=JSON.stringify(car),a=createRace(car,track,{mode:'time'}),b=createRace(car,track,{mode:'time',build:stockBuild()});a.countdown=b.countdown=0;
  for(let i=0;i<200;i++){const input={throttle:true,steer:i>150?.12:0};updateRace(a,input,1/120);updateRace(b,input,1/120);}for(const key of ['s','speed','lateral','yaw'])assert.equal(a[key],b[key]);
  const max=applyBuild(car,{engine:3,chassis:3,brakes:3});assert.equal(max.max,car.max*1.06);assert.equal(max.accel,car.accel*1.12);assert.equal(max.grip,car.grip*1.12);assert.equal(max.brakePower,(car.brakePower||1)*1.18);assert.equal(max.profile,car.profile);assert.equal(JSON.stringify(car),original);assert.equal(applyBuild(max,max.build).max,max.max);
 }
 assert.ok(applyBuild(CARS[0],{chassis:3}).grip>applyBuild(CARS[2],{chassis:3}).grip);assert.ok(applyBuild(CARS[2],{engine:3}).max>applyBuild(CARS[0],{engine:3}).max);
});
test('tiers improve actual acceleration and braking; paint and visual parts change no physics',()=>{
 const t=makeTrack({...TRACKS[0],layout:[[1,0]],length:8000}),a=createRace(CARS[1],t,{mode:'time'}),b=createRace(CARS[1],t,{mode:'time',build:{engine:3,chassis:3,brakes:3}}),c=createRace(CARS[1],t,{mode:'time',build:{color:'#3975a2',vinyl:'apex',hood:'carbon',spoiler:'gt',wheels:'gold'}});
 a.countdown=b.countdown=c.countdown=0;for(let i=0;i<360;i++)for(const r of [a,b,c])updateRace(r,{throttle:true},1/120);assert.ok(b.speed>a.speed+2);assert.equal(c.speed,a.speed);assert.equal(c.car.grip,a.car.grip);
 a.speed=b.speed=40;for(let i=0;i<60;i++)for(const r of [a,b])updateRace(r,{brake:true},1/120);assert.ok(b.speed<a.speed-1.5);
});
test('upgrade purchases are sequential, scoped, capped, permanent and idempotent',async()=>{
 const {store,user}=await fixture();try{assert.throws(()=>store.upgradeVehicle(user.id,'ae86','engine',1),/suficientes/);fund(store,user);const before=store.user(user.id).coins;
  assert.throws(()=>store.upgradeVehicle(user.id,'ae86','engine',2),/anteriores/);assert.throws(()=>store.upgradeVehicle(user.id,'gt86','engine',1),/garaje/);assert.throws(()=>store.upgradeVehicle(user.id,'ae86','__proto__',1),/inválido/);
  for(let tier=1;tier<=3;tier++){const r=store.upgradeVehicle(user.id,'ae86','engine',tier),coins=r.user.coins;assert.equal(r.user.garage.ae86.build.engine,tier);assert.equal(store.upgradeVehicle(user.id,'ae86','engine',tier).user.coins,coins);}
  assert.equal(store.user(user.id).coins,before-UPGRADES.engine.prices.reduce((a,b)=>a+b,0));assert.throws(()=>store.upgradeVehicle(user.id,'ae86','engine',4),/inválido/);assert.equal(store.vehicleBuild(user.id,'rx7').engine,0);
  const other=await store.register('OtherTuning24','tuning-password-24');assert.equal(store.vehicleBuild(other.id,'ae86').engine,0);
 }finally{store.close();}
});
test('failed upgrade and part transactions roll back money, installation and ledger entries',async()=>{
 const {store,user}=await fixture();try{fund(store,user);store.db.exec("CREATE TRIGGER fail_engine BEFORE UPDATE ON vehicle_builds WHEN NEW.engine=1 BEGIN SELECT RAISE(ABORT,'test rollback'); END;");const coins=store.user(user.id).coins;assert.throws(()=>store.upgradeVehicle(user.id,'ae86','engine',1),/rollback/);assert.equal(store.user(user.id).coins,coins);assert.equal(store.vehicleBuild(user.id,'ae86').engine,0);assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM economy_ledger').get().n,0);
  store.db.exec("CREATE TRIGGER fail_part BEFORE INSERT ON owned_vehicle_parts BEGIN SELECT RAISE(ABORT,'test rollback'); END;");assert.throws(()=>store.buyVehiclePart(user.id,'ae86','spoiler-gt'),/rollback/);assert.equal(store.user(user.id).coins,coins);assert.deepEqual(store.user(user.id).garage,{});
 }finally{store.close();}
});
test('visual parts are owned per car; color is validated and repainting or re-equipping is free',async()=>{
 const {store,user}=await fixture();try{fund(store,user);assert.throws(()=>store.customizeVehicle(user.id,'ae86',{color:'#654321'}),/pintura/);assert.throws(()=>store.customizeVehicle(user.id,'ae86',{engine:3}),/inválida/);assert.throws(()=>validateBuild({color:'url(x)'}),/Color/);
  store.buy(user.id,'car','rx7');
  for(const part of VEHICLE_PARTS)store.buyVehiclePart(user.id,'ae86',part.id);const coins=store.user(user.id).coins;assert.equal(store.buyVehiclePart(user.id,'ae86','paint').user.coins,coins);
  store.customizeVehicle(user.id,'ae86',{color:'#AaBbcC',vinyl:'twin'});assert.equal(store.vehicleBuild(user.id,'ae86').color,'#aabbcc');store.customizeVehicle(user.id,'ae86',{color:'#123456',vinyl:'apex'});assert.equal(store.user(user.id).coins,coins);
  assert.throws(()=>store.customizeVehicle(user.id,'rx7',{vinyl:'apex'}),/Compra/);store.customizeVehicle(user.id,'ae86',{color:null,vinyl:'none',hood:'stock',spoiler:'stock',wheels:'stock'});assert.equal(store.user(user.id).garage.ae86.parts.length,VEHICLE_PARTS.length);assert.equal(store.user(user.id).coins,coins);
 }finally{store.close();}
});
test('migration from v3 preserves money, sessions and records and is safe to reopen',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'touge-garage-')),filename=path.join(dir,'save.sqlite');let store;try{
  const fixtureData=await fixture(filename);store=fixtureData.store;const user=fixtureData.user;fund(store,user,1234);const session=store.createSession(user.id),r=createRace(CARS[0],makeTrack(TRACKS[0]),{mode:'time'});Object.assign(r,{s:r.track.length,elapsed:150,won:true});store.addRun('before-upgrades',user.id,r);
  store.db.exec('DROP TABLE owned_vehicle_parts; DROP TABLE vehicle_builds; DROP INDEX runs_build; ALTER TABLE runs DROP COLUMN vehicle_build; ALTER TABLE runs DROP COLUMN build_key; PRAGMA user_version=3;');store.close();store=new Store(filename);assert.equal(store.user(user.id).coins,1234);assert.equal(store.session(session.token).user.id,user.id);assert.equal(store.records()[0].time,150);assert.equal(store.records()[0].buildKey,'M0-C0-F0');store.upgradeVehicle(user.id,'ae86','engine',1);store.close();store=new Store(filename);assert.equal(store.vehicleBuild(user.id,'ae86').engine,1);assert.equal(store.user(user.id).coins,1014);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,8);
 }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('solo preparations are fixed by the server, cannot be forged, and survive later garage changes',async()=>{
 const {store,user}=await fixture();try{fund(store,user);store.upgradeVehicle(user.id,'ae86','engine',1);const runs=new Runs(store),run=runs.start(user.id,{mode:'time',track:'akina',car:'ae86',build:{engine:3,chassis:3}});assert.equal(run.options.build.engine,1);assert.equal(run.options.build.chassis,0);store.upgradeVehicle(user.id,'ae86','engine',2);assert.equal(run.options.build.engine,1);
 }finally{store.close();}
});
test('an upgraded real replay is saved using its captured preparation and has its own personal best',async()=>{
 let now=0;const {store,user}=await fixture();try{fund(store,user);for(const system of Object.keys(UPGRADES))store.upgradeVehicle(user.id,'ae86',system,1);store.buyVehiclePart(user.id,'ae86','paint');store.customizeVehicle(user.id,'ae86',{color:'#3975a2'});
  const runs=new Runs(store,{now:()=>now}),attempt=runs.start(user.id,{mode:'time',track:'usui',car:'ae86'}),r=createRace(CARS[0],makeTrack(TRACKS[3]),attempt.options),recorder=new RunRecorder();for(let i=0;i<108000&&!r.finished;i++)updateRace(r,recorder.capture(r,driverInput(r)),1/120);assert.ok(r.won);store.upgradeVehicle(user.id,'ae86','engine',2);now=900000;const result=await runs.submit(user.id,attempt.id,recorder.frames);assert.equal(result.buildKey,'M1-C1-F1');assert.equal(result.build.color,'#3975a2');assert.equal(result.personalBest,result.time);assert.equal(store.records({track:'usui'})[0].buildKey,'M1-C1-F1');
 }finally{store.close();}
});
test('online freezes server-owned builds at start and publishes per-player appearance',async()=>{
 const {store,user}=await fixture();try{const other=await store.register('StockRacer24','tuning-password-24');store.updateProfile(other.id,{complete:true});fund(store,user);store.upgradeVehicle(user.id,'ae86','engine',1);const rooms=new OnlineRooms({store}),a=rooms.connect(()=>{},()=>{},user),b=rooms.connect(()=>{},()=>{},other);rooms.receive(a,{type:'create'});rooms.receive(b,{type:'join',code:a.room.code,build:{engine:3}});for(const c of [a,b])rooms.receive(c,{type:'ready',ready:true});rooms.receive(a,{type:'start'});const [pa,pb]=[...a.room.players.values()];assert.equal(pa.race.car.max,CARS[0].max*1.02);assert.equal(pb.race.car.max,CARS[0].max);assert.equal(rooms.lobby(a.room).players[0].build.engine,1);store.upgradeVehicle(user.id,'ae86','engine',2);assert.equal(pa.race.car.build.engine,1);
 }finally{store.close();}
});
test('all body variants render finite parts; same-model players keep distinct meshes and replaced previews release buffers',()=>{
 const renderer=Object.create(Renderer.prototype),uploads=[],deleted=[];renderer.cars={};renderer.gl={createBuffer:()=>({}),bindBuffer(){},bufferData(_target,data){assert.ok(data.every(Number.isFinite));uploads.push(data);},deleteBuffer:b=>deleted.push(b),ARRAY_BUFFER:1,STATIC_DRAW:2};
 for(const base of ALL_CARS){const tuned=applyBuild(base,{color:'#3975a2',vinyl:'twin',hood:'carbon',spoiler:'gt',wheels:'gold'});renderer.setCar(tuned);assert.ok(renderer.cars[base.id].count>0);renderer.setCar(applyBuild(base,{vinyl:'apex'}));}
 assert.ok(deleted.length>=ALL_CARS.length);renderer.setNetworkPlayers([{id:'a',car:'ae86',build:{color:'#cc3344'}},{id:'b',car:'ae86',build:{color:'#3366cc',spoiler:'gt'}}]);assert.notEqual(renderer.cars['network-a'].buffer,renderer.cars['network-b'].buffer);assert.notEqual(appearanceKey(applyBuild(CARS[0],{color:'#cc3344'})),appearanceKey(applyBuild(CARS[0],{color:'#3366cc'})));assert.equal(buildKey({color:'#3366cc'}),'M0-C0-F0');
});
test('max preparation opens a winning margin against elite rivals with a less aggressive clean reference driver',()=>{
 for(const id of ['takumi-initial','takumi-project','beckenbauer','kanata-final']){
  const rival=CAMPAIGN_STAGES.find(s=>s.id===id);let won=false;
  for(const car of CARS.slice(0,3)){
   const r=createRace(car,makeTrack(ALL_TRACKS.find(t=>t.id===rival.track)),{mode:'campaign',rival,build:{engine:3,chassis:3,brakes:3},focusEnabled:rival.index>=3,focusType:'time'});r.countdown=0;r.timeLeft=10000;
   for(let i=0;i<108000&&!r.finished;i++){const final=id==='kanata-final';if(r.focus.charge>=60&&(!final||r.track.length-r.s<220))activateFocus(r);updateRace(r,final?kanataLateInput(r,{line:2.5,followLine:0,followGap:10,gripUse:.88}):driverInput(r,{line:-2.5,gripUse:.8}),1/120);}
   if(r.won){won=true;break;}
  }
  assert.ok(won,id);
 }
});
