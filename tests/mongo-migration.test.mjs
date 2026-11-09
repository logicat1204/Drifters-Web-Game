import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {CARS,ALL_TRACKS,createRace,makeTrack} from '../js/sim.mjs';
import {CAMPAIGN_STAGES} from '../js/campaign.mjs';
import {importSqlite,readSqlite} from '../scripts/migrate-mongodb.mjs';
import {MongoStore,pilotView} from '../server/mongo-store.mjs';
import {ensureMongoSchema,importMarker,mongoConnectionMessage,schemaMarker} from '../server/database.mjs';
import {Store,hashToken} from '../server/store.mjs';
import {OnlineRooms} from '../server/online.mjs';
import {Runs} from '../server/runs.mjs';

const song={id:'song-0123456789abcdef01234567',price:100};
const stage=CAMPAIGN_STAGES[0];
const photo=Buffer.from([137,80,78,71,13,10,26,10]);
const pass='night-password-24';
const wire=value=>JSON.parse(JSON.stringify(value));
function samePilot(actual,expected){
  actual=wire(actual);expected=wire(expected);
  for(const pilot of [actual,expected]){
    for(const key of ['cars','cosmetics','music','chapterStories'])pilot[key].sort();
    pilot.campaign.sort((a,b)=>a.id.localeCompare(b.id));
  }
  assert.deepEqual(actual,expected);
}
function finishedRace(mode='time'){
  const race=createRace(CARS[0],makeTrack(ALL_TRACKS.find(t=>t.id===stage.track)),{mode,campaignStage:mode==='campaign'?stage.id:undefined,rival:stage});
  Object.assign(race,{s:race.track.length,elapsed:160,finished:true,won:true});
  race.skill.points=9000;
  return race;
}
async function fixture(t){
  const dir=await mkdtemp(path.join(tmpdir(),'touge-atlas-'));
  const filename=path.join(dir,'source.sqlite'),sql=new Store(filename);
  t.after(async()=>{sql.close();await rm(dir,{recursive:true,force:true});});
  const {id}=await sql.register('AtlasDriver24',pass);
  sql.setPhoto(id,photo,'image/png');
  sql.updateProfile(id,{complete:true,portraitMode:'photo'});
  const session=sql.createSession(id);
  sql.db.prepare('UPDATE wallets SET balance=5000 WHERE user_id=?').run(id);
  sql.upgradeVehicle(id,'ae86','engine',1);
  sql.buyVehiclePart(id,'ae86','paint');
  sql.customizeVehicle(id,'ae86',{color:'#3975a2'});
  sql.buyMusic(id,song);
  sql.markChapterStory(id,stage.chapter,'start');
  sql.addRun('original-race',id,finishedRace());
  sql.addRun('original-stage',id,finishedRace('campaign'));
  return {sql,filename,id,session};
}

test('SQLite export preserves account identity, progress, purchases, photos, credentials and runs',async t=>{
  const {sql,filename,id,session}=await fixture(t),data=readSqlite(filename),pilot=data.pilots[0];
  samePilot(pilotView(pilot),sql.user(id));
  assert.equal(pilot.username_key,'atlasdriver24');
  assert.equal(pilot.password_hash,sql.db.prepare('SELECT password_hash FROM users').get().password_hash);
  assert.deepEqual(pilot.profile.photo,photo);
  assert.equal(data.sessions[0]._id,hashToken(session.token));
  assert.equal(data.sessions[0].csrf,session.csrf);
  assert.deepEqual(data.runs.map(r=>r._id).sort(),['original-race','original-stage']);
  assert.equal(data.economy_ledger.length,4);
});

test('connection diagnostics distinguish DNS, authorization and TLS without printing driver details',()=>{
  const sensitive='mongodb+srv://pilot:secret@example.invalid/';
  const cases=[
    [Object.assign(Error(sensitive),{syscall:'querySrv',code:'ECONNREFUSED'}),/resolución DNS/],
    [Object.assign(Error('bad auth '+sensitive),{code:8000}),/rechazó la autenticación/],
    [Object.assign(Error(sensitive),{code:13}),/no tiene acceso/],
    [Object.assign(Error(sensitive),{code:'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR'}),/conexión TLS/]
  ];
  for(const [error,expected] of cases){
    const message=mongoConnectionMessage({reason:{servers:new Map([['host',{error}]])}});
    assert.match(message,expected);
    assert.ok(!message.includes(sensitive));
  }
});

