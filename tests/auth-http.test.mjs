import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {server,store,accounts} from '../server.mjs';
import {CARS,TRACKS,createRace,makeTrack,updateRace} from '../js/sim.mjs';
import {RunRecorder} from '../js/replay.mjs';
import {defaultAvatar} from '../js/avatar.mjs';
import {driverInput} from './helpers/reference-driver.mjs';
let base,id=0;
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));});
async function request(route,method='GET',data,session,extra={}){return fetch(base+route,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),Origin:base,...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{}),...extra},body:data?JSON.stringify(data):undefined});}
async function register(){const response=await request('/api/register','POST',{username:'HTTPUser'+(++id),password:'http-password-24'});assert.equal(response.status,200);const data=await response.json();return {...data,cookie:response.headers.get('set-cookie').split(';')[0]};}
test('HTTP registration checks availability, sets an HttpOnly session and requires onboarding before online',async()=>{
  assert.equal((await request('/api/rooms')).status,401);const session=await register();assert.equal((await request('/api/rooms','GET',null,session)).status,403);const me=await (await request('/api/session','GET',null,session)).json();assert.equal(me.user.id,session.user.id);assert.equal(me.user.onboarded,false);assert.equal(me.csrf,session.csrf);
  const availability=await (await request('/api/username?name='+session.user.username.toLowerCase())).json();assert.equal(availability.available,false);assert.equal((await request('/api/register','POST',{username:session.user.username.toLowerCase(),password:'different-password'})).status,409);
  const login=await request('/api/login','POST',{username:session.user.username.toUpperCase(),password:'http-password-24'});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
  assert.equal((await request('/api/login','POST',{username:session.user.username,password:'wrong-password'})).status,401);
});
test('CSRF and origin checks protect profile writes; identity and car cannot be forged through protected routes',async()=>{
  const s=await register();assert.equal((await request('/api/profile','PATCH',{complete:true},s,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await request('/api/profile','PATCH',{complete:true},s,{Origin:'https://attacker.example'})).status,403);
  const response=await request('/api/profile','PATCH',{complete:true,displayName:'Takumi personalizado',defaultCar:'supra',userId:'another-user'},s);assert.equal(response.status,200);assert.equal((await response.json()).user.defaultCar,'supra');assert.equal(store.user(s.user.id).displayName,'Takumi personalizado');assert.equal((await request('/api/rooms','GET',null,s)).status,200);
  assert.equal((await request('/server/store.mjs')).status,403);assert.equal((await request('/data/touge.sqlite')).status,403);
});
test('portrait uploads accept bounded images, reject SVG and invalid images, and avatars still work after a photo',async()=>{
  const s=await register(),bytes=await readFile(new URL('../assets/avatars/v2/base-female.png',import.meta.url));
  assert.equal((await request('/api/profile/photo','POST',{image:'data:image/svg+xml;base64,PHN2Zy8+'},s)).status,400);
  assert.equal((await request('/api/profile/photo','POST',{image:'data:image/png;base64,'+Buffer.alloc(40).toString('base64')},s)).status,400);
  assert.equal((await request('/api/profile/photo','POST',{image:'data:image/png;base64,'+bytes.toString('base64')},s)).status,200);
  const photo=await request('/api/profile/photo','GET',null,s);assert.equal(photo.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),bytes);
  const update=await request('/api/profile','PATCH',{complete:true,portraitMode:'photo'},s);const user=(await update.json()).user;assert.equal(user.portraitMode,'photo');assert.equal((await request(user.portraitUrl)).headers.get('content-type'),'image/png');
  assert.equal((await request('/api/profile','PATCH',{portraitMode:'avatar',avatar:{...defaultAvatar('female'),hair:'long',outfit:'hoodie',accessory:'headband'}},s)).status,200);assert.equal((await request('/api/users/'+user.id+'/portrait')).headers.get('content-type'),'image/svg+xml');
});

test('HTTP avatar catalog separates bases and preview rejects invalid combinations before sending image headers',async()=>{
  const catalog=await (await request('/api/avatar/catalog')).json();assert.equal(catalog.version,2);assert.ok(catalog.options.female.hair.some(([id])=>id==='ponytail'));assert.ok(!catalog.options.male.hair.some(([id])=>id==='ponytail'));
  assert.equal((await request('/api/avatar/preview?base=female')).headers.get('content-type'),'image/svg+xml');
  const invalid=await request('/api/avatar/preview?base=male&hair=ponytail');assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/hair/);
  const s=await register();assert.equal((await request('/api/profile','PATCH',{avatar:{...defaultAvatar('female'),accessory:'cap'}},s)).status,400);
});
test('logout invalidates the actual cookie; records stay isolated to their authenticated owner',async()=>{
  const a=await register(),b=await register();await request('/api/profile','PATCH',{complete:true},a);await request('/api/profile','PATCH',{complete:true},b);
  const personal=await (await request('/api/records/me','GET',null,b)).json();assert.equal(personal.stats.races,0);assert.equal((await request('/api/logout','POST',{},a)).status,200);assert.equal((await request('/api/records/me','GET',null,a)).status,401);assert.equal((await request('/api/records/me','GET',null,b)).status,200);
});
test('a complete individual run is verified and saved through HTTP, while forged and cross-account submissions fail',async()=>{
  const s=await register();await request('/api/profile','PATCH',{complete:true},s);let now=Date.now();accounts.runs.now=()=>now;
  try{const config={car:'ae86',track:'usui',mode:'time',difficulty:'normal'},attempt=await (await request('/api/runs/start','POST',config,s)).json(),r=createRace(CARS[0],makeTrack(TRACKS[3]),config),recorder=new RunRecorder();for(let i=0;i<120*900&&!r.finished;i++)updateRace(r,recorder.capture(r,driverInput(r)),1/120);assert.ok(r.finished);now+=300000;
    const response=await request('/api/runs/finish','POST',{id:attempt.id,frames:recorder.frames,time:.001,points:999999999},s);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.time,r.elapsed);assert.equal(saved.points,Math.floor(r.skill.points));assert.equal((await (await request('/api/runs/finish','POST',{id:attempt.id,frames:[]},s)).json()).id,saved.id);assert.equal(store.stats(s.user.id).races,1);
    const b=await register();await request('/api/profile','PATCH',{complete:true},b);assert.equal((await request('/api/runs/finish','POST',{id:attempt.id,frames:recorder.frames},b)).status,404);const mine=await (await request('/api/records/me','GET',null,s)).json();assert.equal(mine.records[0].track,'usui');
  }finally{accounts.runs.now=()=>Date.now();}
});
