import {openPlayMode} from './helpers/play-mode.mjs';
// GPU integration, original geometry, garage appearance and four-car timing.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store,online}=await import('../server.mjs');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/api/health');
 await page.evaluate(async base=>{
  const [{Renderer},sim,{vehicleMultiply}]=await Promise.all([import(base+'/js/renderer.js'),import(base+'/js/sim.mjs'),import(base+'/js/vehicle-model.mjs')]);
  document.body.innerHTML='<canvas id="world" style="width:100vw;height:100vh;display:block"></canvas>';document.body.style.margin='0';
  const r=new Renderer(document.getElementById('world'));r.quality=1;r.setCar(sim.CARS[0]);r.setTrack(sim.makeTrack(sim.TRACKS[0]));await r.atlasReady;await r.vehicleModels.load();if(r.vehicleModels.status!=='ready')throw Error(r.vehicleModels.error);r.boundBuffer=null;
  const id=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const normalize=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const view=(eye,target)=>{const z=normalize(eye.map((v,i)=>v-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];};
  window.modelShot=({id:carId='ae86',rear=false,build={},lights=true,steer=0,s=0}={})=>{
   const car=sim.ALL_CARS.find(c=>c.id===carId);r.setCar({...car,color:build.color||car.color,build});r.time+=1;
   r.render(null,'garage',1/60);const gl=r.gl,u=r.uniforms,eye=[rear?-4.2:4.2,2.15,rear?-5.5:5.5],f=1/Math.tan(35*Math.PI/360),a=gl.canvas.width/gl.canvas.height;
   gl.clearColor(.16,.2,.25,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);r.eye=eye;
   gl.uniformMatrix4fv(u.uView,false,view(eye,[0,.64,0]));gl.uniformMatrix4fv(u.uProjection,false,[f/a,0,0,0,0,f,0,0,0,0,-1.001, -1,0,0,-.2001,0]);gl.uniform3fv(u.uEye,eye);gl.uniform1f(u.uDay,1);gl.uniform1f(u.uLampState,Number(lights));gl.uniform1f(u.uBrake,1);r.draw(r.menuGround);r.draw(r.shadow,id(),.35);r.vehicleModels.forget(carId);r.drawCar(carId,id(),{headlights:lights,s,steer});
   return {error:gl.getError(),status:r.vehicleModels.status,instances:[...r.vehicleModels.instances].map(([key,v])=>({key,...v}))};
  };
  window.modelBenchmark=()=>new Promise(resolve=>{
   r.setCar(sim.CARS[0]);r.setNetworkPlayers([{id:'red',car:'ae86',build:{color:'#be3540'}},{id:'blue',car:'ae86carbon',build:{color:'#3872ab',spoiler:'gt'}},{id:'coupe',car:'ae86coupe'}]);
   const race=sim.createRace(sim.CARS[0],r.track,{mode:'time'});race.countdown=0;race.s=700;race.speed=40;race.netOpponents=[{id:'red',carId:'ae86',s:714,lateral:1.9,yaw:0,steer:.5,headlights:true},{id:'blue',carId:'ae86carbon',s:724,lateral:-1.9,yaw:0,headlights:true},{id:'coupe',carId:'ae86coupe',s:738,lateral:.3,yaw:0,headlights:true}];r.resetCamera=true;
   let last=0,n=0,measure=[];const frame=now=>{const dt=last?(now-last)/1000:1/60;last=now;race.s+=40*dt;for(const o of race.netOpponents)o.s+=40*dt;r.render(race,'race',dt,{day:true,shake:false});if(n++>90)measure.push(dt*1000);if(n<270)requestAnimationFrame(frame);else resolve({fps:1000/(measure.reduce((a,b)=>a+b,0)/measure.length),drawCalls:r.stats.drawCalls,vertices:r.stats.vertices,width:r.canvas.width,height:r.canvas.height,error:r.gl.getError(),instances:r.vehicleModels.instances.size});};requestAnimationFrame(frame);
  });
  window.modelRenderer=r;
 },base);
 for(const [name,config]of [['ae86-propio-frente',{}],['ae86-propio-trasera',{rear:true}],['ae86-propio-project-d',{id:'ae86carbon',steer:.7}],['ae86-propio-coupe',{id:'ae86coupe',rear:true}],['ae86-propio-garaje',{build:{color:'#3975a2',spoiler:'gt',vinyl:'apex',wheels:'gold',hood:'carbon'}}],['ae86-propio-faros-cerrados',{lights:false}]]){
  const result=await page.evaluate(config=>window.modelShot(config),config);assert.equal(result.error,0);assert.equal(result.status,'ready');await page.screenshot({path:path.resolve('screenshots',name+'.png')});
 }
 await page.setViewportSize({width:1920,height:1080});const timing=await page.evaluate(()=>window.modelBenchmark());assert.equal(timing.error,0);assert.ok(timing.instances>=4);assert.ok(timing.vertices>100000);await page.screenshot({path:path.resolve('screenshots/ae86-propio-cuatro-coches.png')});
 // Real game: account, garage, start, animated H toggle, cockpit and return.
 const registered=await page.request.post(base+'/api/register',{data:{username:'OriginalModel24',password:'OriginalPassword24'}});assert.equal(registered.status(),200);const account=await registered.json();assert.equal((await page.request.patch(base+'/api/profile',{headers:{'X-CSRF-Token':account.csrf},data:{complete:true}})).status(),200);
 await page.addInitScript(()=>localStorage.setItem('touge-settings',JSON.stringify({camera:'0',quality:'1',autoQuality:false,performanceDisplay:'off'})));
 await page.goto(base);await page.waitForFunction(()=>window.touge?.models.status==='ready');await page.waitForFunction(()=>document.getElementById('auth-gate').classList.contains('hidden'));await page.keyboard.press('Enter');await page.locator('#main-menu-actions [data-action=garage]').click();await page.waitForFunction(()=>window.touge.state.screen==='garage'&&window.touge.models.draws>0);await page.screenshot({path:path.resolve('screenshots/ae86-propio-garaje-real.png')});
 await page.locator('#header .brand').click();await openPlayMode(page,'offline');await page.locator('#start').click();await page.waitForFunction(()=>window.touge.state.screen==='race');
 await page.keyboard.press('h');await page.waitForFunction(()=>window.touge.models.instances.some(v=>v.key==='ae86'&&v.opening<.02));assert.equal(await page.locator('#headlight-toggle').getAttribute('aria-pressed'),'false');await page.keyboard.press('h');await page.waitForFunction(()=>window.touge.models.instances.some(v=>v.key==='ae86'&&v.opening>.98));assert.equal(await page.locator('#headlight-toggle').getAttribute('aria-pressed'),'true');
 await page.screenshot({path:path.resolve('screenshots/ae86-propio-carrera-real.png')});for(let i=0;i<3;i++)await page.keyboard.press('c');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.getElementById('world').getContext('webgl').getError()),0);await page.keyboard.press('Escape');await page.locator('#pause-panel [data-action=quit]').click();await page.waitForFunction(()=>window.touge.state.screen==='menu'&&window.touge.state.showcase.active);assert.equal((await page.evaluate(()=>window.touge.state.showcase)).triangles,90362);
 assert.deepEqual(errors,[]);console.log('ORIGINAL VEHICLE OK',JSON.stringify(timing),'real garage/race/H/cockpit/menu OK');
}finally{await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();}
