import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {OnlineRooms,sendOnlineFrame} from '../server/online.mjs';
import {selectRaceHost} from '../js/online-direct.mjs';
import {OnlineHost} from '../js/online-host.js';
import {CARS} from '../js/sim.mjs';
import {driverInput} from './helpers/reference-driver.mjs';

function fixture(){let now=0;const service=new OnlineRooms({now:()=>now});const client=()=>{const out=[];const c=service.connect(message=>out.push(structuredClone(message)));c.out=out;return c;};const send=(c,type,data={})=>service.receive(c,{type,...data});const host=client();send(host,'create',{name:'Aarón',car:'ae86',config:{track:'usui'}});const room=host.room;
  const join=(name='Invitado',car='rx7')=>{const c=client();send(c,'join',{name,car,code:room.code});return c;};
  const step=(seconds,inputs=true)=>{for(let i=0;i<seconds*120;i++){now+=1000/120;if(inputs&&i%4===0)for(const p of room.players.values())if(p.race)send(p.client,'input',{seq:p.sequence+1,...driverInput(p.race),headlights:true});service.step();}};
  return {service,host,room,client,send,join,step,advance:ms=>now+=ms};
}
test('congested sockets skip replaceable poses and still send race events',()=>{
  const out=[],ws={readyState:WebSocket.OPEN,bufferedAmount:10,send:payload=>out.push(JSON.parse(payload))};
  const f=fixture(),send=f.host.send;
  f.host.send=(message,replaceable)=>{send(message);sendOnlineFrame(ws,message,replaceable);};
  const guest=f.join();
  for(const c of [f.host,guest])f.send(c,'ready',{ready:true});
  f.send(f.host,'start');
  assert.equal(out.at(-1).type,'snapshot','starting state is critical');
  const count=out.length;
  f.step(4,false);
  assert.equal(out.length,count,'regular poses do not add to a congested queue');
  f.send(f.host,'reposition');
  assert.equal(out.at(-1).players[0].state.resetId,1,'reposition state is critical');
  ws.bufferedAmount=0;
  f.step(1,false);
  assert.ok(out.at(-1).elapsed>4.5,'the next pose reflects current race time');
  ws.bufferedAmount=10;
  f.step(330,false);
  assert.deepEqual(out.slice(-3).map(message=>message.type),['snapshot','results','room']);
});
test('a room has a unique invite code, maximum four slots and rejects the fifth',()=>{
  const f=fixture();assert.match(f.room.code,/^[A-F\d]{8}$/);f.join();f.join('Tercero','r32');f.join('Cuarto','ae86');const fifth=f.join('Quinto');assert.equal(f.room.players.size,4);assert.equal(fifth.room,null);assert.match(fifth.out.at(-1).message,/llena/);assert.equal(f.host.out.at(-1).players.length,4);
});
test('WebRTC probes only relay signals between opted-in pilots in the same lobby',()=>{
  const f=fixture(),guest=f.join(),outsider=f.client();
  f.send(outsider,'create',{name:'Otro piloto',car:'ae86'});
  f.send(f.host,'probe-ready',{ready:true});
  f.send(f.host,'probe-signal',{to:guest.id,kind:'offer',value:'sdp'});
  assert.equal(guest.out.at(-1).type,'room');

  for(const pilot of [guest,outsider])f.send(pilot,'probe-ready',{ready:true});
  assert.deepEqual(guest.out.at(-1).peers,[f.host.id,guest.id]);
  f.send(f.host,'probe-signal',{to:outsider.id,kind:'offer',value:'sdp'});
  assert.deepEqual(outsider.out.at(-1).peers,[outsider.id]);
  f.send(f.host,'probe-signal',{to:guest.id,kind:'offer',value:'sdp',from:outsider.id});
  assert.deepEqual(guest.out.at(-1),{type:'probe-signal',from:f.host.id,kind:'offer',value:'sdp'});
  f.send(guest,'probe-ping',{id:12});
  assert.deepEqual(guest.out.at(-1),{type:'probe-pong',id:12});

  for(const pilot of [f.host,guest])f.send(pilot,'ready',{ready:true});
  f.send(f.host,'start');
  f.send(f.host,'probe-signal',{to:guest.id,kind:'offer',value:'sdp'});
  assert.equal(guest.out.at(-1).type,'snapshot');
});

