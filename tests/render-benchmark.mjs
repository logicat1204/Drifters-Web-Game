// Fixed production-renderer workload. gl.finish is confined to this benchmark:
// its timings include GPU completion and are not the in-game FPS counter.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,label=process.argv[2]||'current';
assert.match(label,/^[a-z0-9-]+$/i);
await mkdir('data',{recursive:true});await mkdir('screenshots',{recursive:true});
const software=process.env.RENDER_BACKEND!=='native';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:software?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]}),page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/api/health');
 await page.evaluate(async origin=>{
  const [{Renderer},{Cockpit},{CornerEffects},sim,campaign]=await Promise.all([import(origin+'/js/renderer.js'),import(origin+'/js/cockpit.js'),import(origin+'/js/effects.js'),import(origin+'/js/sim.mjs'),import(origin+'/js/campaign.mjs')]);
  document.body.innerHTML='<canvas id="world"></canvas><canvas id="cab"></canvas><canvas id="fx"></canvas>';
  const style=document.createElement('style');style.textContent='html,body{margin:0;background:#000}canvas{position:absolute;inset:0;width:100%;height:100%}.hidden{display:none}';document.head.append(style);
  const renderer=new Renderer(document.getElementById('world')),cockpit=new Cockpit(document.getElementById('cab')),effects=new CornerEffects(document.getElementById('fx'));renderer.quality=1;await renderer.atlasReady;
  const gl=renderer.gl,draw=gl.drawArrays.bind(gl),read=gl.readPixels.bind(gl);let calls=0,vertices=0,reads=0;
  gl.drawArrays=(mode,first,count)=>{calls++;vertices+=count;return draw(mode,first,count);};gl.readPixels=(...args)=>{reads++;return read(...args);};
  window.benchmark=async config=>{
   const track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id===config.track)),rival=campaign.CAMPAIGN_STAGES.find(s=>s.id===config.rival)||campaign.CAMPAIGN_STAGES[0];
   renderer.setTrack(track);renderer.setCar(sim.CARS[0]);renderer.setRival(rival);renderer.cameraMode=config.camera||0;renderer.resetCamera=true;
   const r=sim.createRace(sim.CARS[0],track,{rival,night:!config.day,wet:!!config.wet,fog:!!config.fog});Object.assign(r,{s:650,speed:40,countdown:0,rivalS:675,rivalLateral:1.5,rivalYaw:.1});
   if(config.online){r.mode='time';r.netOpponents=['rx7','r32','s2000'].map((carId,i)=>({carId,s:665+i*15,lateral:i%2?2:-2,yaw:0,headlights:true}));renderer.setNetworkPlayers(r.netOpponents.map(p=>({car:p.carId})));}
   if(r.boss)Object.assign(r.boss,{enraged:true,boost:4,ray:.8,blur:1,wings:1,flow:1});
   if(config.focus){r.focus.remaining=3;r.skill.intensity=.7;r.drift=.8;}
   const render=()=>{renderer.render(r,'race',1/60,{day:!!config.day,shake:false});cockpit.draw(r,renderer.cameraMode===3,1/60,{gpuMirror:renderer.mirrorReady,mirror:renderer.mirrorCanvas});effects.draw(r,true,1/60,true);};
   const pixel=new Uint8Array(4),sync=()=>{gl.finish();read(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);};
   for(let i=0;i<5;i++){render();sync();}
   calls=vertices=reads=0;const samples=[];
   for(let i=0;i<24;i++){r.s=650+i*1.2;r.rivalS=r.s+25;const start=performance.now();render();sync();samples.push(performance.now()-start);await new Promise(resolve=>setTimeout(resolve,0));}
   samples.sort((a,b)=>a-b);const ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {name:config.name,medianMs:samples[12],p95Ms:samples[22],drawCalls:Math.round(calls/24),vertices:Math.round(vertices/24),mirrorReadbacks:reads,sceneVertices:renderer.scene.count,resolution:[gl.drawingBufferWidth,gl.drawingBufferHeight],gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',error:gl.getError()};
  };
 },origin);
 const results=[];
 for(const config of [
  {name:'akina-night',track:'akina'},
  {name:'cockpit-night',track:'akina',camera:3},
  {name:'ashinoko-rain-fog',track:'ashinoko',day:true,wet:true,fog:true},
  {name:'manazuru-boss',track:'manazuru',rival:'kanata-final',day:true,focus:true},
  {name:'online-four',track:'akagi',online:true}
 ]){const result=await page.evaluate(config=>window.benchmark(config),config);assert.equal(result.error,0);results.push(result);if(['cockpit-night','ashinoko-rain-fog','manazuru-boss'].includes(config.name))await page.screenshot({path:path.resolve('screenshots',`rendimiento-${label}-${config.name}.png`)});}
 assert.deepEqual(errors,[]);await writeFile(path.resolve('data',`render-benchmark-${label}.json`),JSON.stringify({label,environment:`Headless Edge / ${software?'SwiftShader software':'native backend (see GPU field)'} / 960x600 / 24 synchronized frames per scenario`,results},null,2));
 console.log(JSON.stringify(results.map(({name,medianMs,p95Ms,drawCalls,vertices,mirrorReadbacks})=>({name,medianMs,p95Ms,drawCalls,vertices,mirrorReadbacks})),null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
