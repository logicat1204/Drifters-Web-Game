import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Store,runDocument} from '../server/store.mjs';
import {OnlineRooms} from '../server/online.mjs';
import {OnlineHost} from '../js/online-host.js';
import {placeOnlineCar,onlineSnapshot} from '../js/online-race.mjs';
import {RaceVerification} from '../server/race-verification.mjs';
import {RANKED_EPOCH,SEASON_LENGTH,seasonAward} from '../server/ranked.mjs';
import {ALL_TRACKS,CARS,makeTrack} from '../js/sim.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
import {CosmeticPacks} from '../server/cosmetic-packs.mjs';
import {installCosmetics} from '../js/avatar.mjs';
import {fileURLToPath} from 'node:url';

function evidenceFixture(count,users=[]){
  const track=makeTrack(ALL_TRACKS.find(track=>track.id==='usui'));
  const room={track,config:{track:track.id,night:false,wet:false},introSeconds:0,phase:'racing',verify:true,elapsed:0,players:new Map()};
  for(let i=0;i<count;i++){
    const id='pilot-'+i,car=CARS[i].id;
    const player={client:{id},id,userId:users[i],car,name:id,connected:true};
    placeOnlineCar(room,player,i,0);
    room.players.set(id,player);
  }
  const lobby={...room,players:[...room.players.values()].map(({id,car,name,connected})=>({id,car,name,connected}))};
  const host=new OnlineHost(lobby,track,onlineSnapshot(room,0),0);
  const verifier=new RaceVerification(room,0),forged=new RaceVerification(room,0),missing=new RaceVerification(room,0);
  let now=0;
  for(let frame=1;host.room.phase==='racing'&&frame<25000;frame++){
    now=frame*1000/30;
    for(const [slot,player] of [...host.room.players.values()].entries()){
      const data={...driverInput(player.race,{line:slot%2?2:-2,gripUse:.78}),seq:frame,headlights:true,command:'input'};
      host.input(player.id,data,now);
      verifier.input(player.id,data,now);
      forged.input(player.id,data,now);
      if(slot>0)missing.input(player.id,data,now);
    }
    host.step(now);
    if(frame%5===0||host.room.phase==='results'){
      const {from,frames}=host.trace();
      for(const audit of [verifier,forged,missing])audit.trace(from,frames,now);
    }
  }
  assert.equal(host.room.phase,'results');
  assert.ok(host.room.results.some(row=>!row.dnf));
  return {room,verifier,forged,missing,now,results:host.room.results.map(({id,time,place})=>({id,time,place}))};
}

test('ranked reconstructs positions for two and four drivers and rejects changed times and missing controls',async()=>{
  for(const count of [2,4]){
    const {verifier,forged,missing,now,results}=evidenceFixture(count);
    const replay=await verifier.replay(results,now);
    assert.deepEqual(replay.results.map(({id,time,place})=>({id,time,place})),results);
    if(count===2){
      await assert.rejects(forged.replay(results.map((row,i)=>i===0?{...row,time:row.time-1}:row),now),/no coinciden/);
      await assert.rejects(missing.replay(results,now),/no coinciden/);
    }
  }
});

test('ranked starts with its peer host and cancels a broken link or departing pilot',async()=>{
  let now=0;
  const store=new Store(':memory:'),hub=new OnlineRooms({store,now:()=>now});
  try{
    const clients=[],messages=[];
    for(let i=0;i<2;i++){
      const {id}=await store.register('RankDriver'+i,'racing password test');
      const pilot=store.updateProfile(id,{complete:true});
      messages[i]=[];
      clients[i]=hub.connect(data=>messages[i].push(data),undefined,pilot);
      hub.receive(clients[i],{type:'ranked-queue',direct:true});
    }
    now=4000;hub.step();
    const room=clients[0].room;
    assert.ok(room.ranked);
    assert.equal(room.phase,'preparing');
    assert.equal(hub.publicRooms().length,0);
    for(const [i,c] of clients.entries())hub.receive(c,{type:'direct-report',runId:room.runId,peers:[{id:clients[1-i].id,p95:80,sent:30,received:29}]});
    assert.equal(room.transport,'direct');
    assert.equal(room.phase,'loading');
    for(const c of clients)hub.receive(c,{type:'loaded',runId:room.runId});
    assert.ok(room.verification);
    assert.equal(room.phase,'racing');
    hub.disconnect(clients.find(c=>c.id===room.raceHost));
    assert.equal(hub.rooms.size,0);
    assert.ok(messages.flat().some(data=>data.type==='ranked-cancelled'));
  }finally{store.close();}
});

