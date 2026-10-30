// Model Render's HTTPS termination: the Node server receives plain HTTP, while
// the browser sends the public HTTPS origin. All accounts are disposable.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
process.env.DB_PATH=':memory:';
delete process.env.PUBLIC_URL;
const renderOrigin=process.env.RENDER_EXTERNAL_URL='https://drifters-web-game.onrender.com';
const {server,store,online}=await import('../server.mjs');
let base,nextUser=0;const sockets=[];
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{for(const ws of sockets)ws.terminate();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));store.close();});
const post=(route,data,origin=renderOrigin,session={})=>fetch(base+route,{method:route==='/api/profile'?'PATCH':'POST',headers:{'Content-Type':'application/json',Origin:origin,...(session.cookie?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{})},body:JSON.stringify(data)});
async function register(){
  const username='RenderDriver'+(++nextUser),response=await post('/api/register',{username,password:'render-password-24'});
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/; Secure/);
  return {username,...await response.json(),cookie:response.headers.get('set-cookie').split(';')[0]};
}
test('Render proxy supports registration, secure login, profile writes, invitation metadata and authenticated WebSocket',async()=>{
  const session=await register();assert.equal((await post('/api/profile',{complete:true},renderOrigin,session)).status,200);
  const login=await post('/api/login',{username:session.username,password:'render-password-24'});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=\d+; Secure/);
  const me=await (await fetch(base+'/api/session',{headers:{Cookie:session.cookie}})).json();assert.equal(me.user.id,session.user.id);assert.equal(me.user.onboarded,true);
  const info=await (await fetch(base+'/api/online')).json();assert.equal(info.publicUrl,renderOrigin);
  const ws=new WebSocket(base.replace('http','ws')+'/online',{origin:renderOrigin,headers:{Cookie:session.cookie}});sockets.push(ws);
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.close();
});
test('Render proxy rejects unrelated browser origins even with a valid session',async()=>{
  const session=await register();await post('/api/profile',{complete:true},renderOrigin,session);
  const rejected=await post('/api/register',{username:'ForgedOrigin24',password:'render-password-24'},'https://attacker.example');assert.equal(rejected.status,403);assert.equal((await rejected.json()).error,'Origen no permitido.');
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
