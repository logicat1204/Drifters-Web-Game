import {openPlayMode} from './helpers/play-mode.mjs';
// End-to-end menu checks in a disposable server. No accounts touch the game database.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store,online}=await import('../server.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');await mkdir(path.join(root,'screenshots'),{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],models=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().endsWith('/1985_toyota_sprinter_trueno_ae86_project_d.glb'))models.push(r.url());});
const shot=name=>page.screenshot({path:path.join(root,'screenshots',name+'.png')});
const state=()=>page.evaluate(()=>window.touge.state);
const waitScreen=name=>page.waitForFunction(value=>window.touge?.state.screen===value,name);
const menuClick=action=>['offline','campaign','online'].includes(action)?openPlayMode(page,action):page.locator('#main-menu-actions [data-action='+action+']').click();
const home=async()=>{await page.locator('#header .brand').click();await waitScreen('menu');};
try{
  const register=await context.request.post(base+'/api/register',{data:{username:'MenuPilot24',email:'menupilot24@example.test',password:'MenuPassword24'}});assert.equal(register.status(),200);const account=await register.json();
  assert.equal((await context.request.patch(base+'/api/profile',{headers:{'X-CSRF-Token':account.csrf},data:{displayName:'Night Runner',complete:true}})).status(),200);
  store.db.prepare('UPDATE wallets SET balance=950 WHERE user_id=?').run(account.user.id);store.buy(account.user.id,'car','s2000');
  store.markChapterStory(account.user.id,'akina','start');
  await page.addInitScript(()=>localStorage.setItem('touge-settings',JSON.stringify({difficulty:'easy'})));
  await page.goto(base);await waitScreen('title');assert.equal(await page.locator('#difficulty').count(),0);await page.waitForFunction(()=>document.getElementById('auth-gate').classList.contains('hidden'));
  await page.waitForTimeout(1000);await shot('menu-01-entrada');assert.equal(await page.locator('#main-menu').isVisible(),false);assert.equal(models.length,0,'the title never loads the exhibition model');
  // Any ordinary key enters once, without starting a race on the same keypress.
  await page.keyboard.press('k');await waitScreen('menu');await page.waitForFunction(()=>window.touge?.state.showcase.status==='ready'&&window.touge.state.showcase.active,null,{timeout:30000});await page.waitForTimeout(process.env.RENDER_BACKEND==='native'?4000:300);console.log('SHOWCASE PERFORMANCE:',JSON.stringify(await page.evaluate(()=>window.touge.performance)));assert.equal(models.length,1);assert.equal((await state()).showcase.triangles,90362);assert.equal(await page.evaluate(()=>document.getElementById('world').getContext('webgl').getError()),0);await shot('menu-02-principal');
  assert.equal((await state()).race,null);assert.equal((await state()).menuCar,'ae86');assert.equal((await state()).menuScene,true);
  assert.deepEqual(await page.locator('#main-menu-actions button').evaluateAll(buttons=>buttons.map(b=>b.dataset.action)),['play','garage','settings','profile','exit']);
  await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#main-menu-actions .selected').getAttribute('data-action'),'garage');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');await waitScreen('play');await page.keyboard.press('Enter');await page.locator('#mode-panel').waitFor({state:'visible'});await page.locator('#mode-enter').click();await waitScreen('campaign');await page.locator('#campaign-start').waitFor({state:'visible'});assert.equal(await page.locator('#campaign-stages [data-stage]').count(),3);assert.match(await page.locator('#campaign-detail').innerText(),/Kenji/);await home();
  await menuClick('offline');await waitScreen('home');assert.equal(await page.locator('#mode').inputValue(),'time');await shot('menu-03-individual');await home();
  await menuClick('online');await waitScreen('online');assert.equal(await page.locator('[data-online-tab=public]').getAttribute('aria-selected'),'true');await home();
  await menuClick('settings');await page.locator('#settings-panel').waitFor({state:'visible'});await page.locator('[data-settings-tab=visual]').click();await page.locator('#camera').selectOption('3');await page.locator('#settings-panel [data-action=close]').click();assert.equal((await state()).screen,'menu');
  await menuClick('profile');await page.locator('#account-panel').waitFor({state:'visible'});assert.equal(await page.locator('#profile-display-name').inputValue(),'Night Runner');await page.locator('#account-close').click();
  await page.locator('#main-menu-actions [data-action=garage]').click();await waitScreen('garage');const saved=page.waitForResponse(r=>r.url().endsWith('/api/profile')&&r.request().method()==='PATCH');await page.locator('#car-picker .car-card').nth(1).click();assert.equal((await (await saved).json()).user.defaultCar,'s2000');await home();assert.equal((await state()).menuCar,'s2000');assert.equal(await page.locator('#menu-car-code').textContent(),'AP1');await shot('menu-04-auto-elegido');
  await page.reload();await waitScreen('title');await page.locator('#title-enter').click();await waitScreen('menu');await page.waitForFunction(()=>window.touge.state.car==='s2000');assert.equal((await state()).menuCar,'s2000');
  // A controller press enters the title once; a second press activates the focused menu item.
  await page.evaluate(()=>{window.__menuPad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.__menuPad];});
  const pad=async(index,pressed)=>{await page.evaluate(({index,pressed})=>{window.__menuPad.buttons[index]={pressed,value:pressed?1:0};},{index,pressed});await page.waitForTimeout(150);};
  await menuClick('exit');await page.locator('[data-action=exit-confirm]').click();await waitScreen('title');await pad(0,true);await waitScreen('menu');await pad(0,false);assert.equal((await state()).screen,'menu');await page.keyboard.press('Home');await pad(13,true);await pad(13,false);assert.equal(await page.locator('#main-menu-actions .selected').getAttribute('data-action'),'garage');await pad(12,true);await pad(12,false);await pad(0,true);await waitScreen('play');await pad(0,false);await pad(15,true);await pad(15,false);await pad(15,true);await pad(15,false);await pad(0,true);await page.locator('#mode-panel').waitFor({state:'visible'});await pad(0,false);await pad(0,true);await waitScreen('online');await pad(0,false);await home();
  await menuClick('exit');await page.locator('#exit-panel').waitFor({state:'visible'});await page.locator('#exit-panel [data-action=close]').click();await menuClick('exit');await page.locator('[data-action=exit-confirm]').click();await waitScreen('title');assert.equal((await (await context.request.get(base+'/api/session')).json()).user.username,'MenuPilot24');await page.keyboard.press('Enter');await waitScreen('menu');
  await menuClick('offline');await page.locator('#start').click();await waitScreen('race');const raceDraws=(await state()).showcase.draws;assert.equal((await state()).showcase.active,false);assert.equal((await state()).car,'s2000');await page.waitForTimeout(300);assert.equal((await state()).showcase.draws,raceDraws,'exhibition asset never draws during racing');await page.keyboard.press('Escape');await page.locator('#pause-panel [data-action=quit]').click();await waitScreen('menu');await page.waitForFunction(()=>window.touge.state.showcase.active);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);await shot('menu-05-movil');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);for(const button of await page.locator('#main-menu-actions>button').all()){const box=await button.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<844);}
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);await shot('menu-06-horizontal');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),844);const lastButton=await page.locator('#main-menu-actions>button').last().boundingBox();assert.ok(lastButton.y+lastButton.height<350);
  await page.setViewportSize({width:1440,height:900});await page.goto(base+'/?room=DEADBEEF');await waitScreen('title');await page.keyboard.press('Enter');await waitScreen('online');assert.equal(await page.locator('#online-code').inputValue(),'DEADBEEF');assert.equal(await page.locator('[data-online-tab=private]').getAttribute('aria-selected'),'true');
  assert.deepEqual(errors,[]);console.log('MENU OK: entrada, Jugar y tres modos, teclado, campaña, individual, online, ajustes, perfil, auto persistente, salida, invitaciones y móvil.');
}catch(error){console.error('Menu error:',errors);console.error(await state().catch(()=>({})));await shot('menu-failure');throw error;
}finally{await context.close();await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();}
