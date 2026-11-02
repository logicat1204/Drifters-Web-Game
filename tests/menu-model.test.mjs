import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseMenuModel} from '../js/menu-model.mjs';
const file=new URL('../assets/cars/1985_toyota_sprinter_trueno_ae86_project_d.glb',import.meta.url);
test('exhibition importer preserves the source, hierarchy, geometry and embedded materials',()=>{
 const source=readFileSync(file),buffer=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),hash=()=>createHash('sha256').update(new Uint8Array(buffer)).digest('hex'),before=hash(),model=parseMenuModel(buffer);
 assert.equal(hash(),before);assert.equal(model.triangles,90362);assert.equal(model.batches.length,19);assert.equal(model.materials.length,19);assert.equal(model.images.length,35);assert.match(model.credit.author,/Ddiaz/);assert.match(model.credit.license,/BY-NC-SA/);
 assert.equal(model.batches.reduce((n,b)=>n+b.count,0),model.triangles*3);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const batch of model.batches){assert.ok(batch.data.every(Number.isFinite));for(let i=0;i<batch.data.length;i+=8){for(let j=0;j<3;j++){min[j]=Math.min(min[j],batch.data[i+j]);max[j]=Math.max(max[j],batch.data[i+j]);}assert.ok(Math.abs(Math.hypot(...batch.data.subarray(i+3,i+6))-1)<.00001);}}
 assert.ok(Math.abs(max[2]-min[2]-4.25)<.00001);assert.ok(max[0]-min[0]>1.8&&max[0]-min[0]<1.9);assert.ok(max[1]-min[1]>1.3&&max[1]-min[1]<1.4);assert.ok(model.scale>100&&model.scale<101);
 for(const image of model.images){assert.equal(image.mimeType,'image/png');assert.deepEqual([...image.bytes.subarray(0,4)],[137,80,78,71]);}
});
test('malformed exhibition data fails before creating GPU resources',()=>{
 assert.throws(()=>parseMenuModel(new ArrayBuffer(4)),/inválido/);
 const b=readFileSync(file),buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);new DataView(buffer).setUint32(8,100,true);assert.throws(()=>parseMenuModel(buffer),/inválido/);
});
