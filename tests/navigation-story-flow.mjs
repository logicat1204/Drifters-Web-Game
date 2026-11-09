import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
process.env.DB_PATH=':memory:';process.env.DB_BACKEND='sqlite';
const {server,store}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const wave=Buffer.alloc(44+16000*3);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
await page.route('**/story-effect-test/*.wav',route=>route.fulfill({contentType:'audio/wav',body:wave}));
try{
  await page.goto(base+'/api/health');
  await page.evaluate(async base=>{
    const [{Renderer},sim,{campaignStage},{drawNavigation}]=await Promise.all([import(base+'/js/renderer.js'),import(base+'/js/sim.mjs'),import(base+'/js/campaign.mjs'),import(base+'/js/minimap.mjs')]);
    document.body.innerHTML='<canvas id="world"></canvas><canvas id="minimap"></canvas>';
    const style=document.createElement('style');style.textContent='body{margin:0;background:#090f17}#world{width:1000px;height:700px;display:block}#minimap{position:absolute;bottom:30px;left:30px;width:190px;height:210px;border:1px solid #ffffff55}';document.head.append(style);
    const renderer=new Renderer(document.getElementById('world')),stage=campaignStage('shinji-campaign'),track=sim.makeTrack(sim.ALL_TRACKS.find(t=>t.id===stage.track));
    renderer.quality=1;renderer.setTrack(track);renderer.setCar(sim.CARS[0]);renderer.setRival(stage);renderer.cameraMode=1;
    const race=sim.createRace(sim.CARS[0],track,{rival:stage,night:true});
    Object.assign(race,{s:650,rivalS:672,rivalLateral:.5,rivalYaw:.12,speed:35,countdown:0,elapsed:22,headlights:false});
    race.boss.ray=.8;
    const original=renderer.draw;let trails=0;
    renderer.draw=function(mesh,...args){if(mesh===this.bossLightTrail)trails++;return original.call(this,mesh,...args);};
    renderer.render(race,'race',.02,{day:false,shake:false});
    drawNavigation(document.getElementById('minimap'),track,race);
    if(trails!==9||renderer.bossRay!==undefined)throw Error('La estela debe usar segmentos sobre la carretera.');
    if(renderer.gl.getError()!==renderer.gl.NO_ERROR)throw Error('Error WebGL al dibujar la estela.');
    window.navigationFixture={renderer,race,drawNavigation,track};
  },base);
  await mkdir('data',{recursive:true});
  await page.screenshot({path:'data/navigation-shinji.png'});
  await page.evaluate(()=>{
    const {race,track,drawNavigation}=window.navigationFixture;
    race.online=true;race.netOpponents=[{id:'a',s:race.s+1,lateral:1},{id:'b',s:race.s+2,lateral:-1},{id:'c',s:race.s+3,lateral:0}];
    drawNavigation(document.getElementById('minimap'),track,race);
  });
  await page.locator('#minimap').screenshot({path:'data/navigation-four-drivers.png'});
  await page.goto(base+'/api/health');
  await page.evaluate(async base=>{
    const [{ProgressionClient},{StoryPageAudio}]=await Promise.all([import(base+'/js/progression.js'),import(base+'/js/story-audio.mjs')]);
    document.body.innerHTML='<div id="app"></div><select id="shop-base"></select><button id="campaign-start">Abrir</button><button id="next-arcade"></button><section id="comic-overlay" hidden><span id="comic-eyebrow"></span><h2 id="comic-title"></h2><button id="comic-zoom"></button><button id="comic-cancel">Cerrar</button><div id="comic-reader"><img id="comic-image"></div><span id="comic-page"></span><small id="comic-music"></small><button id="comic-prev">Anterior</button><button id="comic-next"><span></span></button></section>';
    const style=document.createElement('style');style.textContent='.hidden{display:none}#comic-image{height:280px}';document.head.append(style);
    document.getElementById('comic-overlay').hidden=false;
    const effects=new StoryPageAudio(),music=new Audio(base+'/story-effect-test/background.wav'),played=[];
    music.loop=true;
    const p=new ProgressionClient({user:{}},{
      storyAudio:()=>music.play().catch(()=>{}),
      storyPage:file=>{effects.play(file);if(file)played.push(file.url);},
      storyStop:()=>{effects.stop();music.pause();}
    });
    const stage={id:'fixture',chapter:'akina',name:'Fixture',media:{storyStart:[base+'/assets/avatars/v2/base-male.png',base+'/assets/avatars/v2/base-female.png'],
      storySoundsStart:[{url:base+'/story-effect-test/001.wav'},{url:base+'/story-effect-test/002.wav'}]}};
    p.catalog={chapters:[{id:'akina',name:'Akina'}],stages:[stage]};
    document.getElementById('campaign-start').onclick=()=>p.openStory(stage,'start');
    window.storyFixture={effects,music,played,p};
  },base);
  await page.locator('#campaign-start').click();
  await page.waitForFunction(()=>window.storyFixture.played.length===1&&!window.storyFixture.effects.audio.paused);
  await page.locator('#comic-next').click();
  await page.waitForFunction(()=>window.storyFixture.played.length===2&&!window.storyFixture.effects.audio.paused);
  assert.equal(await page.evaluate(()=>window.storyFixture.music.paused),false);
  await page.locator('#comic-prev').click();
  await page.waitForFunction(()=>window.storyFixture.played.length===3);
  assert.deepEqual(await page.evaluate(()=>window.storyFixture.played.map(url=>url.split('/').at(-1))),['001.wav','002.wav','001.wav']);
  await page.locator('#comic-cancel').click();
  assert.deepEqual(await page.evaluate(()=>({page:window.storyFixture.effects.audio.paused,music:window.storyFixture.music.paused,inert:document.getElementById('app').inert})),{page:true,music:true,inert:false});
  assert.deepEqual(errors,[]);
  console.log('NAVIGATION/STORY OK — WebGL, estela horizontal, cuatro marcadores, sonidos por página, retroceso y limpieza.');
}catch(error){
  console.error('Navigation/story errors',errors);
  console.error(await page.evaluate(()=>({played:window.storyFixture?.played,open:window.storyFixture?.p.comicOpen,
    image:document.getElementById('comic-image')?.src,imageReady:document.getElementById('comic-image')?.naturalWidth,
    page:document.getElementById('comic-page')?.textContent,paused:window.storyFixture?.effects.audio.paused,
    audioError:window.storyFixture?.effects.audio.error?.message})));
  throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
