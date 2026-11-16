import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readTrackLayout,placementSpot,placementWarning} from '../js/track-layout.mjs';
import {createRoadIndex} from '../js/scenery.mjs';
import {fadeBetween} from '../js/render-performance.mjs';
import {placementModelKey,sceneryAssetUrl,sceneryModelRoot,textureInsideModelRoot,validModelPath} from '../js/scenery-models.mjs';

const track={id:'akina',length:1000,width:10.6,step:1000,points:[
 {x:0,y:0,z:0,heading:0,s:0,curve:0},{x:0,y:0,z:1000,heading:0,s:1000,curve:0}
]};
const asset={bounds:{min:[-2,0,-2],max:[2,3,2]}};
const catalog=new Map([['2:akina/sign',asset]]);
const object={id:'p1',pack:2,file:'akina/sign',s:120,lateral:12,lift:0,yaw:90,scale:[1,1,1]};
const layout={version:1,track:'akina',objects:[object]};
const ground={groundAt:()=>7,heightAt:()=>6};

test('saved placements derive bounds from the catalog and stay anchored to the track',()=>{
 const parsed=readTrackLayout(layout,track,catalog);
 const spot=placementSpot(track,ground,parsed.objects[0]);
 assert.deepEqual([spot.x,spot.y,spot.z],[12,7,120]);
 assert.equal(spot.angle,Math.PI/2);
 assert.deepEqual(parsed,readTrackLayout(parsed,track));
 assert.equal(placementWarning(spot,createRoadIndex(track),{ground,blockers:[]}), '');
 const blocked=placementSpot(track,ground,{...parsed.objects[0],lateral:0});
 assert.match(placementWarning(blocked,createRoadIndex(track),{ground,blockers:[]}),/calzada/);
});

test('layouts reject invalid transforms, unlisted models, duplicate ids and mismatched tracks',()=>{
 assert.throws(()=>readTrackLayout({...layout,track:'usui'},track,catalog));
 assert.throws(()=>readTrackLayout({...layout,objects:[object,object]},track,catalog));
 for(const patch of [{file:'../sign'},{file:'usui/unknown'},{yaw:Infinity},{scale:[0,1,1]},{portal:true}]){
  assert.throws(()=>readTrackLayout({...layout,objects:[{...object,...patch}]},track,catalog));
 }
});

test('draw distance transition is continuous and bounded',()=>{
 assert.equal(fadeBetween(30,50,100),0);
 assert.equal(fadeBetween(75,50,100),.5);
 assert.equal(fadeBetween(110,50,100),1);
 assert.ok(fadeBetween(51,50,100)<.01);
 assert.ok(fadeBetween(99,50,100)>.99);
});

test('old layouts load without fills and authored terrain keeps a valid simple contour',()=>{
 assert.deepEqual(readTrackLayout(layout,track,catalog).fills,[]);
 const fill={id:'slope',points:[[7,10],[18,10],[18,20],[12,16],[7,20]],lift:2};
 assert.deepEqual(readTrackLayout({...layout,fills:[fill]},track,catalog).fills,[fill]);
 assert.throws(()=>readTrackLayout({...layout,fills:[fill,fill]},track,catalog));
 assert.throws(()=>readTrackLayout({...layout,fills:[{...fill,points:[[7,10],[18,20],[7,20],[18,10]]}]},track,catalog),/cruza/);
 assert.throws(()=>readTrackLayout({...layout,fills:[{...fill,lift:11}]},track,catalog),/altura/);
});

test('tilted placements preserve their angles and extend their footprint and height',()=>{
 const edited={...object,pack:'city-3',file:'models/sign',pitch:90,roll:0,yaw:0,bounds:{min:[-1,0,-.25],max:[1,8,.25]}};
 const {objects:[saved]}=readTrackLayout({...layout,objects:[edited]},track);
 assert.deepEqual([saved.pitch,saved.roll],[90,0]);
 const spot=placementSpot(track,ground,saved);
 assert.ok(Math.abs(spot.height-.5)<1e-5);
 assert.ok(Math.abs(Math.max(...spot.footprint.map(p=>p[2]))-128)<1e-5);
 assert.equal(placementSpot(track,ground,{...saved,pitch:0,roll:0}).height,8);
 const rolled=placementSpot(track,ground,{...saved,pitch:0,roll:90});
 assert.ok(Math.abs(rolled.height-2)<1e-5);
 assert.ok(Math.abs(Math.min(...rolled.footprint.map(p=>p[0]))-4)<1e-5);
});

test('catalog sources preserve namespaces and custom filenames without escaping the asset directory',()=>{
 const file='Sección norte/Mi señal';
 const url=sceneryAssetUrl('custom',file);
 assert.match(url.pathname,/editor-models\/Secci%C3%B3n%20norte\/Mi%20se%C3%B1al\.glb$/);
 assert.equal(validModelPath('custom','../foo'),false);
 assert.equal(validModelPath('custom','x/%2e%2e/foo'),false);
 assert.equal(validModelPath('city-1','models/sign'),true);
 assert.notEqual(placementModelKey({pack:'city-1',file:'models/sign'}),placementModelKey({pack:'city-2',file:'models/sign'}));
 assert.notEqual(placementModelKey({pack:1,file:'tsuchisaka/tsuchisaka_tunnel_portal'}),placementModelKey({pack:1,file:'tsuchisaka/tsuchisaka_tunnel_portal',portal:true}));
 const root=sceneryModelRoot('custom');
 assert.equal(textureInsideModelRoot(new URL('textures/wall.png',root).href,root),true);
 assert.equal(textureInsideModelRoot(new URL('../wall.png',root).href,root),false);
 assert.equal(textureInsideModelRoot('https://example.com/image.png',root),false);
});
