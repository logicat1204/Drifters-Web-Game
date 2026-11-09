import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {openPlayMode} from './helpers/play-mode.mjs';
process.env.DB_PATH=':memory:';process.env.DB_BACKEND='sqlite';
const {server,store,accounts,online}=await import('../server.mjs');
const game=await readFile(new URL('../js/game.js',import.meta.url),'utf8');
const driver=(await readFile(new URL('./helpers/reference-driver.mjs',import.meta.url),'utf8')).replaceAll('../../js/','/js/');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:960,height:600}}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/js/replay-test-driver.mjs',route=>route.fulfill({contentType:'text/javascript',body:driver}));
await page.route('**/js/game.js',route=>route.fulfill({contentType:'text/javascript',body:game+`
import {driverInput as replayDriver} from './replay-test-driver.mjs';
window.finishReplayTest=()=>{
  for(let i=0;i<108000&&!race.finished;i++){
    const input=race.recorder.capture(race,replayDriver(race));
    updateRace(race,input,PHYSICS_STEP);race.watchReplay.capture(race,PHYSICS_STEP);
  }
  finish();
};
`}));
try{
  const registered=await (await context.request.post(base+'/api/register',{data:{username:'ReplayPilot24',password:'ReplayPassword24'}})).json();
  assert.ok(registered.user);
  const profile=await context.request.patch(base+'/api/profile',{headers:{'x-csrf-token':registered.csrf},data:{complete:true}});
  assert.equal(profile.status(),200,await profile.text());
  await page.addInitScript(()=>localStorage.setItem('touge-settings',JSON.stringify({daytime:'day',track:3,weather:'wet',quality:'1',autoQuality:false})));
  await page.goto(base);await page.waitForFunction(()=>window.touge?.state.screen==='title');
  await page.waitForFunction(()=>document.getElementById('auth-gate').classList.contains('hidden'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.touge.state.screen==='menu');
  await openPlayMode(page,'offline');
  await page.locator('#start').click();await page.waitForFunction(()=>window.touge.state.screen==='race');
  accounts.runs.now=()=>Date.now()+1000000;
  await page.evaluate(()=>window.finishReplayTest());
  await page.locator('#results-panel').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('record-save-status').textContent.includes('guardad'));
  const original=await page.evaluate(()=>window.touge.state.race),count=store.stats(registered.user.id).races;
  await page.locator('#results-panel [data-action=replay]').click();
  await page.locator('#replay-controls').waitFor({state:'visible'});
  await page.locator('#replay-pause').click();
  await page.locator('#replay-seek').evaluate(input=>{input.value='70';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#race').isVisible(),false);
  assert.match(await page.locator('#replay-time').innerText(),/01′07/);
  await page.locator('#replay-seek').focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('#replay-time').innerText(),/01′12/);
  await page.keyboard.press('ArrowLeft');
  await mkdir('data',{recursive:true});
  await page.screenshot({path:'data/replay-tv.png'});
  await page.locator('#replay-camera').click();await page.screenshot({path:'data/replay-follow.png'});
  await page.locator('#replay-camera').click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'data/replay-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await page.keyboard.press('Escape');await page.locator('#results-panel').waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>window.touge.state.race),original);
  assert.equal(store.stats(registered.user.id).races,count);
  await page.locator('#results-panel [data-action=replay]').click();
  await page.locator('#replay-speed').selectOption('2');
  await page.locator('[data-action=replay-restart]').click();
  await page.locator('[data-action=replay-exit]').click();
  assert.equal(store.stats(registered.user.id).races,count);
  assert.deepEqual(errors,[]);
  console.log('REPLAY OK — carrera real, resultados, cámaras, pausa, seek, móvil y resultado intacto.');
}catch(error){
  console.error('Replay UI errors',errors);
  console.error(await page.evaluate(()=>({state:window.touge?.state,auth:document.getElementById('auth-status')?.textContent,license:!document.getElementById('account-panel')?.classList.contains('hidden')})));
  await mkdir('data',{recursive:true});
  await page.screenshot({path:'data/replay-failure.png',timeout:10000}).catch(()=>{});
  throw error;
}finally{
  await browser.close();
  for(const ws of online.wss.clients)ws.terminate();
  await new Promise(resolve=>server.close(resolve));store.close();
}
