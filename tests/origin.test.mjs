import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicOrigin,sameOrigin,secureSession} from '../server/origin.mjs';
function configured(values,fn){
  const keys=['PUBLIC_URL','RENDER_EXTERNAL_URL'],saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try{for(const key of keys){if(values[key]===undefined)delete process.env[key];else process.env[key]=values[key];}return fn();}
  finally{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
}
const request=(origin,host='127.0.0.1:4173',encrypted=false,extra={})=>({headers:{host,...(origin===undefined?{}:{origin}),...extra},socket:{encrypted}});
test('direct local HTTP and TLS require the same scheme, host and port',()=>configured({},()=>{
  assert.equal(publicOrigin(),null);assert.equal(sameOrigin(request('http://127.0.0.1:4173')),true);
  assert.equal(sameOrigin(request('https://127.0.0.1:4173')),false);assert.equal(sameOrigin(request('http://127.0.0.1:4174')),false);
  assert.equal(sameOrigin(request('https://localhost','localhost',true)),true);assert.equal(secureSession(request()),false);
  assert.equal(secureSession(request(undefined,'localhost',true)),true);
}));
test('Render HTTPS works behind its HTTP proxy without setting PUBLIC_URL',()=>configured({RENDER_EXTERNAL_URL:'https://drifters-web-game.onrender.com'},()=>{
  assert.equal(publicOrigin(),'https://drifters-web-game.onrender.com');assert.equal(sameOrigin(request('https://drifters-web-game.onrender.com','internal:10000')),true);
  assert.equal(secureSession(request()),true);assert.equal(sameOrigin(request('http://drifters-web-game.onrender.com')),false);
  assert.equal(sameOrigin(request('https://unrelated.example')),false);
}));
test('a custom PUBLIC_URL and Render service URL are both allowed, with preferred invitations',()=>configured({PUBLIC_URL:' https://racing.example/ ',RENDER_EXTERNAL_URL:'https://drifters-web-game.onrender.com'},()=>{
  assert.equal(publicOrigin(),'https://racing.example');assert.equal(sameOrigin(request('https://racing.example')),true);
  assert.equal(sameOrigin(request('https://drifters-web-game.onrender.com')),true);
  assert.equal(sameOrigin(request('https://racing.example.attacker.test')),false);assert.equal(sameOrigin(request('https://other.onrender.com')),false);
}));
test('Render auto-detection still works with stale or invalid PUBLIC_URL',()=>{
  for(const PUBLIC_URL of ['http://localhost:4173','no-es-una-url'])configured({PUBLIC_URL,RENDER_EXTERNAL_URL:'https://drifters-web-game.onrender.com'},()=>{
    assert.equal(sameOrigin(request('https://drifters-web-game.onrender.com')),true);assert.equal(secureSession(request()),true);
  });
});
test('forwarded headers cannot authorize another origin or spoof secure cookies',()=>configured({},()=>{
  const spoof=request('https://attacker.example','127.0.0.1:4173',false,{'x-forwarded-host':'attacker.example','x-forwarded-proto':'https'});
  assert.equal(sameOrigin(spoof),false);assert.equal(secureSession(spoof),false);
}));
test('malformed origins and configuration fail closed while non-browser requests remain supported',()=>{
  configured({},()=>{for(const origin of ['null','not a url','file:///tmp','https://user:password@localhost'])assert.equal(sameOrigin(request(origin)),false);assert.equal(sameOrigin(request()),true);});
  for(const PUBLIC_URL of ['invalid','file:///tmp','https://user:password@racing.example'])configured({PUBLIC_URL},()=>{assert.equal(publicOrigin(),null);assert.equal(sameOrigin(request('http://127.0.0.1:4173')),false);});
});
