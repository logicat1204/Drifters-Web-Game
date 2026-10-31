import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FrameMonitor,AdaptiveResolution,mirrorLayout,viewPlanes,chunkVisible} from '../js/render-performance.mjs';

test('FPS uses actual presentation intervals, retains slow frames and resets after visibility changes',()=>{
 const monitor=new FrameMonitor(60);
 for(let i=0;i<=120;i++)monitor.record(i*1000/60,4,{vertices:123,width:960,height:600});
 let m=monitor.snapshot();assert.ok(Math.abs(m.fps-60)<.001);assert.ok(Math.abs(m.frameMs-1000/60)<.001);assert.equal(m.cpuMs,4);assert.equal(m.samples,60);assert.equal(m.vertices,123);
 monitor.record(2500,5);m=monitor.snapshot();assert.ok(m.fps<45,'a long frame must not be clamped out of the FPS average');
 monitor.reset();monitor.record(20000,1);assert.equal(monitor.snapshot().samples,0);
 for(let i=1;i<=60;i++)monitor.record(20000+i*1000/120,2);m=monitor.snapshot();assert.ok(Math.abs(m.fps-120)<.001);assert.ok(m.p95Ms<9);
 const detached=monitor.snapshot();detached.fps=1;assert.ok(monitor.snapshot().fps>100);
});

test('automatic resolution needs sustained misses, has a bounded floor and recovers slowly',()=>{
 const controller=new AdaptiveResolution(),slow={fps:40,cpuMs:6,samples:100},fast={fps:60,cpuMs:6,samples:100};
 for(let now=0;now<3000;now+=250)controller.update(now,slow);assert.equal(controller.scale,1);
 for(let now=3000;now<=4000;now+=250)controller.update(now,slow);assert.equal(controller.scale,.95);
 for(let now=4250;now<=40000;now+=250)controller.update(now,slow);assert.equal(controller.scale,.65);
 for(let now=40250;now<=47000;now+=250)controller.update(now,fast);assert.equal(controller.scale,.65);
 for(let now=47250;now<=49000;now+=250)controller.update(now,fast);assert.equal(controller.scale,.7);
 for(let now=49250;now<=120000;now+=250)controller.update(now,fast);assert.equal(controller.scale,1);
 controller.reset();controller.update(0,slow);controller.update(100000,slow);assert.equal(controller.scale,1,'a resumed tab cannot trigger an immediate downscale');
 for(let i=0;i<30;i++)controller.update(100250+i*250,slow,false);assert.equal(controller.scale,1,'menus and countdowns do not lower quality');
});

test('clip and fog culling preserve crossing geometry, including nearby folded hairpins',()=>{
 const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),planes=viewPlanes(identity,identity),box=(min,max)=>({min,max});
 assert.ok(chunkVisible(box([-.5,-.5,-.5],[.5,.5,.5]),planes,[0,0,0],60));
 assert.ok(chunkVisible(box([.9,-.5,-.5],[4,.5,.5]),planes,[0,0,0],60),'intersecting a frustum plane is retained');
 assert.equal(chunkVisible(box([2,-.5,-.5],[4,.5,.5]),planes,[0,0,0],60),false);
 assert.ok(chunkVisible(box([-2,-2,-2],[2,2,2]),planes,[61,0,0],60),'fog-crossing chunk is retained based on its bounds');
 assert.equal(chunkVisible(box([-1,-1,-1],[1,1,1]),planes,[62,0,0],60),false);
});

test('mirror opening stays within the viewport at desktop, mobile and ultrawide aspect ratios',()=>{
 for(const [w,h]of [[1440,900],[960,600],[390,844],[844,390],[2560,1080]]){
  const m=mirrorLayout(w,h);assert.ok(m.x>=0&&m.y>=0);assert.ok((m.x+m.width)*m.scale<w);assert.ok((m.y+m.height)*m.scale<h);
  assert.ok(m.width>0&&m.height>0);
 }
});
