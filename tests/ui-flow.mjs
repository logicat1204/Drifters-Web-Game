import {openPlayMode} from './helpers/play-mode.mjs';
// Optional end-to-end browser checks. Uses disposable in-memory accounts only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store,online}=await import('../server.mjs');
const {CARS,TRACKS,createRace,makeTrack}=await import('../js/sim.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'screenshots'),{recursive:true});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),errors=[],contexts=[];
const waitHidden=locator=>locator.waitFor({state:'hidden',timeout:15000});
async function pageFor(){const ctx=await browser.newContext({viewport:{width:1280,height:800}});contexts.push(ctx);const page=await ctx.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base);await page.waitForFunction(()=>window.touge?.state.screen==='title');await page.keyboard.press('Enter');await page.locator('#auth-submit').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('auth-submit').disabled);return page;}
async function register(page,username,car='ae86',displayName=username){await page.locator('[data-auth-mode=register]').click();await page.locator('#auth-username').fill(username);await page.locator('#auth-email').fill(username.toLowerCase()+'@example.test');await page.locator('#auth-password').fill('DisposablePassword24');await page.locator('#auth-confirm').fill('DisposablePassword24');const registered=page.waitForResponse(r=>r.url().endsWith('/api/register')&&r.request().method()==='POST');await page.locator('#auth-submit').click();const response=await registered;assert.equal(response.status(),200,await response.text());await page.locator('#account-panel').waitFor({state:'visible'});await page.locator('#profile-display-name').fill(displayName);await page.locator('#profile-car').selectOption(car);}
async function chooseCosmetic(page,slot,id){
  const actions={hair:'cabello',accessory:'accesorios',eyes:'ojos',mouth:'labios',outfit:'ropa'};
  await page.getByRole('button',{name:'Cambiar '+actions[slot],exact:true}).click();
  await page.locator('#cosmetic-browse').click();
  await page.locator('#cosmetic-grid [data-cosmetic="'+id+'"]').click();
  await page.locator('#cosmetic-dialog form button').click();
}
async function openLicense(page){if(await page.locator('#main-menu').isVisible())await page.locator('#main-menu-actions [data-action=profile]').click();else{await page.locator('#header [data-action=home]').click();await page.locator('#main-menu-actions [data-action=profile]').click();}}
async function save(page){
  const first=await page.locator('#profile-starter').isVisible();
  await page.locator('#profile-save').click();await waitHidden(page.locator('#account-panel'));
  if(first)await page.locator('#welcome-dialog button[value=menu]').click();
}
try{
  const host=await pageFor();await register(host,'ConceptPilot24','r32','Akina Runner');
  await chooseCosmetic(host,'hair','spiked');await chooseCosmetic(host,'accessory','cap');
  await host.locator('#avatar-base').selectOption('female');
  assert.deepEqual(await host.locator('#avatar-hair option').evaluateAll(options=>options.map(o=>o.value)),['bob','long','ponytail','wavy']);
  assert.equal(await host.locator('#avatar-accessory option[value=cap]').count(),0);assert.equal(await host.locator('#avatar-hair').inputValue(),'bob');
  await host.locator('#avatar-skin').selectOption('#a66e4f');await chooseCosmetic(host,'hair','ponytail');await chooseCosmetic(host,'eyes','soft');await chooseCosmetic(host,'mouth','defined');await chooseCosmetic(host,'outfit','hoodie');await chooseCosmetic(host,'accessory','glasses');
  await host.locator('#avatar-base').selectOption('male');assert.equal(await host.locator('#avatar-hair').inputValue(),'spiked');assert.equal(await host.locator('#avatar-accessory').inputValue(),'cap');
  await host.locator('#profile-preview').evaluate(img=>img.decode());await host.screenshot({path:path.join(root,'screenshots/licencia-avatar-hombre.png')});
  await host.locator('#avatar-base').selectOption('female');assert.equal(await host.locator('#avatar-hair').inputValue(),'ponytail');assert.equal(await host.locator('#avatar-accessory').inputValue(),'glasses');assert.equal(await host.locator('#avatar-skin').inputValue(),'#a66e4f');
  await host.locator('#profile-preview').evaluate(img=>img.decode());await host.screenshot({path:path.join(root,'screenshots/licencia-avatar-editor.png')});await save(host);
  const me=await (await host.request.get(base+'/api/session')).json();assert.equal(me.user.defaultCar,'r32');assert.equal(me.user.avatar.base,'female');assert.equal(me.user.displayName,'Akina Runner');
  store.db.prepare('UPDATE wallets SET balance=850 WHERE user_id=?').run(me.user.id);store.buy(me.user.id,'car','mr2');
  await host.reload();await host.locator('#title-enter').click();
  await host.locator('#main-menu-actions [data-action=garage]').click();const carSaved=host.waitForResponse(r=>r.url().endsWith('/api/profile')&&r.request().method()==='PATCH');await host.locator('#car-picker .car-card').nth(1).click();assert.equal((await (await carSaved).json()).user.defaultCar,'mr2');
  await openLicense(host);assert.equal(await host.locator('#avatar-hair').inputValue(),'ponytail');assert.equal(await host.locator('#avatar-eyes').inputValue(),'soft');await host.locator('#portrait-mode').selectOption('photo');await host.locator('#profile-photo').setInputFiles(path.join(root,'assets/avatars/v2/base-female.png'));await host.locator('#profile-status').filter({hasText:'Foto cargada'}).waitFor();await save(host);assert.equal((await (await host.request.get(base+'/api/session')).json()).user.portraitMode,'photo');
  await openLicense(host);await host.locator('#account-logout').click();await host.locator('#auth-gate').waitFor({state:'visible'});await host.locator('#auth-email').fill('conceptpilot24@example.test');await host.locator('#auth-password').fill('DisposablePassword24');await host.locator('#auth-submit').click();await waitHidden(host.locator('#auth-gate'));await waitHidden(host.locator('#account-panel'));
  const restored=await (await host.request.get(base+'/api/session')).json();assert.equal(restored.user.defaultCar,'mr2');assert.equal(restored.user.portraitMode,'photo');
  const r=createRace(CARS[3],makeTrack(TRACKS[0]),{mode:'time'});Object.assign(r,{s:r.track.length,elapsed:132.456,finished:true,won:true});r.skill.points=1200;store.addRun('ui-record',me.user.id,r);
  await openLicense(host);await host.locator('[data-license-tab=records]').click();await host.locator('#records-board li').waitFor();assert.match(await host.locator('#course-record').innerText(),/Akina Runner/);assert.match(await host.locator('#personal-records').innerText(),/2′12″456/);await host.screenshot({path:path.join(root,'screenshots/licencia-records.png')});await host.locator('#account-close').click();
  await openPlayMode(host,'online');await host.locator('[data-online-tab=create]').click();await host.locator('#online-public').check();await host.locator('#online-create').click();await host.locator('#online-room').waitFor({state:'visible'});const code=await host.locator('#online-code-label').innerText();assert.equal((await (await host.request.get(base+'/api/rooms')).json()).rooms.length,1);
  const guests=[];for(const [i,car] of ['ae86','rx7','r32'].entries()){const page=await pageFor();await register(page,'NewDriver'+i,car,'Driver '+(i+2));await save(page);await openPlayMode(page,'online');if(i===0){await page.locator('#online-refresh').click();await page.locator('.public-room button').waitFor();await page.screenshot({path:path.join(root,'screenshots/online-salas-publicas.png')});await page.locator('.public-room button').click();}else{await page.locator('[data-online-tab=private]').click();await page.locator('#online-code').fill(base+'/?room='+code);await page.locator('#online-join').click();}await page.locator('#online-room').waitFor({state:'visible'});guests.push(page);}
  assert.equal((await (await host.request.get(base+'/api/rooms')).json()).rooms.length,0,'full public rooms disappear');assert.deepEqual([...online.rooms.rooms.values()][0].players.values().map(p=>p.car).toArray(),['mr2','ae86','rx7','r32']);
  await host.screenshot({path:path.join(root,'screenshots/online-usuarios-salas.png')});for(const page of [host,...guests])await page.locator('#online-ready').click();await host.locator('#online-start').click();await host.locator('#race').waitFor({state:'visible'});await guests[0].locator('#race').waitFor({state:'visible'});
  for(const page of [host,...guests]){await page.locator('[data-action=pause]').click();await page.locator('#pause-panel [data-action=quit]').click();await page.locator('#online-entry').waitFor({state:'visible'});}
  await host.locator('[data-online-tab=create]').click();await host.locator('#online-public').uncheck();await host.locator('#online-create').click();await host.locator('#online-room').waitFor({state:'visible'});assert.equal((await (await host.request.get(base+'/api/rooms')).json()).rooms.length,0,'private rooms never appear');await host.locator('#online-leave').click();
  await openLicense(host);await host.locator('#portrait-mode').selectOption('avatar');await host.setViewportSize({width:390,height:844});await host.locator('#profile-preview').evaluate(img=>img.decode());await host.screenshot({path:path.join(root,'screenshots/licencia-movil.png')});await save(host);await host.setViewportSize({width:1280,height:800});
  await host.locator('[data-action=home]').first().click();await openPlayMode(host,'offline');await host.locator('#start').click();await host.locator('#race').waitFor({state:'visible'});await host.keyboard.down('ArrowUp');await host.waitForTimeout(3900);await host.keyboard.up('ArrowUp');assert.equal((await host.request.get(base+'/api/session')).status(),200);await host.locator('[data-action=pause]').click();await host.locator('#pause-panel [data-action=quit]').click();
  assert.deepEqual(errors,[]);console.log('UI OK: alta, avatar, foto, login, coche guardado, récords, salas públicas/privadas, cuatro pilotos y salida individual.');
}catch(error){console.error('Browser errors:',errors);for(const ctx of contexts){const page=ctx.pages()[0];if(page&&!page.isClosed()){console.error('UI status:',await page.locator('#auth-status').textContent(),await page.locator('#profile-status').textContent());await page.screenshot({path:path.join(root,'screenshots/ui-failure.png')});break;}}throw error;
}finally{for(const ctx of contexts)await ctx.close();await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();}
