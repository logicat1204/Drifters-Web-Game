// Isolated visual fixture: renders the production renderer/effects, never posts runs.
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
   const [{Renderer},{CornerEffects},sim,focus]=await Promise.all([import(origin+'/js/renderer.js'),import(origin+'/js/effects.js'),import(origin+'/js/sim.mjs'),import(origin+'/js/focus.mjs')]);
   document.body.innerHTML='<div id="preview"><canvas id="world"></canvas><canvas id="fx"></canvas><header><span>SUPERCONCENTRACIÓN / VISUAL QA</span><h1 id="name"></h1></header><footer id="description"></footer></div>';
   const style=document.createElement('style');style.textContent='html,body{margin:0;background:#090e16;color:#fff;font-family:Arial}#preview{position:relative;width:1040px;height:650px;margin:30px;overflow:hidden}canvas{position:absolute;inset:0;width:100%;height:100%;display:block}header{position:absolute;left:34px;top:30px;text-shadow:0 2px 8px #000}header span{font:10px monospace;letter-spacing:2px}h1{font-size:38px;font-weight:400;margin:14px 0}footer{position:absolute;left:0;right:0;bottom:0;padding:25px 34px;background:#050b14bb;font:12px monospace;line-height:1.8}';document.head.append(style);
   const renderer=new Renderer(document.getElementById('world')),effects=new CornerEffects(document.getElementById('fx')),track=sim.makeTrack(sim.TRACKS[0]);renderer.setTrack(track);renderer.setCar(sim.CARS[0]);
   window.renderFocusFixture=type=>{const r=sim.createRace(sim.CARS[0],track,{mode:'time',focusType:type,focusEnabled:true,night:false});Object.assign(r,{s:650,speed:40,countdown:0});r.focus.charge=100;focus.activateFocus(r);r.skill.intensity=.4;renderer.resetCamera=true;renderer.render(r,'race',.02,{day:true,shake:false});effects.draw(r,true,.6,true);document.getElementById('name').textContent=focus.FOCUS_TYPES[type].name;document.getElementById('name').style.color=focus.FOCUS_TYPES[type].color;document.getElementById('description').textContent=focus.FOCUS_TYPES[type].description;};
 },base);
 for(const type of ['balance','drift','time']){await page.evaluate(type=>window.renderFocusFixture(type),type);await page.locator('#preview').screenshot({path:path.join(path.dirname(fileURLToPath(import.meta.url)),'../screenshots/focus-'+type+'.png')});}
 console.log('FOCUS VISUAL OK: tres auras, alas de Drift Master y colores de Time Master.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