const link=(id,p95,received=30)=>({id,p95,received,sent:30});

test('the direct race chooses the pilot with the lowest worst bidirectional latency',()=>{
  const reports=new Map([
    ['a',[link('b',20),link('c',90)]],
    ['b',[link('a',20),link('c',35)]],
    ['c',[link('a',100),link('b',35)]]
  ]);
  assert.equal(selectRaceHost(['a','b','c'],reports),'b');
  reports.set('c',[link('a',100,20),link('b',35,20)]);
  assert.equal(selectRaceHost(['a','b','c'],reports),null);
});

test('a direct race hands the initial state to the elected browser and keeps test results out of the records',()=>{
  const f=fixture(),g=f.join();
  for(const c of [f.host,g])f.send(c,'ready',{ready:true,direct:true});
  f.send(f.host,'start',{direct:true});
  assert.equal(f.room.phase,'preparing');
  const {runId}=f.room;
  f.send(f.host,'direct-signal',{to:g.id,runId,kind:'offer',value:'sdp'});
  assert.equal(g.out.at(-1).from,f.host.id);
  f.send(g,'direct-report',{runId,peers:[link(f.host.id,65)]});
  f.send(f.host,'direct-report',{runId,peers:[link(g.id,70)]});
  assert.equal(f.room.transport,'direct');
  assert.equal(f.host.out.at(-1).players.length,2);
  const browser=new OnlineHost(f.service.lobby(f.room),f.room.track,f.host.out.at(-1),0);
  let snapshot;
  for(let i=1;i<500;i++){
    const now=i*10;
    browser.input(g.id,{seq:i,steer:0,throttle:true},now);
    snapshot=browser.step(now)??snapshot;
  }
  assert.ok(snapshot.players.find(p=>p.id===g.id).state.speed>5);
  browser.action(g.id,'reposition');
  assert.equal(browser.room.players.get(g.id).race.speed,0);
  assert.equal(browser.room.players.get(g.id).race.resetId,1);
  f.step(3,false);
  assert.equal(f.room.elapsed,0,'Render does not step the direct race');
  const results=[{id:f.host.id,place:1,time:80},{id:g.id,place:2,time:100}];
  const winner=f.room.players.get(f.room.raceHost).client;
  const other=winner===g?f.host:g;
  f.send(other,'direct-finish',{runId,results});
  assert.equal(f.room.phase,'racing');
  f.send(winner,'direct-finish',{runId,results});
  assert.equal(f.room.phase,'results');
  assert.ok([...f.room.players.values()].every(p=>p.saved===null));
  f.send(f.host,'rematch');
  assert.equal(f.room.phase,'lobby');
});

test('direct preparation falls back to the server and a lost connection reopens the room',()=>{
  const f=fixture(),g=f.join();
  for(const c of [f.host,g])f.send(c,'ready',{ready:true,direct:true});
  f.send(f.host,'start',{direct:true});
  const {runId}=f.room;
  f.send(g,'direct-report',{runId,peers:[link(f.host.id,60)]});
  f.send(f.host,'direct-report',{runId,peers:[link(g.id,65)]});
  f.service.disconnect(g);
  assert.equal(f.room.phase,'lobby');
  assert.equal(f.room.players.size,1);

  const replacement=f.join();
  for(const c of [f.host,replacement])f.send(c,'ready',{ready:true,direct:true});
  f.send(f.host,'start',{direct:true});
  f.advance(13001);
  f.service.step();
  assert.equal(f.room.phase,'racing');
  assert.equal(f.room.transport,'server');
});

