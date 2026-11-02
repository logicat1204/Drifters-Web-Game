// Whole-catalog GPU review and a mixed four-body race. Disposable server only.
import assert from 'node:assert/strict';
import {createRequire}from 'node:module';
import {mkdir}from 'node:fs/promises';
import path from 'node:path';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store,online}=await import('../server.mjs');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('screenshots/catalogo',{recursive:true});
try{
 await page.goto(base+'/api/health');
 const ids=await page.evaluate(async base=>{
  const [{Renderer},sim]=await Promise.all([import(base+'/js/renderer.js'),import(base+'/js/sim.mjs')]);document.body.innerHTML='<canvas id="world" style="width:100vw;height:100vh;display:block"></canvas>';document.body.style.margin=0;
  const r=new Renderer(document.getElementById('world'));r.quality=1;r.setTrack(sim.makeTrack(sim.TRACKS[0]));r.setCar(sim.CARS[0]);await r.atlasReady;
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  function view(eye,target){const z=unit(eye.map((v,i)=>v-target[i])),x=unit(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
  window.catalogShot=async(id,{rear=false,build={},lights=true}={})=>{
   if(!await r.vehicleModels.load(id))throw Error('Loading '+id);r.boundBuffer=null;const car=sim.ALL_CARS.find(c=>c.id===id);r.setCar({...car,color:build.color||car.color,build});r.time+=1;r.render(null,'garage',1/60);
   const gl=r.gl,u=r.uniforms,eye=[rear?-4.4:4.4,2.25,rear?-5.8:5.8],f=1/Math.tan(35*Math.PI/360),a=gl.canvas.width/gl.canvas.height;r.eye=eye;
   gl.clearColor(.13,.18,.23,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(u.uView,false,view(eye,[0,.65,0]));gl.uniformMatrix4fv(u.uProjection,false,[f/a,0,0,0,0,f,0,0,0,0,-1.001,-1,0,0,-.2001,0]);gl.uniform3fv(u.uEye,eye);gl.uniform1f(u.uDay,1);gl.uniform1f(u.uLampState,Number(lights));gl.uniform1f(u.uBrake,1);r.draw(r.menuGround);r.draw(r.shadow,identity,.35);r.vehicleModels.forget(id);r.drawCar(id,identity,{s:0,steer:.25,headlights:lights});return {error:gl.getError(),status:r.vehicleModels.statusFor(id),vertices:r.stats.vertices};
  };
  window.catalogRace=async()=>{
   const ids=['rx7','r34','ferrari488','civic'];for(const id of ids)await r.vehicleModels.load(id);r.boundBuffer=null;r.setCar(sim.CARS.find(c=>c.id==='rx7'));r.setNetworkPlayers([{id:'a',car:'r34',build:{color:'#3975a2'}},{id:'b',car:'ferrari488'},{id:'c',car:'civic'}]);const race=sim.createRace(sim.CARS[1],r.track,{mode:'time'});Object.assign(race,{s:700,speed:42,countdown:0});race.netOpponents=[{id:'a',carId:'r34',s:716,lateral:1.8,yaw:0,headlights:true},{id:'b',carId:'ferrari488',s:726,lateral:-1.7,yaw:0,headlights:true},{id:'c',carId:'civic',s:741,lateral:.4,yaw:0,headlights:true}];r.cameraMode=0;r.resetCamera=true;
   return await new Promise(resolve=>{let last=0,n=0,samples=[];const frame=now=>{const dt=last?(now-last)/1000:1/60;last=now;race.s+=42*dt;for(const o of race.netOpponents)o.s+=42*dt;r.render(race,'race',dt,{day:true,shake:false});if(n++>90)samples.push(dt*1000);if(n<270)requestAnimationFrame(frame);else resolve({fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),p95:samples.sort((a,b)=>a-b)[Math.floor(samples.length*.95)],width:r.canvas.width,height:r.canvas.height,drawCalls:r.stats.drawCalls,vertices:r.stats.vertices,error:r.gl.getError(),files:[...r.vehicleModels.assets.keys()]});};requestAnimationFrame(frame);});
  };
  return sim.ALL_CARS.map(c=>c.id);
 },base);
 const selected=process.env.CATALOG_IDS?ids.filter(id=>process.env.CATALOG_IDS.split(',').includes(id)):ids;
 for(const id of selected){
  for(const rear of [false,true]){const result=await page.evaluate(async({id,rear})=>window.catalogShot(id,{rear}),{id,rear});assert.equal(result.error,0,id);assert.equal(result.status,'ready',id);await page.screenshot({path:path.resolve('screenshots/catalogo',id+(rear?'-trasera':'-frente')+'.png')});}
 }
 for(const id of ['rx7','mr2','180sx']){const result=await page.evaluate(id=>window.catalogShot(id,{lights:false}),id);assert.equal(result.error,0);await page.screenshot({path:path.resolve('screenshots/catalogo',id+'-cerrados.png')});}
 for(const id of ['rx7','r32','s2000','supra','civic','r8']){const result=await page.evaluate(id=>window.catalogShot(id,{build:{color:'#487fa5',hood:'carbon',vinyl:'twin',spoiler:'gt',wheels:'gold'}}),id);assert.equal(result.error,0);await page.screenshot({path:path.resolve('screenshots/catalogo',id+'-mejorado.png')});}
 await page.setViewportSize({width:1920,height:1080});const race=await page.evaluate(()=>window.catalogRace());assert.equal(race.error,0);assert.ok(race.files.includes('rx7')&&race.files.includes('r34')&&race.files.includes('ferrari488')&&race.files.includes('civic'));assert.ok(race.files.length<=8);await page.screenshot({path:path.resolve('screenshots/catalogo/cuatro-modelos-carrera.png')});
 const registered=await page.request.post(base+'/api/register',{data:{username:'FleetModel24',password:'FleetModelPassword24'}});assert.equal(registered.status(),200);const account=await registered.json();assert.equal((await page.request.patch(base+'/api/profile',{headers:{'X-CSRF-Token':account.csrf},data:{complete:true,defaultCar:'rx7'}})).status(),200);
 await page.addInitScript(()=>localStorage.setItem('touge-settings',JSON.stringify({car:1,camera:'0',daytime:'day',quality:'1',autoQuality:false,performanceDisplay:'off'})));
 await page.goto(base);await page.waitForFunction(()=>window.touge?.models.assets.some(a=>a.file==='rx7'&&a.status==='ready'));await page.waitForFunction(()=>document.getElementById('auth-gate').classList.contains('hidden'));await page.keyboard.press('Enter');await page.locator('#main-menu-actions [data-action=garage]').click();await page.waitForFunction(()=>window.touge.state.screen==='garage');await page.screenshot({path:path.resolve('screenshots/catalogo/rx7-garaje-real.png')});
 await page.locator('#header .brand').click();await page.locator('#main-menu-actions [data-action=offline]').click();await page.locator('#mode').selectOption('time');await page.locator('#start').click();await page.waitForFunction(()=>window.touge.state.screen==='race');await page.keyboard.press('h');await page.waitForFunction(()=>window.touge.models.instances.some(v=>v.key==='rx7'&&v.opening<.02));await page.keyboard.press('h');await page.waitForFunction(()=>window.touge.models.instances.some(v=>v.key==='rx7'&&v.opening>.98));await page.screenshot({path:path.resolve('screenshots/catalogo/rx7-carrera-real.png')});
 for(let i=0;i<3;i++)await page.keyboard.press('c');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.getElementById('world').getContext('webgl').getError()),0);await page.keyboard.press('Escape');await page.locator('#pause-panel [data-action=quit]').click();await page.waitForFunction(()=>window.touge.state.screen==='menu'&&window.touge.state.showcase.active);assert.equal((await page.evaluate(()=>window.touge.state.showcase)).triangles,90362);
 assert.deepEqual(errors,[]);console.log('CATALOG GPU OK',selected.length,'cars',JSON.stringify(race),'real RX7 garage/race/H/interior/menu OK');
}finally{await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(r=>server.close(r));store.close();}
