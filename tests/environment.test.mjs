import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../js/renderer.js';
import {makeTrack,ALL_TRACKS} from '../js/sim.mjs';
import {createRoadIndex} from '../js/scenery.mjs';
import {TEXTURES,SCENERY_MODELS} from '../js/scenery-assets.mjs';
import {ENVIRONMENTS,environmentZone} from '../js/environment.mjs';

test('compiled pack keeps UVs, original props, day/night materials and finite geometry',()=>{
 assert.equal(Object.keys(TEXTURES).length,35);assert.equal(Object.keys(SCENERY_MODELS).length,20);
 for(const name of ['concrete_wall','sprite_tree_autumn','sprite_tree_pine','sky_day','water'])assert.ok(Number.isInteger(TEXTURES[name]));
 for(const [name,model]of Object.entries(SCENERY_MODELS)){
  assert.equal(model.data.length%42,0,name);assert.ok(model.data.every(Number.isFinite),name);
  for(let i=0;i<model.data.length;i+=14){assert.ok(model.data[i]>=model.min[0]-.0001&&model.data[i]<=model.max[0]+.0001);assert.ok(model.data[i+12]>=-1&&model.data[i+12]<35);assert.ok(model.data[i+13]>=-1&&model.data[i+13]<35);}
 }
 const apartment=SCENERY_MODELS.building_apartment.data;assert.ok(apartment.some((v,i)=>i%14===13&&v===TEXTURES.facade_apartment_night));
});

test('terrain footprint checks reject a road through the middle, edge grazing and folded quads',()=>{
 const track={width:10.6,points:[{x:0,z:-100},{x:0,z:100}]},index=createRoadIndex(track);
 assert.equal(index.polygonClear([[-20,0,-20],[20,0,-20],[20,0,20],[-20,0,20]]),false,'enclosing the centerline must be rejected');
 assert.equal(index.polygonClear([[5,0,-10],[9,0,-10],[9,0,10],[5,0,10]]),false,'a strip grazing the driving corridor must be rejected');
 assert.equal(index.polygonClear([[8,0,-10],[12,0,-10],[12,0,10],[8,0,10]]),true);
 assert.equal(index.polygonClear([[10,0,-10],[20,0,10],[10,0,10],[20,0,-10]]),false,'folded strips must be rejected before triangulation');
});

test('all ten decorated maps retain safe road corridors and sector culling, including campaign roads',()=>{
 const summary={};
 for(const config of ALL_TRACKS){
  const track=makeTrack(config),index=createRoadIndex(track),renderer=Object.create(Renderer.prototype);let uploads=0;
  renderer.gl={createBuffer:()=>({}),bindBuffer(){},bufferData(_target,data){assert.ok(data.every(Number.isFinite),config.id);uploads++;},deleteBuffer(){},ARRAY_BUFFER:1,STATIC_DRAW:2};renderer.setTrack(track);
  const env=renderer.environment;assert.ok(env.profile.name);assert.ok(env.props.length>800);assert.equal(uploads,2,'one world buffer and one backdrop buffer');
  assert.equal(renderer.scene.chunks.reduce((n,c)=>n+c.count,6),renderer.scene.count);
  for(const prop of env.props)assert.ok(index.distance(prop.x,prop.z,prop.radius+32)>track.width/2+prop.radius+1.79,config.id+' '+prop.kind);
  // Independently sample accepted surfaces; height is intentionally ignored so
  // lower hairpins stay safe from upper-bank scenery as well.
  for(const {kind,vertices}of env.surfaces){const center=[0,0,0];for(const p of vertices){center[0]+=p[0]/4;center[2]+=p[2]/4;}for(const p of [...vertices,center])assert.ok(index.distance(p[0],p[2],64)>=track.width/2+.14,config.id+' '+kind);}
  for(const tunnel of env.tunnels){assert.ok(tunnel.clearance>5);for(let i=tunnel.first;i<=tunnel.last;i+=3)for(let j=0;j<track.points.length;j++){if(j>=tunnel.first-7&&j<=tunnel.last+7)continue;assert.ok(Math.hypot(track.points[i].x-track.points[j].x,track.points[i].z-track.points[j].z)>=25,config.id+' tunnel crosses another road');}}
  summary[config.id]=env.counts;
 }
 assert.equal(Object.keys(summary).length,10);assert.ok(summary.iroha['tree-autumn']>1500);assert.ok(summary.atami.building>100);assert.equal(summary.usui['railway-bridge'],1);assert.ok(summary.ashinoko.dock>=1);assert.ok(summary.akagi['tunnel-segment']>10);
});

test('course identities and inhabited areas follow authored regional patterns',()=>{
 assert.equal(Object.keys(ENVIRONMENTS).length,10);assert.equal(ENVIRONMENTS.iroha.tree,'autumn');assert.ok(ENVIRONMENTS.ashinoko.lake);assert.ok(ENVIRONMENTS.manazuru.coast);
 assert.equal(environmentZone('atami',.08),'urban');assert.equal(environmentZone('atami',.4),'forest');assert.equal(environmentZone('tsukuba',.5),'orchard');assert.equal(environmentZone('manazuru',.58),'coast');
});
