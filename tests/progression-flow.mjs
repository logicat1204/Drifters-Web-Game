import {mkdir} from 'node:fs/promises';
import {openPlayMode} from './helpers/play-mode.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store,online}=await import('../server.mjs');
const {CAMPAIGN_STAGES}=await import('../js/campaign.mjs');
const {CARS,ALL_TRACKS,makeTrack,createRace}=await import('../js/sim.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),context=await browser.newContext({viewport:{width:1440,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const shotDir=path.join(root,'screenshots','campaign-atlas-regression');await mkdir(shotDir,{recursive:true});const shot=name=>page.screenshot({path:path.join(shotDir,name+'.png')});
const wait=name=>page.waitForFunction(value=>window.touge?.state.screen===value,name);
const home=async()=>{await page.locator('#header .brand').click();await wait('menu');};
const user=async()=>(await (await context.request.get(base+'/api/session')).json()).user;
try{
 const registered=await context.request.post(base+'/api/register',{data:{username:'StoryPilot24',email:'storypilot24@example.test',password:'StoryPassword24'}}),session=await registered.json();assert.equal(registered.status(),200);
 await context.request.patch(base+'/api/profile',{headers:{'X-CSRF-Token':session.csrf},data:{displayName:'Mountain Story',complete:true}});
 await page.goto(base);await wait('title');await page.keyboard.press('Enter');await wait('menu');
 await openPlayMode(page,'campaign');await wait('campaign');await page.locator('[data-stage=kenji]').waitFor();assert.equal(await page.locator('[data-chapter]').count(),9);assert.equal(await page.locator('#campaign-start').isEnabled(),true);await page.waitForTimeout(400);await shot('campania-01-akina');
 await page.locator('[data-stage=takumi-initial]').click();assert.equal(await page.locator('#campaign-start').isEnabled(),false);await page.locator('[data-stage=kenji]').click();await page.locator('#campaign-start').click();await page.locator('#comic-overlay').waitFor({state:'visible'});await page.locator('#comic-image').evaluate(img=>img.decode());assert.equal((await page.evaluate(()=>window.touge.state)).race,null);assert.equal((await page.evaluate(()=>window.touge.state)).screen,'campaign');await shot('campania-02-comic');
 await page.locator('#comic-next').click();await wait('race');await page.waitForTimeout(250);assert.equal(await page.locator('#rival-name').textContent(),'Kenji');assert.equal((await page.evaluate(()=>window.touge.state)).race.focus.enabled,false);await page.locator('[data-action=pause]').click();await page.locator('#pause-panel [data-action=quit]').click();await wait('menu');
 await page.locator('#menu-wallet').click();await wait('shop');await page.locator('[data-item="180sx"]').click();assert.equal(await page.locator('#shop-buy').isEnabled(),false);assert.equal((await user()).coins,0);await home();
 // Fixture victories exercise the production reward transaction in an in-memory database.
 for(const stage of CAMPAIGN_STAGES.slice(0,7)){const r=createRace(CARS[0],makeTrack(ALL_TRACKS.find(t=>t.id===stage.track)),{mode:'campaign',campaignStage:stage.id,rival:stage,focusEnabled:false});Object.assign(r,{s:r.track.length,elapsed:160,won:true,finished:true});r.skill.points=9000;store.addRun('ui-'+stage.id,session.user.id,r);}
 await page.reload();await wait('title');await page.keyboard.press('Enter');await wait('menu');await page.locator('#main-menu-actions [data-action=profile]').click();await page.locator('#account-panel').waitFor({state:'visible'});assert.equal(await page.locator('#profile-focus option:disabled').count(),0);await page.locator('#profile-focus').selectOption('drift');await page.locator('#profile-save').click();await page.locator('#account-panel').waitFor({state:'hidden'});assert.equal((await user()).focusType,'drift');
 await page.locator('#menu-wallet').click();await wait('shop');await page.locator('[data-item="180sx"]').click();const coins=(await user()).coins;await page.locator('#shop-buy').click();await page.waitForFunction(()=>document.getElementById('shop-buy').textContent.includes('EQUIPAR'));assert.equal((await user()).coins,coins-900);await page.locator('#shop-buy').click();await page.waitForFunction(()=>window.touge.state.car==='180sx');assert.equal((await user()).defaultCar,'180sx');await shot('campania-03-tienda-autos');
 await page.locator('[data-shop-category=outfit]').click();await page.locator('#shop-base').selectOption('female');await page.locator('[data-item="female.outfit.bikini"]').click();await page.locator('#shop-buy').click();await page.waitForFunction(()=>document.getElementById('shop-buy').textContent.includes('EQUIPAR'));await page.locator('#shop-buy').click();await page.waitForTimeout(200);assert.equal((await user()).avatar.outfit,'bikini');await page.locator('#shop-detail img').evaluate(img=>img.decode());await shot('campania-04-ropa-mujer');
 await page.locator('[data-item="female.outfit.sapphire"]').click();await page.locator('#shop-detail img').evaluate(img=>img.decode());await shot('campania-05-legendario');
 await home();await page.locator('#main-menu-actions [data-action=profile]').click();await page.locator('#account-panel').waitFor({state:'visible'});assert.equal(await page.locator('#avatar-outfit option[value=bikini]').count(),1);assert.equal(await page.locator('#avatar-outfit option[value=sapphire]').count(),0);await shot('campania-06-licencia-focus');await page.locator('#account-close').click();
 await openPlayMode(page,'offline');await page.locator('#start').click();await wait('race');assert.equal((await page.evaluate(()=>window.touge.state)).race.focus.type,'drift');assert.equal((await page.evaluate(()=>window.touge.state)).race.focus.enabled,true);await page.locator('[data-action=pause]').click();await page.locator('#pause-panel [data-action=quit]').click();await wait('menu');
 await openPlayMode(page,'campaign');await wait('campaign');await page.locator('[data-chapter=manazuru]').click();await page.locator('[data-stage=kanata-final]').click();assert.equal(await page.locator('#campaign-start').isEnabled(),false);await shot('campania-07-final');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.locator('[data-chapter=akina]').click();await shot('campania-08-movil');
 await home();await page.locator('#menu-wallet').click();await wait('shop');await page.locator('[data-shop-category=hair]').click();await page.locator('#shop-base').selectOption('male');await page.locator('[data-item="male.hair.racer-cap"]').click();await page.locator('#shop-detail img').evaluate(img=>img.decode());await page.locator('#shop-detail').scrollIntoViewIfNeeded();await shot('campania-09-tienda-movil');
 assert.deepEqual(errors,[]);console.log('PROGRESSION OK: campañas, bloqueos, cómic real, carrera, focus, monedas, compras, equipamiento, legendarios y móvil.');
}catch(error){console.error(errors);console.error(await page.evaluate(()=>window.touge?.state));await shot('progression-failure');throw error;
}finally{await context.close();await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();}
