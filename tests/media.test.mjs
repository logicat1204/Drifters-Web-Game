import {test}from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm}from 'node:fs/promises';
import {tmpdir}from 'node:os';
import path from 'node:path';
import {MediaLibrary,parseShopSong}from '../server/media.mjs';
import {Store}from '../server/store.mjs';
import {CARS,TRACKS,makeTrack,createRace}from '../js/sim.mjs';
import http from 'node:http';
import {Accounts}from '../server/accounts.mjs';
test('shop names are parsed from the right; ownership remains stable if price or format changes',()=>{
 const a=parseShopSong('GasGasGas_Manuel_300.mp3');assert.equal(a.name,'GasGasGas - Manuel');assert.equal(a.price,300);assert.equal(a.id,parseShopSong('GasGasGas_Manuel_900.ogg').id);assert.equal(parseShopSong('Night_Drive_Manuel_100.wav').title,'Night Drive');
 for(const name of ['bad.mp3','Gas_Manuel_0.mp3','Gas_Manuel_1000001.mp3','Gas_Manuel_-4.wav','Gas_Manuel_300.txt'])assert.equal(parseShopSong(name),null,name);
});
test('campaign resources scan natural multi-page order, independent soundtracks, endings and live additions',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'touge-media-'));try{
  const media=new MediaLibrary(root),folder=path.join(root,'campaign_files','akina','kenji'),put=async(dir,name)=>{await mkdir(path.join(folder,dir),{recursive:true});await writeFile(path.join(folder,dir,name),'fixture');};
  assert.deepEqual((await media.stageMedia({id:'kenji',chapter:'akina'},{comics:['legacy.jpg']})).storyStart,['legacy.jpg']);
  for(const name of ['10.png','2.jpg','001.webp'])await put('story_start',name);await put('story_end','01.png');await put('narrative_music_start','01 intro.wav');await put('narrative_music_end','01 outro.wav');await put('music','01 race.mp3');
  let data=await media.stageMedia({id:'kenji',chapter:'akina'},{portrait:'portrait.jpg',comics:['legacy.jpg']});assert.deepEqual(data.storyStart.map(u=>u.split('/').at(-1)),['001.webp','2.jpg','10.png']);assert.equal(data.comics.length,3);assert.equal(data.storyEnd.length,1);assert.match(data.narrativeStart.url,/narrative_music_start/);assert.match(data.narrativeEnd.url,/narrative_music_end/);assert.equal(data.music[0].name,'01 race');assert.equal(data.portrait,'portrait.jpg');
  await put('story_start','3.png');data=await media.stageMedia({id:'kenji',chapter:'akina'});assert.equal(data.storyStart.length,4);
  await put('story_sounds_start','2_motor.wav');await put('story_sounds_start','10.mp3');await put('story_sounds_end','01.wav');
  data=await media.stageMedia({id:'kenji',chapter:'akina'});
  assert.deepEqual(data.storySoundsStart.map(sound=>sound?.name??null),[null,'2_motor',null,'10']);
  assert.equal(data.storySoundsEnd[0].name,'01');
  const chapter=path.join(root,'campaign_files','akina','_chapter');
  for(const [dir,name]of [['story_start','001.webp'],['story_sounds_start','001.mp3']]){await mkdir(path.join(chapter,dir),{recursive:true});await writeFile(path.join(chapter,dir,name),'fixture');}
  assert.match((await media.chapterMedia({id:'akina'})).storySoundsStart[0].url,/story_sounds_start/);
  await mkdir(path.join(root,'songs','shop'),{recursive:true});await writeFile(path.join(root,'songs','Free.wav'),'free');await writeFile(path.join(root,'songs','shop','GasGasGas_Manuel_300.mp3'),'paid');assert.equal((await media.freeSongs()).length,1);assert.equal((await media.shopSongs())[0].price,300);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('music purchases are transactional, user-scoped, idempotent and survive the v4 migration',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'touge-music-db-')),filename=path.join(root,'save.sqlite');let store;
 try{store=new Store(filename);const a=await store.register('MusicPilot24','password-24'),b=await store.register('OtherMusic24','password-24');store.db.prepare('UPDATE wallets SET balance=1000 WHERE user_id=?').run(a.id);const session=store.createSession(a.id);store.db.exec('DROP TABLE owned_music; PRAGMA user_version=4;');store.close();store=new Store(filename);
  assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,7);assert.equal(store.session(session.token).user.id,a.id);assert.equal(store.user(a.id).coins,1000);const song=parseShopSong('GasGasGas_Manuel_300.mp3');assert.deepEqual(store.user(a.id).music,[]);
  assert.equal(store.buyMusic(a.id,song).user.coins,700);assert.equal(store.buyMusic(a.id,{...song,price:900}).user.coins,700);assert.deepEqual(store.user(b.id).music,[]);assert.throws(()=>store.buyMusic(b.id,song),/suficientes/);assert.deepEqual(store.user(b.id).music,[]);assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM economy_ledger WHERE reason LIKE 'music:%'").get().n,1);
  const balance=store.user(a.id).coins;store.db.exec("CREATE TRIGGER fail_music BEFORE INSERT ON owned_music BEGIN SELECT RAISE(ABORT,'rollback music'); END;");assert.throws(()=>store.buyMusic(a.id,parseShopSong('Other_Manuel_100.wav')),/rollback/);assert.equal(store.user(a.id).coins,balance);store.close();store=new Store(filename);assert.deepEqual(store.user(a.id).music,[song.id]);
 }finally{store?.close();await rm(root,{recursive:true,force:true});}
});
test('Time Attack rankings select one best verified finish per driver and isolate mode and conditions',async()=>{
 const store=new Store(':memory:');try{const a=await store.register('RankPilot24','password-24'),b=await store.register('RankRival24','password-24');const track=makeTrack(TRACKS[0]);let seq=0;
  for(const [user,time,mode,complete,wet]of [[a,130,'time',true,false],[a,120,'time',true,false],[b,125,'time',true,false],[b,70,'battle',true,false],[b,50,'time',false,false],[a,60,'time',true,true]]){const r=createRace(CARS[0],track,{mode,wet});Object.assign(r,{s:complete?track.length:100,elapsed:time,finished:true,won:true});store.addRun('ranking-'+seq++,user.id,r);}
  assert.deepEqual(store.records({track:'akina',mode:'time'}).map(r=>[r.userId,r.time]),[[a.id,120],[b.id,125]]);assert.equal(store.records({track:'akina',mode:'time',wet:true})[0].time,60);assert.equal(store.records({track:'akina',mode:'time',car:'supra'}).length,0);
 }finally{store.close();}
});

