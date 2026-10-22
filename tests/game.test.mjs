import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTrack, sample, worldAt, TRACKS, CARS, createRace, updateRace, clamp } from '../js/sim.mjs';
import {referenceDrive} from './helpers/reference-driver.mjs';

const track=makeTrack(TRACKS[0]);
function ready(opts={}){const r=createRace(CARS[0],track,opts);r.countdown=0;r.lateral=0;return r;}
function run(r,input,seconds){for(let i=0;i<seconds*120;i++)updateRace(r,input,1/120);}
test('tracks are deterministic, continuous, distinct and descend',()=>{for(const config of TRACKS){const t=makeTrack(config);assert.deepEqual(t,makeTrack(config));for(let i=1;i<t.points.length;i++){const a=t.points[i-1],b=t.points[i];assert.ok(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)-8)<.001);}assert.ok(sample(t,t.length).y<sample(t,0).y-250);assert.ok(Number.isFinite(sample(t,1e9).x));}assert.notDeepEqual(makeTrack(TRACKS[1]).points,track.points);});
test('countdown holds both cars and race clock',()=>{const r=createRace(CARS[0],track);run(r,{throttle:true},2);assert.equal(r.s,12);assert.equal(r.speed,0);assert.equal(r.rivalS,24);assert.equal(r.elapsed,0);});
test('accelerator, automatic gears and brakes work',()=>{const r=ready();run(r,{throttle:true},5);assert.ok(r.speed>23);assert.ok(r.gear>=2);const speed=r.speed;run(r,{brake:true},1);assert.ok(r.speed<speed-10);run(r,{brake:true},5);assert.equal(r.speed,0);});
test('screen-right steering goes to camera-right world position',()=>{const r=ready();r.speed=20;run(r,{throttle:true,steer:1},.3);assert.ok(r.lateral<-.15);assert.ok(r.yaw<0);const p=worldAt(track,r.s,r.lateral),center=worldAt(track,r.s,0);assert.ok(p.x<center.x);});
test('manual transmission stays in selected gear and rev limiter holds first',()=>{const r=ready({manual:true});run(r,{throttle:true},6);assert.equal(r.gear,1);assert.ok(r.speed>19&&r.speed<20.2);r.gear=3;run(r,{throttle:true},2);assert.equal(r.gear,3);assert.ok(r.speed>30);});
test('guardrail impact loses speed and keeps the car on the road',()=>{const r=ready();r.speed=35;r.lateral=4.9;updateRace(r,{throttle:true},1/120);assert.ok(r.speed<26);assert.ok(Math.abs(r.lateral)<=4.75);assert.ok(r.collision>.9);});
test('handbrake creates slip and drift points at speed',()=>{const r=ready();r.speed=30;run(r,{throttle:true,steer:.55,handbrake:true},.65);assert.ok(r.drift>.5);assert.ok(r.driftPoints>0);});
test('checkpoints extend the clock once and timeout finishes the race',()=>{const r=ready();r.s=track.length/4;r.speed=25;updateRace(r,{throttle:true},1/120);assert.equal(r.checkpoints,1);assert.ok(r.timeLeft>178);const time=r.timeLeft;updateRace(r,{throttle:true},1/120);assert.ok(r.timeLeft<time);r.timeLeft=.001;updateRace(r,{},1/120);assert.ok(r.finished);assert.equal(r.won,false);});
test('a clean braking lap reaches results and the finished race freezes',()=>{const {race:r,impacts,brakingFrames}=referenceDrive(TRACKS[0],{mode:'time'});assert.ok(r.finished);assert.ok(r.won);assert.ok(r.s>=track.length);assert.equal(impacts,0);assert.ok(brakingFrames>0);const s=r.s;updateRace(r,{throttle:true},.05);assert.equal(r.s,s);});
