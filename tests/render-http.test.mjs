// Model Render's HTTPS termination: the Node server receives plain HTTP, while
// the browser sends the public HTTPS origin. All accounts are disposable.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {WebSocket} from 'ws';
import {campaignEvents} from '../js/campaign-events.mjs';
import {RunRecorder,runSubmission} from '../js/replay.mjs';
import {ALL_CARS,ALL_TRACKS,createRace,makeTrack,updateRace} from '../js/sim.mjs';
import {activateFocus,FOCUS} from '../js/focus.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
process.env.DB_PATH=':memory:';
delete process.env.PUBLIC_URL;
const renderOrigin=process.env.RENDER_EXTERNAL_URL='https://drifters-web-game.onrender.com';
const {server,store,online,accounts}=await import('../server.mjs');
let base,nextUser=0;const sockets=[];
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{for(const ws of sockets)ws.terminate();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();});
const post=(route,data,origin=renderOrigin,session={})=>fetch(base+route,{method:route==='/api/profile'?'PATCH':'POST',headers:{'Content-Type':'application/json',Origin:origin,...(session.cookie?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:JSON.stringify(data)});
async function register(){
  const username='RenderDriver'+(++nextUser),response=await post('/api/register',{username,email:username.toLowerCase()+'@example.test',password:'render-password-24'});
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/; Secure/);
  return {username,...await response.json(),cookie:response.headers.get('set-cookie').split(';')[0]};
}
test('Render proxy supports registration, secure login, profile writes, invitation metadata and authenticated WebSocket',async()=>{
  const session=await register();assert.equal((await post('/api/profile',{complete:true},renderOrigin,session)).status,200);
  const login=await post('/api/login',{email:session.username.toLowerCase()+'@example.test',password:'render-password-24'});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=\d+; Secure/);
  const me=await (await fetch(base+'/api/session',{headers:{Cookie:session.cookie}})).json();assert.equal(me.user.id,session.user.id);assert.equal(me.user.onboarded,true);
  const info=await (await fetch(base+'/api/online')).json();assert.equal(info.publicUrl,renderOrigin);
  const ws=new WebSocket(base.replace('http','ws')+'/online',{origin:renderOrigin,headers:{Cookie:session.cookie}});sockets.push(ws);
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.close();
});
test('Render proxy rejects unrelated browser origins even with a valid session',async()=>{
  const session=await register();await post('/api/profile',{complete:true},renderOrigin,session);
  const rejected=await post('/api/register',{username:'ForgedOrigin24',email:'forgedorigin24@example.test',password:'render-password-24'},'https://attacker.example');assert.equal(rejected.status,403);assert.equal((await rejected.json()).error,'Origen no permitido.');
  assert.equal((await post('/api/profile',{displayName:'Forged'},'https://attacker.example',session)).status,403);
  const ws=new WebSocket(base.replace('http','ws')+'/online',{origin:'https://attacker.example',headers:{Cookie:session.cookie}});sockets.push(ws);ws.on('error',()=>{});
  const status=await new Promise((resolve,reject)=>{ws.once('open',()=>reject(Error('Cross-origin socket opened')));ws.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode);ws.terminate();});});assert.equal(status,403);
});
test('custom domains coexist with the Render domain and become the preferred invitation URL',async()=>{
  process.env.PUBLIC_URL='https://race.example';
  try{
    const session=await register();assert.equal((await post('/api/profile',{complete:true},'https://race.example',session)).status,200);
    assert.equal((await post('/api/profile',{displayName:'Render pilot'},renderOrigin,session)).status,200);
    assert.equal((await (await fetch(base+'/api/online')).json()).publicUrl,'https://race.example');
  }finally{delete process.env.PUBLIC_URL;}
});

test('Ashinoko saves a two-lap win with focus even when a recorded press has no effect',async()=>{
  const session=await register(),id=session.user.id;
  assert.equal((await post('/api/profile',{complete:true},renderOrigin,session)).status,200);
  store.db.prepare('UPDATE wallets SET balance=100000 WHERE user_id=?').run(id);
  const car='rx7amemiya';
  store.buy(id,'car',car);
  for(const system of ['engine','chassis','brakes'])for(const tier of [1,2,3])store.upgradeVehicle(id,car,system,tier);
  const stage='ashinoko-grid',events=campaignEvents();
  const seed=store.db.prepare('INSERT INTO campaign_progress(user_id,level_id,best_time,best_points,reward_coins,cleared_at) VALUES(?,?,120,0,0,0)');
  for(const event of events.slice(0,events.findIndex(event=>event.id===stage)))seed.run(id,event.id);
  store.claimCampaignChest(id,'chest-akagi');
  store.updateProfile(id,{focusType:'time'});
  const start=await post('/api/runs/start',{mode:'campaign',car,campaignStage:stage},renderOrigin,session);
  assert.equal(start.status,200,await start.clone().text());
  const attempt=await start.json(),track=makeTrack(ALL_TRACKS.find(track=>track.id===attempt.track));
  const race=createRace(ALL_CARS.find(item=>item.id===car),track,attempt.options),recorder=new RunRecorder();
  let repeatedPress=false;
  for(let tick=0;tick<108400&&!race.finished;tick++){
    if(tick===0||!repeatedPress&&race.focus.remaining>0){
      assert.equal(activateFocus(race),false);
      recorder.action(1);
      repeatedPress||=tick>0;
    }else if(race.focus.charge>=FOCUS.minimum&&activateFocus(race))recorder.action(1);
    const input=recorder.capture(race,driverInput(race,{line:-2.15,gripUse:.97}));
    updateRace(race,input,1/120);
  }
  assert.equal(race.laps,2);assert.equal(race.grid.length,3);assert.equal(race.won,true);
  assert.ok(race.focus.activations>0&&repeatedPress);
  const submission=await runSubmission(attempt.id,recorder.frames);
  assert.equal(submission.headers['Content-Encoding'],'gzip');
  assert.ok(submission.body.size<JSON.stringify(recorder.frames).length);
  const finish=(body,headers={})=>fetch(base+'/api/runs/finish',{method:'POST',body,headers:{
    Origin:renderOrigin,Cookie:session.cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json',...headers
  }});
  assert.equal((await finish('invalid gzip',submission.headers)).status,400);
  assert.equal((await finish(gzipSync(Buffer.alloc(4*1024*1024+1)),submission.headers)).status,413);
  const now=accounts.runs.now;
  accounts.runs.now=()=>now()+1000000;
  try{
    const response=await finish(submission.body,submission.headers);
    assert.equal(response.status,200,await response.clone().text());
    const saved=await response.json();
    assert.equal(saved.time,race.elapsed);
    assert.equal(saved.points,Math.floor(race.skill.points));
    assert.ok(saved.completed&&saved.won&&saved.reward.coins>0);
    assert.equal(saved.reward.stage,stage);
    assert.ok(saved.user.campaign.some(event=>event.id===stage));
    const retry=await finish(JSON.stringify({id:attempt.id,frames:recorder.frames}));
    assert.equal(retry.status,200);
    assert.deepEqual(await retry.json(),saved);
    assert.equal(store.stats(id).races,1);
  }finally{accounts.runs.now=now;}
});
