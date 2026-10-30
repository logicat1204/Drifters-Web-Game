import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CARS,ALL_CARS,HANDLING_VERSION,ALL_TRACKS as TRACKS} from '../js/sim.mjs';
import {DEFAULT_AVATAR,validateAvatar,migrateAvatar,cosmeticId,avatarLayers,COSMETICS} from '../js/avatar.mjs';
import {CAMPAIGN_STAGES,campaignStage,stageAvailable,focusUnlocks,campaignReward,campaignReplayReward} from '../js/campaign.mjs';
import {FOCUS_TYPES} from '../js/focus.mjs';
const scrypt=promisify(scryptCallback),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hashToken=value=>createHash('sha256').update(value).digest('hex');
export function username(value){if(typeof value!=='string'||!/^[a-zA-Z0-9]{3,24}$/.test(value))throw Error('El usuario debe tener de 3 a 24 letras y números, sin espacios.');return value;}
function password(value){if(typeof value!=='string'||value.length<8||Buffer.byteLength(value)>256)throw Error('La contraseña debe tener al menos 8 caracteres y como máximo 256 bytes.');return value;}
export class Store {
  constructor(filename=process.env.DB_PATH||(process.env.NODE_TEST_CONTEXT?':memory:':path.join(process.env.DATA_DIR||path.join(root,'data'),'touge.sqlite')),{now=()=>Date.now()}={}){
    this.now=now;if(filename!==':memory:')mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});this.db=new DatabaseSync(filename);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const version=this.db.prepare('PRAGMA user_version').get().user_version;
    if(version>3){this.db.close();throw Error('La base de datos requiere una versión más reciente del servidor.');}
    if(version===0){this.db.exec('BEGIN IMMEDIATE');try{this.db.exec(readFileSync(new URL('./migrations/001-accounts.sql',import.meta.url),'utf8'));this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');this.db.close();throw error;}}

    this.db.exec('BEGIN IMMEDIATE');try{
      const insert=this.db.prepare('INSERT OR IGNORE INTO cosmetics(id,slot,rig) VALUES(?,?,?)');for(const item of COSMETICS)insert.run(item.id,item.slot,item.rig);
      if(version<2){
        const update=this.db.prepare('UPDATE profiles SET avatar=?,photo_version=photo_version+1 WHERE user_id=?');
        const grant=this.db.prepare('INSERT OR IGNORE INTO inventory(user_id,item_id,acquired_at) VALUES(?,?,?)');
        for(const profile of this.db.prepare('SELECT user_id,avatar FROM profiles').all()){
          update.run(JSON.stringify(migrateAvatar(JSON.parse(profile.avatar))),profile.user_id);
          for(const item of COSMETICS)if(item.starter)grant.run(profile.user_id,item.id,this.now());
        }
        this.db.exec(readFileSync(new URL('./migrations/002-avatar-rigs.sql',import.meta.url),'utf8'));
      }
      if(version<3){
        this.db.exec(readFileSync(new URL('./migrations/003-campaign-economy.sql',import.meta.url),'utf8'));
        const grantCar=this.db.prepare('INSERT OR IGNORE INTO owned_cars VALUES(?,?,?)'),grantItem=this.db.prepare('INSERT OR IGNORE INTO inventory VALUES(?,?,?)');
        for(const user of this.db.prepare('SELECT id FROM users').all()){
          for(const car of CARS)grantCar.run(user.id,car.id,this.now());
          for(const item of COSMETICS)if(item.starter)grantItem.run(user.id,item.id,this.now());
        }
      }
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');this.db.close();throw error;}
    this.dummySalt=randomBytes(16).toString('hex');this.dummyHash=null;
  }
  available(name){return !this.db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE').get(username(name));}
  async register(name,pass){
    name=username(name);password(pass);if(!this.available(name))throw Object.assign(Error('Ese nombre de usuario ya está ocupado.'),{status:409});
    const salt=randomBytes(16).toString('hex'),hash=await scrypt(pass,salt,64,{N:16384,r:8,p:1}),id=randomUUID();
    this.db.exec('BEGIN IMMEDIATE');try{
      this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,name,hash.toString('hex'),salt,this.now());
      this.db.prepare('INSERT INTO profiles(user_id,display_name,avatar) VALUES(?,?,?)').run(id,name,JSON.stringify(DEFAULT_AVATAR));
      this.db.prepare('INSERT INTO wallets(user_id) VALUES(?)').run(id);const grantCar=this.db.prepare('INSERT INTO owned_cars VALUES(?,?,?)');for(const car of CARS)grantCar.run(id,car.id,this.now());
      const grant=this.db.prepare('INSERT INTO inventory VALUES(?,?,?)');for(const item of COSMETICS)if(item.starter)grant.run(id,item.id,this.now());this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');if(/UNIQUE/.test(error.message))throw Object.assign(Error('Ese nombre de usuario ya está ocupado.'),{status:409});throw error;}return this.user(id);
  }
  async login(name,pass){
    // Unknown and known users both perform a password derivation.
    const row=typeof name==='string'&&name.length<=24?this.db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(name):null;
    const text=typeof pass==='string'&&Buffer.byteLength(pass)<=256?pass:'';
    const candidate=await scrypt(text,row?.salt||this.dummySalt,64,{N:16384,r:8,p:1});
    if(!row||!timingSafeEqual(candidate,Buffer.from(row.password_hash,'hex')))throw Object.assign(Error('Usuario o contraseña incorrectos.'),{status:401});return this.user(row.id);
  }
  user(id){const p=this.db.prepare('SELECT u.id,u.username,u.created_at,p.display_name,p.avatar,p.photo_version,p.portrait_mode,p.photo IS NOT NULL AS has_photo,p.default_car,p.arcade_stage,p.onboarded,p.focus_type FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=?').get(id);if(!p)return null;return {id:p.id,username:p.username,displayName:p.display_name,focusType:p.focus_type,...this.progression(id),avatar:JSON.parse(p.avatar),portraitMode:p.portrait_mode,portraitUrl:`/api/users/${p.id}/portrait?v=${p.photo_version}`,photoVersion:p.photo_version,hasPhoto:!!p.has_photo,defaultCar:p.default_car,arcadeStage:p.arcade_stage,onboarded:!!p.onboarded,createdAt:p.created_at};}
  createSession(id){const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(this.now());this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hashToken(token),id,csrf,this.now()+30*24*60*60*1000);return {token,csrf};}
  session(token){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;const row=this.db.prepare('SELECT user_id,csrf,expires_at FROM sessions WHERE token_hash=? AND expires_at>?').get(hashToken(token),this.now());return row?{user:this.user(row.user_id),csrf:row.csrf,token}:null;}
  logout(token){if(token)this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));}
  updateProfile(id,data){
    const current=this.user(id);if(!current)throw Error('Usuario inexistente.');
    const displayName=data.displayName===undefined?current.displayName:typeof data.displayName==='string'?data.displayName.normalize('NFKC').trim():'';
    if(!displayName||displayName.length>24||/[\p{Cc}\p{Cf}<>]/u.test(displayName))throw Error('El nombre visible debe tener de 1 a 24 caracteres.');
    const car=data.defaultCar??current.defaultCar;if(!ALL_CARS.some(c=>c.id===car))throw Error('Coche inválido.');if(!this.db.prepare('SELECT 1 FROM owned_cars WHERE user_id=? AND car_id=?').get(id,car))throw Error('Compra ese coche antes de equiparlo.');
    const selectedFocus=data.focusType??current.focusType;if(!FOCUS_TYPES[selectedFocus]||selectedFocus!=='balance'&&!current.focusUnlocked.includes(selectedFocus))throw Error('Esa especialidad todavía está bloqueada.');
    const stage=data.arcadeStage??current.arcadeStage;if(!Number.isInteger(stage)||stage<0||stage>=TRACKS.length)throw Error('Etapa inválida.');
    const avatar=data.avatar===undefined?current.avatar:validateAvatar(data.avatar);
    const owned=new Set(this.db.prepare('SELECT item_id FROM inventory WHERE user_id=?').all(id).map(x=>x.item_id));
    for(const slot of ['hair','eyes','mouth','outfit','accessory','makeup'])if(!owned.has(cosmeticId(avatar.base,slot,avatar[slot])))throw Error('Ese cosmético no pertenece a tu inventario.');
    const mode=data.portraitMode??current.portraitMode;if(!['avatar','photo'].includes(mode))throw Error('Elige foto o avatar.');
    const hasPhoto=this.db.prepare('SELECT photo IS NOT NULL AS present FROM profiles WHERE user_id=?').get(id).present;
    if(mode==='photo'&&!hasPhoto)throw Error('Sube una foto antes de continuar.');
    const onboarded=current.onboarded||data.complete===true;
    this.db.prepare('UPDATE profiles SET display_name=?,avatar=?,portrait_mode=?,default_car=?,arcade_stage=?,onboarded=?,focus_type=?,photo_version=photo_version+1 WHERE user_id=?').run(displayName,JSON.stringify(avatar),mode,car,stage,Number(onboarded),selectedFocus,id);return this.user(id);
  }
  setPhoto(id,bytes,mime){this.db.prepare('UPDATE profiles SET photo=?,photo_mime=?,photo_version=photo_version+1 WHERE user_id=?').run(bytes,mime,id);return this.user(id);}
  photo(id){const p=this.db.prepare('SELECT photo,photo_mime FROM profiles WHERE user_id=?').get(id);return p?.photo?{bytes:Buffer.from(p.photo),mime:p.photo_mime}:null;}
  portrait(id){const p=this.db.prepare('SELECT portrait_mode,photo,photo_mime,avatar FROM profiles WHERE user_id=?').get(id);if(!p)return null;if(p.portrait_mode==='photo'&&p.photo)return {bytes:Buffer.from(p.photo),mime:p.photo_mime};return {bytes:Buffer.from(avatarSvg(JSON.parse(p.avatar))),mime:'image/svg+xml'};}
  progression(id){
    const cleared=this.db.prepare('SELECT level_id AS id,best_time AS bestTime,best_points AS bestPoints,reward_coins AS rewardCoins FROM campaign_progress WHERE user_id=?').all(id);
    return {coins:this.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(id)?.balance||0,campaign:cleared,focusUnlocked:focusUnlocks(cleared.map(s=>s.id)),cars:this.db.prepare('SELECT car_id FROM owned_cars WHERE user_id=?').all(id).map(c=>c.car_id),cosmetics:this.db.prepare('SELECT item_id FROM inventory WHERE user_id=?').all(id).map(c=>c.item_id)};
  }
  loadout(id){const user=this.user(id);return {focusType:user.focusType,focusEnabled:user.focusUnlocked.includes(user.focusType)};}
  buy(id,kind,key){
    const item=kind==='car'?ALL_CARS.find(c=>c.id===key):kind==='cosmetic'?COSMETICS.find(c=>c.id===key):null;
    if(!item||!Number.isInteger(item.price)||item.price<=0)throw Error('Artículo de tienda inválido.');
    this.db.exec('BEGIN IMMEDIATE');try{
      const owns=kind==='car'?this.db.prepare('SELECT 1 FROM owned_cars WHERE user_id=? AND car_id=?').get(id,key):this.db.prepare('SELECT 1 FROM inventory WHERE user_id=? AND item_id=?').get(id,key);
      if(!owns){
        if(!this.db.prepare('UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?').run(item.price,id,item.price).changes)throw Object.assign(Error('No tienes suficientes monedas.'),{status:409});
        this.db.prepare(kind==='car'?'INSERT INTO owned_cars VALUES(?,?,?)':'INSERT INTO inventory VALUES(?,?,?)').run(id,key,this.now());
        this.db.prepare('INSERT INTO economy_ledger VALUES(?,?,?,?,?,?)').run('buy:'+id+':'+kind+':'+key,id,-item.price,kind+':'+key,null,this.now());
      }
      this.db.exec('COMMIT');return {user:this.user(id),alreadyOwned:!!owns};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  addRun(id,userId,r,source='solo',finishTime=r.elapsed){
    const valid=r.s>=r.track.length,stage=r.campaignStage?campaignStage(r.campaignStage):null;
    this.db.exec('BEGIN IMMEDIATE');try{
      const inserted=this.db.prepare('INSERT OR IGNORE INTO runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,userId,r.track.id,r.car.id,source,r.mode,Number(r.manual),Number(r.wet),Number(r.night),HANDLING_VERSION,finishTime,Math.floor(r.skill.points),Math.floor(r.driftPoints),Number(valid),Number(source==='online'?r.netPlace===1:r.won),this.now(),stage?.id||null,r.focus.type,Number(r.focus.enabled!==false));
      if(inserted.changes&&stage&&source==='solo'&&r.mode==='campaign'&&valid&&r.won){
        const progress=this.progression(userId),cleared=progress.campaign.map(s=>s.id);
        if(stage.track!==r.track.id||!stageAvailable(stage,cleared))throw Error('Nivel de campaña bloqueado.');
        const old=progress.campaign.find(s=>s.id===stage.id),points=Math.floor(r.skill.points),entitlement=campaignReward(stage,Math.max(points,old?.bestPoints||0)),coins=Math.max(0,entitlement-(old?.rewardCoins||0))+(old?campaignReplayReward(stage,points):0);
        this.db.prepare('INSERT INTO campaign_progress VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,level_id) DO UPDATE SET best_time=MIN(best_time,excluded.best_time),best_points=MAX(best_points,excluded.best_points),reward_coins=MAX(reward_coins,excluded.reward_coins)').run(userId,stage.id,finishTime,points,entitlement,this.now());
        if(coins){this.db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(coins,userId);this.db.prepare('INSERT INTO economy_ledger VALUES(?,?,?,?,?,?)').run('reward:'+id,userId,coins,'campaign:'+stage.id,id,this.now());}
      }
      this.db.exec('COMMIT');return this.runResult(id,userId);
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  runResult(id,userId){const run=this.db.prepare('SELECT * FROM runs WHERE id=? AND user_id=?').get(id,userId);if(!run)return null;const best=this.db.prepare('SELECT MIN(elapsed) AS time FROM runs WHERE user_id=? AND track=? AND car=? AND source=? AND manual=? AND wet=? AND night=? AND handling=? AND completed=1').get(userId,run.track,run.car,run.source,run.manual,run.wet,run.night,run.handling);return {id,time:run.elapsed,points:run.points,drift:run.drift,completed:!!run.completed,won:!!run.won,personalBest:best.time,stats:this.stats(userId),reward:{coins:this.db.prepare('SELECT COALESCE(SUM(delta),0) AS n FROM economy_ledger WHERE user_id=? AND run_id=?').get(userId,id).n,stage:run.campaign_level},user:this.user(userId)};}
  stats(id){return this.db.prepare('SELECT COUNT(*) AS races,COALESCE(SUM(won),0) AS wins,COALESCE(SUM(points),0) AS points,COALESCE(MAX(points),0) AS bestPoints,COALESCE(MAX(drift),0) AS bestDrift FROM runs WHERE user_id=?').get(id);}
  records({userId=null,track='akina',source='solo',wet=false,night=true,manual=false,car=null}={}){
    if(!TRACKS.some(t=>t.id===track)||!['solo','online'].includes(source)||car&&!ALL_CARS.some(c=>c.id===car))throw Error('Filtro de récords inválido.');
    const filters=[HANDLING_VERSION,track,source,Number(wet),Number(night),Number(manual)],extra=(userId?' AND r.user_id=?':'')+(car?' AND r.car=?':'');if(userId)filters.push(userId);if(car)filters.push(car);
    return this.db.prepare(`WITH ranked AS (SELECT r.*,u.username,p.display_name,p.photo_version,ROW_NUMBER() OVER(PARTITION BY r.user_id ORDER BY r.elapsed,r.created_at) AS n FROM runs r JOIN users u ON u.id=r.user_id JOIN profiles p ON p.user_id=u.id WHERE r.handling=? AND r.track=? AND r.source=? AND r.wet=? AND r.night=? AND r.manual=? AND r.completed=1${extra}) SELECT user_id AS userId,username,display_name AS displayName,car,elapsed AS time,points,created_at AS createdAt,photo_version AS portraitVersion FROM ranked WHERE n=1 ORDER BY elapsed,created_at LIMIT 50`).all(...filters).map(row=>({...row,portraitUrl:`/api/users/${row.userId}/portrait?v=${row.portraitVersion}`}));
  }
  personal(id){return {stats:this.stats(id),records:this.db.prepare('SELECT track,car,source,manual,wet,night,MIN(elapsed) AS time,MAX(points) AS points FROM runs WHERE user_id=? AND handling=? AND completed=1 GROUP BY track,car,source,manual,wet,night ORDER BY track,time').all(id,HANDLING_VERSION)};}
  close(){this.db.close();}
  backup(filename){return backup(this.db,filename);}
}
const layerCache=new Map();
export function avatarSvg(value){
  const layers=avatarLayers(value),defs=[],images=[];
  for(const [i,layer] of layers.entries()){
    if(!layerCache.has(layer.id))layerCache.set(layer.id,readFileSync(path.join(root,'assets/avatars/v2/layers',layer.id+'.png')).toString('base64'));
    if(layer.tint)defs.push(`<filter id="t${i}" color-interpolation-filters="sRGB"><feFlood flood-color="${layer.tint}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`);
    images.push(`<image width="512" height="640" href="data:image/png;base64,${layerCache.get(layer.id)}"${layer.tint?` filter="url(#t${i})"`:''}/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 640"><defs>${defs.join('')}</defs><path fill="#273c43" d="M0 0h512v640H0z"/><path fill="#3c5358" d="M0 500 512 80v560H0z"/>${images.join('')}</svg>`;
}
