import {timingSafeEqual} from 'node:crypto';
import {AVATAR_VERSION,avatarOptions,defaultAvatar,COSMETICS} from '../js/avatar.mjs';
import {avatarSvg} from './store.mjs';
import {Runs} from './runs.mjs';
export const fail=(message,status=400)=>Object.assign(Error(message),{status});
export async function jsonBody(req,max=12000){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fail('Se requiere JSON.',415);
  if(Number(req.headers['content-length'])>max){req.resume();throw fail('El archivo o la petición es demasiado grande.',413);}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw fail('El archivo o la petición es demasiado grande.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail('JSON inválido.');}
}
export const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
function sessionToken(req){const cookies=String(req.headers.cookie||'').split(';').map(v=>v.trim());return cookies.find(v=>v.startsWith('touge_session='))?.slice(14);}
export function sameOrigin(req){if(!req.headers.origin)return true;try{const origin=new URL(req.headers.origin);if(process.env.PUBLIC_URL)return origin.origin===new URL(process.env.PUBLIC_URL).origin;return origin.host===req.headers.host&&origin.protocol===(req.socket.encrypted?'https:':'http:');}catch{return false;}}
function safeEqual(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function validPhoto(bytes,type){
  let width=0,height=0;
  if(type==='png'&&bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
  if(type==='jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217){let i=2;while(i+8<bytes.length){if(bytes[i++]!==255)break;while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;if(marker>=208&&marker<=215||marker===1)continue;const length=bytes.readUInt16BE(i);if(length<2||i+length>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=bytes.readUInt16BE(i+3);width=bytes.readUInt16BE(i+5);break;}i+=length;}}
  if(type==='webp'&&bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length){const format=bytes.toString('ascii',12,16);if(format==='VP8X'){width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);}else if(format==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383;}else if(format==='VP8L'&&bytes[20]===47){const bits=bytes.readUInt32LE(21);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}}
  if(!width||!height||width>2048||height>2048)throw fail('Imagen inválida o demasiado grande. Usa un retrato de hasta 2048 × 2048.');
}
export class Accounts {
  constructor(store){this.store=store;this.runs=new Runs(store);this.limits=new Map();}
  session(req){return this.store.session(sessionToken(req));}
  require(req,complete=false){const session=this.session(req);if(!session)throw fail('Inicia sesión para continuar.',401);if(complete&&!session.user.onboarded)throw fail('Completa tu nombre y tu retrato de piloto.',403);return session;}
  throttle(req,key,max,window){const ip=req.socket.remoteAddress||'local',id=key+':'+ip;let r=this.limits.get(id);const now=Date.now();if(!r||now>r.until){r={n:0,until:now+window};this.limits.set(id,r);}if(++r.n>max)throw fail('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',429);if(this.limits.size>5000)for(const [k,v] of this.limits)if(now>v.until)this.limits.delete(k);}
  cookie(req,res,token){const secure=req.socket.encrypted||process.env.PUBLIC_URL?.startsWith('https://');res.setHeader('Set-Cookie',`touge_session=${token||''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?2592000:0}${secure?'; Secure':''}`);}
  async handle(req,res,url,online){
    const p=url.pathname;if(!p.startsWith('/api/'))return false;
    try{
      if(p==='/api/health'){json(res,200,{ok:true});return true;}
      if(p==='/api/avatar/catalog'&&req.method==='GET'){json(res,200,{version:AVATAR_VERSION,options:{male:avatarOptions('male'),female:avatarOptions('female')},defaults:{male:defaultAvatar('male'),female:defaultAvatar('female')},items:COSMETICS});return true;}
      if(p==='/api/avatar/preview'&&req.method==='GET'){
        const a={...defaultAvatar(url.searchParams.get('base')||'male'),...Object.fromEntries(url.searchParams),version:AVATAR_VERSION},svg=avatarSvg(a);res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'private, max-age=60','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'"});res.end(svg);return true;
      }
      const portrait=/^\/api\/users\/([a-f\d-]{36})\/portrait$/.exec(p);
      if(portrait&&['GET','HEAD'].includes(req.method)){const image=this.store.portrait(portrait[1]);if(!image)throw fail('Piloto inexistente.',404);res.writeHead(200,{'Content-Type':image.mime,'Content-Length':image.bytes.length,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'"});res.end(req.method==='HEAD'?undefined:image.bytes);return true;}
      if(p==='/api/username'&&req.method==='GET'){this.throttle(req,'available',90,60000);json(res,200,{available:this.store.available(url.searchParams.get('name'))});return true;}
      if(p==='/api/session'&&req.method==='GET'){const s=this.session(req);json(res,200,{user:s?.user||null,csrf:s?.csrf||null});return true;}
      if(['/api/register','/api/login'].includes(p)&&req.method==='POST'){
        if(!sameOrigin(req))throw fail('Origen no permitido.',403);this.throttle(req,p,p==='/api/register'?12:35,p==='/api/register'?3600000:60000);
        const data=await jsonBody(req),user=p==='/api/register'?await this.store.register(data.username,data.password):await this.store.login(data.username,data.password),session=this.store.createSession(user.id);this.cookie(req,res,session.token);json(res,200,{user,csrf:session.csrf});return true;
      }
      const routes=['/api/logout','/api/profile','/api/profile/photo','/api/records','/api/records/me','/api/rooms','/api/runs/start','/api/runs/finish'];if(!routes.includes(p))return false;
      const s=this.require(req,['/api/rooms','/api/runs/start','/api/runs/finish'].includes(p));
      if(!['GET','HEAD'].includes(req.method)&&(!sameOrigin(req)||!safeEqual(req.headers['x-csrf-token'],s.csrf)))throw fail('La sesión cambió. Actualiza la página e intenta de nuevo.',403);
      if(p==='/api/logout'&&req.method==='POST'){this.store.logout(s.token);online?.rooms?.revoke(s.user.id);this.cookie(req,res,null);json(res,200,{ok:true});return true;}
      if(p==='/api/profile'&&req.method==='PATCH'){json(res,200,{user:this.store.updateProfile(s.user.id,await jsonBody(req))});return true;}
      if(p==='/api/profile/photo'&&req.method==='GET'){const photo=this.store.photo(s.user.id);if(!photo)throw fail('Aún no hay una foto.',404);res.writeHead(200,{'Content-Type':photo.mime,'Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff'});res.end(photo.bytes);return true;}
      if(p==='/api/profile/photo'&&req.method==='POST'){
        this.throttle(req,'photo',20,60000);const data=await jsonBody(req,750000);if(typeof data.image!=='string')throw fail('Elige una imagen.');const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data.image);if(!match)throw fail('Usa una foto PNG, JPEG o WebP.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>512000||bytes.length<12)throw fail('La foto debe ocupar como máximo 500 KB.');
        validPhoto(bytes,match[1]);
        json(res,200,{user:this.store.setPhoto(s.user.id,bytes,'image/'+match[1])});return true;
      }
      if(p==='/api/records/me'&&req.method==='GET'){json(res,200,this.store.personal(s.user.id));return true;}
      if(p==='/api/records'&&req.method==='GET'){const q=url.searchParams;json(res,200,{records:this.store.records({track:q.get('track')||'akina',source:q.get('source')||'solo',car:q.get('car')||null,wet:q.get('wet')==='1',night:q.get('night')!=='0',manual:q.get('manual')==='1',userId:q.get('mine')==='1'?s.user.id:null})});return true;}
      if(p==='/api/rooms'&&req.method==='GET'){json(res,200,{rooms:online.rooms.publicRooms()});return true;}
      if(p==='/api/runs/start'&&req.method==='POST'){this.throttle(req,'start',40,60000);json(res,200,this.runs.start(s.user.id,await jsonBody(req)));return true;}
      if(p==='/api/runs/finish'&&req.method==='POST'){this.throttle(req,'finish',12,60000);const data=await jsonBody(req,4*1024*1024);json(res,200,await this.runs.submit(s.user.id,data.id,data.frames));return true;}
      throw fail('Método no permitido.',405);
    }catch(error){json(res,error.status||400,{error:error.message});return true;}
  }
}
