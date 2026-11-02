import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseVehicleModel,vehicleWheelMatrix,vehiclePopupMatrix,VehicleModels} from '../js/vehicle-model.mjs';
const source=readFileSync(new URL('../assets/cars/original/ae86.glb',import.meta.url)),buffer=()=>source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),model=()=>parseVehicleModel(buffer());
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
test('original AE86 has finite lit UV geometry, separate variants, pivots and a useful far LOD',()=>{
 const m=model();for(const [lod,parts]of m.parts.entries()){
  for(const part of Object.values(parts)){assert.equal(part.data.length,part.count*14);assert.equal(part.count%3,0);assert.ok(part.data.every(Number.isFinite));for(let i=0;i<part.data.length;i+=14)assert.ok(Math.abs(Math.hypot(...part.data.subarray(i+3,i+6))-1)<.0001);}
  assert.ok(parts.body_hatch.count!==parts.body_coupe.count);assert.ok(Math.abs(parts.wheel.pivot[1]-.298)<.00001);assert.ok(parts.popup_l.pivot[0]<0&&parts.popup_r.pivot[0]>0);
  const count=['body','hood','body_hatch','glass_hatch','popup_l','popup_r',...(lod===0?['lettering','badges']:[])].reduce((n,k)=>n+parts[k].count/3,0)+4*parts.wheel.count/3;
  if(lod===0)assert.ok(count>10000&&count<20000,count);else assert.ok(count<5500,count);
 }
 for(let i=0;i<m.parts[0].hood.data.length;i+=14)assert.ok(m.parts[0].hood.data[i+4]>.95,'bonnet normals face the sky');
 const body=m.parts[0].body.data,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<body.length;i+=14)for(let j=0;j<3;j++){min[j]=Math.min(min[j],body[i+j]);max[j]=Math.max(max[j],body[i+j]);}
 assert.ok(max[2]-min[2]>4.2&&max[2]-min[2]<4.5);assert.ok(max[0]-min[0]>1.625&&max[0]-min[0]<2);
 // The exhibition download is independent of this authored asset.
 const imported=readFileSync(new URL('../assets/cars/1985_toyota_sprinter_trueno_ae86_project_d.glb',import.meta.url));assert.equal(createHash('sha256').update(imported).digest('hex'),'0006cf7f95086efee95a5a0a175ddcc0844b730eb6237228692e0bcfbf2bd86f');
});
test('wheel travel and steering rotate about their hubs; popup motion keeps each hinge fixed',()=>{
 const rest=vehicleWheelMatrix(identity,1,true,0,0),moving=vehicleWheelMatrix(identity,1,true,3,.7);assert.deepEqual([...rest.slice(12,15)],[...moving.slice(12,15)]);assert.notDeepEqual([...rest.slice(0,12)],[...moving.slice(0,12)]);assert.ok(Math.abs(rest[14]-1.17)<.00001);
 const rearA=vehicleWheelMatrix(identity,-1,false,2,0),rearB=vehicleWheelMatrix(identity,-1,false,2,1);assert.deepEqual(rearA,rearB);
 const pivot=[-.54,.742,1.31],closed=vehiclePopupMatrix(identity,pivot,0),open=vehiclePopupMatrix(identity,pivot,1);assert.deepEqual([...closed.slice(12,15)],[...open.slice(12,15)]);assert.ok(open[9]>0);assert.deepEqual(vehiclePopupMatrix(identity,pivot,10),open);
});
test('vehicle instances share GPU geometry but keep paint, parts, headlights and LOD independent',()=>{
 const gl={depthMask(){},uniform1f(){},uniform3fv(){}},assets=new VehicleModels(gl),calls=[];assets.parts=model().parts;assets.status='ready';const renderer={uniforms:{},time:1,eye:[0,2,5],draw(mesh,transform,alpha){calls.push({mesh,transform,alpha});}};
 assets.draw(renderer,'a',{id:'ae86',color:'#e7e6df',build:{}},identity,{headlights:true,s:50,steer:.5},1);const stock=calls.length;assert.equal(assets.instances.get('a').opening,1);
 assets.draw(renderer,'b',{id:'ae86carbon',color:'#3366cc',build:{spoiler:'gt',vinyl:'apex',wheels:'gold'}},identity,{headlights:false,s:80,steer:-.5},1);assert.equal(assets.instances.get('b').opening,0);assert.equal(calls.length-stock,stock+1);assert.ok(calls.slice(stock).some(c=>c.mesh===assets.parts[0].badges));assert.ok(!calls.slice(stock).some(c=>c.mesh===assets.parts[0].lettering));
 renderer.time+=.1;assets.draw(renderer,'a',{id:'ae86',color:'#e7e6df'},identity,{headlights:false},1);const intermediate=assets.instances.get('a').opening;assert.ok(intermediate>0&&intermediate<1);assets.draw(renderer,'a',{id:'ae86',color:'#e7e6df'},identity,{headlights:false},1);assert.equal(assets.instances.get('a').opening,intermediate,'mirror pass must not advance animation twice');
 renderer.eye=[0,2,100];assets.draw(renderer,'b',{id:'ae86carbon',color:'#3366cc'},identity,{headlights:false},1);assert.equal(assets.instances.get('b').lod,1);assert.equal(assets.instances.get('a').lod,0);assets.forget('b');assert.equal(assets.instances.has('b'),false);
});
test('truncated GLBs and unidentified vehicle pieces fail before GPU upload',()=>{assert.throws(()=>parseVehicleModel(new ArrayBuffer(4)),/inválido/);const b=buffer();new DataView(b).setUint32(12,b.byteLength,true);assert.throws(()=>parseVehicleModel(b),/incompleto/);});
