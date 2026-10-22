import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OnlineRooms} from '../server/online.mjs';
import {CARS} from '../js/sim.mjs';
import {driverInput} from './helpers/reference-driver.mjs';

function fixture(){let now=0;const service=new OnlineRooms({now:()=>now});const client=()=>{const out=[];const c=service.connect(message=>out.push(structuredClone(message)));c.out=out;return c;};const send=(c,type,data={})=>service.receive(c,{type,...data});const host=client();send(host,'create',{name:'Aarón',car:'ae86',config:{track:'usui'}});const room=host.room;
  const join=(name='Invitado',car='rx7')=>{const c=client();send(c,'join',{name,car,code:room.code});return c;};
  const step=(seconds,inputs=true)=>{for(let i=0;i<seconds*120;i++){now+=1000/120;if(inputs&&i%4===0)for(const p of room.players.values())if(p.race)send(p.client,'input',{seq:p.sequence+1,...driverInput(p.race),headlights:true});service.step();}};
  return {service,host,room,client,send,join,step,advance:ms=>now+=ms};
}
test('a room has a unique invite code, maximum four slots and rejects the fifth',()=>{
  const f=fixture();assert.match(f.room.code,/^[A-F\d]{8}$/);f.join();f.join('Tercero','r32');f.join('Cuarto','ae86');const fifth=f.join('Quinto');assert.equal(f.room.players.size,4);assert.equal(fifth.room,null);assert.match(fifth.out.at(-1).message,/llena/);assert.equal(f.host.out.at(-1).players.length,4);
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
