import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CARS,TRACKS,makeTrack,createRace,updateRace,repositionRace} from '../js/sim.mjs';
import {FOCUS,activateFocus,updateFocus} from '../js/focus.mjs';
import {OnlineClient} from '../js/online.js';
import {referenceDrive} from './helpers/reference-driver.mjs';

function ready(car=CARS[0]){const r=createRace(car,makeTrack(TRACKS[0]),{mode:'time'});r.countdown=0;r.lateral=0;return r;}
function run(r,input,seconds){for(let i=0;i<seconds*120;i++)updateRace(r,input,1/120);}
test('head-on impacts on either barrier lose speed but never pin any of the cars',()=>{
  for(const car of CARS)for(const side of [-1,1])for(const speed of [8,35]){
    const r=ready(car);Object.assign(r,{lateral:side*4.75,speed,yaw:side*1.35,travelYaw:side*1.35});updateRace(r,{throttle:true,steer:-side},1/120);
    assert.ok(r.speed<speed);assert.ok(Math.abs(r.travelYaw)<1e-9);assert.ok(Math.abs(r.yaw)<1e-9);const at=r.s;let impacts=0;
    for(let i=0;i<4*120;i++){const before=r.collision;updateRace(r,{throttle:true,steer:-side},1/120);if(r.collision>before)impacts++;}
    assert.ok(r.s>at+40,car.id);assert.ok(r.speed>15,car.id);assert.equal(impacts,0,'continuous scraping must not repeatedly apply impact penalties');
    run(r,{steer:side,throttle:true},.45);assert.ok(Math.abs(r.lateral)<4.4,'steering toward the road must release the barrier');
  }
});
test('reposition preserves progress and the race clock, resets all motion and breaks the combo',()=>{
  const r=ready();Object.assign(r,{s:850,speed:42,lateral:4.65,yaw:1,travelYaw:.8,yawRate:1,lateralV:30,drift:1,combo:700,gear:4,rpm:7000,elapsed:25,timeLeft:120,checkpoints:1,wallSlow:2});r.skill.chain=5;r.focus.charge=55;
  assert.equal(repositionRace(r),true);for(const key of ['speed','lateral','yaw','travelYaw','yawRate','lateralV','steer','drift','combo','wallSlow'])assert.equal(r[key],0,key);
  assert.equal(r.s,850);assert.equal(r.elapsed,25);assert.equal(r.timeLeft,120);assert.equal(r.checkpoints,1);assert.equal(r.skill.chain,0);assert.equal(r.gear,1);assert.equal(r.focus.charge,55);
  run(r,{throttle:true,steer:1},.4);assert.equal(r.speed,0);assert.equal(r.s,850);assert.ok(r.elapsed>25);assert.equal(repositionRace(r),false);run(r,{throttle:true},.6);assert.ok(r.speed>0);
});
test('neither reset nor focus can bypass the countdown or reopen a finished race',()=>{
  const r=ready();r.countdown=3;r.focus.charge=100;assert.equal(repositionRace(r),false);assert.equal(activateFocus(r),false);r.countdown=0;r.finished=true;assert.equal(repositionRace(r),false);assert.equal(activateFocus(r),false);
});
test('a nearby offline rival cannot push a recovering car away from the center',()=>{
  const r=ready();r.mode='battle';r.opponent=ready();r.opponent.s=r.s;r.opponent.lateral=.2;
  assert.equal(repositionRace(r),true);run(r,{throttle:true},.4);
  assert.equal(r.lateral,0);assert.equal(r.speed,0);assert.equal(r.collision,0);assert.ok(r.opponent.s>r.s,'the rival keeps racing');
});
test('a complete clean lap charges concentration but straights, crawling and wall scraping do not',()=>{
  const r=referenceDrive(TRACKS[0],{mode:'time'}).race;assert.equal(r.focus.charge,FOCUS.capacity);
  for(const props of [{speed:30,lateral:0,curve:0},{speed:0,lateral:0,curve:.015},{speed:30,lateral:4.65,curve:.015},{speed:50,lateral:0,curve:.035}]){
    const idle=ready();Object.assign(idle,props);for(let i=0;i<600;i++)updateFocus(idle,1/120,props.curve,19.44);assert.equal(idle.focus.charge,0);
  }
});
test('charge determines a short duration, is consumed entirely, cannot stack or refill while active',()=>{
  for(const charge of [30,60,100]){const r=ready();r.focus.charge=charge;assert.equal(activateFocus(r),true);assert.equal(r.focus.remaining,charge/100*5);assert.equal(r.focus.charge,0);assert.equal(activateFocus(r),false);
    for(let i=0;i<charge/100*5*120-1;i++)updateFocus(r,1/120,.015,19.44);assert.ok(r.focus.remaining>0);assert.equal(r.focus.charge,0);
    updateFocus(r,.02,.015,19.44);assert.equal(r.focus.remaining,0);assert.equal(r.focus.cooldown,3);assert.equal(activateFocus(r),false);
  }
  const low=ready();low.focus.charge=29.9;assert.equal(activateFocus(low),false);
});
test('focus gives a bounded real speed increase, more grip, and expires without auto-recharging',()=>{
  for(const car of CARS){const base=ready(car),boost=ready(car);base.speed=boost.speed=car.max;boost.focus.charge=100;activateFocus(boost);run(base,{throttle:true},4);run(boost,{throttle:true},4);
    assert.ok(boost.speed>base.speed+1);assert.ok(boost.speed<=car.max*1.06);assert.ok(boost.cornerSpeed>base.cornerSpeed*1.09);assert.equal(boost.focus.charge,0);run(boost,{throttle:true},1.2);assert.equal(boost.focus.remaining,0);assert.ok(boost.speed<=car.max);assert.ok(boost.focus.cooldown>0);
  }
});
test('impact or recovery cancels concentration without refunding it',()=>{
  const hit=ready();hit.focus.charge=100;activateFocus(hit);hit.collision=1;updateFocus(hit,.01,.015,19.44);assert.equal(hit.focus.remaining,0);assert.equal(hit.focus.charge,0);
  const reset=ready();reset.focus.charge=80;activateFocus(reset);repositionRace(reset);assert.equal(reset.focus.remaining,0);assert.equal(reset.focus.charge,0);
});
test('online reset snapshots snap to the stationary center instead of smoothing back toward the wall',()=>{
  const r=ready(),server=ready();Object.assign(r,{online:true,s:400,lateral:1.5,speed:30});Object.assign(server,{s:400,lateral:4.65,speed:30});repositionRace(server);
  const client=Object.create(OnlineClient.prototype);Object.assign(client,{id:'self',input:{throttle:true},lights:true});client.reconcile(r,r.track,{players:[{id:'self',state:structuredClone(server),place:null,dnf:false}]});
  assert.equal(r.lateral,0);assert.equal(r.speed,0);assert.equal(r.s,400);assert.equal(r.resetId,1);assert.ok(r.resetHold>0);
});
