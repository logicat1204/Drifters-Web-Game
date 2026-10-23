import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {server,online} from '../server.mjs';
let base;const sockets=[];
before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{for(const ws of sockets)ws.terminate();for(const ws of online.wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));});
let nextUser=0;
async function connect(displayName='Piloto',car='ae86'){
  const response=await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'SocketUser'+(++nextUser),password:'socket-password-24'})});const account=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal(response.status,200);const profile=await fetch(base+'/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie,'X-CSRF-Token':account.csrf},body:JSON.stringify({displayName,defaultCar:car,complete:true})});assert.equal(profile.status,200);
  const ws=new WebSocket(base.replace('http','ws')+'/online',{origin:base,headers:{Cookie:cookie}}),messages=[],waiters=[];sockets.push(ws);ws.on('message',raw=>{const msg=JSON.parse(raw);messages.push(msg);for(const w of [...waiters]){const i=messages.findIndex(m=>m.type===w.type&&w.predicate(m));if(i>=0){waiters.splice(waiters.indexOf(w),1);clearTimeout(w.timer);w.resolve(messages.splice(i,1)[0]);}}});await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return {ws,send:msg=>ws.send(JSON.stringify(msg)),next(type,predicate=()=>true){const i=messages.findIndex(m=>m.type===type&&predicate(m));if(i>=0)return Promise.resolve(messages.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={type,predicate,resolve,timer:setTimeout(()=>reject(Error('No message: '+type)),3000)};waiters.push(w);});}};}
test('real WebSockets create, invite, ready four players, start synchronously and reject late joining',async()=>{
  const host=await connect('Host test','supra');const hello=await host.next('hello');host.send({type:'create',name:'Host <test>',car:'supra',config:{track:'akina'}});const room=await host.next('room');assert.equal(room.hostId,hello.id);assert.equal(room.players[0].name,'Host test');assert.equal(room.players[0].car,'supra');const guests=[];
  for(let i=0;i<3;i++){const car=['mr2','s2000','silvia'][i],g=await connect('Guest '+i,car);g.send({type:'join',code:room.code,name:'Guest '+i,car});const joined=await g.next('room',m=>m.players.length===i+2);assert.equal(joined.players.at(-1).car,car);guests.push(g);}
  const fifth=await connect();fifth.send({type:'join',code:room.code,name:'Fifth',car:'ae86'});assert.match((await fifth.next('error')).message,/llena/);
  guests[0].send({type:'start'});assert.match((await guests[0].next('error')).message,/anfitrión/);
  for(const c of [host,...guests])c.send({type:'ready',ready:true});await host.next('room',m=>m.players.length===4&&m.players.every(p=>p.ready));host.send({type:'start'});
  const snapshots=await Promise.all([host,...guests].map(c=>c.next('snapshot')));assert.equal(new Set(snapshots.map(s=>s.tick)).size,1);assert.ok(snapshots.every(s=>s.players.length===4&&s.players.every(p=>p.state.countdown===3)));
  fifth.send({type:'join',code:room.code,name:'Fifth',car:'ae86'});assert.match((await fifth.next('error')).message,/cerrada/);
  host.send({type:'input',seq:1,steer:0,throttle:true,s:100000});const state=await host.next('snapshot',s=>s.tick>snapshots[0].tick);assert.ok(state.players.every(p=>p.state.s<=24));
  host.send({type:'leave'});await guests[0].next('room',m=>m.hostId!==hello.id);assert.ok(true);
});
test('cross-origin upgrades and oversized or malformed messages are rejected',async()=>{
  const rejected=new WebSocket(base.replace('http','ws')+'/online',{origin:'https://unrelated.example'});rejected.on('error',()=>{});const status=await new Promise(resolve=>rejected.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode);rejected.terminate();}));assert.equal(status,403);
  const malformed=await connect();malformed.ws.send('{broken');const code=await new Promise(resolve=>malformed.ws.once('close',resolve));assert.equal(code,1007);
  const large=await connect();large.ws.send('x'.repeat(3000));assert.equal(await new Promise(resolve=>large.ws.once('close',resolve)),1009);
});
test('unauthenticated browsers cannot open a game WebSocket',async()=>{
  const ws=new WebSocket(base.replace('http','ws')+'/online',{origin:base});ws.on('error',()=>{});const status=await new Promise(resolve=>ws.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode);ws.terminate();}));assert.equal(status,401);
});
test('online connection metadata advertises four slots without inventing a public address',async()=>{const info=await (await fetch(base+'/api/online')).json();assert.equal(info.online,true);assert.equal(info.maxPlayers,4);assert.equal(info.publicUrl,null);});
