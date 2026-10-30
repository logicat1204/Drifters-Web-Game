// Public origins come from server configuration, never from forwarded client headers.
function httpOrigin(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{const url=new URL(value.trim());return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.origin:null;}catch{return null;}
}
function configuredOrigins(){return [process.env.PUBLIC_URL,process.env.RENDER_EXTERNAL_URL].map(httpOrigin).filter(Boolean);}
export function publicOrigin(){return configuredOrigins()[0]||null;}
export function secureSession(req){return !!req.socket.encrypted||configuredOrigins().some(origin=>origin.startsWith('https://'));}
export function sameOrigin(req){
  if(!req.headers.origin)return true;
  const origin=httpOrigin(req.headers.origin);if(!origin)return false;
  const allowed=configuredOrigins();
  if(allowed.length)return allowed.includes(origin);
  // Invalid deployment configuration must not fall back to trusting the Host header.
  if(process.env.PUBLIC_URL?.trim()||process.env.RENDER_EXTERNAL_URL?.trim())return false;
  return origin===httpOrigin(`${req.socket.encrypted?'https:':'http:'}//${req.headers.host}`);
}