test('loading holds the direct start until every pilot confirms the current run',()=>{
  const f=fixture(),g=f.join();
  for(const c of [f.host,g])f.send(c,'ready',{ready:true,direct:true,loadGate:true});
  f.send(f.host,'start');
  const {runId}=f.room;
  f.send(g,'direct-report',{runId,peers:[link(f.host.id,60)]});
  f.send(f.host,'direct-report',{runId,peers:[link(g.id,65)]});
  assert.equal(f.room.phase,'loading');
  assert.equal(f.room.transport,'direct');
  f.send(g,'loaded',{runId:'previous'});
  f.send(f.host,'loaded',{runId});
  f.step(2,false);
  assert.equal(f.room.phase,'loading');
  assert.equal(f.room.players.get(g.id).race.countdown,3+f.room.introSeconds);
  assert.equal(g.out.at(-1).players.filter(p=>p.loaded).length,1);
  f.send(g,'loaded',{runId});
  assert.equal(f.room.phase,'racing');
  assert.equal(g.out.at(-1).type,'snapshot');
  assert.equal(g.out.at(-1).players[1].state.countdown,3+f.room.introSeconds);
});

test('a browser without WebRTC uses the server through the same loading screen',()=>{
  const f=fixture(),g=f.join();
  f.send(f.host,'ready',{ready:true,direct:true,loadGate:true});
  f.send(g,'ready',{ready:true,direct:false,loadGate:true});
  f.send(f.host,'start');
  assert.equal(f.room.phase,'loading');
  assert.equal(f.room.transport,'server');
  f.send(f.host,'loaded',{runId:f.room.runId});
  f.send(g,'loaded',{runId:f.room.runId});
  assert.equal(f.room.phase,'racing');
});

