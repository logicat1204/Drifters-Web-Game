import {test}from 'node:test';
import assert from 'node:assert/strict';
import {createHash}from 'node:crypto';
import {CABIN_PROFILES,buildCabin}from '../js/cabin-geometry.mjs';
import {DriverCamera}from '../js/driver-camera.mjs';
import {cabinMirrorBounds,cabinViewMatrix}from '../js/cabin-view.js';
import {ALL_CARS,CARS,TRACKS,makeTrack,createRace,updateRace,repositionRace}from '../js/sim.mjs';
test('all 25 cars have explicit original cockpit geometry, readable clusters and correct driving side',()=>{
 assert.deepEqual(Object.keys(CABIN_PROFILES).sort(),ALL_CARS.map(c=>c.id).sort());const hashes=new Set();for(const car of ALL_CARS){const p=CABIN_PROFILES[car.id],model=buildCabin(p);assert.ok(p.width>1.6&&p.width<1.9,car.id);assert.ok(p.height>=1&&p.height<1.25);assert.ok(p.height-(1.1075+p.yOffset)>.02,'binnacle stays below the horizon: '+car.id);assert.ok(Math.abs(p.seat)<p.width/2-.3);let triangles=0;for(const [part,data]of Object.entries(model)){if(part==='profile')continue;assert.equal(data.length%42,0,part);assert.ok(data.every(Number.isFinite),car.id+part);for(let i=0;i<data.length;i+=14)assert.ok(Math.abs(Math.hypot(...data.subarray(i+3,i+6))-1)<.001);triangles+=data.length/42;}assert.ok(triangles<10000,car.id+' budget');hashes.add(createHash('sha256').update(model.body).digest('hex'));}assert.ok(hashes.size>=20);assert.ok(CABIN_PROFILES.ae86.seat>0);assert.ok(CABIN_PROFILES.r8.seat<0);assert.equal(CABIN_PROFILES.s2000.instruments,'digital');assert.notEqual(CABIN_PROFILES.ae86.depth,CABIN_PROFILES.rx7.depth);
});
test('driver inertia is bounded at uneven frame rates; comfort and reduced motion remove head movement',()=>{
 for(const fps of [30,60,144]){const cam=new DriverCamera(),r={speed:30,steer:1,travelYaw:.4,countdown:0,gear:2,car:{}};cam.reset(r);for(let i=0;i<fps*3;i++){r.speed+=.08;const p=cam.update(r,1/fps,{motion:100,stableHorizon:false});assert.ok(Math.abs(p.x)<.025&&Math.abs(p.y)<.02&&Math.abs(p.z)<.055&&Math.abs(p.yaw)<=.11&&Math.abs(p.roll)<.022);assert.ok(Object.values(p).every(Number.isFinite));}assert.ok(cam.pose.x>0&&cam.pose.yaw<0&&cam.pose.roll<0);}
 for(const option of [{motion:0},{reducedMotion:true},{shake:false}]){const cam=new DriverCamera(),r={speed:50,steer:1,travelYaw:.5,countdown:0,gear:2,collision:1};for(let i=0;i<120;i++)cam.update(r,1/60,option);for(const k of ['x','y','z','yaw','pitch','roll','kick'])assert.equal(Math.abs(cam.pose[k]),0,k);assert.equal(cam.pose.steer,1,'comfort does not disconnect the wheel');}
});
test('gear and handbrake animations decay; resets never carry a previous impact or shift into a new race',()=>{
 const cam=new DriverCamera(),r={speed:30,steer:.3,countdown:0,gear:2,collision:1,resetId:0};cam.update(r,1/60);r.gear=3;r.handbrakeDown=true;cam.update(r,1/60);assert.ok(cam.pose.shift>0&&cam.pose.handbrake>0&&cam.pose.kick>0);r.resetId++;r.collision=0;r.handbrakeDown=false;cam.update(r,0);assert.equal(cam.pose.shift,0);assert.equal(cam.pose.kick,0);assert.equal(cam.pose.handbrake,0);cam.update({...r},0);assert.equal(cam.pose.x,0);
});
test('camera presentation never changes physics and stable horizon stays level while steering',()=>{
 const track=makeTrack(TRACKS[0]),a=createRace(CARS[0],track,{mode:'time'}),b=createRace(CARS[0],track,{mode:'time'}),cam=new DriverCamera();for(let i=0;i<900;i++){const input={throttle:true,steer:Math.sin(i/70),brake:false,handbrake:i%180<10};updateRace(a,input,1/120);updateRace(b,input,1/120);const before=JSON.stringify(a);cam.update(a,1/120,{stableHorizon:true});assert.equal(JSON.stringify(a),before);assert.equal(cam.pose.roll,0);}for(const key of ['s','lateral','speed','yaw','gear','rpm','elapsed'])assert.equal(a[key],b[key]);repositionRace(a);cam.update(a,0);assert.equal(cam.pose.z,0);
});
test('the 3D mirror projects into a valid viewport region for both driving sides and portrait screens',()=>{
 for(const profile of Object.values(CABIN_PROFILES))for(const [width,height,fov]of [[1920,1080,65],[390,844,89],[844,390,75]]){const m=cabinMirrorBounds(profile,{x:0,y:0,z:0,yaw:.04,pitch:.01,roll:0},fov,width,height);assert.ok(m.width>15&&m.height>10,profile.id);assert.ok(m.x>=0&&m.y>=0&&m.x+m.width<=width+.01&&m.y+m.height<=height+.01);}
});
test('actual gauge faces stay in the lower viewport across every car, FOV and braking head pitch',()=>{
 for(const profile of Object.values(CABIN_PROFILES)){
  const body=buildCabin(profile).body,top=[];for(let i=0;i<body.length;i+=14)if(body[i+12]===1&&body[i+11]===0)top.push([...body.subarray(i,i+3),1]);assert.ok(top.length>=2);
  for(const fov of [55,65,80,100])for(const pitch of [-.04,0,.04]){const view=cabinViewMatrix(profile,{x:0,y:0,z:0,yaw:0,pitch,roll:0}),minimum=fov<=65?.68:fov<=80?.63:.59;for(const point of top){const y=point.reduce((s,n,k)=>s+n*view[k*4+1],0),z=point.reduce((s,n,k)=>s+n*view[k*4+2],0),screenY=.5+.5*y/z/Math.tan(fov*Math.PI/360);assert.ok(screenY>=minimum,profile.id+' instrument obstructs road at FOV '+fov);}}
 }
});