test('a finished direct race publishes the verified classification after saving its coins and records',async()=>{
  const store=new Store(':memory:'),wallNow=RANKED_EPOCH+1200000,hub=new OnlineRooms({store,wallNow:()=>wallNow});
  try{
    const users=[];
    for(let i=0;i<2;i++)users.push((await store.register('DirectFinal'+i,'racing password test')).id);
    const {room,verifier,now,results}=evidenceFixture(2,users),events=[];
    Object.assign(room,{verification:verifier,ranked:true,transport:'direct',runId:randomUUID()});
    for(const player of room.players.values())player.client.send=event=>events.push(event);
    await hub.verifyFinish(room,results,now);
    assert.equal(events[0].type,'verification-start');
    const message=events.find(event=>event.type==='results');
    assert.equal(message.verified,true);
    const winner=message.results.find(result=>result.place===1);
    assert.ok(winner.coins>=720);
    assert.equal(store.user(winner.userId).coins,winner.coins);
    assert.equal(store.stats(winner.userId).wins,1);
    assert.equal(store.rankedRows(0)[0].userId,winner.userId);
  }finally{store.close();}
});

test('season pays each pilot once after the settlement window and survives reopening',async()=>{
  const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),path=await import('node:path');
  const folder=await mkdtemp(path.join(tmpdir(),'touge-ranked-')),filename=path.join(folder,'ranked.sqlite');
  let now=RANKED_EPOCH+1000,store=new Store(filename,{now:()=>now});
  try{
    const participants=[];
    const track=makeTrack(ALL_TRACKS[0]);
    const match={id:randomUUID(),finishedAt:now,season:0,evidence:{test:true},results:[]};
    for(let i=0;i<10;i++){
      const {id}=await store.register('SeasonRank'+i,'racing password test');
      const room={track,config:{},players:new Map()};
      const p={car:CARS[0].id};
      placeOnlineCar(room,p,0,0);
      const run=runDocument(match.id+':'+id,id,p.race,'online',160,now);
      match.results.push({userId:id,name:'SeasonRank'+i,rating:100-i,coins:0,place:i===0?1:2,run});
      participants.push(id);
    }
    store.saveVerifiedOnline(match);store.saveVerifiedOnline(match);
    assert.equal(store.rankedStatus(participants[0]).leaders.length,10);
    const row=store.db.prepare('SELECT evidence FROM verified_online_matches').get();
    assert.deepEqual(JSON.parse(gunzipSync(row.evidence)),{test:true});
    now=RANKED_EPOCH+SEASON_LENGTH+30000;
    assert.equal(store.rankedStatus(participants[0]).goldenKeys,0);
    now+=120000;
    for(const [i,id] of participants.entries()){
      const expected=seasonAward(i+1,participants.length),list=store.rankedStatus(id);
      assert.equal(list.goldenKeys,expected.keys);
      assert.equal(list.coins,expected.coins);
      assert.deepEqual(store.rankedStatus(id).rewards,[]);
    }
    store.close();store=new Store(filename,{now:()=>now});
    assert.equal(store.rankedStatus(participants[0]).goldenKeys,2);
    assert.deepEqual(store.rankedStatus(participants[0]).rewards,[]);
    const packs=new CosmeticPacks(fileURLToPath(new URL('../',import.meta.url)));
    const cosmetics=await packs.reload();
    assert.ok(cosmetics.some(cosmetic=>cosmetic.id==='male.accessory.gafas-podio'));
    installCosmetics(cosmetics);store.syncCosmetics();
    assert.throws(()=>store.buy(participants[9],'cosmetic','male.accessory.gafas-podio'),/llaves doradas/);
    const buyer=participants[0],balance=store.user(buyer).coins;
    assert.equal(store.buy(buyer,'cosmetic','male.accessory.gafas-podio').goldenKeys,1);
    assert.equal(store.buy(buyer,'cosmetic','male.accessory.gafas-podio').goldenKeys,1);
    assert.equal(store.user(buyer).coins,balance);
  }finally{installCosmetics();store.close();await rm(folder,{recursive:true,force:true});}
});
