// Visual QA uses actual simulation controls and renderer, with no saved race.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');await mkdir(path.join(root,'screenshots'),{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1100,height:730}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/api/health');
 await page.evaluate(async origin=>{
  const [{Renderer},sim,{CAMPAIGN_STAGES}]=await Promise.all([import(origin+'/js/renderer.js'),import(origin+'/js/sim.mjs'),import(origin+'/js/campaign.mjs')]);
  document.body.innerHTML='<div id="preview"><canvas id="world"></canvas><header><small>PRUEBA DE ADELANTAMIENTO / SIMULACIÓN REAL</small><h1 id="stage"></h1></header><footer id="description"></footer></div>';
  const css=document.createElement('style');css.textContent='html,body{margin:0;background:#080e16;color:#fff;font-family:Arial}#preview{position:relative;width:1040px;height:650px;margin:30px;overflow:hidden}canvas{position:absolute;inset:0;width:100%;height:100%}header{position:absolute;left:30px;top:28px;text-shadow:0 2px 8px #000}header small{font:10px monospace;letter-spacing:1px}h1{font-size:32px;font-weight:400;color:#ffd2d9}footer{position:absolute;bottom:0;left:0;right:0;padding:24px 30px;background:#080e17dc;font:12px/1.7 monospace}';document.head.append(css);
  const rival=CAMPAIGN_STAGES.find(s=>s.id==='kanata-final'),track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id===rival.track)),r=sim.createRace(sim.CARS[0],track,{rival,night:false});Object.assign(r,{s:120,speed:40,lateral:0,countdown:0,timeLeft:1000});
  r.opponent=sim.createRace(sim.rivalCar(rival),track,{mode:'time',aiDriver:rival,focusEnabled:false});Object.assign(r.opponent,{s:75,speed:50,lateral:0,countdown:0,timeLeft:1000});r.rivalS=75;r.boss.confirmedSide=-1;
  const renderer=new Renderer(document.getElementById('world'));renderer.setTrack(track);renderer.setCar(sim.CARS[0]);renderer.setRival(rival);let hits=0;
  window.passingFrame=stage=>{
   let ready=false;
   for(let i=0;i<25*120&&!ready;i++){
    const old=r.contactCooldown;sim.updateRace(r,{steer:0,throttle:r.speed<40,brake:r.speed>40.25},1/120);if(r.contactCooldown>old+.1)hits++;
    const gap=r.s-r.rivalS;ready=stage==='salida'?gap<7&&gap>4&&Math.abs(r.rivalLateral)>2.15:stage==='paralelo'?Math.abs(gap)<1:gap<-11&&!r.boss.enraged;
   }
   renderer.resetCamera=true;renderer.render(r,'race',.02,{day:true,shake:false});document.getElementById('stage').textContent={salida:'KANATA / SALE POR UN COSTADO',paralelo:'KANATA / ADELANTAMIENTO LIMPIO',regreso:'KANATA / POSICIÓN RECUPERADA'}[stage];document.getElementById('description').textContent=`Separación lateral: ${Math.abs(r.rivalLateral-r.lateral).toFixed(2)} m · Contactos: ${hits} · Maniobra: ${r.opponent.aiDriver.passing.phase}`;
   return {ready,hits,clearance:Math.abs(r.rivalLateral-r.lateral),gl:renderer.gl.getError()};
  };
  window.disputeFrame=()=>{
    const duel=sim.createRace(sim.CARS[2],track,{rival,night:false});Object.assign(duel,{s:120,speed:69,lateral:0,countdown:0,timeLeft:1000});
    const opponent=duel.opponent=sim.createRace(sim.rivalCar(rival),track,{mode:'time',aiDriver:rival,focusEnabled:false});Object.assign(opponent,{s:119.5,speed:69,lateral:2.5,targetLine:2.5,countdown:0,timeLeft:1000});
    Object.assign(opponent.aiDriver.passing,{phase:'overtake',side:1,lane:2.5});duel.rivalS=119.5;duel.boss.enraged=true;let contacts=0;
    for(let i=0;i<3*120;i++){
      const v=duel.speed,p=sim.sample(track,duel.s),ahead=duel.lateral+duel.lateralV*.45,desired=sim.clamp(-(ahead-2.5)*.065,-.22,.22),road=p.curve*v*Math.cos(duel.travelYaw)/sim.clamp(1-p.curve*duel.lateral,.65,1.35),rate=road+(desired-duel.travelYaw)*3.3,body=duel.travelYaw+rate/9.5;
      const steer=-sim.clamp(Math.atan((road+(body-duel.yaw)*9)*2.62/Math.max(v,2))/sim.steeringAngle(v),-1,1),old=duel.contactCooldown;
      sim.updateRace(duel,{steer,throttle:v<69,brake:v>69.25},1/120);if(duel.contactCooldown>old+.1)contacts++;
      if(contacts&&opponent.aiDriver.passing.contesting&&!opponent.braking)break;
    }
    renderer.setCar(sim.CARS[2]);renderer.resetCamera=true;renderer.render(duel,'race',.02,{day:true,shake:false});
    document.getElementById('stage').textContent='KANATA / DISPUTA LA POSICIÓN';document.getElementById('description').textContent='Cierre tardío: conserva su trazada y acelera. Contactos físicos: '+contacts;
    return {contacts,contesting:opponent.aiDriver.passing.contesting,braking:opponent.braking,lane:opponent.aiDriver.passing.lane,gl:renderer.gl.getError()};
  };
 },origin);
 for(const stage of ['salida','paralelo','regreso']){const result=await page.evaluate(stage=>window.passingFrame(stage),stage);assert.ok(result.ready,stage);assert.equal(result.hits,0);assert.equal(result.gl,0);if(stage!=='regreso')assert.ok(result.clearance>2.15);await page.locator('#preview').screenshot({path:path.join(root,'screenshots','adelantamiento-'+stage+'.png')});}

 const dispute=await page.evaluate(()=>window.disputeFrame());assert.ok(dispute.contacts>0);assert.ok(dispute.contesting);assert.equal(dispute.braking,false);assert.equal(dispute.lane,2.5);assert.equal(dispute.gl,0);await page.locator('#preview').screenshot({path:path.join(root,'screenshots','adelantamiento-disputa.png')});
 assert.deepEqual(errors,[]);console.log('AI PASSING VISUAL OK: adelantamiento limpio y disputa física ante un cierre tardío.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
