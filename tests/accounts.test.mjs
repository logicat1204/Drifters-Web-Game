import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {Store,avatarSvg} from '../server/store.mjs';
import {Runs} from '../server/runs.mjs';
import {DEFAULT_AVATAR,avatarOptions,defaultAvatar,avatarLayers,validateAvatar,migrateAvatar,COSMETICS} from '../js/avatar.mjs';
import {RunRecorder} from '../js/replay.mjs';
import {CARS,TRACKS,createRace,makeTrack,updateRace,repositionRace} from '../js/sim.mjs';
import {activateFocus} from '../js/focus.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
import {OnlineRooms} from '../server/online.mjs';
const complete=(store,user,extra={})=>store.updateProfile(user.id,{displayName:user.username,avatar:DEFAULT_AVATAR,portraitMode:'avatar',complete:true,...extra});
test('accounts have case-insensitive unique alphanumeric handles, hashed passwords and expiring revocable sessions',async()=>{
  let now=1000;const store=new Store(':memory:',{now:()=>now});
  try{const [a,b]=await Promise.allSettled([store.register('TakumiFX24','night-pass-24'),store.register('takumifx24','other-pass-24')]);assert.equal([a,b].filter(r=>r.status==='fulfilled').length,1);assert.equal(store.available('TAKUMIFX24'),false);const user=(a.status==='fulfilled'?a:b).value,hash=store.db.prepare('SELECT password_hash,salt FROM users').get();assert.equal(hash.password_hash.length,128);assert.notEqual(hash.password_hash,'night-pass-24');assert.equal(user.password_hash,undefined);
    await assert.rejects(store.register('bad name','night-pass-24'));await assert.rejects(store.register('NewName','tiny'));await assert.rejects(store.login(user.username,'wrong-password'),/incorrectos/);
    const session=store.createSession(user.id);assert.equal(store.session(session.token).user.id,user.id);assert.notEqual(store.db.prepare('SELECT token_hash FROM sessions').get().token_hash,session.token);store.logout(session.token);assert.equal(store.session(session.token),null);const expires=store.createSession(user.id);now+=31*86400000;assert.equal(store.session(expires.token),null);
  }finally{store.close();}
});
test('profiles, inventory, photos, default cars and records persist across database reopen without cross-user leakage',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'touge-db-')),filename=path.join(folder,'users.sqlite');let store=new Store(filename);
  try{const a=await store.register('Alvaroo','password-A24'),b=await store.register('Kanata24','password-B24');complete(store,a,{displayName:'Álvaro',defaultCar:'supra'});complete(store,b,{defaultCar:'mr2'});assert.throws(()=>store.updateProfile(a.id,{avatar:{...DEFAULT_AVATAR,hair:'paid-unknown'}}));assert.throws(()=>store.updateProfile(a.id,{portraitMode:'photo'}),/Sube/);store.setPhoto(a.id,Buffer.from([1,2,3]),'image/png');store.updateProfile(a.id,{portraitMode:'photo'});
    const r=createRace(CARS[6],makeTrack(TRACKS[0]),{mode:'time'});Object.assign(r,{finished:true,s:r.track.length,elapsed:140,won:true});r.skill.points=800;store.addRun('legitimate-A',a.id,r);store.addRun('legitimate-A',a.id,r);assert.equal(store.stats(a.id).races,1);assert.equal(store.stats(b.id).races,0);assert.equal(store.records()[0].username,'Alvaroo');assert.equal(store.personal(b.id).records.length,0);
    store.close();store=new Store(filename);assert.equal(store.user(a.id).defaultCar,'supra');assert.equal(store.user(a.id).displayName,'Álvaro');assert.equal(store.user(b.id).defaultCar,'mr2');assert.equal(store.stats(a.id).points,800);assert.deepEqual(store.portrait(a.id).bytes,Buffer.from([1,2,3]));assert.equal((await store.login('ALVAROO','password-A24')).id,a.id);
  }finally{store.close();await rm(folder,{recursive:true,force:true});}
});
test('independent avatar catalogs render every item on their own rig and reject mismatched pieces',()=>{
  for(const base of ['male','female'])for(const key of ['hair','eyes','mouth','outfit','accessory'])for(const [id] of avatarOptions(base)[key]){const avatar={...defaultAvatar(base),[key]:id},layers=avatarLayers(avatar),svg=avatarSvg(avatar);assert.ok(layers.length>=9);assert.ok(layers.every(layer=>layer.id.startsWith(base+'/')));assert.match(svg,/data:image\/png;base64,/);assert.doesNotMatch(svg,/<script|href="https?:/);}
  const male=new Set(avatarLayers(defaultAvatar('male')).map(l=>l.id));assert.ok(avatarLayers(defaultAvatar('female')).every(l=>!male.has(l.id)));
  assert.throws(()=>validateAvatar({...DEFAULT_AVATAR,hair:'ponytail'}),/hair/);assert.throws(()=>validateAvatar({...defaultAvatar('female'),eyes:'sharp'}),/eyes/);
  assert.ok(COSMETICS.every(item=>item.bases.length===1&&item.id.startsWith(item.bases[0]+'.')&&item.rig.endsWith(item.bases[0])));
  assert.throws(()=>avatarSvg({...DEFAULT_AVATAR,skin:'red" onload="alert(1)'}));
});

test('gender-specific inventory ownership is checked even when two pieces have the same local key',async()=>{
  const store=new Store(':memory:');try{
    const user=await store.register('SeparateParts24','password-24');
    store.db.prepare('DELETE FROM inventory WHERE user_id=? AND item_id=?').run(user.id,'female.outfit.jacket');
    assert.equal(store.updateProfile(user.id,{avatar:defaultAvatar('male')}).avatar.base,'male');
    assert.throws(()=>store.updateProfile(user.id,{avatar:defaultAvatar('female')}),/inventario/);
    assert.equal(store.updateProfile(user.id,{avatar:{...defaultAvatar('female'),outfit:'shirt'}}).avatar.base,'female');
  }finally{store.close();}
});

test('v1 avatars map to the independent catalog without changing colors or outfit types',()=>{
  for(const base of ['male','female'])for(const hair of ['short','spiked','bob','long'])for(const accessory of ['none','glasses','earrings','cap']){
    const a=migrateAvatar({...DEFAULT_AVATAR,version:1,base,hair,accessory,eyes:'round',mouth:'full',skin:'#805039',outfit:'hoodie'});
    assert.equal(a.version,2);assert.equal(a.base,base);assert.equal(a.skin,'#805039');assert.equal(a.outfit,'hoodie');validateAvatar(a);
  }
});

test('database v1 migration preserves profiles, photos, sessions and records and grants both catalogs exactly once',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'touge-avatar-')),filename=path.join(folder,'users.sqlite');let store=new Store(filename);
  try{
    const user=complete(store,await store.register('LegacyDriver24','password-24'),{displayName:'Piloto anterior',defaultCar:'supra'}),session=store.createSession(user.id);
    store.setPhoto(user.id,Buffer.from([3,2,1]),'image/png');store.updateProfile(user.id,{portraitMode:'photo'});
    const race=createRace(CARS[0],makeTrack(TRACKS[0]),{mode:'time'});Object.assign(race,{s:race.track.length,elapsed:145,won:true});store.addRun('legacy-record',user.id,race);
    const legacy={...DEFAULT_AVATAR,version:1,base:'female',hair:'spiked',eyes:'round',mouth:'full',accessory:'cap',skin:'#805039',outfit:'hoodie'};
    store.db.prepare('UPDATE profiles SET avatar=? WHERE user_id=?').run(JSON.stringify(legacy),user.id);
    store.db.prepare('DELETE FROM inventory WHERE user_id=?').run(user.id);
    store.db.exec("INSERT INTO cosmetics VALUES('hair.spiked','hair','portrait-v1'); PRAGMA user_version=1;");store.db.prepare('INSERT INTO inventory VALUES(?,?,?)').run(user.id,'hair.spiked',1);
    const oldVersion=store.user(user.id).photoVersion;store.close();store=new Store(filename);
    const restored=store.user(user.id);assert.deepEqual(restored.avatar,migrateAvatar(legacy));assert.equal(restored.displayName,'Piloto anterior');assert.equal(restored.defaultCar,'supra');assert.equal(restored.onboarded,true);assert.equal(restored.photoVersion,oldVersion+1);assert.equal(store.session(session.token).user.id,user.id);assert.deepEqual(store.portrait(user.id).bytes,Buffer.from([3,2,1]));assert.equal(store.records()[0].time,145);
    const count=store.db.prepare('SELECT COUNT(*) AS n FROM inventory WHERE user_id=?').get(user.id).n;assert.equal(count,COSMETICS.length+1);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,2);
    store.close();store=new Store(filename);assert.equal(store.user(user.id).photoVersion,oldVersion+1);assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM inventory WHERE user_id=?').get(user.id).n,count);
    store.updateProfile(user.id,{portraitMode:'avatar'});assert.equal(store.portrait(user.id).mime,'image/svg+xml');
  }finally{store.close();await rm(folder,{recursive:true,force:true});}
});
function recordedLap(options={}){const r=createRace(CARS[0],makeTrack(TRACKS[3]),{mode:'time',...options}),recorder=new RunRecorder();let usedFocus=false,usedReset=false;
  for(let i=0;i<120*900&&!r.finished;i++){
    if(r.focus.charge>40&&!usedFocus){assert.ok(activateFocus(r));recorder.action(1);usedFocus=true;}
    if(usedFocus&&r.focus.remaining===0&&r.s>2000&&!usedReset){assert.ok(repositionRace(r));recorder.action(2);usedReset=true;}
    if(r.manual){if(r.rpm>7200&&r.gear<5)r.gear++;if(r.rpm<2900&&r.gear>1)r.gear--;}
    r.headlights=r.s%500>150;const input=recorder.capture(r,driverInput(r));updateRace(r,input,1/120);
  }return {r,recorder};
}
test('solo results are derived from a real replay with gears, lamps, focus and recovery, never from submitted times',async()=>{
  let now=0;const store=new Store(':memory:');try{const user=complete(store,await store.register('Replay24','night-pass-24')),runs=new Runs(store,{now:()=>now});
    for(const manual of [false,true]){const attempt=runs.start(user.id,{car:'ae86',track:'usui',mode:'time',difficulty:'normal',manual}),{r,recorder}=recordedLap({manual});assert.ok(r.won);now+=300000;const saved=await runs.submit(user.id,attempt.id,recorder.frames);assert.equal(saved.time,r.elapsed);assert.equal(saved.points,Math.floor(r.skill.points));assert.equal(saved.completed,true);assert.equal((await runs.submit(user.id,attempt.id,[])).id,saved.id);}
    assert.equal(store.stats(user.id).races,2);assert.equal(store.personal(user.id).records.length,2);
    const invalid=runs.start(user.id,{car:'ae86',track:'usui',mode:'time',difficulty:'normal'});await assert.rejects(runs.submit(user.id,invalid.id,[[999999,0,1,1,0]]),/inválido|larga/);await assert.rejects(runs.submit(user.id,invalid.id,[[1,0,1,1,0]]),/no terminó/);await assert.rejects(runs.submit('another-user',invalid.id,[]),/pertenece/);
  }finally{store.close();}
});
test('leaderboards pick one fastest run per pilot and separate source, weather, time, transmission and car',async()=>{
  const store=new Store(':memory:');try{const a=complete(store,await store.register('DriverA','night-pass-A')),b=complete(store,await store.register('DriverB','night-pass-B'));let id=0;
    const save=(u,elapsed,opts={},source='solo')=>{const r=createRace(CARS[0],makeTrack(TRACKS[0]),{mode:'time',...opts});Object.assign(r,{s:r.track.length,elapsed,won:true,finished:true});store.addRun('r'+id++,u.id,r,source);};
    save(a,150);save(a,140);save(b,145);save(b,80,{wet:true});save(b,70,{night:false});save(b,60,{manual:true});save(b,50,{},'online');
    const board=store.records();assert.deepEqual(board.map(r=>[r.username,r.time]),[['DriverA',140],['DriverB',145]]);assert.equal(store.records({wet:true})[0].time,80);assert.equal(store.records({source:'online'})[0].time,50);assert.equal(store.records({car:'supra'}).length,0);
  }finally{store.close();}
});
test('public rooms omit private, full and started rooms; authenticated identity and default car cannot be forged',async()=>{
  const store=new Store(':memory:');try{const user=complete(store,await store.register('Takumi24','night-pass-24'),{defaultCar:'supra'}),rooms=new OnlineRooms({store}),out=[],c=rooms.connect(m=>out.push(m),()=>{},user);
    rooms.receive(c,{type:'create',public:true,name:'Forged',car:'r32'});assert.equal(rooms.publicRooms().length,1);const p=c.room.players.get(c.id);assert.equal(p.name,'Takumi24');assert.equal(p.car,'supra');assert.equal(p.userId,user.id);
    c.room.public=false;assert.equal(rooms.publicRooms().length,0);c.room.public=true;c.room.phase='racing';assert.equal(rooms.publicRooms().length,0);c.room.phase='lobby';while(c.room.players.size<4)c.room.players.set('fake'+c.room.players.size,{client:{id:'fake'},name:'Test'});assert.equal(rooms.publicRooms().length,0);
  }finally{store.close();}
});
test('online finishes are saved before disconnect, and rematches and withdrawals never duplicate or lose records',async()=>{
  const store=new Store(':memory:');try{let now=0;const users=await Promise.all(['OnlineA','OnlineB'].map(name=>store.register(name,'online-password-24').then(u=>complete(store,u)))),rooms=new OnlineRooms({store,now:()=>now}),[host,guest]=users.map(u=>rooms.connect(()=>{},()=>{},u));
    rooms.receive(host,{type:'create',public:true,config:{track:'usui'}});const room=host.room;rooms.receive(guest,{type:'join',code:room.code});for(const c of [host,guest])rooms.receive(c,{type:'ready',ready:true});rooms.receive(host,{type:'start'});
    const winner=room.players.get(host.id);winner.race.countdown=0;winner.race.s=room.track.length-.1;winner.race.speed=30;winner.race.elapsed=100;room.elapsed=103;now+=10;rooms.step();assert.equal(winner.place,1);assert.equal(store.stats(users[0].id).races,1);assert.equal(store.records({track:'usui',source:'online'})[0].username,'OnlineA');
    rooms.disconnect(host);assert.equal(store.stats(users[0].id).races,1);const remaining=room.players.get(guest.id);remaining.race.countdown=0;remaining.race.timeLeft=0;now+=10;rooms.step();assert.equal(room.phase,'results');assert.equal(store.stats(users[1].id).races,1);assert.equal(store.personal(users[1].id).records.length,0);
    rooms.receive(guest,{type:'rematch'});const second=rooms.connect(()=>{},()=>{},users[0]);rooms.receive(second,{type:'join',code:room.code});for(const c of [guest,second])rooms.receive(c,{type:'ready',ready:true});rooms.receive(guest,{type:'start'});rooms.disconnect(second);assert.equal(store.stats(users[0].id).races,2,'a withdrawal in the next race is a new result');assert.equal(store.records({track:'usui',source:'online'}).length,1,'withdrawals cannot appear as finish times');
  }finally{store.close();}
});
