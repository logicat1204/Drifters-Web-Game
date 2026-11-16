import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeTrack,ALL_TRACKS,worldAt} from '../js/sim.mjs';
import {createRoadIndex} from '../js/scenery.mjs';
import {createTerrainField} from '../js/terrain-field.mjs';
test('shared ground is continuous, seals the roadside and returns the height of an actual supporting triangle',()=>{
 const track=makeTrack({...ALL_TRACKS[0],length:800,elevation:60,layout:[[1,0]]}),index=createRoadIndex(track),ground=createTerrainField(track,index),faces=[];
 ground.build({surface(...args){faces.push(args.slice(0,4));}},()=>{},0);
 assert.ok(faces.length>100);
 for(const vertices of faces)assert.equal(index.polygonClear(vertices,.12),true);
 const [a,b,c]=faces[0],x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3;assert.ok(Math.abs(ground.groundAt(x,z)-(a[1]+b[1]+c[1])/3)<1e-5);
 assert.equal(ground.groundAt(10000,10000),null);
 for(const z of [160,320,480])assert.ok(Math.abs(ground.heightAt(16-.0001,z)-ground.heightAt(16+.0001,z))<.01);
 for(const side of [-1,1])assert.notEqual(ground.groundAt(side*5.8,300),null,'the rail must have a continuous supporting collar');
});

test('adaptive terrain closes broad gaps at real hairpins without entering the road',()=>{
 const track=makeTrack(ALL_TRACKS.find(t=>t.id==='iroha')),index=createRoadIndex(track),ground=createTerrainField(track,index);
 ground.build({surface(){}},()=>{},0);
 let gaps=0;
 for(let s=32;s<track.length-32;s+=8)for(const offset of [7,9,13,18,22])for(const side of [-1,1]){
   const {x,z}=worldAt(track,s,offset*side);
   if(index.distance(x,z,24)>=6.25&&ground.groundAt(x,z)===null)gaps++;
 }
 assert.ok(gaps<30,`${gaps} samples lack ground on Irohazaka`);
 assert.ok(ground.repairCounts.automatic>0&&ground.repairCounts.automatic<4000);
 for(const face of ground.surfaces)if(face.kind==='ground-repair')assert.ok(index.polygonClear(face.vertices,.18));
});

test('authored fill adjusts the height of a real opening and clips the road',()=>{
 const track=makeTrack(ALL_TRACKS.find(t=>t.id==='iroha')),index=createRoadIndex(track);
 const {x,z}=worldAt(track,904,-13);
 const points=[[x-12,z-12],[x+12,z-12],[x+12,z+12],[x-12,z+12]];
 const ground=createTerrainField(track,index,{fills:[{id:'fill',points,lift:3}]});
 ground.build({surface(){}},()=>{},0);
 assert.ok(ground.repairCounts.manual>0);
 assert.ok(ground.groundAt(x,z)>ground.heightAt(x,z)+1);
 for(const face of ground.surfaces)if(face.kind==='ground-fill')assert.ok(index.polygonClear(face.vertices,.18));
});
