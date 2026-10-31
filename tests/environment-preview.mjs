import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store}=await import('../server.mjs');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
await mkdir('screenshots',{recursive:true});await mkdir('data',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='software'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/api/health');await page.evaluate(async origin=>{
  const [{Renderer},sim,{Cockpit},{CornerEffects},{CAMPAIGN_STAGES}]=await Promise.all([import(origin+'/js/renderer.js'),import(origin+'/js/sim.mjs'),import(origin+'/js/cockpit.js'),import(origin+'/js/effects.js'),import(origin+'/js/campaign.mjs')]);
  document.body.innerHTML='<canvas id="world"></canvas><canvas id="cab"></canvas><canvas id="rain"></canvas><div id="label"></div>';const style=document.createElement('style');style.textContent='html,body{margin:0;background:#111}canvas{position:absolute;inset:0;width:100%;height:100%}.hidden{display:none}#label{position:absolute;left:28px;bottom:24px;padding:12px 18px;background:#08121bdd;color:#eee;font:12px monospace;letter-spacing:1px}';document.head.append(style);
  const renderer=new Renderer(document.getElementById('world')),cab=new Cockpit(document.getElementById('cab')),rain=new CornerEffects(document.getElementById('rain'));renderer.quality=1;renderer.setCar(sim.CARS[0]);await renderer.atlasReady;let active=null,activeConfig=null;
  window.environmentShot=({id,t=.18,day=true,camera=0,tunnel=false,fog=false})=>{
   const track=sim.makeTrack(sim.ALL_TRACKS.find(c=>c.id===id)),rival=CAMPAIGN_STAGES.find(s=>s.track===id)||CAMPAIGN_STAGES[0];renderer.setTrack(track);renderer.setRival(rival);renderer.cameraMode=camera;
   const r=sim.createRace(sim.CARS[0],track,{rival,night:!day,wet:fog,fog}),s=tunnel?(renderer.environment.tunnels[0]?.start??track.length*t)+70:track.length*t;Object.assign(r,{s,countdown:0,speed:32,lateral:0,rivalS:s+35,rivalLateral:1.2});if(r.opponent)Object.assign(r.opponent,{s:s+35,speed:32,countdown:0,lateral:1.2});active=r;activeConfig={day,camera};renderer.resetCamera=true;renderer.render(r,'race',.05,{day,shake:false});cab.draw(r,camera===3,.05,{gpuMirror:renderer.mirrorReady});rain.draw(r,true,.05,true);document.getElementById('label').textContent=`${track.name} / ${renderer.environment.profile.name.toUpperCase()}${tunnel?' / TÚNEL':''}`;
   return {id,atlas:renderer.atlasLoaded,error:renderer.gl.getError(),counts:renderer.environment.counts,vertices:renderer.scene.count,visibleVertices:renderer.stats.vertices,chunks:renderer.stats.chunks,tunnels:renderer.environment.tunnels};
  };
  window.environmentFps=async()=>{
   const [{FrameMonitor},{driverInput}]=await Promise.all([import(origin+'/js/render-performance.mjs'),import(origin+'/tests/helpers/reference-driver.mjs')]),monitor=new FrameMonitor();let previous=null,accumulator=0,count=0;
   return new Promise(resolve=>{const frame=now=>{const start=performance.now(),dt=previous===null?0:Math.min(.1,(now-previous)/1000);previous=now;accumulator+=dt;while(accumulator>=1/120){sim.updateRace(active,driverInput(active),1/120);accumulator-=1/120;}renderer.render(active,'race',Math.min(.05,dt),{day:activeConfig.day,shake:false});cab.draw(active,activeConfig.camera===3,dt,{gpuMirror:renderer.mirrorReady});rain.draw(active,true,dt,true);monitor.record(now,performance.now()-start,renderer.stats);if(++count>=300)resolve(monitor.snapshot());else requestAnimationFrame(frame);};requestAnimationFrame(frame);});
  };
 },origin);
 const results=[];
 for(const [name,config]of Object.entries({
  'akina-bosque':{id:'akina',t:.18},'akina-noche':{id:'akina',t:.18,day:false,camera:3},'irohazaka-otono':{id:'iroha',t:.36},'usui-puente':{id:'usui',t:.265},'tsukuba-huertos':{id:'tsukuba',t:.49},'atami-ciudad':{id:'atami',t:.07},'atami-noche':{id:'atami',t:.07,day:false},'akagi-tunel':{id:'akagi',tunnel:true,camera:1},'manazuru-costa':{id:'manazuru',t:.58},'ashinoko-niebla':{id:'ashinoko',t:.08,fog:true},'ashinoko-ribera':{id:'ashinoko',t:.08},'odawara-pueblo':{id:'odawara',t:.04},'tsubaki-bosque':{id:'tsubaki',t:.24}
 })){const result=await page.evaluate(config=>window.environmentShot(config),config);assert.equal(result.error,0);assert.equal(result.atlas,true);assert.ok(result.visibleVertices<result.vertices);results.push({name,...result});if(process.env.ENVIRONMENT_FPS!=='1'){const bytes=await page.screenshot();let saved=false;for(let retry=0;retry<4&&!saved;retry++){try{await writeFile(path.resolve('screenshots','entorno-'+name+'.png'),bytes);saved=true;}catch(error){if(retry===3)throw error;await new Promise(resolve=>setTimeout(resolve,200));}}}}
 assert.deepEqual(errors,[]);await writeFile('data/environment-preview.json',JSON.stringify(results,null,2));console.log('ENVIRONMENT OK:',JSON.stringify(results.map(({name,visibleVertices,vertices,counts,tunnels})=>({name,visibleVertices,vertices,trees:Object.entries(counts).filter(([k])=>k.startsWith('tree')).reduce((n,[,v])=>n+v,0),tunnels:tunnels.length}))));
 if(process.env.ENVIRONMENT_FPS==='1'){
  await page.setViewportSize({width:1920,height:1080});const performance=[];
  for(const config of [{id:'akina',t:.18,day:false,camera:3},{id:'iroha',t:.36},{id:'atami',t:.07,day:false},{id:'akagi',tunnel:true,camera:1},{id:'ashinoko',t:.08,fog:true}]){await page.evaluate(config=>window.environmentShot(config),config);const metrics=await page.evaluate(()=>window.environmentFps());performance.push({config,...metrics});assert.ok(metrics.fps>0);console.log('ENVIRONMENT FPS:',JSON.stringify({config,...metrics}));}
  await writeFile('data/environment-fps.json',JSON.stringify(performance,null,2));assert.deepEqual(errors,[]);
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