test('music API charges the catalog price, rejects unauthorized purchases and returns course rankings',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'touge-media-api-')),store=new Store(':memory:'),media=new MediaLibrary(root),accounts=new Accounts(store,{media});
 const server=http.createServer(async(req,res)=>{if(!await accounts.handle(req,res,new URL(req.url,'http://localhost')))res.writeHead(404).end();});
 try{
  await mkdir(path.join(root,'songs','shop'),{recursive:true});await writeFile(path.join(root,'songs','shop','GasGasGas_Manuel_300.mp3'),'fixture');
  const pilot=await store.register('MusicApiPilot24','password-24');store.db.prepare('UPDATE wallets SET balance=1000 WHERE user_id=?').run(pilot.id);const session=store.createSession(pilot.id),song=(await media.shopSongs())[0];
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,headers={Cookie:'touge_session='+session.token,'Content-Type':'application/json','X-CSRF-Token':session.csrf};
  assert.equal((await fetch(base+'/api/shop/buy',{method:'POST',headers:{...headers,'X-CSRF-Token':'forged'},body:JSON.stringify({kind:'music',id:song.id})})).status,403);
  assert.equal((await fetch(base+'/api/shop/buy',{method:'POST',headers,body:JSON.stringify({kind:'music',id:'missing',price:1})})).status,400);
  let response=await fetch(base+'/api/shop/buy',{method:'POST',headers,body:JSON.stringify({kind:'music',id:song.id,price:1})});assert.equal(response.status,200);assert.equal((await response.json()).user.coins,700);
  const owned=await(await fetch(base+'/api/songs',{headers})).json();assert.equal(owned.songs[0].id,song.id);assert.equal(owned.songs[0].absolute,undefined);assert.equal((await(await fetch(base+'/api/songs')).json()).songs.length,0);
  const race=createRace(CARS[0],makeTrack(TRACKS[0]),{mode:'time'});Object.assign(race,{s:race.track.length,elapsed:125,finished:true,won:true});store.addRun('http-ranking',pilot.id,race);
  response=await fetch(base+'/api/rankings?track=akina',{headers});const ranking=await response.json();assert.equal(ranking.records.length,1);assert.equal(ranking.records[0].rank,1);assert.equal(ranking.personal.time,125);assert.equal(ranking.personal.userId,pilot.id);assert.equal(ranking.filters.mode,'time');assert.equal((await fetch(base+'/api/rankings')).status,401);
 }finally{server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));store.close();await rm(root,{recursive:true,force:true});}
});
