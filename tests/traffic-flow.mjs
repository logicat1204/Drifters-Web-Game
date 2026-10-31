// Disposable online room: two real browsers, production physics and WebSockets.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.env.DB_PATH=':memory:';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server,store,online}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');await mkdir(path.join(root,'screenshots'),{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),contexts=[],errors=[];
async function pilot(name){
 const context=await browser.newContext({viewport:{width:1100,height:760}});contexts.push(context);
 const response=await context.request.post(base+'/api/register',{data:{username:name,password:'Slipstream-2026'}});assert.equal(response.status(),200);const account=await response.json();
 assert.equal((await context.request.patch(base+'/api/profile',{headers:{'X-CSRF-Token':account.csrf},data:{displayName:name,defaultCar:'ae86',complete:true}})).status(),200);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>window.touge?.state.screen==='title');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.touge.state.screen==='menu');await page.locator('#main-menu-actions [data-action=online]').click();return page;
}
try{
 const host=await pilot('DraftFollower24');await host.locator('[data-online-tab=create]').click();await host.locator('#online-create').click();await host.locator('#online-room').waitFor({state:'visible'});const code=await host.locator('#online-code-label').innerText();
 const guest=await pilot('DraftLeader24');await guest.locator('[data-online-tab=private]').click();await guest.locator('#online-code').fill(code);await guest.locator('#online-join').click();await guest.locator('#online-room').waitFor({state:'visible'});
 for(const page of [host,guest])await page.locator('#online-ready').click();await host.locator('#online-start').click();await host.locator('#race').waitFor({state:'visible'});await guest.locator('#race').waitFor({state:'visible'});
 const room=online.rooms.rooms.get(code),[follower,leader]=[...room.players.values()];
 // Place both on Akina's existing opening straight; no production cheat endpoint.
 for(const [p,s]of [[follower,70],[leader,92]])Object.assign(p.race,{s,lateral:0,speed:45,countdown:0,yaw:0,travelYaw:0});online.rooms.snapshot(room);
 for(const page of [host,guest])await page.keyboard.down('ArrowUp');
 await host.waitForFunction(()=>window.touge.state.race.draft.strength>.6);assert.equal(await host.locator('#draft-panel').getAttribute('aria-hidden'),'false');assert.equal(await host.locator('#draft-label').innerText(),'REBUFO');assert.ok(follower.race.draft.strength>.6);assert.equal(leader.race.draft.strength,0);
 await host.screenshot({path:path.join(root,'screenshots/rebufo-online.png')});
 for(let i=0;i<3;i++)await host.keyboard.press('c');await host.waitForTimeout(200);await host.screenshot({path:path.join(root,'screenshots/rebufo-interior.png')});
 await host.setViewportSize({width:390,height:844});assert.equal(await host.evaluate(()=>document.documentElement.scrollWidth),390);await host.screenshot({path:path.join(root,'screenshots/rebufo-movil.png')});
 assert.deepEqual(errors,[]);console.log('TRAFFIC UI OK: rebufo online autoritativo, barra reactiva, cámara interior y móvil.');
}finally{for(const context of contexts)await context.close();await browser.close();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();}
