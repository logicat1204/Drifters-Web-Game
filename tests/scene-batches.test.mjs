import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packScene,chunkOpacity} from '../js/scene-batches.mjs';
import {PART2_MODELS} from '../js/scenery-part2.mjs';
test('packing retains every vertex once and gives road, terrain and props independent bounds',()=>{
 const data=Array(84).fill(0),spans=[];for(const [index,kind]of ['road','foliage','terrain','detail','road'].entries()){const first=data.length/14;for(let n=0;n<3;n++)data.push(index,n,index*20,...Array(11).fill(0));spans.push({first,count:3,kind,sector:index%2});}
 const before=data.slice().sort((a,b)=>a-b),chunks=packScene(data,spans);assert.deepEqual(data.slice().sort((a,b)=>a-b),before);assert.equal(chunks.reduce((n,c)=>n+c.count,6),data.length/14);assert.ok(chunks.filter(c=>c.kind==='road').every(c=>c.distance===Infinity));assert.ok(chunks.filter(c=>c.kind==='detail').every(c=>c.distance===420));
});
test('distance fades are continuous and terrain height never independently hides supporting ground',()=>{
 const origin=[0,0,0],chunk={kind:'foliage',min:[0,0,0],max:[1,10,1],distance:620};assert.equal(chunkOpacity(chunk,origin,500),1);assert.ok(chunkOpacity(chunk,origin,590)>0&&chunkOpacity(chunk,origin,590)<1);assert.equal(chunkOpacity(chunk,origin,620),0);
 const upper={...chunk,min:[0,50,0]};assert.equal(chunkOpacity(upper,origin,150),1);assert.equal(chunkOpacity({...chunk,min:[0,8,0]},origin,50),1);assert.equal(chunkOpacity({...chunk,kind:'road',distance:Infinity,baseY:8},origin,50),1);
});
test('selected second-pack assets have bounded finite meshes without runtime textures',()=>{
 for(const [name,model]of Object.entries(PART2_MODELS)){assert.equal(model.data.length%42,0,name);assert.ok(model.data.every(Number.isFinite));assert.ok(model.data.every((v,i)=>i%14<12||v===-1));}assert.ok(PART2_MODELS.bg_hills_ring_low.data.length/14<5000);
});
