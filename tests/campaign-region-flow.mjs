import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {campaignEvents} from '../js/campaign-events.mjs';
import {openPlayMode} from './helpers/play-mode.mjs';

process.env.DB_BACKEND='sqlite';
process.env.DB_PATH=':memory:';
process.env.PUBLIC_URL='';
process.env.RENDER_EXTERNAL_URL='';
const {server,store,online}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,
  args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext(),errors=[];
  const registration=await context.request.post(base+'/api/register',{data:{username:'RegionQaPilot',email:'region.qa@example.test',password:'password-qa-123'}});
  assert.equal(registration.status(),200);
  const session=await registration.json(),headers={'X-CSRF-Token':session.csrf};
  const profile=await context.request.patch(base+'/api/profile',{headers,data:{complete:true,defaultCar:'r32'}});
  assert.ok((await profile.json()).user.onboarded);
  assert.ok((await (await context.request.get(base+'/api/session')).json()).user.onboarded);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.stack));
  const apiErrors=[];
  page.on('requestfailed',request=>{if(request.url().includes('/api/'))apiErrors.push(request.failure().errorText+' '+new URL(request.url()).pathname);});
  page.on('response',response=>{if(response.status()>=400&&response.url().includes('/api/'))apiErrors.push(response.status()+' '+new URL(response.url()).pathname);});
  async function launch(world){
    await page.goto(base);
    try{await page.locator('#auth-submit:not([disabled])').waitFor({state:'attached',timeout:15000});}
    catch(error){throw Error([error.message,...errors,...apiErrors,await page.locator('#auth-status').textContent()].join('\n'));}
    await page.keyboard.press('Enter');
    if(await page.locator('#auth-gate').isVisible()){
      assert.equal(await page.locator('#auth-status').textContent(),'',errors.join('\n'));
      await page.locator('#auth-email').fill('region.qa@example.test');
      await page.locator('#auth-password').fill('password-qa-123');
      await page.locator('#auth-submit').click();
    }
    await page.locator('#auth-gate').waitFor({state:'hidden'});
    await page.locator('#main-menu-actions [data-action=play]').waitFor();
    await openPlayMode(page,'campaign',{world,travel:false});
    if(world==='initial-d'){
      await page.getByRole('button',{name:'Pasos finales'}).click();
      assert.equal(await page.locator('#campaign-map-destinations [data-chapter]').count(),4);
      await page.locator('[data-chapter=turnpike]').click();
      assert.ok(await page.locator('#campaign-travel').isDisabled());
      await page.getByRole('button',{name:'Primeras montañas'}).click();
      assert.ok(await page.locator('[data-chapter=myogi]').isVisible());
    }
    await page.locator('#campaign-travel').click();
    const overlay=page.locator('#comic-overlay');
    await overlay.waitFor({state:'visible'});
    const prologue=page.waitForResponse(response=>response.url().endsWith('/api/campaign/story'));
    await page.locator('#comic-next').click();
    assert.equal((await prologue).status(),200);
    if(await overlay.isVisible())await page.locator('#comic-cancel').click();
    await overlay.waitFor({state:'hidden'});
  }
  await launch('initial-d');
  const nodes=page.locator('#campaign-stages button');
  assert.equal(await nodes.count(),5);
  assert.equal(await page.locator('#campaign-stages .region-road-mark.branch').count(),1);
  assert.equal(await page.locator('[data-stage=kenji]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-stage=trial-akina]').click();assert.ok(await page.locator('#campaign-start').isDisabled());
  await page.locator('#campaign-song summary').click();
  await page.locator('#campaign-song input[value=none]').check();
  await page.getByRole('button',{name:'Siguiente canción'}).click();
  assert.match(await page.locator('.campaign-song-carousel').innerText(),/Solo el sonido/);
  await page.locator('[data-stage=chest-akina]').click();
  assert.ok(await page.locator('#campaign-chest-open').isDisabled());
  await page.locator('[data-stage=kenji]').click();
  if(process.env.CAMPAIGN_QA_SCREENSHOT)await page.screenshot({path:process.env.CAMPAIGN_QA_SCREENSHOT});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  const seed=store.db.prepare('INSERT INTO campaign_progress(user_id,level_id,best_time,best_points,reward_coins,cleared_at) VALUES(?,?,120,100,700,0)');
  for(const event of campaignEvents()){
    if(event.id==='odawara-grid')break;
    seed.run(session.user.id,event.id);
  }
  const chest=()=>context.request.post(base+'/api/campaign/chest',{headers,data:{id:'chest-akina'}});
  assert.deepEqual((await (await chest()).json()).user.focusUnlocked,['balance']);
  assert.ok((await (await chest()).json()).alreadyClaimed);
  await page.setViewportSize({width:1280,height:800});
  store.markChapterStory(session.user.id,'map:odawara','start');
  await launch('mf-ghost');
  await page.locator('[data-stage=odawara-grid]').click();
  assert.equal(await page.locator('.campaign-grid-driver').count(),2);
  const starting=page.waitForResponse(response=>response.url().endsWith('/api/runs/start'));
  await page.locator('#campaign-start').click();
  if(await page.locator('#comic-overlay').isVisible()){
    for(let pageNumber=0;pageNumber<20&&await page.locator('#comic-overlay').isVisible();pageNumber++)await page.locator('#comic-next').click();
  }
  const attempt=await starting;
  assert.equal(attempt.status(),200,await attempt.text());
  try{await page.waitForFunction(()=>window.touge?.state.screen==='race',null,{polling:100,timeout:6000});}
  catch(error){throw Error([error.message,await page.locator('#campaign-status').textContent(),await page.locator('#toast').textContent(),...errors,...apiErrors].join('\n'));}
  assert.equal(await page.locator('#position').textContent(),'3 / 3');
  assert.match(await page.locator('#advantage').textContent(),/VUELTA 1 \/ 2/);
  assert.equal(await page.locator('#race-intro').isVisible(),true);
  if(process.env.CAMPAIGN_QA_SCREENSHOT)await page.screenshot({path:'data/phase3-start.png'});
  assert.equal(await page.locator('#race-intro-roster>div').count(),3);
  await page.locator('#race-intro').waitFor({state:'hidden'});
  assert.ok(await page.locator('#focus-gauge').isVisible());
  assert.equal(await page.locator('#race [data-action=pause]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Campaña OK: mapa de nodos, carrusel, móvil, cofres y salida de parrilla.');
}finally{
  await browser.close();
  for(const ws of online.wss.clients)ws.terminate();
  await new Promise(resolve=>server.close(resolve));store.close();
}
