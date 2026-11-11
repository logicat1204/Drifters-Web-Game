import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_TRACKS,ALL_CARS,CARS,makeTrack,rivalCar,lateralGrip} from '../js/sim.mjs';
import {rivalRoute,routeSample} from '../js/rival-route.mjs';

const course=id=>makeTrack(ALL_TRACKS.find(t=>t.id===id));

test('the same pilot style retains individual model performance and the driver alone receives wet technique',()=>{
 const model=id=>rivalCar({car:id,style:'Complete',level:5});
 const toyota=model('gt86'),porsche=model('cayman');
 assert.ok(porsche.accel>toyota.accel&&porsche.max>toyota.max&&porsche.grip>toyota.grip);
 assert.notEqual(porsche.brakePower,toyota.brakePower);
 assert.ok(Math.abs(lateralGrip(porsche,true)/lateralGrip(porsche)-.96)<1e-8);
 const owned=ALL_CARS.find(c=>c.id==='cayman');
 assert.ok(Math.abs(lateralGrip(owned,true)/lateralGrip(owned)-.75)<1e-8);
 const pro=rivalCar({car:'cayman',style:'Complete',level:5,ngplus:true});
 assert.ok(pro.accel>porsche.accel&&pro.max>porsche.max&&pro.grip>porsche.grip);
});

test('planned paths stay within the road and have a continuous lap seam and feasible braking distances',()=>{
 const car=CARS[0];
 for(const id of ['akina','manazuru']){
  const track=course(id),route=rivalRoute(track,car,{style:'Skiller',level:4});
  for(let i=0;i<=route.count;i++){
   const sample=routeSample(route,i*route.step);
   assert.ok(Math.abs(sample.line)<=track.width/2-1.4,id);
   assert.ok(Math.abs(sample.lineSlope)<=.141,id);
   assert.ok(sample.speed>0&&sample.speed<=car.max,id);
   assert.ok(Math.abs(sample.curve)<.20,id);
   if(i){const ds=route.distance[i]-route.distance[i-1],required=(route.speed2[i-1]-route.speed2[i])/(2*ds);assert.ok(required<=19*(car.brakePower||1)+1e-6,id);}
  }
  if(track.closed){assert.equal(route.line[0],route.line.at(-1));assert.equal(route.lineSlope[0],route.lineSlope.at(-1));}
 }
});

test('style changes tight-corner pace at equal vehicle stats, and rain costs little AI pace',()=>{
 const track=course('iroha'),car=CARS[0],metrics={};
 for(const style of ['Grip','Complete','Skiller']){
  const driver={style,level:3},dry=rivalRoute(track,car,driver,false),wet=rivalRoute(track,car,driver,true);
  assert.equal(dry,rivalRoute(track,car,driver,false));assert.notEqual(dry,wet);
  let dryTime=0,wetTime=0,corner=0,count=0;
  for(let i=1;i<=dry.count;i++){
   const s=i*dry.step,a=routeSample(dry,s),b=routeSample(wet,s),ds=dry.distance[i]-dry.distance[i-1];
   dryTime+=ds/a.speed;wetTime+=ds/b.speed;
   if(Math.abs(a.roadCurve)>.016){corner+=a.speed;count++;}
  }
  assert.ok(wetTime>dryTime&&wetTime<dryTime*1.025,style);
  metrics[style]=corner/count;
 }
 assert.ok(metrics.Complete>metrics.Grip*1.04);
 assert.ok(metrics.Skiller>metrics.Complete*1.04);
});
