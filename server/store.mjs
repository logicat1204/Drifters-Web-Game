import {UPGRADES,VEHICLE_PARTS,stockBuild,validateBuild,buildKey} from '../js/tuning.mjs';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CARS,STARTER_CARS,ALL_CARS,HANDLING_VERSION,ALL_TRACKS as TRACKS} from '../js/sim.mjs';
import {DEFAULT_AVATAR,defaultAvatar,validateAvatar,migrateAvatar,cosmeticId,avatarLayers,COSMETICS} from '../js/avatar.mjs';
import {CAMPAIGN_CHAPTERS,CAMPAIGN_STAGES,campaignStage,stageAvailable,focusUnlocks,campaignReward,campaignReplayReward,campaignStages} from '../js/campaign.mjs';
import {FOCUS_TYPES} from '../js/focus.mjs';
const scrypt=promisify(scryptCallback),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const hashToken=value=>createHash('sha256').update(value).digest('hex');
export const derivePassword=(value,salt)=>scrypt(value,salt,64,{N:16384,r:8,p:1});
export function username(value){if(typeof value!=='string'||!/^[a-zA-Z0-9]{3,24}$/.test(value))throw Error('El usuario debe tener de 3 a 24 letras y números, sin espacios.');return value;}
export function password(value){if(typeof value!=='string'||value.length<8||Buffer.byteLength(value)>256)throw Error('La contraseña debe tener al menos 8 caracteres y como máximo 256 bytes.');return value;}
export function profileUpdate(current,data){
  if(!current)throw Error('Usuario inexistente.');
  const displayName=data.displayName===undefined?current.displayName:typeof data.displayName==='string'?data.displayName.normalize('NFKC').trim():'';
  if(!displayName||displayName.length>24||/[\p{Cc}\p{Cf}<>]/u.test(displayName))throw Error('El nombre visible debe tener de 1 a 24 caracteres.');
  const car=data.defaultCar??current.defaultCar;
  if(!ALL_CARS.some(c=>c.id===car))throw Error('Coche inválido.');
  const needsStarter=!current.onboarded&&current.cars.length===0;
  const grantStarter=needsStarter&&data.complete===true&&STARTER_CARS.some(c=>c.id===car);
  const editingBeforeChoice=needsStarter&&data.complete!==true&&data.defaultCar===undefined;
  if(!current.cars.includes(car)&&!grantStarter&&!editingBeforeChoice)throw Error(needsStarter?'Elige un coche inicial para completar tu licencia.':'Compra ese coche antes de equiparlo.');
  const selectedFocus=data.focusType??current.focusType;
  if(!FOCUS_TYPES[selectedFocus]||selectedFocus!=='balance'&&!current.focusUnlocked.includes(selectedFocus))throw Error('Esa especialidad todavía está bloqueada.');
  const stage=data.arcadeStage??current.arcadeStage;
  if(!Number.isInteger(stage)||stage<0||stage>=TRACKS.length)throw Error('Etapa inválida.');
  const avatar=data.avatar===undefined?current.avatar:validateAvatar(data.avatar),owned=new Set(current.cosmetics);
  for(const slot of ['hair','eyes','mouth','outfit','accessory','makeup'])if(!owned.has(cosmeticId(avatar.base,slot,avatar[slot])))throw Error('Ese cosmético no pertenece a tu inventario.');
  const mode=data.portraitMode??current.portraitMode;
  if(!['avatar','photo'].includes(mode))throw Error('Elige foto o avatar.');
  if(mode==='photo'&&!current.hasPhoto)throw Error('Sube una foto antes de continuar.');
  return {displayName,car,grantStarter,selectedFocus,stage,avatar,mode,onboarded:current.onboarded||data.complete===true};
}
export function checkChapterStory(cleared,chapter,phase){
  const parts=chapter?.split(':')||[],season=parts.length===2?parts[0]:'dry',base=parts.length===2?parts[1]:chapter;
  if(!CAMPAIGN_CHAPTERS.some(c=>c.id===base)||!['start','end'].includes(phase))throw Error('Escena inválida.');
  const stages=campaignStages(season).filter(s=>s.chapter===base);
  if(!stages.length)throw Error('Escena inválida.');
  if(phase==='start'?!stageAvailable(stages[0],cleared):!stages.every(s=>cleared.includes(s.id)))throw Object.assign(Error('Completa los desafíos anteriores para ver esta escena.'),{status:403});
}
export function checkRecordFilters({track,source,mode,car}){
  if(mode&&!['time','battle','arcade','campaign'].includes(mode)||!TRACKS.some(t=>t.id===track)||!['solo','online'].includes(source)||car&&!ALL_CARS.some(c=>c.id===car))throw Error('Filtro de récords inválido.');
}
export function campaignPayout(stage,cleared,run){
  if(stage.track!==run.track||!stageAvailable(stage,cleared.map(s=>s.level_id)))throw Error('Nivel de campaña bloqueado.');
  const old=cleared.find(s=>s.level_id===stage.id);
  const entitlement=campaignReward(stage,Math.max(run.points,old?.best_points||0));
  const coins=Math.max(0,entitlement-(old?.reward_coins||0))+(old?campaignReplayReward(stage,run.points):0);
  return {entitlement,coins};
}
export function runDocument(id,userId,r,source,finishTime,now){
  return {id,user_id:userId,track:r.track.id,car:r.car.id,source,mode:r.mode,manual:Number(r.manual),wet:Number(r.wet),night:Number(r.night),
    handling:HANDLING_VERSION,elapsed:finishTime,points:Math.floor(r.skill.points),drift:Math.floor(r.driftPoints),completed:Number(r.s>=r.track.length),
    won:Number(source==='online'?r.netPlace===1:r.won),created_at:now,campaign_level:campaignStage(r.campaignStage)?.id??null,focus_type:r.focus.type,
    focus_enabled:Number(r.focus.enabled!==false),vehicle_build:JSON.stringify(validateBuild(r.car.build)),build_key:buildKey(r.car.build)};
}
export const sqlitePath=()=>process.env.DB_PATH||path.join(process.env.DATA_DIR||path.join(root,'data'),'touge.sqlite');
export class Store {
  constructor(filename=process.env.NODE_TEST_CONTEXT&&!process.env.DB_PATH?':memory:':sqlitePath(),{now=()=>Date.now()}={}){
    this.now=now;if(filename!==':memory:')mkdirSync(path.dirname(path.resolve(filename)),{recursive:true});this.db=new DatabaseSync(filename);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const version=this.db.prepare('PRAGMA user_version').get().user_version;
    if(version>7){this.db.close();throw Error('La base de datos requiere una versión más reciente del servidor.');}
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
      if(version<4)this.db.exec(readFileSync(new URL('./migrations/004-vehicle-garage.sql',import.meta.url),'utf8'));
      if(version<5)this.db.exec(readFileSync(new URL('./migrations/005-music.sql',import.meta.url),'utf8'));
      if(version<6)this.db.exec(readFileSync(new URL('./migrations/006-chapter-stories.sql',import.meta.url),'utf8'));
      if(version<7){
        const columns=this.db.prepare('PRAGMA table_info(campaign_progress)').all();
        if(!columns.some(column=>column.name==='handling'))this.db.exec("ALTER TABLE campaign_progress ADD COLUMN handling TEXT NOT NULL DEFAULT 'v8'");
        this.db.exec('PRAGMA user_version=7');
      }
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');this.db.close();throw error;}
    this.dummySalt=randomBytes(16).toString('hex');this.dummyHash=null;
  }
  available(name){return !this.db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE').get(username(name));}
  syncCosmetics(){const insert=this.db.prepare('INSERT OR IGNORE INTO cosmetics(id,slot,rig) VALUES(?,?,?)');for(const item of COSMETICS)insert.run(item.id,item.slot,item.rig);}
  markChapterStory(id,chapter,phase){
    checkChapterStory(this.progression(id).campaign.map(s=>s.id),chapter,phase);
    this.db.prepare('INSERT OR IGNORE INTO chapter_story_seen VALUES(?,?,?,?)').run(id,chapter,phase,this.now());return this.user(id);
  }
  async register(name,pass){
    name=username(name);password(pass);if(!this.available(name))throw Object.assign(Error('Ese nombre de usuario ya está ocupado.'),{status:409});
    const salt=randomBytes(16).toString('hex'),hash=await derivePassword(pass,salt),id=randomUUID();
    this.db.exec('BEGIN IMMEDIATE');try{
      this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,name,hash.toString('hex'),salt,this.now());
      this.db.prepare('INSERT INTO profiles(user_id,display_name,avatar) VALUES(?,?,?)').run(id,name,JSON.stringify(DEFAULT_AVATAR));
      this.db.prepare('INSERT INTO wallets(user_id) VALUES(?)').run(id);
      const grant=this.db.prepare('INSERT INTO inventory VALUES(?,?,?)');for(const item of COSMETICS)if(item.starter)grant.run(id,item.id,this.now());this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');if(/UNIQUE/.test(error.message))throw Object.assign(Error('Ese nombre de usuario ya está ocupado.'),{status:409});throw error;}return this.user(id);
  }
  async login(name,pass){
    // Unknown and known users both perform a password derivation.
    const row=typeof name==='string'&&name.length<=24?this.db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(name):null;
    const text=typeof pass==='string'&&Buffer.byteLength(pass)<=256?pass:'';
    const candidate=await derivePassword(text,row?.salt||this.dummySalt);
    if(!row||!timingSafeEqual(candidate,Buffer.from(row.password_hash,'hex')))throw Object.assign(Error('Usuario o contraseña incorrectos.'),{status:401});return this.user(row.id);
  }
  user(id){const p=this.db.prepare('SELECT u.id,u.username,u.created_at,p.display_name,p.avatar,p.photo_version,p.portrait_mode,p.photo IS NOT NULL AS has_photo,p.default_car,p.arcade_stage,p.onboarded,p.focus_type FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=?').get(id);if(!p)return null;return {id:p.id,username:p.username,displayName:p.display_name,focusType:p.focus_type,...this.progression(id),avatar:JSON.parse(p.avatar),portraitMode:p.portrait_mode,portraitUrl:`/api/users/${p.id}/portrait?v=${p.photo_version}`,photoVersion:p.photo_version,hasPhoto:!!p.has_photo,defaultCar:p.default_car,arcadeStage:p.arcade_stage,onboarded:!!p.onboarded,createdAt:p.created_at};}
  createSession(id){const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(this.now());this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hashToken(token),id,csrf,this.now()+30*24*60*60*1000);return {token,csrf};}
  session(token){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;const row=this.db.prepare('SELECT user_id,csrf,expires_at FROM sessions WHERE token_hash=? AND expires_at>?').get(hashToken(token),this.now());return row?{user:this.user(row.user_id),csrf:row.csrf,token}:null;}
  logout(token){if(token)this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));}
  updateProfile(id,data){
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const {displayName,car,grantStarter,selectedFocus,stage,avatar,mode,onboarded}=profileUpdate(this.user(id),data);
      if(grantStarter)this.db.prepare('INSERT INTO owned_cars VALUES(?,?,?)').run(id,car,this.now());
      this.db.prepare('UPDATE profiles SET display_name=?,avatar=?,portrait_mode=?,default_car=?,arcade_stage=?,onboarded=?,focus_type=?,photo_version=photo_version+1 WHERE user_id=?').run(displayName,JSON.stringify(avatar),mode,car,stage,Number(onboarded),selectedFocus,id);
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    return this.user(id);
  }
  setPhoto(id,bytes,mime){this.db.prepare('UPDATE profiles SET photo=?,photo_mime=?,photo_version=photo_version+1 WHERE user_id=?').run(bytes,mime,id);return this.user(id);}
  photo(id){const p=this.db.prepare('SELECT photo,photo_mime FROM profiles WHERE user_id=?').get(id);return p?.photo?{bytes:Buffer.from(p.photo),mime:p.photo_mime}:null;}
  portrait(id){const p=this.db.prepare('SELECT portrait_mode,photo,photo_mime,avatar FROM profiles WHERE user_id=?').get(id);if(!p)return null;if(p.portrait_mode==='photo'&&p.photo)return {bytes:Buffer.from(p.photo),mime:p.photo_mime};return {bytes:Buffer.from(avatarSvg(JSON.parse(p.avatar))),mime:'image/svg+xml'};}
  progression(id){
    const cleared=this.db.prepare('SELECT level_id AS id,CASE WHEN handling=? THEN best_time END AS bestTime,best_points AS bestPoints,reward_coins AS rewardCoins FROM campaign_progress WHERE user_id=?').all(HANDLING_VERSION,id);
    return {chapterStories:this.db.prepare('SELECT chapter_id,phase FROM chapter_story_seen WHERE user_id=?').all(id).map(s=>s.chapter_id+':'+s.phase),music:this.db.prepare('SELECT song_id FROM owned_music WHERE user_id=?').all(id).map(s=>s.song_id),garage:this.garage(id),coins:this.db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(id)?.balance||0,campaign:cleared,focusUnlocked:focusUnlocks(cleared.map(s=>s.id)),cars:this.db.prepare('SELECT car_id FROM owned_cars WHERE user_id=?').all(id).map(c=>c.car_id),cosmetics:this.db.prepare('SELECT item_id FROM inventory WHERE user_id=?').all(id).map(c=>c.item_id)};
  }
  garage(id){
    const parts=this.db.prepare('SELECT car_id,part_id FROM owned_vehicle_parts WHERE user_id=? ORDER BY part_id').all(id),result={};
    for(const row of this.db.prepare('SELECT * FROM vehicle_builds WHERE user_id=?').all(id))result[row.car_id]={build:validateBuild(row),parts:parts.filter(p=>p.car_id===row.car_id).map(p=>p.part_id)};
    return result;
  }
  vehicleBuild(id,car){return validateBuild(this.db.prepare('SELECT * FROM vehicle_builds WHERE user_id=? AND car_id=?').get(id,car)||stockBuild());}
  requireCar(id,car){if(!ALL_CARS.some(c=>c.id===car)||!this.db.prepare('SELECT 1 FROM owned_cars WHERE user_id=? AND car_id=?').get(id,car))throw Error('Ese coche no pertenece a tu garaje.');}
  ensureBuild(id,car){this.db.prepare('INSERT OR IGNORE INTO vehicle_builds(user_id,car_id) VALUES(?,?)').run(id,car);}
  spend(id,price){if(!this.db.prepare('UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?').run(price,id,price).changes)throw Object.assign(Error('No tienes suficientes monedas.'),{status:409});}
  upgradeVehicle(id,car,system,tier){
    this.requireCar(id,car);const upgrade=Object.hasOwn(UPGRADES,system)?UPGRADES[system]:null;
    if(!upgrade||!Number.isInteger(tier)||tier<1||tier>3)throw Error('Nivel de mejora inválido.');
    this.db.exec('BEGIN IMMEDIATE');try{
      const current=this.vehicleBuild(id,car),alreadyOwned=current[system]>=tier;
      if(!alreadyOwned){
        if(tier!==current[system]+1)throw Error('Compra los niveles anteriores primero.');
        const price=upgrade.prices[tier-1];this.spend(id,price);this.ensureBuild(id,car);
        this.db.prepare(`UPDATE vehicle_builds SET ${system}=? WHERE user_id=? AND car_id=?`).run(tier,id,car);
        this.db.prepare('INSERT INTO economy_ledger VALUES(?,?,?,?,?,?)').run(`upgrade:${id}:${car}:${system}:${tier}`,id,-price,`upgrade:${car}:${system}:${tier}`,null,this.now());
      }
      this.db.exec('COMMIT');return {user:this.user(id),alreadyOwned};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  buyVehiclePart(id,car,key){
    this.requireCar(id,car);const part=VEHICLE_PARTS.find(p=>p.id===key);if(!part)throw Error('Pieza visual inválida.');
    this.db.exec('BEGIN IMMEDIATE');try{
      const owns=this.db.prepare('SELECT 1 FROM owned_vehicle_parts WHERE user_id=? AND car_id=? AND part_id=?').get(id,car,key);
      if(!owns){
        this.spend(id,part.price);this.ensureBuild(id,car);this.db.prepare('INSERT INTO owned_vehicle_parts VALUES(?,?,?,?)').run(id,car,key,this.now());
        if(part.slot!=='paint')this.db.prepare(`UPDATE vehicle_builds SET ${part.slot}=? WHERE user_id=? AND car_id=?`).run(part.value,id,car);
        this.db.prepare('INSERT INTO economy_ledger VALUES(?,?,?,?,?,?)').run(`vehicle-part:${id}:${car}:${key}`,id,-part.price,`vehicle-part:${car}:${key}`,null,this.now());
      }
      this.db.exec('COMMIT');return {user:this.user(id),alreadyOwned:!!owns};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  customizeVehicle(id,car,patch){
    this.requireCar(id,car);if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['color','vinyl','hood','spoiler','wheels'].includes(k)))throw Error('Personalización inválida.');
    const current=this.vehicleBuild(id,car),next=validateBuild({...current,...patch}),owns=new Set(this.db.prepare('SELECT part_id FROM owned_vehicle_parts WHERE user_id=? AND car_id=?').all(id,car).map(p=>p.part_id));
    if(next.color!==null&&!owns.has('paint'))throw Error('Desbloquea la pintura libre primero.');
    for(const slot of ['vinyl','hood','spoiler','wheels'])if(next[slot]!==stockBuild()[slot]&&!owns.has(VEHICLE_PARTS.find(p=>p.slot===slot&&p.value===next[slot])?.id))throw Error('Compra esa pieza antes de equiparla.');
    this.ensureBuild(id,car);this.db.prepare('UPDATE vehicle_builds SET color=?,vinyl=?,hood=?,spoiler=?,wheels=? WHERE user_id=? AND car_id=?').run(next.color,next.vinyl,next.hood,next.spoiler,next.wheels,id,car);
    return {user:this.user(id)};
  }
  loadout(id){const user=this.user(id);return {focusType:user.focusType,focusEnabled:user.focusUnlocked.includes(user.focusType)};}
  buy(id,kind,key){
    if(kind==='car'&&!this.db.prepare('SELECT onboarded FROM profiles WHERE user_id=?').get(id)?.onboarded)throw Error('Completa tu licencia y elige tu coche inicial.');
    const item=kind==='car'?ALL_CARS.find(c=>c.id===key):kind==='cosmetic'?COSMETICS.find(c=>c.id===key):null;
    if(!item||item.availableForSale===false||!Number.isInteger(item.price)||item.price<=0)throw Error('Artículo de tienda inválido.');
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
  buyMusic(id,song){
    if(!song||!/^song-[a-f0-9]{24}$/.test(song.id)||!Number.isSafeInteger(song.price)||song.price<1||song.price>1000000)throw Error('Canción de tienda inválida.');
    this.db.exec('BEGIN IMMEDIATE');try{
      const owns=this.db.prepare('SELECT 1 FROM owned_music WHERE user_id=? AND song_id=?').get(id,song.id);
      if(!owns){this.spend(id,song.price);this.db.prepare('INSERT INTO owned_music VALUES(?,?,?)').run(id,song.id,this.now());this.db.prepare('INSERT INTO economy_ledger VALUES(?,?,?,?,?,?)').run('buy:'+id+':music:'+song.id,id,-song.price,'music:'+song.id,null,this.now());}
      this.db.exec('COMMIT');return {user:this.user(id),alreadyOwned:!!owns};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  addRun(id,userId,r,source='solo',finishTime=r.elapsed){
    const run=runDocument(id,userId,r,source,finishTime,this.now()),stage=campaignStage(run.campaign_level);
    this.db.exec('BEGIN IMMEDIATE');try{
      const fields=Object.keys(run);
      const inserted=this.db.prepare(`INSERT OR IGNORE INTO runs(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`).run(...Object.values(run));
      if(inserted.changes&&stage&&source==='solo'&&r.mode==='campaign'&&run.completed&&run.won){
        const cleared=this.db.prepare('SELECT * FROM campaign_progress WHERE user_id=?').all(userId);
        const {entitlement,coins}=campaignPayout(stage,cleared,run);
        this.db.prepare('INSERT INTO campaign_progress(user_id,level_id,best_time,best_points,reward_coins,cleared_at,handling) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,level_id) DO UPDATE SET best_time=CASE WHEN campaign_progress.handling=excluded.handling THEN MIN(best_time,excluded.best_time) ELSE excluded.best_time END,best_points=MAX(best_points,excluded.best_points),reward_coins=MAX(reward_coins,excluded.reward_coins),handling=excluded.handling').run(userId,stage.id,finishTime,run.points,entitlement,this.now(),HANDLING_VERSION);
        if(coins){this.db.prepare('UPDATE wallets SET balance=balance+? WHERE user_id=?').run(coins,userId);this.db.prepare('INSERT INTO economy_ledger VALUES(?,?,?,?,?,?)').run('reward:'+id,userId,coins,'campaign:'+stage.id,id,this.now());}
      }
      this.db.exec('COMMIT');return this.runResult(id,userId);
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  runResult(id,userId){const run=this.db.prepare('SELECT * FROM runs WHERE id=? AND user_id=?').get(id,userId);if(!run)return null;const best=this.db.prepare('SELECT MIN(elapsed) AS time FROM runs WHERE user_id=? AND track=? AND car=? AND source=? AND manual=? AND wet=? AND night=? AND handling=? AND build_key=? AND completed=1').get(userId,run.track,run.car,run.source,run.manual,run.wet,run.night,run.handling,run.build_key);return {id,build:JSON.parse(run.vehicle_build),buildKey:run.build_key,time:run.elapsed,points:run.points,drift:run.drift,completed:!!run.completed,won:!!run.won,personalBest:best.time,stats:this.stats(userId),reward:{coins:this.db.prepare('SELECT COALESCE(SUM(delta),0) AS n FROM economy_ledger WHERE user_id=? AND run_id=?').get(userId,id).n,stage:run.campaign_level},user:this.user(userId)};}
  stats(id){return this.db.prepare('SELECT COUNT(*) AS races,COALESCE(SUM(won),0) AS wins,COALESCE(SUM(points),0) AS points,COALESCE(MAX(points),0) AS bestPoints,COALESCE(MAX(drift),0) AS bestDrift FROM runs WHERE user_id=?').get(id);}
  records({userId=null,track='akina',source='solo',wet=false,night=true,manual=false,car=null,mode=null}={}){
    checkRecordFilters({track,source,mode,car});
    const filters=[HANDLING_VERSION,track,source,Number(wet),Number(night),Number(manual)],extra=(userId?' AND r.user_id=?':'')+(car?' AND r.car=?':'')+(mode?' AND r.mode=?':'');if(userId)filters.push(userId);if(car)filters.push(car);if(mode)filters.push(mode);
    return this.db.prepare(`WITH ranked AS (SELECT r.*,u.username,p.display_name,p.photo_version,ROW_NUMBER() OVER(PARTITION BY r.user_id ORDER BY r.elapsed,r.created_at) AS n FROM runs r JOIN users u ON u.id=r.user_id JOIN profiles p ON p.user_id=u.id WHERE r.handling=? AND r.track=? AND r.source=? AND r.wet=? AND r.night=? AND r.manual=? AND r.completed=1${extra}) SELECT user_id AS userId,username,display_name AS displayName,car,elapsed AS time,points,created_at AS createdAt,photo_version AS portraitVersion,build_key AS buildKey,vehicle_build AS vehicleBuild FROM ranked WHERE n=1 ORDER BY elapsed,created_at LIMIT 50`).all(...filters).map(row=>({...row,build:JSON.parse(row.vehicleBuild),portraitUrl:`/api/users/${row.userId}/portrait?v=${row.portraitVersion}`}));
  }
  personal(id){return {stats:this.stats(id),records:this.db.prepare('SELECT track,car,source,manual,wet,night,build_key AS buildKey,MIN(elapsed) AS time,MAX(points) AS points FROM runs WHERE user_id=? AND handling=? AND completed=1 GROUP BY track,car,source,manual,wet,night,build_key ORDER BY track,time').all(id,HANDLING_VERSION)};}
  close(){this.db.close();}
  backup(filename){return backup(this.db,filename);}
}
const layerCache=new Map();
export function avatarSvg(value){
  const layers=avatarLayers(value),defs=[],images=[];
  for(const [i,layer] of layers.entries()){
    const key=layer.id+':'+(layer.revision||''),file=layer.url?path.resolve(root,'.'+decodeURIComponent(layer.url)):path.join(root,'assets/avatars/v2/layers',layer.id+'.png');
    if(!file.startsWith(path.join(root,'assets')+path.sep))throw Error('Capa inválida.');
    if(!layerCache.has(key)){if(layerCache.size>512)layerCache.clear();try{layerCache.set(key,readFileSync(file).toString('base64'));}catch(error){if(layer.url)return avatarSvg(defaultAvatar(value.base==='female'?'female':'male'));throw error;}}
    if(layer.tint)defs.push(`<filter id="t${i}" color-interpolation-filters="sRGB"><feFlood flood-color="${layer.tint}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`);
    images.push(`<image width="512" height="640" href="data:image/png;base64,${layerCache.get(key)}"${layer.tint?` filter="url(#t${i})"`:''}/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 640"><defs>${defs.join('')}</defs><path fill="#273c43" d="M0 0h512v640H0z"/><path fill="#3c5358" d="M0 500 512 80v560H0z"/>${images.join('')}</svg>`;
}
