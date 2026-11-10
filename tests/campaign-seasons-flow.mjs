import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {openPlayMode} from './helpers/play-mode.mjs';
process.env.DB_BACKEND='sqlite';process.env.DB_PATH=':memory:';
const {server,store,online}=await import('../server.mjs');
const {campaignStages}=await import('../js/campaign.mjs');
const {CARS,ALL_TRACKS,makeTrack,createRace}=await import('../js/sim.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:[]}),context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('screenshots',{recursive:true});
const home=async()=>{await page.locator('#header .brand').click();await page.waitForFunction(()=>window.touge.state.screen==='menu');};
try{
 const response=await context.request.post(base+'/api/register',{data:{username:'SeasonBrowser24',password:'season-browser-24'}}),session=await response.json();assert.equal(response.status(),200);
 await context.request.patch(base+'/api/profile',{headers:{'X-CSRF-Token':session.csrf},data:{displayName:'Campeón',complete:true}});
 const win=stage=>{const r=createRace(CARS[0],makeTrack(ALL_TRACKS.find(t=>t.id===stage.track)),{mode:'campaign',campaignStage:stage.id,rival:stage});Object.assign(r,{s:r.track.length,finished:true,won:true,elapsed:220});store.addRun('browser-'+stage.id,session.user.id,r);};
 await page.goto(base);await page.waitForFunction(()=>window.touge?.state.screen==='title');await page.keyboard.press('Enter');await openPlayMode(page,'campaign');assert.equal(await page.locator('#campaign-seasons').isVisible(),false);await home();
 for(const stage of campaignStages())win(stage);
 await openPlayMode(page,'campaign');await page.waitForFunction(()=>document.querySelector('[data-season=rain]')?.getAttribute('aria-pressed')==='true');assert.equal(await page.locator('[data-season]').count(),2);assert.equal(await page.locator('[data-season=rain]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#campaign-counter').textContent(),/^0 \/ 24/);
 await page.locator('#campaign-start').click();await page.locator('#comic-dialogue').waitFor({state:'visible'});assert.match(await page.locator('#comic-dialogue').textContent(),/asfalto|lluvia/);await page.waitForTimeout(350);await page.screenshot({path:'screenshots/season-rain-story.png'});
 while(await page.locator('#comic-overlay').isVisible())await page.locator('#comic-next').click();await page.waitForFunction(()=>window.touge.state.screen==='race');assert.equal((await page.evaluate(()=>window.touge.state)).race.wet,true);assert.equal((await page.evaluate(()=>window.touge.state)).race.campaignStage,'rain:kenji');await page.locator('[data-action=pause]').click();await page.locator('#pause-panel [data-action=quit]').click();
 for(const stage of campaignStages('rain'))win(stage);
 await openPlayMode(page,'campaign');await page.waitForFunction(()=>document.querySelector('[data-season=ngplus]')?.getAttribute('aria-pressed')==='true');assert.equal(await page.locator('[data-season]').count(),3);assert.equal(await page.locator('[data-season=ngplus]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#campaign-detail').textContent(),/NIVEL 3/);await page.screenshot({path:'screenshots/season-ngplus-map.png'});
 for(const stage of campaignStages('ngplus'))win(stage);await home();await openPlayMode(page,'campaign');await page.waitForFunction(()=>document.getElementById('campaign-completion').textContent.includes('JUEGO COMPLETADO'));assert.match(await page.locator('#campaign-completion').textContent(),/JUEGO COMPLETADO/);assert.equal(await page.locator('#campaign-start').isEnabled(),true);assert.equal(await page.locator('#chapter-story-start').isEnabled(),true);assert.equal(await page.locator('#chapter-story-end').isEnabled(),true);assert.equal(await page.locator('#campaign-next').isDisabled(),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:'screenshots/season-completed-mobile.png'});assert.deepEqual(errors,[]);console.log('SEASONS OK: gates, rainy scene and race, NG+, final replay access and mobile.');
}finally{await context.close();await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();}
