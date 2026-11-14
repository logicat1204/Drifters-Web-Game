import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {openPlayMode} from './helpers/play-mode.mjs';

process.env.DB_PATH = ':memory:';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {server, online, store} = await import('../server.mjs');
const {ALL_CARS} = await import('../js/sim.mjs');
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.BROWSER_EXECUTABLE,
  args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
const errors=[];
async function pilot(name, mobile=false) {
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36'}:{viewport:{width:1440,height:900}});
  const response=await context.request.post(base+'/api/register',{data:{username:name,email:name.toLowerCase()+'@example.test',password:'DrivingOptionsQA24'}});
  assert.equal(response.status(),200);
  const {user,csrf}=await response.json();
  assert.deepEqual(user.cars,[]);
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{if(!localStorage.getItem('touge-settings'))localStorage.setItem('touge-settings',JSON.stringify({camera:'3',quality:'1',song:'none',transmission:'manual'}));});
  await page.goto(base);
  await page.waitForFunction(()=>window.touge?.state.screen==='title');
  await page.locator('#title-enter').click();
  await page.locator('#account-panel').waitFor();
  assert.equal(await page.locator('#profile-car').inputValue(),'');
  assert.deepEqual(await page.locator('#profile-car option').evaluateAll(options=>options.map(option=>option.value)),['','ae86','rx7','r32']);
  await page.locator('#profile-car').selectOption(mobile?'ae86':'rx7');
  await page.locator('#profile-save').click();
  await page.locator('#account-panel').waitFor({state:'hidden'});
  await page.locator('#welcome-dialog button[value=menu]').click();
  const session=await(await context.request.get(base+'/api/session')).json();
  assert.deepEqual(session.user.cars,[mobile?'ae86':'rx7']);
  return {page,context,csrf};
}
const settings = async page => {
  await page.locator('#main-menu-actions [data-action=settings]').click();
  await page.locator('[data-settings-tab=controls]').click();
};
const closeSettings = page => page.locator('#settings-panel [data-action=close]').click();
async function drive(page) {
  await openPlayMode(page,'time');
  await page.locator('#start').click();
  await page.waitForFunction(()=>touge.state.race?.countdown===0);
}
async function quit(page) {
  await page.locator('#race [data-action=pause]').click();
  await page.locator('#pause-panel [data-action=quit]').click();
  await page.waitForFunction(()=>touge.state.screen==='menu');
}
async function gear(page, number) {await page.waitForFunction(n=>touge.state.race.gear===n,number);}
try {
  const desktop=await pilot('ControlDesktop24'),page=desktop.page;
  const shop=await(await desktop.context.request.get(base+'/api/shop')).json();
  assert.equal(shop.cars.length,ALL_CARS.length);
  assert.ok(shop.cars.every(car=>car.price>0));

  await settings(page);
  assert.equal(await page.locator('#transmission').inputValue(),'sequential');
  await closeSettings(page);
  await openPlayMode(page,'time');
  await page.locator('#time-weather').selectOption('wet');
  await page.locator('#home [data-action=ranking]').click();
  await page.locator('#ranking-conditions').filter({hasText:'MOJADO'}).waitFor();
  await page.locator('#ranking-panel [data-action=close]').click();
  await page.locator('#start').click();
  await page.waitForFunction(()=>touge.state.race?.countdown===0);
  assert.equal(await page.evaluate(()=>touge.state.race.wet),true);
  await page.keyboard.press('e');await gear(page,2);
  await page.keyboard.press('q');await gear(page,1);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>touge.cabin.pose?.steer<-.5);
  await page.keyboard.up('ArrowRight');
  await quit(page);

  await settings(page);
  await page.locator('#transmission').selectOption('direct');
  await page.getByRole('button',{name:'Asignar marcha 4'}).click();
  await page.keyboard.press('j');
  assert.match(await page.getByRole('button',{name:'Asignar marcha 4'}).innerText(),/J/);
  await closeSettings(page);
  await drive(page);
  await page.keyboard.press('j');await gear(page,4);
  await page.keyboard.press('2');await gear(page,2);
  await quit(page);

  await settings(page);
  await page.locator('#transmission').selectOption('shifter');
  await page.locator('#settings-panel [data-action=control-layout]').click();
  assert.equal(await page.locator('#control-layout').inputValue(),'shifter');
  const previewShifter=page.locator('#control-preview [data-control=shifter]');
  await previewShifter.focus();
  await page.keyboard.press('ArrowLeft');
  await page.locator('#control-size').fill('26');
  await page.locator('#control-layout-panel .start-button').click();
  await closeSettings(page);
  await drive(page);
  const shifter=page.locator('#touch-controls [data-control=shifter]');
  const box=await shifter.boundingBox();
  const at=(x,y)=>[box.x+box.width*x,box.y+box.height*y];
  await page.mouse.click(...at(.5,.81));await gear(page,4);
  await page.mouse.move(...at(.5,.81));await page.mouse.down();
  await page.mouse.move(...at(.5,.5),{steps:4});await page.mouse.move(...at(.82,.5),{steps:4});
  await page.mouse.move(...at(.82,.19),{steps:4});await page.mouse.up();await gear(page,5);
  await quit(page);
  await desktop.context.close();

  const mobile=await pilot('ControlMobile24',true),phone=mobile.page;
  await settings(phone);
  assert.equal(await phone.locator('#transmission option[value=direct]').evaluate(option=>option.disabled),true);
  assert.equal(await phone.locator('#transmission option[value=shifter]').evaluate(option=>option.disabled),true);
  await phone.locator('#settings-panel [data-action=control-layout]').click();
  await phone.locator('#touch-steering').selectOption('wheel');
  const gasPreview=phone.locator('#control-preview [data-control=throttle]');
  await gasPreview.focus();
  await phone.keyboard.press('ArrowUp');
  await phone.locator('#control-size').fill('21');
  const position=await phone.evaluate(()=>JSON.parse(localStorage.getItem('touge-settings')).controlLayouts.portrait.throttle);
  assert.equal(position[0],.89);assert.ok(Math.abs(position[1]-.84)<1e-9);assert.equal(position[2],.21);
  await phone.locator('#control-layout-panel .start-button').click();
  await closeSettings(phone);
  await drive(phone);
  assert.equal(await phone.locator('#touch-controls [data-control=left]').isVisible(),false);
  await phone.locator('#touch-controls [data-control=up]').tap();await gear(phone,2);
  const cdp=await mobile.context.newCDPSession(phone);
  const wheel=await phone.locator('#touch-controls [data-control=wheel]').boundingBox();
  const gas=await phone.locator('#touch-controls [data-control=throttle]').boundingBox();
  const pedal={id:1,x:Math.round(gas.x+gas.width/2),y:Math.round(gas.y+gas.height/2)};
  const center={x:wheel.x+wheel.width/2,y:wheel.y+wheel.height/2};
  const rim={id:2,x:Math.round(center.x),y:Math.round(center.y-wheel.width*.4)};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pedal]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pedal,rim]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[pedal,{id:2,x:Math.round(center.x+wheel.width*.37),y:Math.round(center.y-wheel.width*.13)}]});
  await phone.waitForFunction(()=>touge.cabin.pose?.steer<-.4&&touge.state.race.speed>2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.waitForFunction(()=>Math.abs(touge.cabin.pose.steer)<.1);
  await quit(phone);
  await phone.setViewportSize({width:844,height:390});
  await settings(phone);
  await phone.locator('#settings-panel [data-action=control-layout]').click();
  assert.equal(await phone.locator('#control-layout').inputValue(),'landscape');
  await phone.locator('#touch-steering').selectOption('buttons');
  await phone.locator('#control-layout-panel .start-button').click();
  await closeSettings(phone);
  await drive(phone);
  assert.equal(await phone.locator('#touch-controls [data-control=wheel]').isVisible(),false);
  const left=await phone.locator('#touch-controls [data-control=left]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:Math.round(left.x+left.width/2),y:Math.round(left.y+left.height/2)}]});
  await phone.waitForFunction(()=>touge.cabin.pose?.steer>.5);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await quit(phone);
  assert.deepEqual(errors,[]);
  console.log('DRIVING OPTIONS OK: one starter, full shop, wet ranking, three manual modes, movable H pattern, mobile layout, multitouch wheel and shift.');
} finally {
  await browser.close();
  for(const ws of online.wss.clients)ws.terminate();
  await new Promise(resolve=>server.close(resolve));
  store.close();
}
