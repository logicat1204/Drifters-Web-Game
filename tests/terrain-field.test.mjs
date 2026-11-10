import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeTrack,ALL_TRACKS} from '../js/sim.mjs';
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
