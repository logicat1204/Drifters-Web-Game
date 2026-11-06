import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drivingMix,engineFamily} from '../js/driving-audio.js';
test('audio reflects actual controls for any input device, soft slip, wet grip and interior damping',()=>{
 const r={rpm:6500,speed:50,drift:.65,understeer:0,wet:false},outside=drivingMix(r,{throttle:1,brake:true}),inside=drivingMix(r,{throttle:1,brake:true},true),wet=drivingMix({...r,wet:true},{brake:true});assert.ok(outside.load>drivingMix(r,{}).load);assert.ok(outside.brake>0);assert.ok(inside.wind<outside.wind);assert.ok(wet.tires<outside.tires);assert.equal(wet.rain,1);assert.ok(inside.tires<=1);assert.equal(drivingMix({...r,speed:0},{brake:true}).brake,0);
 for(const mix of [outside,inside,wet,drivingMix(null,{})])for(const v of Object.values(mix))if(typeof v==='number')assert.ok(Number.isFinite(v)&&v>=0&&v<=2);
 assert.equal(engineFamily('rx7'),'rotary');assert.equal(engineFamily('r32'),'six');assert.equal(engineFamily('ae86'),'four');assert.equal(engineFamily('r8'),'exotic');
});
