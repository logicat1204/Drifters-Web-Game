// Disposable browser QA: real AI controls, production WebGL and no saved runs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
process.env.DB_BACKEND='sqlite';process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const {server,store}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:730}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('screenshots/ai-driving',{recursive:true});
try{
 await page.goto(base+'/api/health');
 await page.evaluate(async()=>{
  const [{Renderer},sim]=await Promise.all([import('/js/renderer.js'),import('/js/sim.mjs')]);
  document.body.innerHTML='<main><canvas></canvas><header><small>PRUEBA DE CONDUCCIÓN · AKINA</small><h1></h1></header><footer></footer></main>';
  document.head.insertAdjacentHTML('beforeend','<style>html,body{margin:0;background:#090d12;color:white;font-family:Arial}main{position:relative;margin:30px;width:1040px;height:650px;overflow:hidden}canvas{width:100%;height:100%}header{position:absolute;top:24px;left:28px;text-shadow:0 2px 4px black}small{font:11px monospace;letter-spacing:2px}h1{font-size:30px;font-weight:400}footer{position:absolute;bottom:0;left:0;right:0;padding:20px 28px;background:#090d12d9;font:12px monospace}</style>');
  const renderer=new Renderer(document.querySelector('canvas')),track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id==='akina'));
  renderer.quality=1;renderer.cameraMode=1;renderer.setTrack(track);renderer.setCar(sim.CARS[0]);
  const point=track.points.find(p=>p.s>600&&Math.abs(p.curve)>.018&&Math.abs(p.curve)<.025&&Math.sign(sim.sample(track,p.s+15).curve)===Math.sign(p.curve));
  window.drivingPreview=async style=>{
   const car=sim.CARS.find(c=>c.id===({Grip:'r32',Complete:'rx7',Skiller:'ae86'}[style])),rival={id:'preview-'+style,style,level:3,car:car.id,color:car.color};
   const o=sim.createRace(sim.rivalCar(rival),track,{mode:'time',rival,aiDriver:rival,focusEnabled:false});Object.assign(o,{countdown:0,lateral:0,timeLeft:10000});
   const sensed={rival,s:-1000,speed:0,lateral:0},view=sim.createRace(sim.CARS[0],track,{rival,night:false});renderer.setRival(rival);renderer.particles=[];
   while(o.s<point.s)sim.updateRace(o,sim.rivalDriverInput(sensed,o,1/120),1/120);
   let smoke=0,peakParticles=0;
   for(let frame=0;frame<90;frame++){
    for(let i=0;i<2;i++)sim.updateRace(o,sim.rivalDriverInput(sensed,o,1/120),1/120);
    Object.assign(view,{s:o.s-14,lateral:0,speed:o.speed,countdown:0,yaw:0,rivalS:o.s,rivalSpeed:o.speed,rivalLateral:o.lateral,rivalYaw:o.yaw,rivalSteer:o.steer,rivalBraking:o.braking,rivalDrift:o.drift,rivalSlip:o.slipAngle});
    renderer.resetCamera=true;renderer.render(view,'race',1/60,{day:true,shake:false});
    smoke=Math.max(smoke,renderer.particles.filter(p=>!p.wet).length);peakParticles=Math.max(peakParticles,renderer.particles.length);
    await new Promise(requestAnimationFrame);
   }
   document.querySelector('h1').textContent=({Grip:'GRIP · TRAZADA ESTABLE',Complete:'BALANCE · ROTACIÓN MODERADA',Skiller:'SKILLER · DERRAPE CONTROLADO'}[style]);
   document.querySelector('footer').textContent=`Velocidad: ${Math.round(o.speed*3.6)} km/h · Rotación: ${(Math.abs(o.slipAngle)*180/Math.PI).toFixed(1)}° · Presión de freno: ${Math.round(o.brakePressure*100)}%`;
   return {style,smoke,peakParticles,gl:renderer.gl.getError(),rotation:Math.abs(o.slipAngle),s:o.s};
  };
 });
 const results=[];
 for(const style of ['Grip','Complete','Skiller']){
  const result=await page.evaluate(style=>window.drivingPreview(style),style);assert.equal(result.gl,0);assert.ok(result.peakParticles<=48);results.push(result);
  await page.screenshot({path:path.resolve('screenshots/ai-driving',style+'.png')});
 }
 assert.ok(results.find(r=>r.style==='Skiller').smoke>0,'real dry Skiller drift emits tire wisps');assert.equal(results.find(r=>r.style==='Grip').smoke,0,'grip steering does not invent a drift trail');
 assert.deepEqual(errors,[]);console.log('AI DRIVING VISUAL OK',JSON.stringify(results));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
