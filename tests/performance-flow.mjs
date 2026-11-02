// Real menu/drive flow, followed by pixel comparisons of culled vs full geometry.
// All accounts and attempts exist only in the disposable in-memory server.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store,online}=await import('../server.mjs');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const viewport={width:Number(process.env.PERF_WIDTH)||1100,height:Number(process.env.PERF_HEIGHT)||730};
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 const response=await context.request.post(origin+'/api/register',{data:{username:'FpsPilot24',password:'FpsPassword24'}});assert.equal(response.status(),200);const account=await response.json();
 assert.equal((await context.request.patch(origin+'/api/profile',{headers:{'X-CSRF-Token':account.csrf},data:{displayName:'FPS Test',complete:true}})).status(),200);
 await page.addInitScript(()=>{
  if(!localStorage.getItem('touge-settings'))localStorage.setItem('touge-settings',JSON.stringify({quality:'1',camera:'3',autoQuality:true,performanceDisplay:'detailed'}));
  const get=HTMLCanvasElement.prototype.getContext;window.__mirrorReadbacks=0;
  HTMLCanvasElement.prototype.getContext=function(...args){const ctx=get.apply(this,args);if(args[0]==='webgl'&&ctx&&!ctx.__countReads){ctx.__countReads=true;const read=ctx.readPixels.bind(ctx);ctx.readPixels=(...values)=>{window.__mirrorReadbacks++;return read(...values);};}return ctx;};
 });
 await page.goto(origin);await page.waitForFunction(()=>window.touge?.performance.samples>20);await page.waitForFunction(()=>document.getElementById('auth-gate').classList.contains('hidden'));
 assert.ok(await page.locator('#performance-overlay').isVisible());await page.keyboard.press('Enter');
 await page.locator('#main-menu-actions [data-action=settings]').click();assert.equal(await page.locator('#auto-quality').isChecked(),true);assert.equal(await page.locator('#performance-display').inputValue(),'detailed');
 await page.locator('#auto-quality').uncheck();await page.locator('#performance-display').selectOption('off');assert.equal(await page.locator('#performance-overlay').isVisible(),false);
 await page.locator('#settings-panel [data-action=close]').click();await page.keyboard.press('F8');assert.equal(await page.locator('#performance-overlay').isVisible(),true);await page.keyboard.press('F8');assert.equal(await page.locator('#performance-details').isVisible(),true);
 await page.locator('#main-menu-actions [data-action=offline]').click();await page.locator('#mode').selectOption('time');await page.locator('#start').click();await page.waitForFunction(()=>window.touge?.state.screen==='race');await page.waitForFunction(()=>window.touge.state.race.countdown===0,null,{timeout:30000});
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.touge.state.race.speed>8);await page.waitForFunction(()=>window.touge.state.race.elapsed>=10,null,{timeout:30000});await page.keyboard.up('ArrowUp');
 await page.waitForFunction(()=>window.touge.performance.samples>30);const telemetry=await page.evaluate(()=>window.touge.performance);
 assert.ok(telemetry.fps>0&&telemetry.frameMs>0&&telemetry.p95Ms>=telemetry.frameMs*.5);assert.ok(telemetry.vertices>0&&telemetry.drawCalls>0&&telemetry.width>0);assert.equal(telemetry.scale,1);assert.equal(telemetry.automatic,false);assert.equal(await page.evaluate(()=>window.__mirrorReadbacks),0,'production driving performs zero GPU readbacks');
 const poses=await page.evaluate(()=>new Promise(resolve=>{const samples=[];const frame=()=>{const p=window.touge.presentation,r=window.touge.state.race;samples.push({physical:r.s,visual:p.s,alpha:p.alpha});if(samples.length>=30)resolve(samples);else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));
 assert.ok(poses.some(p=>Math.abs(p.physical-p.visual)>.000001),'production frame must use interpolation');for(const p of poses){assert.ok(p.alpha>=0&&p.alpha<=1);assert.ok(p.physical-p.visual>=-.0001&&p.physical-p.visual<1.2);}
 await page.screenshot({path:path.resolve('screenshots/rendimiento-monitor-interior.png')});
 await page.keyboard.press('c');await page.waitForTimeout(300);await page.screenshot({path:path.resolve('screenshots/movimiento-tercera-persona.png')});await page.keyboard.press('z');await page.waitForFunction(()=>window.touge.state.race.speed===0&&window.touge.presentation.lateral===0);
 await page.keyboard.press('Escape');await page.locator('#pause-panel [data-action=quit]').click();await page.locator('#main-menu-actions [data-action=settings]').click();await page.locator('#auto-quality').check();await page.locator('#settings-panel [data-action=close]').click();
 await page.reload();await page.waitForFunction(()=>window.touge?.performance.samples>10);assert.equal(await page.evaluate(()=>window.touge.performance.display),'detailed');assert.equal(await page.evaluate(()=>window.touge.performance.automatic),true);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);const overlay=await page.locator('#performance-overlay').boundingBox();assert.ok(overlay.x>=0&&overlay.x+overlay.width<=391&&overlay.y>=0&&overlay.y+overlay.height<=845);await page.screenshot({path:path.resolve('screenshots/rendimiento-monitor-movil.png')});
 // A navigation stops the game's animation loop before isolated render checks.
 await page.setViewportSize({width:960,height:600});await page.goto(origin+'/api/health');
 await page.evaluate(async origin=>{
  const [{Renderer},sim,{CAMPAIGN_STAGES},performanceModule]=await Promise.all([import(origin+'/js/renderer.js'),import(origin+'/js/sim.mjs'),import(origin+'/js/campaign.mjs'),import(origin+'/js/render-performance.mjs')]);
  document.body.innerHTML='<canvas id="world" style="width:100vw;height:100vh;display:block"></canvas>';document.body.style.margin='0';
  const renderer=new Renderer(document.getElementById('world')),gl=renderer.gl,rawRead=gl.readPixels.bind(gl);renderer.quality=1;renderer.setCar(sim.CARS[0]);await renderer.atlasReady;let reads=0;gl.readPixels=(...args)=>{reads++;return rawRead(...args);};
  const pixels=()=>{const result=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);rawRead(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,result);return result;};
  window.checkVisibility=({id,camera,day,fog})=>{
   const track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id===id)),rival=CAMPAIGN_STAGES.find(s=>s.track===id)||CAMPAIGN_STAGES[0];renderer.setTrack(track);renderer.setRival(rival);renderer.cameraMode=camera;
   const r=sim.createRace(sim.CARS[0],track,{rival,night:!day,wet:!!fog,fog:!!fog});Object.assign(r,{s:track.length*.45,speed:35,countdown:0,rivalS:track.length*.45+25,rivalLateral:1.8});
   const render=culling=>{renderer.culling=culling;renderer.resetCamera=true;renderer.mirrorTime=-1;renderer.particles=[];renderer.render(r,'race',0,{day,shake:false});return {pixels:pixels(),vertices:renderer.stats.vertices};};
   const full=render(false),culled=render(true);let difference=0;for(let i=0;i<full.pixels.length;i+=4)if(Math.max(Math.abs(full.pixels[i]-culled.pixels[i]),Math.abs(full.pixels[i+1]-culled.pixels[i+1]),Math.abs(full.pixels[i+2]-culled.pixels[i+2]))>4)difference++;
   const total=renderer.scene.chunks.reduce((n,c)=>n+c.count,6);
   return {id,camera,ratio:difference/(full.pixels.length/4),full:full.vertices,culled:culled.vertices,total,scene:renderer.scene.count,error:gl.getError(),reads};
  };
  window.checkMirror=(scale=1)=>{
   renderer.resolutionScale=scale;
   const track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id==='akina')),rival=CAMPAIGN_STAGES[0];renderer.setTrack(track);renderer.setRival(rival);renderer.cameraMode=3;
   const r=sim.createRace(sim.CARS[0],track,{rival,night:false});Object.assign(r,{s:100,speed:0,countdown:0,rivalS:86,rivalLateral:1.8});
   const render=visible=>{r.mode=visible?'battle':'time';renderer.resetCamera=true;renderer.mirrorTime=-1;renderer.render(r,'race',0,{day:true,shake:false});return pixels();};
   const on=render(true),off=render(false),bw=gl.drawingBufferWidth,bh=gl.drawingBufferHeight,cw=renderer.canvas.clientWidth,ch=renderer.canvas.clientHeight,m=performanceModule.mirrorLayout(cw,ch),x=Math.round(m.x*m.scale*bw/cw),y=Math.round(m.y*m.scale*bh/ch),w=Math.floor(m.width*m.scale*bw/cw),h=Math.floor(m.height*m.scale*bh/ch);let changed=0;
   for(let py=y+2;py<y+h-2;py++)for(let px=x+2;px<x+w-2;px++){const i=((bh-1-py)*bw+px)*4;if(Math.max(Math.abs(on[i]-off[i]),Math.abs(on[i+1]-off[i+1]),Math.abs(on[i+2]-off[i+2]))>6)changed++;}
   return {changed,reads,error:gl.getError(),width:bw,height:bh};
  };
 },origin);
 const comparisons=[];
 const tracks=await page.evaluate(async origin=>(await import(origin+'/js/sim.mjs')).ALL_TRACKS.map(t=>t.id),origin);
 for(const id of tracks){
  for(const camera of [0,3]){const comparison=await page.evaluate(config=>window.checkVisibility(config),{id,camera,day:id!=='akina',fog:id==='ashinoko'});assert.equal(comparison.error,0);assert.equal(comparison.reads,0);assert.equal(comparison.total,comparison.scene);assert.ok(comparison.ratio<.002,JSON.stringify(comparison));assert.ok(comparison.culled<comparison.full,JSON.stringify(comparison));comparisons.push(comparison);}
 }
 const mirrors=[];
 for(const viewport of [{width:960,height:600},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);for(const scale of [1,.65]){const mirror=await page.evaluate(scale=>window.checkMirror(scale),scale);assert.equal(mirror.error,0);assert.equal(mirror.reads,0);assert.ok(mirror.changed>15,'a real car behind must appear in the GPU-composited mirror: '+JSON.stringify(mirror));assert.equal(mirror.width,Math.round(viewport.width*scale));mirrors.push(mirror);}
 }
 assert.deepEqual(errors,[]);
 console.log('PERFORMANCE OK:',JSON.stringify({telemetry,pixelComparisons:comparisons.length,maxPixelDifference:Math.max(...comparisons.map(c=>c.ratio)),mirrors}));
}finally{await context.close();await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();}