test('abandoning or timing out during loading reopens the room without a result',()=>{
  const f=fixture(),g=f.join();
  for(const c of [f.host,g])f.send(c,'ready',{ready:true,loadGate:true});
  f.send(f.host,'start');
  f.send(g,'cancel-start',{runId:f.room.runId});
  assert.equal(f.room.phase,'lobby');
  assert.match(f.host.out.at(-1).message,/canceló la salida/);
  assert.equal(f.room.players.size,2);

  for(const c of [f.host,g])f.send(c,'ready',{ready:true,loadGate:true});
  f.send(f.host,'start');
  f.advance(31000);
  f.service.step();
  assert.equal(f.room.phase,'lobby');
  assert.equal(f.room.runId,null);
  assert.equal(f.host.out.some(message=>message.type==='results'),false);
  assert.match(f.host.out.at(-1).message,/tiempo de carga/);

  for(const c of [f.host,g])f.send(c,'ready',{ready:true,loadGate:true});
  f.send(f.host,'start');
  f.service.disconnect(g);
  assert.equal(f.room.phase,'lobby');
  assert.equal(f.room.players.size,1);
  assert.match(f.host.out.at(-1).message,/abandonó/);
});
test('all seven garage cars can join and use their own authoritative physics',()=>{
  for(const car of CARS){const f=fixture(),guest=f.join('Nuevo coche',car.id);assert.equal(f.room.players.get(guest.id)?.car,car.id);
    for(const c of [f.host,guest])f.send(c,'ready',{ready:true});f.send(f.host,'start');f.step(7);
    const race=f.room.players.get(guest.id).race;assert.equal(race.car.id,car.id);assert.equal(race.car.grip,car.grip);assert.equal(race.car.max,car.max);assert.ok(race.speed>0);assert.ok(Number.isFinite(race.lateral));
  }
  const f=fixture(),bad=f.join('Inválido','unknown');assert.equal(bad.room,null);assert.match(bad.out.at(-1).message,/válido/);
});
test('only the host can start and every player, including the host, must be ready',()=>{
  const f=fixture();f.send(f.host,'start');assert.match(f.host.out.at(-1).message,/2 jugadores/);const guest=f.join();f.send(guest,'start');assert.match(guest.out.at(-1).message,/anfitrión/);f.send(f.host,'ready',{ready:true});f.send(f.host,'start');assert.match(f.host.out.at(-1).message,/Todos/);f.send(guest,'ready',{ready:true});f.send(f.host,'start');assert.equal(f.room.phase,'racing');assert.equal(f.room.players.get(guest.id).race.countdown,3);
});
test('changing car or course resets readiness and only the host can configure',()=>{
  const f=fixture(),g=f.join();f.send(g,'ready',{ready:true});f.send(g,'profile',{name:'新しい名前',car:'r32'});assert.equal(f.room.players.get(g.id).ready,false);assert.equal(f.room.players.get(g.id).car,'r32');f.send(g,'config',{config:{track:'akagi'}});assert.equal(f.room.config.track,'usui');f.send(g,'ready',{ready:true});f.send(f.host,'ready',{ready:true});f.send(f.host,'config',{config:{track:'akina',night:false,wet:true}});assert.ok([...f.room.players.values()].every(p=>!p.ready));assert.equal(f.room.config.night,false);assert.equal(f.room.config.wet,true);
});
test('the countdown closes admission immediately and preserves profile and car',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');const late=f.join();assert.equal(late.room,null);assert.match(late.out.at(-1).message,/cerrada/);f.send(g,'profile',{name:'Cheat',car:'r32'});assert.equal(f.room.players.get(g.id).car,'rx7');f.step(2);assert.equal(f.room.players.get(g.id).race.s,24);assert.equal(f.room.players.get(g.id).race.elapsed,0);
});
test('the server accepts controls but ignores forged positions, speed and race results',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');const p=f.room.players.get(g.id);p.race.countdown=0;f.send(g,'input',{seq:1,steer:0,throttle:true,s:999999,speed:99999,finished:true,place:1,headlights:false});f.service.step();assert.ok(p.race.s<25);assert.ok(p.race.speed<1);assert.equal(p.place,null);assert.equal(p.race.headlights,false);f.send(g,'input',{seq:1,steer:1,throttle:false});assert.equal(p.input.throttle,true);f.send(g,'input',{seq:2,steer:Infinity});assert.equal(p.sequence,1);
});
test('online manual gear changes are authoritative, bounded and scoped to the current recovery',()=>{
  const f=fixture(),guest=f.join();
  f.send(f.host,'ready',{ready:true,manual:true});
  f.send(guest,'ready',{ready:true});
  f.send(f.host,'start');
  const hostRace=f.room.players.get(f.host.id).race,guestRace=f.room.players.get(guest.id).race;
  f.step(4,false);
  assert.equal(hostRace.manual,true);
  assert.equal(guestRace.manual,false);
  f.send(f.host,'input',{seq:1,steer:0,gear:4,gearEpoch:0});
  f.send(guest,'input',{seq:1,steer:0,gear:4,gearEpoch:0});
  f.service.step();
  assert.equal(hostRace.gear,4);
  assert.equal(guestRace.gear,1);
  f.send(f.host,'input',{seq:2,steer:0,gear:8,gearEpoch:0});
  f.service.step();
  assert.equal(hostRace.gear,4);
  f.send(f.host,'reposition');
  f.step(.6,false);
  f.send(f.host,'input',{seq:3,steer:0,gear:3,gearEpoch:0});
  f.service.step();
  assert.equal(hostRace.gear,1);
  f.send(f.host,'input',{seq:4,steer:0,gear:3,gearEpoch:1});
  f.service.step();
  assert.equal(hostRace.gear,3);
});
test('stale controls brake the car instead of leaving a disconnected accelerator held',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');const p=f.room.players.get(g.id);p.race.countdown=0;p.race.speed=30;f.send(g,'input',{seq:1,steer:0,throttle:true});f.advance(400);f.service.step();assert.equal(p.race.braking,true);assert.ok(p.race.speed<30);
});
test('player contacts are resolved on the server and slow both cars',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');for(const p of f.room.players.values())Object.assign(p.race,{countdown:0,s:100,lateral:0,speed:30});f.service.step();const [a,b]=[...f.room.players.values()].map(p=>p.race);assert.ok(a.speed<29&&b.speed<29);assert.ok(a.lateral>b.lateral);assert.ok(a.collision>0&&b.collision>0);
});
test('host leaving transfers ownership, racing departures become DNF, empty rooms are deleted',()=>{
  const f=fixture(),g=f.join();f.service.disconnect(f.host);assert.equal(f.room.hostId,g.id);const third=f.join('Tercero');for(const c of [g,third])f.send(c,'ready',{ready:true});f.send(g,'start');f.service.disconnect(g);assert.equal(f.room.hostId,third.id);assert.equal(f.room.players.get(g.id).dnf,true);f.service.disconnect(third);assert.equal(f.service.rooms.size,0);
});
test('two real physics laps finish with shared places and only host can open a rematch',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');f.step(180);assert.equal(f.room.phase,'results');assert.deepEqual(f.room.results.map(p=>p.place),[1,2]);assert.ok(f.room.results.every(p=>p.time>60&&p.points>0));const hostResult=f.host.out.find(m=>m.type==='results'),guestResult=g.out.find(m=>m.type==='results');assert.deepEqual(hostResult,guestResult);f.send(g,'rematch');assert.equal(f.room.phase,'results');f.send(f.host,'rematch');assert.equal(f.room.phase,'lobby');assert.ok([...f.room.players.values()].every(p=>!p.ready&&p.race===null));
});
test('remaining racers get a finishing window, DNF results, and idle lobbies expire',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');const a=f.room.players.get(f.host.id);Object.assign(a.race,{countdown:0,s:f.room.track.length-.05,speed:25});f.step(.02,false);assert.equal(a.place,1);f.step(46,false);assert.equal(f.room.phase,'results');assert.ok(f.room.results.find(p=>p.id===g.id).dnf);f.advance(31*60*1000);f.service.sweep();assert.equal(f.service.rooms.size,0);
});
test('disconnecting after crossing the finish keeps the earned place and time',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');const winner=f.room.players.get(f.host.id);Object.assign(winner.race,{countdown:0,s:f.room.track.length-.05,speed:25});f.step(.02,false);f.service.disconnect(f.host);assert.equal(winner.place,1);assert.equal(winner.dnf,false);f.step(46,false);assert.equal(f.room.results[0].id,f.host.id);assert.equal(f.room.results[0].dnf,false);assert.ok(Number.isFinite(f.room.results[0].time));
});
test('reset is authoritative, stops at the same progress, and cannot be spammed or used during countdown',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');f.send(g,'reposition');assert.match(g.out.at(-1).message,/salida/);f.step(3.02,false);
  const p=f.room.players.get(g.id);Object.assign(p.race,{s:300,lateral:4.6,speed:30,yaw:.7});f.send(g,'reposition',{s:9000,speed:60});assert.equal(p.race.s,300);assert.equal(p.race.speed,0);assert.equal(p.race.lateral,0);assert.equal(p.race.resetId,1);
  const snap=g.out.at(-1);assert.equal(snap.type,'snapshot');const state=snap.players.find(v=>v.id===g.id).state;assert.equal(state.resetId,1);assert.equal(state.speed,0);f.send(g,'reposition');assert.equal(p.race.resetId,1);
});
test('the server spends only earned focus charge and ignores fabricated boost fields in controls',()=>{
  const f=fixture(),g=f.join();for(const c of [f.host,g])f.send(c,'ready',{ready:true});f.send(f.host,'start');f.step(3.02,false);const p=f.room.players.get(g.id);
  f.send(g,'input',{seq:1,steer:0,throttle:true,focus:{charge:100,remaining:100}});f.send(g,'focus',{charge:100,duration:100});assert.equal(p.race.focus.remaining,0);
  p.race.focus.charge=60;f.send(g,'focus',{charge:100,duration:100});assert.equal(p.race.focus.remaining,3);assert.equal(p.race.focus.charge,0);assert.equal(p.race.focus.activations,1);f.send(g,'focus');assert.equal(p.race.focus.activations,1);
  const snapshot=g.out.findLast(m=>m.type==='snapshot');assert.equal(snapshot.players.find(v=>v.id===g.id).state.focus.duration,3);
});
