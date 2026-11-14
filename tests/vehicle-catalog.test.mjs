import {test}from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from 'node:fs';
import {createHash}from 'node:crypto';
import {ALL_CARS}from '../js/sim.mjs';
import {CAMPAIGN_STAGES}from '../js/campaign.mjs';
import {VEHICLE_FILES}from '../js/vehicle-catalog.mjs';
import {parseVehicleModel,VehicleModels,vehicleWheelMatrix}from '../js/vehicle-model.mjs';
const specs=JSON.parse(readFileSync(new URL('../assets/cars/original/catalog-specs.json',import.meta.url),'utf8')).cars;
const bytes=id=>{const b=readFileSync(new URL('../assets/cars/original/'+VEHICLE_FILES[id]+'.glb',import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
test('every playable car selects its original asset by exact ID and all new bodies are valid with useful LODs',()=>{
 assert.deepEqual(new Set(Object.keys(VEHICLE_FILES)),new Set(ALL_CARS.map(c=>c.id)));assert.equal(specs.length,41);
 for(const rival of CAMPAIGN_STAGES)assert.ok(VEHICLE_FILES[rival.car],rival.id);
 const fingerprints=new Map();
 for(const spec of specs){
  const model=parseVehicleModel(bytes(spec.id));assert.equal(model.rig.id,spec.id);assert.ok(Math.abs(model.rig.front-model.rig.rear-spec.wb)<1e-6);assert.ok(Math.abs(model.rig.wheelY-model.rig.radius-.006)<1e-6);
  for(const [lod,parts]of model.parts.entries()){
   for(const p of Object.values(parts)){assert.ok(p.count>0,spec.id);assert.equal(p.count%3,0);assert.ok(p.data.every(Number.isFinite));for(let i=0;i<p.data.length;i+=14)assert.ok(Math.abs(Math.hypot(...p.data.subarray(i+3,i+6))-1)<.0001,spec.id);}
   assert.equal(!!parts.popup_l,spec.lights==='popup');assert.equal(!!parts.popup_r,spec.lights==='popup');
   const triangles=['body','cabin','hood','glass','spoiler_stock',...(lod===0?['badges']:[]),...(parts.popup_l?['popup_l','popup_r']:[])].reduce((n,k)=>n+(parts[k]?.count||0)/3,0)+parts.wheel.count/3*4;
   assert.ok(triangles<=(lod===0?26000:7000),`${spec.id} LOD${lod}: ${triangles}`);
   if(lod===1){const near=model.parts[0];assert.ok(parts.body.count<near.body.count*.6,spec.id);assert.ok(parts.wheel.count<near.wheel.count*.65,spec.id);}
  }
  const body=model.parts[0].body.data,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<body.length;i+=14)for(let j=0;j<3;j++){min[j]=Math.min(min[j],body[i+j]);max[j]=Math.max(max[j],body[i+j]);}
  assert.ok(max[2]-min[2]>spec.size[0]-.2&&max[2]-min[2]<spec.size[0]+.4,spec.id);assert.ok(max[0]-min[0]>spec.size[1]-.1&&max[0]-min[0]<spec.size[1]+.4,spec.id);
  fingerprints.set(spec.id,createHash('sha256').update(body).digest('hex'));
  const front=vehicleWheelMatrix(identity,1,true,22,.5,model.rig),rear=vehicleWheelMatrix(identity,-1,false,22,.5,model.rig);assert.ok(Math.abs(front[12]-model.rig.track)<1e-6);assert.ok(Math.abs(front[14]-rear[14]-spec.wb)<1e-6);
 }
 for(const [a,b]of [['rx7','mr2'],['r32','r34'],['180sx','silvia'],['gt86','rx7'],['civic','silvia'],['gt3rs','supra']])assert.notEqual(fingerprints.get(a),fingerprints.get(b),`${a} and ${b} must have their own silhouette`);
});
test('lazy loading shares AE86 variants, bounds GPU cache, releases old buffers and reloads evicted bodies',async()=>{
 const oldFetch=globalThis.fetch,requests=[],deleted=[];let count=0;const gl={ARRAY_BUFFER:1,STATIC_DRAW:2,createBuffer:()=>({id:++count}),bindBuffer(){},bufferData(){},deleteBuffer:b=>deleted.push(b.id)};
 globalThis.fetch=async url=>{const id=/\/([^/]+)\.glb$/.exec(String(url))[1];requests.push(id);return new Response(bytes(id));};
 try{
  const models=new VehicleModels(gl),first=models.load('ae86');assert.equal(models.load('ae86carbon'),first);assert.ok(await first);assert.equal(models.statusFor('ae86coupe'),'ready');assert.deepEqual(requests,['ae86']);
  for(const id of ['rx7','r32','mr2','s2000','silvia','supra','180sx','r34'])assert.ok(await models.load(id));
  assert.equal(models.assets.size,8);assert.equal(models.statusFor('rx7'),'idle');assert.equal(models.statusFor('ae86'),'ready');assert.ok(deleted.length>0);assert.ok(await models.load('rx7'));assert.equal(requests.filter(id=>id==='rx7').length,2);assert.equal(models.assets.size,8);
  const before=requests.length;assert.equal(await models.load('unknown-car'),false);assert.equal(requests.length,before);
 }finally{globalThis.fetch=oldFetch;}
});
test('different bodies draw their own wheel rigs and GT upgrades replace each stock wing',()=>{
 const gl={depthMask(){},uniform1f(){},uniform3fv(){}},assets=new VehicleModels(gl),calls=[],renderer={uniforms:{},time:1,eye:[0,2,5],draw(mesh,matrix){calls.push({mesh,matrix});}};
 for(const id of ['rx7','r34','s2000','gt3rs']){
  const m=parseVehicleModel(bytes(id));assets.assets.set(id,{status:'ready',parts:m.parts,rig:m.rig});assets.draw(renderer,id,{id,color:'#4488cc',build:{spoiler:'gt'}},identity,{s:12,headlights:true},1);
  const p=m.parts[0];assert.ok(calls.some(c=>c.mesh===p.spoiler_gt),id);assert.ok(!calls.some(c=>c.mesh===p.spoiler_stock),id);const wheels=calls.filter(c=>c.mesh===p.wheel);assert.equal(wheels.length,4);assert.ok(wheels.some(c=>Math.abs(c.matrix[14]-m.rig.front)<1e-6));calls.length=0;
 }
});
