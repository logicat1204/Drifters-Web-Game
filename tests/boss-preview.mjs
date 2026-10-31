// Isolated visual fixture: renders the production renderer/effects, never posts runs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1100,height:730}});
try{
 await page.goto(base+'/api/health');
 await page.evaluate(async origin=>{
   const [{Renderer},{CornerEffects},sim,campaign]=await Promise.all([import(origin+'/js/renderer.js'),import(origin+'/js/effects.js'),import(origin+'/js/sim.mjs'),import(origin+'/js/campaign.mjs')]);
   document.body.innerHTML='<div id="preview"><canvas id="world"></canvas><canvas id="fx"></canvas><header><span>JEFES DE CAMPAÑA / VISUAL QA</span><h1 id="name"></h1></header><footer id="description"></footer></div>';
   const style=document.createElement('style');style.textContent='html,body{margin:0;background:#090e16;color:#fff;font-family:Arial}#preview{position:relative;width:1040px;height:650px;margin:30px;overflow:hidden}canvas{position:absolute;inset:0;width:100%;height:100%;display:block}header{position:absolute;left:34px;top:30px;text-shadow:0 2px 8px #000}header span{font:10px monospace;letter-spacing:2px}h1{font-size:38px;font-weight:400;margin:14px 0}footer{position:absolute;left:0;right:0;bottom:0;padding:25px 34px;background:#050b14bb;font:12px monospace;line-height:1.8}';document.head.append(style);
   const renderer=new Renderer(document.getElementById('world')),effects=new CornerEffects(document.getElementById('fx')),track=sim.makeTrack(sim.TRACKS[0]);renderer.setTrack(track);renderer.setCar(sim.CARS[0]);
   window.renderFocusFixture=id=>{
     const rival=campaign.CAMPAIGN_STAGES.find(s=>s.id===id),track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id===rival.track));renderer.setTrack(track);renderer.setRival(rival);
     const r=sim.createRace(sim.CARS[0],track,{rival,night:true});Object.assign(r,{s:650,speed:35,countdown:0,elapsed:22,rivalS:661,rivalLateral:.2,rivalYaw:.16});Object.assign(r.boss,{ray:.8,blur:1,wings:1.6,flow:2,enraged:true,boost:6});if(id==='kanata-final')Object.assign(r,{rivalS:r.s-5,rivalLateral:-2.5});renderer.cameraMode=window.bossCamera||0;renderer.resetCamera=true;renderer.render(r,'race',.02,{day:rival.index>=14,shake:false});
     if(renderer.gl.getError()!==renderer.gl.NO_ERROR)throw Error('WebGL boss draw failed');
     document.getElementById('name').textContent=rival.short;document.getElementById('name').style.color=rival.signature.color;document.getElementById('description').textContent=rival.signature.name+' / '+rival.signature.description;
   };
   window.renderKanataChase=async recovered=>{
     const {updateBossState}=await import(origin+'/js/bosses.mjs'),rival=campaign.CAMPAIGN_STAGES.find(s=>s.id==='kanata-final'),track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id===rival.track));
     const r=sim.createRace(sim.CARS[0],track,{rival,night:false});Object.assign(r,{s:650,speed:45,countdown:0,elapsed:22});
     r.opponent=sim.createRace(sim.rivalCar(rival),track,{mode:'time',aiDriver:rival});Object.assign(r.opponent,{s:660,speed:42,countdown:0,lateral:-2.5});
     updateBossState(r,.01,0);r.opponent.s=645;updateBossState(r,.01,0);for(let i=0;i<15;i++)updateBossState(r,.05,0);
     if(recovered){r.opponent.s=660;for(let i=0;i<100;i++)updateBossState(r,.01,0);}
     Object.assign(r,{rivalS:r.opponent.s,rivalSpeed:42,rivalLateral:-2.5,rivalYaw:0});
     renderer.setTrack(track);renderer.setCar(sim.CARS[0]);renderer.setRival(rival);renderer.cameraMode=0;renderer.resetCamera=true;
     let draws=0;const original=renderer.draw;renderer.draw=function(mesh,...args){if(mesh===this.bossCrimson)draws++;return original.call(this,mesh,...args);};
     try{renderer.render(r,'race',.02,{day:true,shake:false});}finally{renderer.draw=original;}
     document.getElementById('name').textContent=recovered?'KANATA / POSICIÓN RECUPERADA':'KANATA / CONTRAATAQUE';document.getElementById('name').style.color=recovered?'#d7e2ed':rival.signature.color;
     document.getElementById('description').textContent=recovered?'Un segundo delante: carmesí e impulso desactivados.':'Adelantado: aura carmesí activa durante la persecución.';
     return {enraged:r.boss.enraged,boost:r.boss.boost,draws,counter:r.opponent.aiDriver.counter};
   };
 },base);
 for(const type of ['shinji-campaign','takumi-project','keisuke-project','beckenbauer','kanata-final']){await page.evaluate(type=>window.renderFocusFixture(type),type);await page.locator('#preview').screenshot({path:path.join(path.dirname(fileURLToPath(import.meta.url)),'../screenshots/boss-'+type+'.png')});}

 for(const recovered of [false,true]){const state=await page.evaluate(recovered=>window.renderKanataChase(recovered),recovered);assert.equal(state.enraged,!recovered);assert.equal(state.draws,recovered?0:1);if(recovered){assert.equal(state.boost,0);assert.equal(state.counter,null);}await page.locator('#preview').screenshot({path:path.join(path.dirname(fileURLToPath(import.meta.url)),'../screenshots/kanata-'+(recovered?'normal':'carmesi')+'.png')});}
 await page.emulateMedia({reducedMotion:'reduce'});for(const camera of [1,2,3]){await page.evaluate(camera=>{window.bossCamera=camera;},camera);await page.evaluate(()=>window.renderFocusFixture('kanata-final'));}
 console.log('BOSS VISUAL OK: cinco firmas y apagado de Kanata verificados con WebGL.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
