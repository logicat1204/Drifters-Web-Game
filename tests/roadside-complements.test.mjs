import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMPLEMENT_MODELS} from '../js/roadside-complements.mjs';
import {PART3_MODELS} from '../js/scenery-part3.mjs';
test('original complementary GLBs reproduce the compiled meshes with vertex colours and no external resources',()=>{
 for(const [name,m]of Object.entries(COMPLEMENT_MODELS)){
  const b=readFileSync(new URL(`../assets/touge_complements/models/${name}.glb`,import.meta.url)),size=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+size)),bin=b.subarray(28+size);
  assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);assert.equal(j.accessors[0].count,m.data.length/14);assert.equal(j.images,undefined);assert.equal(j.buffers[0].byteLength,bin.length);assert.ok(m.data.length/42<=28);
  for(let i=0;i<m.data.length/14;i++)for(let a=0;a<9;a++)assert.ok(Math.abs(bin.readFloatLE(i*36+a*4)-m.data[i*14+a])<1e-4);
 }
});
test('third-pack selection is finite and precompiled without texture references or extra runtime loading',()=>{
 assert.deepEqual(Object.keys(PART3_MODELS),['traffic_cone','tire_stack','car_parked_red','person_photo']);
 for(const m of Object.values(PART3_MODELS)){assert.equal(m.data.length%42,0);assert.ok(m.data.every(Number.isFinite));assert.ok(m.data.every((v,i)=>i%14<12||v===-1));}
});
