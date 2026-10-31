// Compares the former generic fog with Ashinoko's production profile and checks
// actual GPU visibility of near/far rivals in all four cameras. No saved races.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store}=await import('../server.mjs');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');await mkdir(path.join(root,'screenshots'),{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1100,height:730}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/api/health');await page.evaluate(async origin=>{
  const [{Renderer},{Cockpit},sim,{CAMPAIGN_STAGES},{CornerEffects}]=await Promise.all([import(origin+'/js/renderer.js'),import(origin+'/js/cockpit.js'),import(origin+'/js/sim.mjs'),import(origin+'/js/campaign.mjs'),import(origin+'/js/effects.js')]);
  document.body.innerHTML='<div id="preview"><canvas id="world"></canvas><canvas id="rain"></canvas><canvas id="cab"></canvas><header><small>LAKE ASHINOKO GT / VISIBILIDAD</small><h1 id="label"></h1></header><footer>El tramo cercano de pista sigue visible. La niebla oculta las curvas y los coches lejanos.</footer></div>';
  const css=document.createElement('style');css.textContent='html,body{margin:0;background:#0b1018;color:#fff;font-family:Arial}#preview{width:1040px;height:650px;margin:30px;position:relative;overflow:hidden}canvas{position:absolute;inset:0;width:100%;height:100%}header{position:absolute;left:28px;top:24px;text-shadow:0 2px 6px #253342}header small{font:10px monospace;letter-spacing:1px}h1{font-size:32px;font-weight:400}footer{position:absolute;left:0;right:0;bottom:0;background:#142131da;padding:20px 28px;font:11px/1.7 monospace}';document.head.append(css);
  const track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id==='ashinoko')),rival=CAMPAIGN_STAGES.find(s=>s.id==='sakamoto'),renderer=new Renderer(document.getElementById('world')),cockpit=new Cockpit(document.getElementById('cab')),rain=new CornerEffects(document.getElementById('rain'));
  renderer.setTrack(track);renderer.setCar(sim.CARS[0]);renderer.setRival(rival);await renderer.atlasReady;
  const render=(camera,dense,s=700,gap=25,visible=true)=>{
   // Same road geometry. Only the former generic atmosphere is selected for comparison.
   const r=sim.createRace(sim.CARS[0],dense?track:{...track,id:'fog-reference'},{rival,wet:true,fog:true,night:false,mode:visible?'battle':'time'});Object.assign(r,{s,lateral:0,speed:40,rivalS:s+gap,rivalLateral:1.5,rivalYaw:0,countdown:0});
   renderer.cameraMode=camera;renderer.resetCamera=true;renderer.render(r,'race',.05,{day:true,shake:false});
   return r;
  };
  window.fogShot=(camera,dense)=>{const r=render(camera,dense);cockpit.draw(r,camera===3,.05,{gpuMirror:renderer.mirrorReady});rain.draw(r,true,.05,true);document.getElementById('label').textContent=dense?'NIEBLA DENSA':'VISIBILIDAD ANTERIOR';return {near:renderer.gl.getUniform(renderer.program,renderer.uniforms.uFogStart),far:renderer.gl.getUniform(renderer.program,renderer.uniforms.uFogEnd),error:renderer.gl.getError()};};
  window.measureFog=(camera,dense,gap)=>{
   const capture=visible=>{render(camera,dense,100,gap,visible);const gl=renderer.gl,data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
   const on=capture(true),off=capture(false);let changed=0;for(let i=0;i<on.length;i+=4)if(Math.max(Math.abs(on[i]-off[i]),Math.abs(on[i+1]-off[i+1]),Math.abs(on[i+2]-off[i+2]))>4)changed++;
   return {changed,error:renderer.gl.getError()};
  };
 },origin);
 for(const camera of [0,1,2,3]){
  const old=await page.evaluate(camera=>window.measureFog(camera,false,90),camera),far=await page.evaluate(camera=>window.measureFog(camera,true,90),camera),near=await page.evaluate(camera=>window.measureFog(camera,true,18),camera);
  assert.equal(old.error,0);assert.equal(far.error,0);assert.equal(near.error,0);assert.ok(old.changed>10,'old far rival should be visible: '+camera);assert.equal(far.changed,0,'dense fog should hide the far rival: '+camera);assert.ok(near.changed>30,'near rival stays visible: '+camera);
 }
 for(const [camera,name]of [[0,'persecucion'],[3,'interior']])for(const dense of [false,true]){const state=await page.evaluate(({camera,dense})=>window.fogShot(camera,dense),{camera,dense});assert.equal(state.error,0);assert.ok(dense?state.far<80:state.far>150);await page.locator('#preview').screenshot({path:path.join(root,'screenshots',`ashinoko-${name}-${dense?'densa':'antes'}.png`)});}
 assert.deepEqual(errors,[]);console.log('ASHINOKO FOG OK: far rival hidden, nearby rival readable, all four cameras and cockpit mirror render correctly.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