test('startup recognizes imported or initialized databases and protects unmarked player data',async()=>{
  for(const id of [importMarker,schemaMarker]){
    const db={collection(name){
      assert.equal(name,'migrations');
      return {async findOne(filter){assert.ok(filter._id.$in.includes(id));return {_id:id};}};
    }};
    await ensureMongoSchema(null,db);
  }
  const db={collection(name){
    return {async findOne(){return name==='pilots'?{_id:'existing-player'}:null;}};
  }};
  await assert.rejects(ensureMongoSchema(null,db),/base tiene datos/);
});

const mongoPort=Number(process.env.TOUGE_MONGO_TEST_PORT);
test('a local Mongo replica imports once and serves races and atomic purchases', {skip:!mongoPort},async t=>{
  const {sql,filename,id,session}=await fixture(t);
  const client=new MongoClient(`mongodb://127.0.0.1:${mongoPort}/?directConnection=true`,{promoteBuffers:true,serverSelectionTimeoutMS:5000});
  const db=client.db('touge_test_'+randomUUID().replaceAll('-',''));
  await client.connect();
  t.after(async()=>{try{await db.dropDatabase();}finally{await client.close();}});
  const data=readSqlite(filename);
  await importSqlite(client,db,data);
  await assert.rejects(importSqlite(client,db,data),/ya tiene una migración/);
  const store=new MongoStore(client,db);
  samePilot(await store.login('ATLASDRIVER24',pass),sql.user(id));
  const migratedSession=await store.session(session.token);
  samePilot(migratedSession.user,sql.user(id));
  assert.equal(migratedSession.csrf,session.csrf);
  assert.deepEqual(await store.portrait(id),sql.portrait(id));
  assert.deepEqual(await store.records({mode:'time'}),sql.records({mode:'time'}));
  assert.deepEqual(wire(await store.personal(id)),wire(sql.personal(id)));
  const {user:migratedUser,...migratedRun}=await store.runResult('original-stage',id);
  const {user:originalUser,...originalRun}=sql.runResult('original-stage',id);
  samePilot(migratedUser,originalUser);
  assert.deepEqual(wire(migratedRun),wire(originalRun));
  await assert.rejects(store.register('AtlasDriver24',pass),/ocupado/);
  const coins=(await store.user(id)).coins;
  const purchases=await Promise.all([store.upgradeVehicle(id,'ae86','engine',2),store.upgradeVehicle(id,'ae86','engine',2)]);
  assert.equal(purchases.filter(p=>!p.alreadyOwned).length,1);
  assert.equal((await store.user(id)).coins,coins-480);
  const saved=await store.addRun('new-stage',id,finishedRace('campaign'));
  assert.ok(saved.reward.coins>0);
  await store.addRun('new-stage',id,finishedRace('campaign'));
  assert.equal((await store.user(id)).coins,saved.user.coins);
  const attempt=await new Runs(store).start(id,{car:'ae86',track:'akina',mode:'time'});
  assert.equal(attempt.options.build.engine,2);
  const other=await store.register('OtherPilot24',pass);
  await store.updateProfile(other.id,{complete:true});
  const rooms=new OnlineRooms({store});
  const host=rooms.connect(()=>{},()=>{},{id}),guest=rooms.connect(()=>{},()=>{},other);
  await rooms.receive(host,{type:'create'});
  await rooms.receive(guest,{type:'join',code:host.room.code});
  for(const player of [host,guest])rooms.receive(player,{type:'ready',ready:true});
  await rooms.receive(host,{type:'start'});
  assert.equal(host.room.phase,'racing');
  assert.equal(host.room.players.get(host.id).race.car.build.engine,2);
  await store.logout(session.token);
  assert.equal(await store.session(session.token),null);
});
