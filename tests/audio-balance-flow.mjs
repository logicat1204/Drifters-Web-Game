import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
process.env.DB_PATH=':memory:';process.env.DB_BACKEND='sqlite';
const {server,store}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:process.env.RENDER_BACKEND==='native'?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  const baseline=process.env.AUDIO_BASELINE_FILE?await readFile(process.env.AUDIO_BASELINE_FILE,'utf8'):null;
  if(baseline)await page.route('**/js/audio-baseline.js',route=>route.fulfill({contentType:'text/javascript',body:baseline}));
  await page.goto(base+'/api/health');
  const results=await page.evaluate(async hasBaseline=>{
    const current=await import('/js/driving-audio.js');
    const previous=hasBaseline?await import('/js/audio-baseline.js'):null;
    const scenarios=[
      {name:'engine',engine:35,tires:0},
      {name:'tires',engine:0,tires:35,drift:.65,slipAngle:.18,gripUsage:1.1},
      {name:'brakes',engine:0,tires:35,brake:true},
      {name:'grip-corner',engine:0,tires:35,gripUsage:.85},
      {name:'cabin-engine',engine:35,tires:0,interior:true},
      {name:'maximum',engine:100,tires:100,weather:100,brake:true,drift:.9,wet:true,rivals:true,zone:1},
      {name:'zero',engine:0,tires:0,weather:0,drift:1,brake:true},
      {name:'paused',engine:100,tires:100,drift:1,active:false}
    ];
    const render=async(Driver,test)=>{
      const ctx=new OfflineAudioContext(2,24000*2,24000),audio=new Driver(ctx,ctx.destination);
      await audio.ready;
      const race={car:{id:'ae86'},s:500,lateral:0,speed:50,rpm:6500,drift:test.drift||0,slipAngle:test.slipAngle||0,gripUsage:test.gripUsage||0,
        understeer:0,wet:!!test.wet,mode:'time',skill:{intensity:test.zone||0}};
      if(test.rivals){race.online=true;race.netOpponents=['rx7','r32','s2000'].map((carId,i)=>({id:String(i),carId,s:501+i*3,lateral:i-1,speed:50}));}
      audio.update(race,test.active!==false,{engineVolume:test.engine,tireVolume:test.tires,weatherVolume:test.weather||0,camera:test.interior?'3':'0'},{throttle:1,brake:!!test.brake});
      const buffer=await ctx.startRendering();
      let peak=0,sum=0,high=0,count=0;
      for(let channel=0;channel<buffer.numberOfChannels;channel++){
        const data=buffer.getChannelData(channel);
        for(let i=4800;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));sum+=data[i]*data[i];high+=(data[i]-data[i-1])**2;count++;}
      }
      return {peak,rms:Math.sqrt(sum/count),high:Math.sqrt(high/count),status:audio.status};
    };
    const out=[];
    for(const test of scenarios)out.push({name:test.name,current:await render(current.DrivingAudio,test),previous:previous?await render(previous.DrivingAudio,test):null});
    return out;
  },!!baseline);
  for(const result of results){
    assert.equal(result.current.status,'recordings');
    assert.ok(result.current.peak<.98,JSON.stringify(result));
    if(['zero','paused'].includes(result.name))assert.ok(result.current.rms<1e-6,JSON.stringify(result));
    else assert.ok(result.current.rms>.004,JSON.stringify(result));
  }
  const find=name=>results.find(result=>result.name===name);
  assert.ok(find('tires').current.rms>.008);
  assert.ok(find('cabin-engine').current.high<find('engine').current.high);
  if(baseline){
    assert.ok(find('engine').current.rms>find('engine').previous.rms*1.3);
    assert.ok(find('tires').current.rms>find('tires').previous.rms*4);
    assert.ok(find('brakes').current.rms>find('brakes').previous.rms*4);
  }
  const game=await readFile(new URL('../js/game.js',import.meta.url),'utf8');
  await page.route('**/js/game.js',route=>route.fulfill({contentType:'text/javascript',body:game+'\nwindow.audioBalanceFixture={sound,settings};'}));
  await page.addInitScript(()=>localStorage.setItem('touge-settings',JSON.stringify({engineVolume:35,tireVolume:35,musicVolume:50,quality:'1',performanceDisplay:'off'})));
  await page.goto(base);await page.waitForFunction(()=>window.touge?.state.screen==='title');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>window.touge.audio.status==='recordings');
  const mixer=await page.evaluate(async()=>{
    const {sound,settings}=window.audioBalanceFixture;
    const saved=[settings.engineVolume,settings.tireVolume,settings.musicVolume];
    await sound.play({id:'audio-check',url:'/assets/audio/engines/high.wav'});
    sound.update({car:{id:'ae86'},s:500,lateral:0,mode:'time',rpm:6500,gear:4,speed:50,drift:.8,slipAngle:.2,gripUsage:1.1,skill:{intensity:1}},true,{throttle:true,brake:true});
    const result={saved,routed:sound.fileSource.mediaElement===sound.audio,elementVolume:sound.audio.volume,duck:sound.musicDuck,context:sound.ctx.state};
    sound.stop();
    return result;
  });
  assert.deepEqual(mixer.saved,[35,35,50]);
  assert.equal(mixer.routed,true);assert.equal(mixer.elementVolume,1);assert.equal(mixer.context,'running');
  assert.ok(mixer.duck>=.62&&mixer.duck<.8);
  assert.deepEqual(errors,[]);
  await mkdir('data',{recursive:true});await writeFile('data/audio-balance.json',JSON.stringify({results,mixer},null,2));
  console.log('AUDIO BALANCE OK',JSON.stringify({results:results.map(({name,current,previous})=>({name,rms:current.rms,peak:current.peak,previousRms:previous?.rms})),mixer}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));store.close();}
