import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARS,TRACKS,createRace,makeTrack,updateRace,worldAt,repositionRace} from '../js/sim.mjs';
import {SLIPSTREAM,CONTACT,vehiclePose,updateSlipstream,resolveVehicleContact} from '../js/traffic.mjs';
import {activateFocus,FOCUS_TYPES} from '../js/focus.mjs';
import {OnlineRooms} from '../server/online.mjs';
import {OnlineClient} from '../js/online.js';
import {driverInput} from './helpers/reference-driver.mjs';
const track=makeTrack({...TRACKS[0],length:6000,elevation:0,layout:[[1,0]]});
function ready(s=100,car=CARS[1]){const r=createRace(car,track,{mode:'time'});Object.assign(r,{s,countdown:0,speed:55,lateral:0,timeLeft:1000});return r;}
function build(r,others,seconds=2){for(let i=0;i<seconds*120;i++)updateSlipstream(r,others,1/120,worldAt);}
function onlineFixture(count=2){
 let now=0;const service=new OnlineRooms({now:()=>now}),clients=Array.from({length:count},()=>{const out=[];const c=service.connect(m=>out.push(structuredClone(m)));c.out=out;return c;});
 const send=(i,type,data={})=>service.receive(clients[i],{type,...data});send(0,'create',{name:'Lead',car:'rx7'});const room=clients[0].room;
 for(let i=1;i<count;i++)send(i,'join',{code:room.code,name:'Driver'+i,car:'rx7'});
 clients.forEach((_,i)=>send(i,'ready',{ready:true}));send(0,'start');room.track=track;
 const players=[...room.players.values()];players.forEach((p,i)=>{p.race=ready(120-i*20);p.input={steer:0,throttle:true};});
 const step=()=>{now+=1000/120;for(const p of players)p.inputAt=now;service.step();};
 return {service,clients,send,room,players,step};
}
test('slipstream builds progressively in the wake, is strongest when aligned and never stacks',()=>{
 const r=ready(),leader=ready(120),off=ready();off.lateral=1.1;
 updateSlipstream(r,[leader],1/120,worldAt);assert.ok(r.draft.strength>0&&r.draft.strength<.03);
 build(r,[leader]);build(off,[leader]);assert.ok(r.draft.strength>.98);assert.ok(off.draft.strength<r.draft.strength*.6);
 const two=ready();build(two,[leader,ready(116)]);assert.ok(two.draft.strength<=1);assert.ok(Math.abs(two.draft.strength-r.draft.strength)<.001);
});
test('no wake benefit alongside, in front, too far away, at low speeds or facing the wrong way',()=>{
 for(const props of [{s:98},{s:102},{s:150},{lateral:2.5},{speed:0},{travelYaw:Math.PI},{finished:true},{resetHold:.3}]){const r=ready(),o=ready(120);Object.assign(o,props);build(r,[o]);assert.equal(r.draft.strength,0,JSON.stringify(props));}
 const stopped=ready();stopped.speed=19;build(stopped,[ready(120)]);assert.equal(stopped.draft.strength,0);
});
test('leaving the wake gives a short smooth exit, while impacts and recovery cancel it',()=>{
 const r=ready();build(r,[ready(120)]);const charged=r.draft.strength;
 updateSlipstream(r,[],.05,worldAt);assert.ok(r.draft.strength<charged&&r.draft.strength>.85);assert.equal(r.draft.target,0);
 build(r,[],3);assert.ok(r.draft.strength<.01);
 build(r,[ready(120)]);r.collision=.3;updateSlipstream(r,[],.01,worldAt);assert.equal(r.draft.strength,0);
 r.collision=0;build(r,[ready(120)]);assert.ok(repositionRace(r));assert.equal(r.draft.strength,0);
});
test('reduced drag produces measurable extra acceleration and a bounded top-speed advantage',()=>{
 for(const car of CARS){const base=ready(100,car),wake=ready(100,car);base.speed=wake.speed=car.max-3;
  for(let i=0;i<8*120;i++){updateRace(base,{throttle:true},1/120);updateRace(wake,{throttle:true},1/120,[{...vehiclePose(wake),s:wake.s+18,speed:car.max*1.1}]);assert.ok(wake.speed<=car.max*(1+SLIPSTREAM.topSpeed));}
  assert.ok(wake.speed>base.speed+1.5,car.id);assert.ok(wake.s>base.s+7,car.id);
 }
});
test('slipstream and concentration have bounded combined speed and give no added corner grip',()=>{
 const r=ready();r.focus.charge=100;assert.ok(activateFocus(r));
 for(let i=0;i<300;i++){updateRace(r,{throttle:true},1/120,[{...vehiclePose(r),s:r.s+18,speed:80}]);assert.ok(r.speed<=r.car.max*FOCUS_TYPES.balance.topSpeed*(1+SLIPSTREAM.topSpeed));}
 const a=ready(),b=ready();build(b,[ready(120)]);updateRace(a,{},1/120);updateRace(b,{},1/120,[ready(120)]);assert.equal(a.cornerSpeed,b.cornerSpeed);
});
test('a clean driven pull-out converts slipstream momentum into a pass against an equal car',()=>{
 const leader=ready(120),follower=ready(100);leader.speed=follower.speed=65;let pullingOut=false,passed=false;
 for(let i=0;i<12*120;i++){
  const poses=[leader,follower].map(vehiclePose);
  if(leader.s-follower.s<12)pullingOut=true;
  updateRace(leader,{throttle:true},1/120,[]);
  updateRace(follower,{...driverInput({...follower,lateral:follower.lateral+follower.lateralV*.5},{line:pullingOut?-2.6:0}),throttle:true,brake:false},1/120,[poses[0]]);
  assert.equal(resolveVehicleContact(follower,leader,poses[1],poses[0]),false);
  if(follower.s>leader.s+6)passed=true;
 }
 assert.ok(pullingOut);assert.ok(passed);assert.ok(Math.abs(follower.lateral)>CONTACT.width);
});
test('rear contact treats both identities equally, keeps separation during cooldown and penalizes the trailing car',()=>{
 for(const swap of [false,true]){const front=ready(120),rear=ready(116.5);front.speed=40;rear.speed=65;const a=swap?rear:front,b=swap?front:rear;
  assert.ok(resolveVehicleContact(a,b));assert.ok(rear.speed<front.speed);assert.ok(front.speed>=39);assert.ok(front.s-rear.s>=CONTACT.length);assert.ok(a.collision>0&&b.collision>0);
  rear.s=front.s-1;rear.speed=60;assert.ok(resolveVehicleContact(a,b,{...vehiclePose(a),s:swap?front.s-4.201:front.s},{...vehiclePose(b),s:swap?front.s:front.s-4.201}));assert.ok(front.s-rear.s>=CONTACT.length);assert.ok(rear.speed<=front.speed);
 }
});
test('campaign uses the same contact response when the AI rear-ends the player',()=>{
 const r=ready(120);r.mode='battle';r.speed=30;r.opponent=ready(115);r.opponent.speed=65;let contactSeen=false;
 for(let i=0;i<120;i++){updateRace(r,{throttle:true},1/120);assert.ok(r.opponent.s<r.s);contactSeen||=r.opponent.contactCooldown>0;}
 assert.ok(r.s-r.opponent.s>=CONTACT.length-.01);assert.ok(contactSeen);
});
test('swept rear contacts preserve the previous leader; side contacts stay inside the road and allow escape',()=>{
 const front=ready(120),rear=ready(121);rear.speed=70;const oldRear={...vehiclePose(rear),s:115};resolveVehicleContact(front,rear,vehiclePose(front),oldRear);assert.ok(rear.s<front.s-4.2);
 const a=ready(200),b=ready(200);a.lateral=4.6;b.lateral=4.1;resolveVehicleContact(a,b);assert.ok(a.lateral<=4.6);assert.ok(a.lateral-b.lateral>=CONTACT.width);
 b.lateral=0;assert.equal(resolveVehicleContact(a,b),false);
});
test('online server computes draft for four drivers from shared poses and ignores forged draft input',()=>{
 const f=onlineFixture(4);for(let i=0;i<120;i++)f.step();const [front,second,third,fourth]=f.players.map(p=>p.race);
 assert.equal(front.draft.strength,0);for(const r of [second,third,fourth])assert.ok(r.draft.strength>.7);
 const snap=f.clients[0].out.findLast(m=>m.type==='snapshot');assert.ok(snap.players[1].state.draft.strength>.7);
 f.send(0,'input',{seq:1,steer:0,throttle:true,draft:{strength:999},speed:999});f.step();assert.equal(front.draft.strength,0);assert.ok(front.speed<front.car.max*1.05);
});
test('online draft calculations do not depend on iteration order',()=>{
 const a=onlineFixture(4),b=onlineFixture(4);b.room.players=new Map([...b.room.players].reverse());
 for(let i=0;i<120;i++){a.step();b.step();}for(let i=0;i<4;i++){assert.equal(a.players[i].race.speed,b.players[i].race.speed);assert.deepEqual(a.players[i].race.draft,b.players[i].race.draft);}
});
test('online contact never allows a faster trailing driver through the leader during cooldown',()=>{
 const f=onlineFixture();Object.assign(f.players[0].race,{s:120,speed:30});Object.assign(f.players[1].race,{s:115,speed:65});
 for(let i=0;i<120;i++){f.step();assert.ok(f.players[1].race.s<f.players[0].race.s);}
 const [front,rear]=f.players.map(p=>p.race);assert.ok(front.s-rear.s>=CONTACT.length-.01);assert.ok(rear.speed<=front.speed+.1);
});
test('reconciliation retains authoritative draft state and predicts it from other players',()=>{
 const r=ready(),leader=ready(120);build(r,[leader]);const self={id:'self',state:structuredClone(r)},other={id:'lead',connected:true,state:vehiclePose(leader)};
 const client=Object.create(OnlineClient.prototype);Object.assign(client,{id:'self',lights:true,input:{throttle:true}});
 client.reconcile(r,track,{players:[self,other]});assert.ok(r.draft.strength>.98);assert.equal(r.contactCooldown,0);
});
test('client predicts rear contact without mutating remote snapshots or waiting for a correction',()=>{
 const r=ready(115.7),leader=ready(120);r.speed=65;leader.speed=30;
 const players=[{id:'self',connected:true,state:structuredClone(r)},{id:'lead',connected:true,state:structuredClone(leader)}],original=structuredClone(players);
 const client=Object.create(OnlineClient.prototype);client.id='self';client.predict(r,{throttle:true},.05,players);
 assert.ok(r.s<leader.s+leader.speed*.05-CONTACT.length+.01);assert.ok(r.collision>0);assert.deepEqual(players,original);
});
