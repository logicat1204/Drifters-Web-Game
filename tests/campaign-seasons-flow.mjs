import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {openPlayMode} from './helpers/play-mode.mjs';
process.env.DB_BACKEND='sqlite';process.env.DB_PATH=':memory:';
const {server,store,online}=await import('../server.mjs');
const {campaignStages,campaignConditions}=await import('../js/campaign.mjs');
const {ALL_CARS,CARS,ALL_TRACKS,makeTrack,createRace}=await import('../js/sim.mjs');
const competitionCar=ALL_CARS.find(car=>car.id==='gt3rs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:[]}),context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('screenshots',{recursive:true});
const screen=name=>page.waitForFunction(name=>window.touge.state.screen===name,name);
const home=async()=>{await page.locator('#header .brand').click();await screen('menu');};
const action=async(locator,endpoint,method='POST')=>{
 const waiting=page.waitForResponse(response=>response.url().endsWith(endpoint)&&response.request().method()===method);
 await locator.click();
 const response=await waiting;
 assert.equal(response.status(),200,await response.text());
 return response.json();
};
const launchDuel=async()=>{
 await page.locator('#campaign-start').click();
 while(await page.locator('#comic-overlay').isVisible())await page.locator('#comic-next').click();
 await screen('race');
 return page.evaluate(()=>window.touge.state.race);
};
const quitDuel=async()=>{
 await page.locator('[data-action=pause]').click();
 await page.locator('#pause-panel [data-action=quit]').click();
 await screen('menu');
};
try{
 const response=await context.request.post(base+'/api/register',{data:{username:'SeasonBrowser24',password:'season-browser-24'}}),session=await response.json();assert.equal(response.status(),200);
 await context.request.patch(base+'/api/profile',{headers:{'X-CSRF-Token':session.csrf},data:{displayName:'Campeón',complete:true}});
 const win=stage=>{
  const car=stage.ngplus?competitionCar:CARS[0];
  const track=makeTrack(ALL_TRACKS.find(t=>t.id===stage.track));
  const race=createRace(car,track,{...campaignConditions(stage),mode:'campaign',campaignStage:stage.id,rival:stage,build:store.vehicleBuild(session.user.id,car.id)});
  Object.assign(race,{s:track.length,finished:true,won:true,elapsed:220});
  store.addRun('browser-'+stage.id,session.user.id,race);
 };
 await page.goto(base);await page.waitForFunction(()=>window.touge?.state.screen==='title');await page.keyboard.press('Enter');await openPlayMode(page,'campaign');assert.equal(await page.locator('#campaign-seasons').isVisible(),false);await home();
 for(const stage of campaignStages())win(stage);
 await openPlayMode(page,'campaign');await page.waitForFunction(()=>document.querySelector('[data-season=rain]')?.getAttribute('aria-pressed')==='true');assert.equal(await page.locator('[data-season]').count(),2);assert.equal(await page.locator('[data-season=rain]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#campaign-counter').textContent(),/^0 \/ 24/);
 await page.locator('#campaign-start').click();await page.locator('#comic-dialogue').waitFor({state:'visible'});assert.match(await page.locator('#comic-dialogue').textContent(),/asfalto|lluvia/);await page.waitForTimeout(350);await page.screenshot({path:'screenshots/season-rain-story.png'});
 while(await page.locator('#comic-overlay').isVisible())await page.locator('#comic-next').click();await page.waitForFunction(()=>window.touge.state.screen==='race');assert.equal((await page.evaluate(()=>window.touge.state)).race.wet,true);assert.equal((await page.evaluate(()=>window.touge.state)).race.campaignStage,'rain:kenji');await page.locator('[data-action=pause]').click();await page.locator('#pause-panel [data-action=quit]').click();
 for(const stage of campaignStages('rain'))win(stage);
 await openPlayMode(page,'campaign');await page.waitForFunction(()=>document.querySelector('[data-season=ngplus]')?.getAttribute('aria-pressed')==='true');assert.equal(await page.locator('[data-season]').count(),3);assert.equal(await page.locator('[data-season=ngplus]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#campaign-detail').textContent(),/NIVEL 3/);
 const start=page.locator('#campaign-start');
 assert.equal(await start.isDisabled(),true);
 assert.match(await page.locator('#campaign-detail').textContent(),/categoría 3/i);
 await page.screenshot({path:'screenshots/season-ngplus-map.png'});

 const shop=page.getByRole('button',{name:'VER COCHES EN TIENDA'});
 await shop.click();await screen('shop');
 await page.getByRole('tab',{name:'Música'}).click();
 await home();await openPlayMode(page,'campaign');
 await shop.click();await screen('shop');
 await page.waitForFunction(()=>document.querySelector('[data-shop-category=car]')?.getAttribute('aria-selected')==='true');
 const card=page.locator('[data-item=gt3rs]');
 assert.match(await card.textContent(),/CATEGORÍA 3/);
 await card.click();
 assert.match(await page.locator('#shop-detail').textContent(),/Apto para NG\+/);
 await action(page.locator('#shop-buy'),'/api/shop/buy');
 await page.waitForFunction(()=>document.getElementById('shop-buy')?.textContent.startsWith('EQUIPAR'));
 await action(page.locator('#shop-buy'),'/api/profile','PATCH');
 await page.waitForFunction(()=>window.touge.state.car==='gt3rs');
 await home();await openPlayMode(page,'campaign');
 assert.equal(await start.isDisabled(),true);
 assert.match(await page.locator('#campaign-detail').textContent(),/frenos al nivel 3/i);
 await page.getByRole('button',{name:'IR AL GARAJE'}).click();
 await screen('workshop');
 for(const system of ['engine','chassis','brakes']){
  for(let tier=1;tier<=3;tier++){
   const result=await action(page.locator('#upgrade-'+system),'/api/garage/upgrade');
   assert.equal(result.user.garage.gt3rs.build[system],tier);
  }
 }
 await page.waitForFunction(()=>document.getElementById('workshop-build').textContent==='PREPARACIÓN AL MÁXIMO');
 await home();await openPlayMode(page,'campaign');
 assert.equal(await start.isEnabled(),true);
 const ngplusRace=await launchDuel();
 assert.equal(ngplusRace.campaignStage,'ngplus:kenji');
 assert.equal(ngplusRace.wet,false);
 for(const system of ['engine','chassis','brakes'])assert.equal(ngplusRace.build[system],3);
 await quitDuel();

 for(const stage of campaignStages('ngplus'))win(stage);await openPlayMode(page,'campaign');await page.waitForFunction(()=>document.getElementById('campaign-completion').textContent.includes('JUEGO COMPLETADO'));assert.match(await page.locator('#campaign-completion').textContent(),/JUEGO COMPLETADO/);assert.equal(await start.isEnabled(),true);assert.match(await start.textContent(),/VOLVER A COMPETIR/);assert.equal(await page.locator('#chapter-story-start').isEnabled(),true);assert.equal(await page.locator('#chapter-story-end').isEnabled(),true);assert.equal(await page.locator('#campaign-next').isDisabled(),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:'screenshots/season-completed-mobile.png'});
 const replay=await launchDuel();
 assert.match(replay.campaignStage,/^ngplus:/);
 assert.equal(replay.build.brakes,3);
 assert.deepEqual(errors,[]);console.log('SEASONS OK: rainy race, NG+ preparation from shop and garage, final replay and mobile.');
}finally{await context.close();await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();}
