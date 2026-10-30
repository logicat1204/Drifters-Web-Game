import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Store} from '../server/store.mjs';
import {Runs} from '../server/runs.mjs';
import {CAMPAIGN_STAGES,CAMPAIGN_CHAPTERS,CAMPAIGN_LEVELS,DRIVER_STYLES,campaignReward,campaignReplayReward} from '../js/campaign.mjs';
import {CARS,ALL_CARS,ALL_TRACKS,createRace,makeTrack,updateRace} from '../js/sim.mjs';
import {activateFocus,updateFocus,FOCUS_TYPES} from '../js/focus.mjs';
import {defaultAvatar,COSMETICS} from '../js/avatar.mjs';
import {RunRecorder} from '../js/replay.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
const media=JSON.parse(readFileSync(new URL('../assets/campaign-media.json',import.meta.url)));
function stageRace(stage,car=CARS[2]){const chapter=CAMPAIGN_CHAPTERS.find(c=>c.id===stage.chapter);return createRace(car,makeTrack(ALL_TRACKS.find(t=>t.id===stage.track)),{mode:'campaign',campaignStage:stage.id,rival:stage,wet:!!chapter.wet,fog:!!chapter.fog,focusEnabled:false});}
function win(store,user,stage,index=0,points=9000){const race=stageRace(stage);Object.assign(race,{s:race.track.length,elapsed:160,finished:true,won:true});race.skill.points=points;return store.addRun('win-'+stage.id+'-'+index,user.id,race);}
async function fixture(){const store=new Store(':memory:'),user=await store.register('CampaignDriver','night-password-24');return {store,user};}
test('the guide has 24 ordered opponents, nine campaigns and real portrait/comic files',()=>{
  assert.equal(CAMPAIGN_STAGES.length,24);assert.equal(CAMPAIGN_CHAPTERS.length,9);assert.equal(CAMPAIGN_LEVELS.length,5);assert.equal(new Set(CAMPAIGN_STAGES.map(s=>s.id)).size,24);
  for(const stage of CAMPAIGN_STAGES){assert.ok(stage.level>=1&&stage.level<=5);assert.ok(DRIVER_STYLES[stage.style]);assert.ok(ALL_CARS.some(c=>c.id===stage.car));assert.ok(ALL_TRACKS.some(t=>t.id===stage.track));for(const src of [media.stages[stage.id].portrait,...media.stages[stage.id].comics])assert.ok(existsSync(new URL('..'+decodeURIComponent(src),import.meta.url)),src);}
  assert.deepEqual(CAMPAIGN_STAGES.filter(s=>s.unlock).map(s=>[s.id,s.unlock]),[['takumi-initial','balance'],['keisuke-initial','time'],['kai-campaign','drift']]);
});
test('progression, concentration and car ownership are enforced before an attempt starts',async()=>{
  const {store,user}=await fixture();try{const runs=new Runs(store);assert.deepEqual(user.focusUnlocked,[]);assert.equal(user.focusType,'balance');assert.equal(user.coins,0);
    assert.throws(()=>runs.start(user.id,{car:'ae86',track:'akina',mode:'campaign',campaignStage:'takumi-initial',difficulty:'easy'}),/bloqueado/);
    const first=runs.start(user.id,{car:'ae86',track:'manazuru',mode:'campaign',campaignStage:'kenji',difficulty:'hard',focusType:'time',focusEnabled:true});assert.equal(first.track,'akina');assert.equal(first.options.rival.id,'kenji');assert.equal(first.options.rival.level,1);assert.equal(first.options.focusEnabled,false);assert.equal(first.options.focusType,'balance');
    assert.throws(()=>store.updateProfile(user.id,{focusType:'drift'}),/bloqueada/);assert.throws(()=>store.updateProfile(user.id,{defaultCar:'gt86'}),/Compra/);assert.throws(()=>runs.start(user.id,{car:'gt86',track:'akina',mode:'time',difficulty:'easy'}),/comprado/);
    store.updateProfile(user.id,{arcadeStage:9});assert.equal(store.user(user.id).campaign.length,0);
  }finally{store.close();}
});
test('first wins unlock in order and bounded score improvements never grant duplicate coins',async()=>{
  const {store,user}=await fixture();try{
    const first=win(store,user,CAMPAIGN_STAGES[0]);assert.equal(first.reward.coins,campaignReward(CAMPAIGN_STAGES[0],9000));const balance=first.user.coins;
    assert.equal(win(store,user,CAMPAIGN_STAGES[0]).user.coins,balance);assert.equal(win(store,user,CAMPAIGN_STAGES[0],1).reward.coins,campaignReplayReward(CAMPAIGN_STAGES[0],9000));
    const better=win(store,user,CAMPAIGN_STAGES[0],2,999999);assert.equal(better.reward.coins,100+campaignReplayReward(CAMPAIGN_STAGES[0],999999));assert.equal(win(store,user,CAMPAIGN_STAGES[0],3,99999999).reward.coins,campaignReplayReward(CAMPAIGN_STAGES[0],99999999));
    for(const stage of CAMPAIGN_STAGES.slice(1,7))win(store,user,stage);
    assert.deepEqual(store.user(user.id).focusUnlocked,['balance','time','drift']);store.updateProfile(user.id,{focusType:'time'});assert.deepEqual(store.loadout(user.id),{focusType:'time',focusEnabled:true});
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM economy_ledger WHERE id=?').get('reward:win-kenji-0').n,1);
  }finally{store.close();}
});
test('defeats, ordinary duels and online results cannot mint campaign rewards',async()=>{
  const {store,user}=await fixture();try{for(const [i,props,source]of [[0,{won:false},'solo'],[1,{mode:'battle',won:true},'solo'],[2,{won:true},'online']]){const r=stageRace(CAMPAIGN_STAGES[0]);Object.assign(r,{s:r.track.length,elapsed:160,finished:true,...props});store.addRun('no-reward-'+i,user.id,r,source);}assert.equal(store.user(user.id).coins,0);assert.equal(store.user(user.id).campaign.length,0);
  }finally{store.close();}
});
test('purchases are permanent, gender-scoped, atomic and idempotent',async()=>{
  const {store,user}=await fixture();try{
    assert.throws(()=>store.buy(user.id,'car','gt86'),/suficientes/);assert.equal(store.user(user.id).coins,0);
    for(const stage of CAMPAIGN_STAGES.slice(0,7))win(store,user,stage);
    const before=store.user(user.id).coins,bought=store.buy(user.id,'car','180sx');assert.equal(bought.user.coins,before-900);assert.equal(store.buy(user.id,'car','180sx').user.coins,before-900);assert.equal(store.updateProfile(user.id,{defaultCar:'180sx'}).defaultCar,'180sx');
    assert.throws(()=>store.updateProfile(user.id,{avatar:{...defaultAvatar('female'),outfit:'bikini'}}),/inventario/);
    store.buy(user.id,'cosmetic','female.outfit.bikini');store.updateProfile(user.id,{avatar:{...defaultAvatar('female'),outfit:'bikini'}});assert.equal(store.user(user.id).avatar.outfit,'bikini');
    assert.throws(()=>store.buy(user.id,'cosmetic','male.outfit.bikini'),/inválido/);
    const coins=store.user(user.id).coins;store.db.exec("CREATE TRIGGER fail_purchase BEFORE INSERT ON inventory WHEN NEW.item_id='male.hair.racer-cap' BEGIN SELECT RAISE(ABORT,'test rollback'); END;");assert.throws(()=>store.buy(user.id,'cosmetic','male.hair.racer-cap'),/rollback/);assert.equal(store.user(user.id).coins,coins);assert.ok(!store.user(user.id).cosmetics.includes('male.hair.racer-cap'));
    assert.ok(COSMETICS.filter(c=>!c.starter).length>=25);
  }finally{store.close();}
});
test('a real campaign replay grants the first clear, while fabricated focus actions fail for a locked account',async()=>{
  let now=0;const {store,user}=await fixture(),runs=new Runs(store,{now:()=>now});try{
    const attempt=runs.start(user.id,{car:'r32',mode:'campaign',campaignStage:'kenji',difficulty:'normal'}),r=createRace(CARS[2],makeTrack(ALL_TRACKS.find(t=>t.id===attempt.track)),attempt.options),recorder=new RunRecorder();
    for(let i=0;i<120*900&&!r.finished;i++)updateRace(r,recorder.capture(r,driverInput(r)),1/120);assert.equal(r.won,true);now=900000;
    const saved=await runs.submit(user.id,attempt.id,recorder.frames);assert.equal(saved.user.campaign[0].id,'kenji');assert.ok(saved.reward.coins>=300);assert.equal((await runs.submit(user.id,attempt.id,[])).user.coins,saved.user.coins);
    const bad=runs.start(user.id,{car:'ae86',track:'usui',mode:'time',difficulty:'normal'});await assert.rejects(runs.submit(user.id,bad.id,[[1,0,1,1,1]]),/concentración inválida/);
  }finally{store.close();}
});
test('Ashinoko forces rain and fog and ignores a submitted dry daytime setup',async()=>{
  const {store,user}=await fixture();try{for(const stage of CAMPAIGN_STAGES.slice(0,17))win(store,user,stage);const attempt=new Runs(store).start(user.id,{car:'ae86',mode:'campaign',campaignStage:'sakamoto',difficulty:'easy',wet:false,fog:false,night:true});assert.equal(attempt.options.wet,true);assert.equal(attempt.options.fog,true);assert.equal(attempt.options.night,false);assert.equal(attempt.options.rival.level,3);
  }finally{store.close();}
});
test('each concentration specialization has a measurable bounded effect and obeys the same short duration',()=>{
 const make=type=>{const r=createRace(CARS[0],makeTrack(ALL_TRACKS[0]),{mode:'time',focusType:type});Object.assign(r,{countdown:0,speed:30,lateral:0});r.focus.charge=100;assert.equal(activateFocus(r),true);return r;};
 const locked=createRace(CARS[0],makeTrack(ALL_TRACKS[0]),{mode:'time',focusEnabled:false});locked.countdown=0;locked.focus.charge=100;assert.equal(activateFocus(locked),false);updateFocus(locked,.1,.02,20);assert.equal(locked.focus.charge,0);
 for(const type of Object.keys(FOCUS_TYPES)){const r=make(type);for(let i=0;i<120;i++)updateRace(r,{throttle:true},1/120);assert.ok(r.speed<=r.car.max*FOCUS_TYPES[type].topSpeed);assert.ok(r.focus.remaining<4.01&&r.focus.remaining>3.98);}
 const time=make('time'),balance=make('balance');for(let i=0;i<60;i++){updateRace(time,{throttle:true},1/120);updateRace(balance,{throttle:true},1/120);}assert.ok(time.speed>balance.speed+1);
 const brakingTime=make('time'),brakingBalance=make('balance');for(let i=0;i<60;i++){updateRace(brakingTime,{brake:true},1/120);updateRace(brakingBalance,{brake:true},1/120);}assert.ok(brakingTime.speed<brakingBalance.speed-5);
 const drift=make('drift'),balanced=make('balance');updateRace(drift,{},.01);updateRace(balanced,{},.01);assert.ok(drift.cornerSpeed>balanced.cornerSpeed*1.1);
});
test('all 24 campaign AIs maneuver physically and finish, with no guardrail impacts',()=>{
 for(const stage of CAMPAIGN_STAGES){const r=stageRace(stage);r.countdown=0;r.timeLeft=10000;let brakes=0,turns=0,impacts=0;for(let i=0;i<900*120&&!r.rivalFinished;i++){const previous=r.opponent?.wallCooldown??0;updateRace(r,{},1/120);if(r.rivalBraking)brakes++;if(Math.abs(r.rivalSteer)>.1)turns++;if((r.opponent?.wallCooldown??0)>previous+.1)impacts++;}assert.ok(r.rivalFinished,stage.id);assert.ok(brakes>120,stage.id);assert.ok(turns>300,stage.id);assert.equal(impacts,0,stage.id);}
});
test('each campaign stage can be won with a starter machine and a physically driven passing line',()=>{
  for(const stage of CAMPAIGN_STAGES){let won=false;
    for(const line of [-2.5,2.5,0]){for(const car of CARS.slice(0,3)){
      const r=stageRace(stage,car);r.countdown=0;r.timeLeft=10000;r.focus.enabled=stage.index>=3;r.focus.type=stage.index>=7?'drift':'balance';
      for(let i=0;i<108000&&!r.finished;i++){if(r.focus.charge>=90)activateFocus(r);updateRace(r,driverInput(r,{line}),1/120);}
      if(r.won){won=true;break;}
    }if(won)break;}
    assert.ok(won,stage.id+' must be beatable without purchases');
  }
});
test('the five difficulty levels have strictly increasing physical pace on the same course and car',()=>{
  const times=[];for(let level=1;level<=5;level++){const r=stageRace({...CAMPAIGN_STAGES[2],level});r.countdown=0;r.timeLeft=10000;for(let i=0;i<108000&&!r.rivalFinished;i++)updateRace(r,{},1/120);assert.ok(r.rivalFinished);times.push(r.elapsed);}for(let i=1;i<times.length;i++)assert.ok(times[i]<times[i-1],JSON.stringify(times));
});
