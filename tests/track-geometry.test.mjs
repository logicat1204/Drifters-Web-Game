import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAuthoredTrack,trackCrossings} from '../js/track-geometry.mjs';

const config={id:'fixture',name:'Fixture',length:1000,elevation:70,seed:1};
const open={length:1000,closed:false,points:[[0,100],[0,75],[10,50],[0,25],[0,0]],sectionLengths:[240,260,260,240]};
const closed={length:1200,closed:true,points:[[0,100],[50,100],[75,75],[75,25],[50,0],[0,0],[-25,25],[-25,75]]};
test('reference geometry uses uniform physical distance and preserves length and explicit checkpoints',()=>{
  const track=buildAuthoredTrack(config,open);
  assert.deepEqual(track,buildAuthoredTrack(config,open));
  assert.equal(track.points[track.renderSegments].s,1000);
  assert.ok(track.step<=4);
  assert.deepEqual(track.sectionEnds,[240,500,760,1000]);
  assert.equal(track.points.length,track.renderSegments+81);
  let measured=0;
  for(let i=1;i<=track.renderSegments;i++){
    const a=track.points[i-1],b=track.points[i];
    measured+=Math.hypot(b.x-a.x,b.z-a.z);
    assert.ok(Math.abs((b.s-a.s)-track.step)<1e-8);
    assert.ok(Math.abs(b.heading-a.heading)<.2);
    assert.ok(Math.abs((b.y-a.y)/track.step)<=.18001);
  }
  assert.ok(Math.abs(measured-track.length)/track.length<.001);
  assert.equal(track.points[0].x,0);
  assert.equal(track.points[0].z,0);
  assert.ok(Math.abs(track.points[track.renderSegments].y+70)<1e-8);
});
test('closed reference tracks close geometry and grades and repeat safely past the finish',()=>{
  const track=buildAuthoredTrack(config,closed),start=track.points[0],end=track.points[track.renderSegments];
  assert.equal(start.x,end.x);assert.equal(start.z,end.z);assert.equal(start.y,end.y);
  assert.ok(Math.abs(Math.sin(start.heading-end.heading))<1e-8);
  assert.ok(Math.abs(start.curve-end.curve)<1e-8);
  for(let i=1;i<=80;i++){
    const a=track.points[i],b=track.points[track.renderSegments+i];
    assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.equal(a.y,b.y);
    assert.ok(Math.abs(Math.sin(a.heading-b.heading))<1e-8);
  }
  assert.deepEqual(trackCrossings(track),[]);
});
test('regional height profiles have distinct terrain and explicit estimates respect grade limits',()=>{
  const a=buildAuthoredTrack({...config,id:'akina'},open),b=buildAuthoredTrack({...config,id:'iroha'},open);
  assert.notEqual(a.points[100].y,b.points[100].y);
  const steep=buildAuthoredTrack(config,{...open,elevationProfile:[[0,0],[.1,-1000],[1,-1050]]});
  assert.ok(steep.elevationGradeScale<1);
  for(let i=1;i<=steep.renderSegments;i++)assert.ok(Math.abs((steep.points[i].y-steep.points[i-1].y)/steep.step)<=.18001);
  assert.throws(()=>buildAuthoredTrack(config,{...closed,elevationProfile:[[0,0],[1,-100]]}),/cerrar/);
});
test('invalid geometry fails clearly and crossings are reported rather than hidden',()=>{
  assert.throws(()=>buildAuthoredTrack(config,{...open,points:[[0,0],[NaN,2]]}),/inválido/);
  assert.throws(()=>buildAuthoredTrack(config,{...open,sectionLengths:[1,2,3]}),/sectores/);
  const crossed=buildAuthoredTrack(config,{length:1200,closed:true,points:[[-50,-50],[50,50],[-50,50],[50,-50]]});
  assert.ok(trackCrossings(crossed).length>0);
});
