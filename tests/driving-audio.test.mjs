import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drivingMix,engineFamily,musicDucking} from '../js/driving-audio.js';
test('audio reflects actual controls for any input device, soft slip, wet grip and interior damping',()=>{
 const r={rpm:6500,speed:50,drift:.65,understeer:0,wet:false},outside=drivingMix(r,{throttle:1,brake:true}),inside=drivingMix(r,{throttle:1,brake:true},true),wet=drivingMix({...r,wet:true},{brake:true});assert.ok(outside.load>drivingMix(r,{}).load);assert.ok(outside.brake>0);assert.ok(inside.wind<outside.wind);assert.ok(wet.tires<outside.tires);assert.equal(wet.rain,1);assert.ok(inside.tires<=1);assert.equal(drivingMix({...r,speed:0},{brake:true}).brake,0);
 for(const mix of [outside,inside,wet,drivingMix(null,{})])for(const v of Object.values(mix))if(typeof v==='number')assert.ok(Number.isFinite(v)&&v>=0&&v<=2);
 assert.equal(engineFamily('rx7'),'rotary');assert.equal(engineFamily('r32'),'six');assert.equal(engineFamily('ae86'),'four');assert.equal(engineFamily('r8'),'exotic');
});
test('tires become audible during loaded grip corners and modest slip without squealing on a straight',()=>{
 const straight={rpm:6000,speed:45,drift:0,understeer:0,slipAngle:0,gripUsage:0};
 const corner=drivingMix({...straight,gripUsage:.85}),slide=drivingMix({...straight,slipAngle:.14});
 assert.equal(drivingMix(straight).tires,0);
 assert.ok(corner.tires>.2);
 assert.ok(slide.tires>corner.tires);
 assert.equal(drivingMix({...straight,speed:0,slipAngle:.4},{handbrake:true}).tires,0);
 assert.ok(drivingMix({...straight,braking:true}).brake>0);
 assert.equal(drivingMix({...straight,braking:true},{brake:false}).brake,0);
});
test('music gives modest headroom to cornering effects and returns to its full menu level',()=>{
 const straight=drivingMix({speed:45,rpm:6000});
 const corner=drivingMix({speed:45,rpm:6000,slipAngle:.2,skill:{intensity:1}},{brake:true});
 assert.equal(musicDucking(corner,false),1);
 assert.ok(musicDucking(corner,true)<musicDucking(straight,true));
 assert.ok(musicDucking(corner,true)>=.62);
 assert.equal(musicDucking(null,false),1);
});
