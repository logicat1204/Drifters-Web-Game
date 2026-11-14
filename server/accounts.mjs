import {UPGRADES,VEHICLE_PARTS,PAINTS} from '../js/tuning.mjs';
import {timingSafeEqual} from 'node:crypto';
import {AVATAR_VERSION,avatarOptions,defaultAvatar,COSMETICS,installCosmetics,validateAvatar} from '../js/avatar.mjs';
import {avatarSvg} from './store.mjs';
import {emailAddress} from './account-email.mjs';
import {licenseBackgrounds} from './license-backgrounds.mjs';
import {Runs} from './runs.mjs';
import {databaseUnavailable,isMongoError} from './database.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MediaLibrary} from './media.mjs';
import {CAMPAIGN_CHAPTERS,CAMPAIGN_STAGES,CAMPAIGN_SEASONS,seasonStageId} from '../js/campaign.mjs';
import {campaignEvents,CAMPAIGN_CHESTS,trialTime} from '../js/campaign-events.mjs';
import {EXPANSION_TRACKS,COURSE_REFERENCE_ROOT} from '../js/expansion-courses.mjs';
import {ALL_CARS,ALL_TRACKS} from '../js/sim.mjs';
import {CAMPAIGN_WORLDS} from '../js/campaign-worlds.mjs';
import {FOCUS_TYPES} from '../js/focus.mjs';
const campaignMedia=JSON.parse(readFileSync(new URL('../assets/campaign-media.json',import.meta.url),'utf8'));
const campaignMap=JSON.parse(readFileSync(new URL('../assets/campaign-map/map.json',import.meta.url),'utf8'));
const assetUrl=relative=>'/'+relative.split('/').map(encodeURIComponent).join('/');
function worldStory(world,season){
  if(season==='ngplus')return {
    start:['Los aspirantes regresan con una misión: quitarte el título. Tu defensa empieza en la línea de salida.'],
    end:[world==='initial-d'?'Has defendido tu título en todos los pasos de montaña. Los últimos aspirantes esperan en MF Ghost.':'Has defendido el trono hasta la bandera a cuadros en Manazuru. Japón vuelve a reconocer a su campeón.']
  };
  if(season==='rain')return {start:['Las montañas ya conocen tu nombre. Hoy las luces apenas se distinguen entre el agua y vuelves con referencias nuevas.'],end:['Los últimos faros se pierden entre la lluvia. Has completado la revancha del touge.']};
  return world==='initial-d'?
    {start:['Las carreteras de Gunma se vacían al caer la noche. Aquí empieza tu historia.'],end:['Has dejado tu nombre en los pasos de montaña. La próxima salida te espera en la parrilla de MF Ghost.']}:
    {start:['El escenario cambia a Kanagawa. Clasifícate contra el cronómetro y gana tu sitio en la parrilla.'],end:['Cae la bandera a cuadros en la península. Has vencido a Kanata y puedes volver como campeón para defender el título.']};
}
import {sameOrigin,secureSession} from './origin.mjs';
export {sameOrigin} from './origin.mjs';
export const fail=(message,status=400)=>Object.assign(Error(message),{status});
export async function jsonBody(req,max=12000){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fail('Se requiere JSON.',415);
  if(Number(req.headers['content-length'])>max){req.resume();throw fail('El archivo o la petición es demasiado grande.',413);}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw fail('El archivo o la petición es demasiado grande.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail('JSON inválido.');}
}
export const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
function sessionToken(req){const cookies=String(req.headers.cookie||'').split(';').map(v=>v.trim());return cookies.find(v=>v.startsWith('touge_session='))?.slice(14);}
function safeEqual(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function validPhoto(bytes,type){
  let width=0,height=0;
  if(type==='png'&&bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
  if(type==='jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217){let i=2;while(i+8<bytes.length){if(bytes[i++]!==255)break;while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;if(marker>=208&&marker<=215||marker===1)continue;const length=bytes.readUInt16BE(i);if(length<2||i+length>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=bytes.readUInt16BE(i+3);width=bytes.readUInt16BE(i+5);break;}i+=length;}}
  if(type==='webp'&&bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length){const format=bytes.toString('ascii',12,16);if(format==='VP8X'){width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);}else if(format==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383;}else if(format==='VP8L'&&bytes[20]===47){const bits=bytes.readUInt32LE(21);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}}
  if(!width||!height||width>2048||height>2048)throw fail('Imagen inválida o demasiado grande. Usa un retrato de hasta 2048 × 2048.');
}
export class Accounts {
  constructor(store,{media=new MediaLibrary(fileURLToPath(new URL('../',import.meta.url))),packs=null}={}){this.store=store;this.media=media;this.packs=packs;this.runs=new Runs(store);this.limits=new Map();}
  async refreshCosmetics(){if(!this.packs)return;installCosmetics(await this.packs.reload());await this.store.syncCosmetics();}
  session(req){return this.store.session(sessionToken(req));}
  async require(req,complete=false){const session=await this.session(req);if(!session)throw fail('Inicia sesión para continuar.',401);if(complete&&!session.user.onboarded)throw fail('Completa tu nombre y tu retrato de piloto.',403);return session;}
  throttle(req,key,max,window){const ip=req.socket.remoteAddress||'local',id=key+':'+ip;let r=this.limits.get(id);const now=Date.now();if(!r||now>r.until){r={n:0,until:now+window};this.limits.set(id,r);}if(++r.n>max)throw fail('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',429);if(this.limits.size>5000)for(const [k,v] of this.limits)if(now>v.until)this.limits.delete(k);}
  cookie(req,res,token){res.setHeader('Set-Cookie',`touge_session=${token||''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?2592000:0}${secureSession(req)?'; Secure':''}`);}
  async handle(req,res,url,online){
    const p=url.pathname;if(!p.startsWith('/api/'))return false;
    try{
      if(p==='/api/health'){json(res,200,{ok:true});return true;}
      if(p==='/api/license-backgrounds'&&req.method==='GET'){json(res,200,{backgrounds:await licenseBackgrounds()});return true;}
      if(p==='/api/avatar/catalog'&&req.method==='GET'){await this.refreshCosmetics();json(res,200,{version:AVATAR_VERSION,options:{male:avatarOptions('male'),female:avatarOptions('female')},defaults:{male:defaultAvatar('male'),female:defaultAvatar('female')},items:COSMETICS});return true;}
      if(p==='/api/avatar/preview'&&req.method==='GET'){
        const a={...defaultAvatar(url.searchParams.get('base')||'male'),...Object.fromEntries(url.searchParams),version:AVATAR_VERSION},svg=avatarSvg(validateAvatar(a),url.searchParams.get('transparent')==='1');res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'private, max-age=60','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'"});res.end(svg);return true;
      }
      const portrait=/^\/api\/users\/([a-f\d-]{36})\/portrait$/.exec(p);
      if(portrait&&['GET','HEAD'].includes(req.method)){const image=await this.store.portrait(portrait[1],url.searchParams.get('transparent')==='1');if(!image)throw fail('Piloto inexistente.',404);res.writeHead(200,{'Content-Type':image.mime,'Content-Length':image.bytes.length,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'"});res.end(req.method==='HEAD'?undefined:image.bytes);return true;}
      if(p==='/api/username'&&req.method==='GET'){this.throttle(req,'available',90,60000);json(res,200,{available:await this.store.available(url.searchParams.get('name'))});return true;}
      if(p==='/api/session'&&req.method==='GET'){const s=await this.session(req);json(res,200,{user:s?.user||null,csrf:s?.csrf||null});return true;}
      if(p==='/api/songs'&&req.method==='GET'){const user=(await this.session(req))?.user,shop=await this.media.shopSongs();json(res,200,{songs:[...await this.media.freeSongs(),...shop.filter(song=>user?.music.includes(song.id)).map(({absolute,...song})=>({...song,detail:'TU COLECCIÓN · '+song.author}))]});return true;}
      if(['/api/register','/api/login'].includes(p)&&req.method==='POST'){
        if(!sameOrigin(req))throw fail('Origen no permitido.',403);this.throttle(req,p,p==='/api/register'?12:35,p==='/api/register'?3600000:60000);
        const data=await jsonBody(req);
        const user=p==='/api/register'?await this.store.register(data.username,data.password,emailAddress(data.email)):await this.store.login(data.email??data.username,data.password);
        const session=await this.store.createSession(user.id);this.cookie(req,res,session.token);json(res,200,{user,csrf:session.csrf});return true;
      }
      const routes=['/api/logout','/api/profile','/api/profile/email','/api/profile/photo','/api/records','/api/records/me','/api/rankings','/api/rooms','/api/runs/start','/api/runs/finish','/api/campaign','/api/campaign/story','/api/campaign/chest','/api/shop','/api/shop/buy','/api/garage','/api/garage/upgrade','/api/garage/buy','/api/garage/customize'];if(!routes.includes(p))return false;
      const s=await this.require(req,['/api/rooms','/api/runs/start','/api/runs/finish'].includes(p));
      if(!['GET','HEAD'].includes(req.method)&&(!sameOrigin(req)||!safeEqual(req.headers['x-csrf-token'],s.csrf)))throw fail('La sesión cambió. Actualiza la página e intenta de nuevo.',403);
      if(p==='/api/logout'&&req.method==='POST'){await this.store.logout(s.token);online?.rooms?.revoke(s.user.id);this.cookie(req,res,null);json(res,200,{ok:true});return true;}
      if(p==='/api/profile/email'&&req.method==='POST'){
        this.throttle(req,'link-email',12,3600000);
        if(s.user.hasEmail)throw fail('Esta cuenta ya tiene un correo vinculado.',409);
        const data=await jsonBody(req);
        const pilot=await this.store.login(s.user.username,data.password);
        if(pilot.id!==s.user.id)throw fail('La sesión cambió.',403);
        json(res,200,{user:await this.store.linkEmail(s.user.id,data.email)});return true;
      }
      if(p==='/api/profile'&&req.method==='PATCH'){
        const data=await jsonBody(req);
        if(data.licenseBackground!=null&&data.licenseBackground!==s.user.licenseBackground&&!(await licenseBackgrounds()).some(item=>item.id===data.licenseBackground))throw fail('Ese fondo de licencia no está disponible.');
        json(res,200,{user:await this.store.updateProfile(s.user.id,data)});return true;
      }
      if(p==='/api/profile/photo'&&req.method==='GET'){const photo=await this.store.photo(s.user.id);if(!photo)throw fail('Aún no hay una foto.',404);res.writeHead(200,{'Content-Type':photo.mime,'Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff'});res.end(photo.bytes);return true;}
      if(p==='/api/profile/photo'&&req.method==='POST'){
        this.throttle(req,'photo',20,60000);const data=await jsonBody(req,750000);if(typeof data.image!=='string')throw fail('Elige una imagen.');const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data.image);if(!match)throw fail('Usa una foto PNG, JPEG o WebP.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>512000||bytes.length<12)throw fail('La foto debe ocupar como máximo 500 KB.');
        validPhoto(bytes,match[1]);
        json(res,200,{user:await this.store.setPhoto(s.user.id,bytes,'image/'+match[1])});return true;
      }
      if(p==='/api/campaign'&&req.method==='GET'){
        const seasons=await Promise.all(CAMPAIGN_SEASONS.map(async season=>{
          const alternate=season.id==='dry'?undefined:season.id;
          const chapters=await Promise.all(CAMPAIGN_CHAPTERS.map(async chapter=>({
            ...chapter,season:alternate,storyKey:'map:'+seasonStageId(chapter.id,season.id),map:campaignMap[chapter.id],
            media:{...await this.media.chapterMedia({...chapter,season:alternate}),
              portrait:chapter.referenceCover?assetUrl(chapter.referenceCover):campaignMedia.stages[CAMPAIGN_STAGES.find(s=>s.chapter===chapter.id).id].portrait}
          })));
          const stages=await Promise.all(campaignEvents(season.id).map(async stage=>{
            const chapter=chapters.find(c=>c.id===stage.chapter),base=stage.baseId||stage.id;
            const track=EXPANSION_TRACKS.find(t=>t.id===stage.track),supplied=track&&stage.portrait?
              assetUrl(COURSE_REFERENCE_ROOT+'/'+track.folder+'/'+stage.portrait):null;
            const related={'kai-nagao':'kai-campaign','keisuke-enna':'keisuke-project'}[base];
            const legacy=campaignMedia.stages[base]||{portrait:supplied||campaignMedia.stages[related]?.portrait||chapter.media.portrait};
            const media=await this.media.stageMedia({...stage,season:alternate},legacy);
            const customPortrait=media.portraits[base]||Object.values(media.portraits)[0];
            media.portrait=customPortrait||media.portrait;
            media.driverPortrait=customPortrait||supplied||campaignMedia.stages[base]?.portrait||campaignMedia.stages[related]?.portrait||null;
            const carInfo=driver=>ALL_CARS.find(c=>c.id===driver.car);
            return {...stage,media,carInfo:carInfo(stage),
              ...(stage.kind==='trial'?{targetTime:trialTime(stage,ALL_TRACKS.find(t=>t.id===stage.track).length)}:{}),
              ...(stage.kind==='grid'?{rivals:stage.rivals.map(driver=>({...driver,carInfo:carInfo(driver),portrait:media.portraits[driver.id]||campaignMedia.stages[driver.id]?.portrait}))}:{})};
          }));
          const stories=await Promise.all(CAMPAIGN_WORLDS.map(async world=>[world.id,await this.media.chapterMedia({
            ...world,world:true,season:alternate,fallback:worldStory(world.id,season.id)
          })]));
          return {...season,chapters,stages,worldStories:Object.fromEntries(stories)};
        }));
        json(res,200,{...seasons[0],seasons,chests:CAMPAIGN_CHESTS,worldMedia:await this.media.worldCovers(CAMPAIGN_WORLDS),focusTypes:FOCUS_TYPES,user:s.user});return true;
      }
      if(p==='/api/campaign/story'&&req.method==='POST'){const data=await jsonBody(req);json(res,200,{user:await this.store.markChapterStory(s.user.id,data.chapter,data.phase)});return true;}
      if(p==='/api/campaign/chest'&&req.method==='POST'){const data=await jsonBody(req);json(res,200,await this.store.claimCampaignChest(s.user.id,data.id));return true;}
      if(p==='/api/shop'&&req.method==='GET'){await this.refreshCosmetics();const songs=(await this.media.shopSongs()).map(({absolute,url,...song})=>({...song,url:s.user.music.includes(song.id)?url:null}));json(res,200,{cars:ALL_CARS,cosmetics:COSMETICS.filter(c=>!c.starter),songs,user:s.user});return true;}
      if(p==='/api/shop/buy'&&req.method==='POST'){this.throttle(req,'buy',60,60000);await this.refreshCosmetics();const data=await jsonBody(req);json(res,200,data.kind==='music'?await this.store.buyMusic(s.user.id,(await this.media.shopSongs()).find(song=>song.id===data.id)):await this.store.buy(s.user.id,data.kind,data.id));return true;}
      if(p==='/api/garage'&&req.method==='GET'){json(res,200,{upgrades:UPGRADES,parts:VEHICLE_PARTS,paints:PAINTS,user:s.user});return true;}
      if(['/api/garage/upgrade','/api/garage/buy','/api/garage/customize'].includes(p)&&req.method==='POST'){
        this.throttle(req,'garage',90,60000);const data=await jsonBody(req);
        const result=p.endsWith('/upgrade')?await this.store.upgradeVehicle(s.user.id,data.car,data.system,data.tier):p.endsWith('/buy')?await this.store.buyVehiclePart(s.user.id,data.car,data.part):await this.store.customizeVehicle(s.user.id,data.car,data.appearance);
        json(res,200,result);return true;
      }
      if(p==='/api/records/me'&&req.method==='GET'){json(res,200,await this.store.personal(s.user.id));return true;}
      if(p==='/api/rankings'&&req.method==='GET'){const q=url.searchParams,filters={track:q.get('track')||'akina',source:'solo',mode:'time',wet:q.get('wet')==='1',night:q.get('night')!=='0',manual:q.get('manual')==='1',car:q.get('car')||null},records=await this.store.records(filters),personal=(await this.store.records({...filters,userId:s.user.id}))[0]||null;json(res,200,{records:records.map((r,i)=>({...r,rank:i+1})),personal:personal?{...personal,rank:records.findIndex(r=>r.userId===s.user.id)+1||null}:null,filters});return true;}
      if(p==='/api/records'&&req.method==='GET'){const q=url.searchParams;json(res,200,{records:await this.store.records({track:q.get('track')||'akina',source:q.get('source')||'solo',car:q.get('car')||null,wet:q.get('wet')==='1',night:q.get('night')!=='0',manual:q.get('manual')==='1',userId:q.get('mine')==='1'?s.user.id:null})});return true;}
      if(p==='/api/rooms'&&req.method==='GET'){json(res,200,{rooms:online.rooms.publicRooms()});return true;}
      if(p==='/api/runs/start'&&req.method==='POST'){this.throttle(req,'start',40,60000);json(res,200,await this.runs.start(s.user.id,{...await jsonBody(req),campaignRules:true}));return true;}
      if(p==='/api/runs/finish'&&req.method==='POST'){this.throttle(req,'finish',12,60000);const data=await jsonBody(req,4*1024*1024);json(res,200,await this.runs.submit(s.user.id,data.id,data.frames));return true;}
      throw fail('Método no permitido.',405);
    }catch(error){const unavailable=isMongoError(error);json(res,unavailable?503:error.status||400,{error:unavailable?databaseUnavailable:error.message});return true;}
  }
}
