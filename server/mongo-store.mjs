import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {ALL_CARS,HANDLING_VERSION} from '../js/sim.mjs';
import {COSMETICS,DEFAULT_AVATAR} from '../js/avatar.mjs';
import {campaignStage,focusUnlocks} from '../js/campaign.mjs';
import {UPGRADES,VEHICLE_PARTS,stockBuild,validateBuild} from '../js/tuning.mjs';
import {avatarSvg,campaignPayout,checkChapterStory,checkRecordFilters,derivePassword,hashToken,password,profileUpdate,runDocument,username} from './store.mjs';

const noPhoto={projection:{password_hash:0,salt:0,'profile.photo':0}};
const finishSort={elapsed:1,created_at:1,_id:1};
const portraitUrl=(id,version)=>`/api/users/${id}/portrait?v=${version}`;
const duplicateName=()=>Object.assign(Error('Ese nombre de usuario ya está ocupado.'),{status:409});
const owned=(rows,key,id)=>rows.some(row=>row[key]===id);
const runCategory=run=>Object.fromEntries(['user_id','track','car','source','manual','wet','night','handling','build_key'].map(key=>[key,run[key]]));

export function pilotView(pilot){
  if(!pilot)return null;
  const p=pilot.profile;
  const garage=Object.fromEntries(pilot.builds.map(row=>[row.car_id,{
    build:validateBuild(row),parts:pilot.parts.filter(part=>part.car_id===row.car_id).map(part=>part.part_id).sort()
  }]));
  return {
    id:pilot._id,username:pilot.username,createdAt:pilot.created_at,displayName:p.display_name,focusType:p.focus_type,
    avatar:p.avatar,portraitMode:p.portrait_mode,portraitUrl:portraitUrl(pilot._id,p.photo_version),photoVersion:p.photo_version,
    hasPhoto:p.has_photo,defaultCar:p.default_car,arcadeStage:p.arcade_stage,onboarded:!!p.onboarded,garage,coins:pilot.balance,
    cars:pilot.cars.map(row=>row.car_id),cosmetics:pilot.inventory.map(row=>row.item_id),music:pilot.music.map(row=>row.song_id),
    chapterStories:pilot.stories.map(row=>row.chapter_id+':'+row.phase),focusUnlocked:focusUnlocks(pilot.campaign.map(row=>row.level_id)),
    campaign:pilot.campaign.map(row=>({id:row.level_id,bestTime:row.handling===HANDLING_VERSION?row.best_time:null,bestPoints:row.best_points,rewardCoins:row.reward_coins}))
  };
}

export class MongoStore {
  constructor(client,db,{now=()=>Date.now()}={}){
    this.client=client;this.pilots=db.collection('pilots');this.sessions=db.collection('sessions');
    this.runs=db.collection('runs');this.ledger=db.collection('economy_ledger');this.now=now;this.remote=true;
    this.dummySalt=randomBytes(16).toString('hex');
  }
  close(){return this.client.close();}
  syncCosmetics(){} // The live catalog comes from the same asset packs as SQLite.
  async available(name){return !await this.pilots.findOne({username_key:username(name).toLowerCase()},{projection:{_id:1}});}
  async register(name,pass){
    name=username(name);password(pass);
    const now=this.now(),salt=randomBytes(16).toString('hex'),hash=await derivePassword(pass,salt);
    const pilot={_id:randomUUID(),username:name,username_key:name.toLowerCase(),password_hash:hash.toString('hex'),salt,created_at:now,
      profile:{display_name:name,avatar:DEFAULT_AVATAR,photo_version:0,portrait_mode:'avatar',has_photo:false,default_car:'ae86',arcade_stage:0,onboarded:0,focus_type:'balance'},
      balance:0,inventory:COSMETICS.filter(item=>item.starter).map(item=>({item_id:item.id,acquired_at:now})),
      cars:[],builds:[],parts:[],music:[],stories:[],campaign:[]};
    try{await this.pilots.insertOne(pilot);}catch(error){if(error.code===11000)throw duplicateName();throw error;}
    return pilotView(pilot);
  }
  async login(name,pass){
    const row=typeof name==='string'&&/^[a-zA-Z0-9]{3,24}$/.test(name)?await this.pilots.findOne({username_key:name.toLowerCase()},{projection:{salt:1,password_hash:1}}):null;
    const candidate=await derivePassword(typeof pass==='string'&&Buffer.byteLength(pass)<=256?pass:'',row?.salt||this.dummySalt);
    if(!row||!timingSafeEqual(candidate,Buffer.from(row.password_hash,'hex')))throw Object.assign(Error('Usuario o contraseña incorrectos.'),{status:401});
    return this.user(row._id);
  }
  async user(id){return id?pilotView(await this.pilots.findOne({_id:id},noPhoto)):null;}
  async createSession(id){
    const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
    await this.sessions.insertOne({_id:hashToken(token),user_id:id,csrf,expires_at:new Date(this.now()+30*24*60*60*1000)});
    return {token,csrf};
  }
  sessionRow(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    return this.sessions.findOne({_id:hashToken(token),expires_at:{$gt:new Date(this.now())}});
  }
  async hasSession(token){return !!await this.sessionRow(token);}
  async session(token){
    const row=await this.sessionRow(token),user=row&&await this.user(row.user_id);
    return user?{user,csrf:row.csrf,token}:null;
  }
  logout(token){if(token)return this.sessions.deleteOne({_id:hashToken(token)});}
  transaction(work){return this.client.withSession(session=>session.withTransaction(()=>work(session),{writeConcern:{w:'majority'},timeoutMS:15000}));}
  async pilot(id,session){
    const pilot=await this.pilots.findOne({_id:id},{...noPhoto,session});
    if(!pilot)throw Error('Usuario inexistente.');
    return pilot;
  }
  async updateProfile(id,data){
    return this.transaction(async session=>{
      const pilot=await this.pilot(id,session);
      const {displayName,car,grantStarter,selectedFocus,stage,avatar,mode,onboarded}=profileUpdate(pilotView(pilot),data);
      const fields={display_name:displayName,default_car:car,focus_type:selectedFocus,arcade_stage:stage,avatar,portrait_mode:mode,onboarded:Number(onboarded),photo_version:pilot.profile.photo_version+1};
      const update={$set:Object.fromEntries(Object.entries(fields).map(([key,value])=>['profile.'+key,value]))};
      if(grantStarter){
        const starter={car_id:car,acquired_at:this.now()};
        update.$push={cars:starter};pilot.cars.push(starter);
      }
      await this.pilots.updateOne({_id:id},update,{session});
      Object.assign(pilot.profile,fields);
      return pilotView(pilot);
    });
  }
  async setPhoto(id,bytes,mime){
    const pilot=await this.pilots.findOneAndUpdate({_id:id},{$set:{'profile.photo':bytes,'profile.photo_mime':mime,'profile.has_photo':true},$inc:{'profile.photo_version':1}},{...noPhoto,returnDocument:'after'});
    return pilotView(pilot);
  }
  async photo(id){
    const row=await this.pilots.findOne({_id:id},{projection:{'profile.photo':1,'profile.photo_mime':1}});
    return row?.profile.photo?{bytes:row.profile.photo,mime:row.profile.photo_mime}:null;
  }
  async portrait(id){
    const row=await this.pilots.findOne({_id:id},{projection:{profile:1}}),p=row?.profile;
    if(!p)return null;
    if(p.portrait_mode==='photo'&&p.photo)return {bytes:p.photo,mime:p.photo_mime};
    return {bytes:Buffer.from(avatarSvg(p.avatar)),mime:'image/svg+xml'};
  }
  async markChapterStory(id,chapter,phase){
    return this.transaction(async session=>{
      const pilot=await this.pilot(id,session);
      checkChapterStory(pilot.campaign.map(row=>row.level_id),chapter,phase);
      if(!pilot.stories.some(row=>row.chapter_id===chapter&&row.phase===phase)){
        const story={chapter_id:chapter,phase,seen_at:this.now()};
        await this.pilots.updateOne({_id:id},{$push:{stories:story}},{session});
        pilot.stories.push(story);
      }
      return pilotView(pilot);
    });
  }
  // A purchase and its ledger entry commit together. Retried transactions read a fresh balance.
  async purchase(id,entry,select){
    return this.transaction(async session=>{
      const pilot=await this.pilot(id,session),changes=select(pilot);
      if(!changes)return {user:pilotView(pilot),alreadyOwned:true};
      if(pilot.balance<entry.price)throw Object.assign(Error('No tienes suficientes monedas.'),{status:409});
      const update={...changes,balance:pilot.balance-entry.price};
      await this.pilots.updateOne({_id:id},{$set:update},{session});
      await this.ledger.insertOne({_id:entry.id,user_id:id,delta:-entry.price,reason:entry.reason,run_id:null,created_at:this.now()},{session});
      return {user:pilotView({...pilot,...update}),alreadyOwned:false};
    });
  }
  buy(id,kind,key){
    const item=kind==='car'?ALL_CARS.find(c=>c.id===key):kind==='cosmetic'?COSMETICS.find(c=>c.id===key):null;
    if(!item||item.availableForSale===false||!Number.isInteger(item.price)||item.price<=0)throw Error('Artículo de tienda inválido.');
    const [list,field]=kind==='car'?['cars','car_id']:['inventory','item_id'];
    return this.buyItem(id,kind,key,item.price,list,field);
  }
  buyMusic(id,song){
    if(!song||!/^song-[a-f0-9]{24}$/.test(song.id)||!Number.isSafeInteger(song.price)||song.price<1||song.price>1000000)throw Error('Canción de tienda inválida.');
    return this.buyItem(id,'music',song.id,song.price,'music','song_id');
  }
  buyItem(id,kind,key,price,list,field){
    return this.purchase(id,{id:`buy:${id}:${kind}:${key}`,reason:`${kind}:${key}`,price},pilot=>{
      if(kind==='car'&&!pilot.profile.onboarded)throw Error('Completa tu licencia y elige tu coche inicial.');
      return owned(pilot[list],field,key)?null:{[list]:[...pilot[list],{[field]:key,acquired_at:this.now()}]};
    });
  }
  requireBuild(pilot,car){
    if(!ALL_CARS.some(c=>c.id===car)||!owned(pilot.cars,'car_id',car))throw Error('Ese coche no pertenece a tu garaje.');
    return validateBuild(pilot.builds.find(row=>row.car_id===car)||stockBuild());
  }
  replaceBuild(pilot,car,build){return [...pilot.builds.filter(row=>row.car_id!==car),{car_id:car,...build}];}
  upgradeVehicle(id,car,system,tier){
    const upgrade=Object.hasOwn(UPGRADES,system)?UPGRADES[system]:null;
    if(!upgrade||!Number.isInteger(tier)||tier<1||tier>3)throw Error('Nivel de mejora inválido.');
    return this.purchase(id,{id:`upgrade:${id}:${car}:${system}:${tier}`,reason:`upgrade:${car}:${system}:${tier}`,price:upgrade.prices[tier-1]},pilot=>{
      const build=this.requireBuild(pilot,car);
      if(build[system]>=tier)return null;
      if(tier!==build[system]+1)throw Error('Compra los niveles anteriores primero.');
      return {builds:this.replaceBuild(pilot,car,{...build,[system]:tier})};
    });
  }
  buyVehiclePart(id,car,key){
    const part=VEHICLE_PARTS.find(p=>p.id===key);if(!part)throw Error('Pieza visual inválida.');
    return this.purchase(id,{id:`vehicle-part:${id}:${car}:${key}`,reason:`vehicle-part:${car}:${key}`,price:part.price},pilot=>{
      const build=this.requireBuild(pilot,car);
      if(pilot.parts.some(row=>row.car_id===car&&row.part_id===key))return null;
      if(part.slot!=='paint')build[part.slot]=part.value;
      return {builds:this.replaceBuild(pilot,car,build),parts:[...pilot.parts,{car_id:car,part_id:key,acquired_at:this.now()}]};
    });
  }
  customizeVehicle(id,car,patch){
    if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['color','vinyl','hood','spoiler','wheels'].includes(k)))throw Error('Personalización inválida.');
    return this.transaction(async session=>{
      const pilot=await this.pilot(id,session),next=validateBuild({...this.requireBuild(pilot,car),...patch});
      const owns=new Set(pilot.parts.filter(p=>p.car_id===car).map(p=>p.part_id));
      if(next.color!==null&&!owns.has('paint'))throw Error('Desbloquea la pintura libre primero.');
      const stock=stockBuild();
      for(const slot of ['vinyl','hood','spoiler','wheels'])if(next[slot]!==stock[slot]&&!owns.has(VEHICLE_PARTS.find(p=>p.slot===slot&&p.value===next[slot])?.id))throw Error('Compra esa pieza antes de equiparla.');
      pilot.builds=this.replaceBuild(pilot,car,next);
      await this.pilots.updateOne({_id:id},{$set:{builds:pilot.builds}},{session});
      return {user:pilotView(pilot)};
    });
  }
  async addRun(id,userId,r,source='solo',finishTime=r.elapsed){
    const {id:_id,...run}=runDocument(id,userId,r,source,finishTime,this.now());
    const stage=campaignStage(run.campaign_level);
    if(stage&&source==='solo'&&run.mode==='campaign'&&run.completed&&run.won){
      try{
        await this.transaction(async session=>{
          const pilot=await this.pilot(userId,session);
          await this.runs.insertOne({_id,...run},{session});
          const {entitlement,coins}=campaignPayout(stage,pilot.campaign,run);
          const old=pilot.campaign.find(row=>row.level_id===stage.id);
          const progress={level_id:stage.id,handling:run.handling,best_time:Math.min(run.elapsed,old?.handling===run.handling?old.best_time:Infinity),best_points:Math.max(run.points,old?.best_points??run.points),
            reward_coins:Math.max(entitlement,old?.reward_coins??0),cleared_at:old?.cleared_at??run.created_at};
          const campaign=[...pilot.campaign.filter(row=>row.level_id!==stage.id),progress];
          await this.pilots.updateOne({_id:userId},{$set:{campaign},$inc:{balance:coins}},{session});
          if(coins)await this.ledger.insertOne({_id:'reward:'+id,user_id:userId,delta:coins,reason:'campaign:'+stage.id,run_id:id,created_at:this.now()},{session});
        });
      }catch(error){if(error.code!==11000||!await this.runs.findOne({_id,user_id:userId},{projection:{_id:1}}))throw error;}
    }else{
      try{await this.runs.insertOne({_id,...run});}catch(error){if(error.code!==11000)throw error;}
    }
    return source==='online'?undefined:this.runResult(id,userId);
  }
  async runResult(id,userId){
    const run=await this.runs.findOne({_id:id,user_id:userId});
    if(!run)return null;
    const [best,stats,[reward],user]=await Promise.all([
      this.runs.findOne({...runCategory(run),completed:1},{sort:finishSort,projection:{elapsed:1}}),
      this.stats(userId),this.ledger.aggregate([{$match:{user_id:userId,run_id:id}},{$group:{_id:null,coins:{$sum:'$delta'}}}]).toArray(),
      this.user(userId)
    ]);
    return {id,build:JSON.parse(run.vehicle_build),buildKey:run.build_key,time:run.elapsed,points:run.points,drift:run.drift,completed:!!run.completed,won:!!run.won,
      personalBest:best?.elapsed??null,stats,reward:{coins:reward?.coins??0,stage:run.campaign_level},user};
  }
  async stats(id){
    const [stats]=await this.runs.aggregate([
      {$match:{user_id:id}},{$group:{_id:null,races:{$sum:1},wins:{$sum:'$won'},points:{$sum:'$points'},bestPoints:{$max:'$points'},bestDrift:{$max:'$drift'}}},
      {$project:{_id:0}}
    ]).toArray();
    return stats??{races:0,wins:0,points:0,bestPoints:0,bestDrift:0};
  }
  async records({userId=null,track='akina',source='solo',wet=false,night=true,manual=false,car=null,mode=null}={}){
    checkRecordFilters({track,source,mode,car});
    const rows=await this.runs.aggregate([
      {$match:{handling:HANDLING_VERSION,track,source,wet:Number(wet),night:Number(night),manual:Number(manual),completed:1,
        ...(userId?{user_id:userId}:{}),...(car?{car}:{}),...(mode?{mode}:{})}},
      {$sort:finishSort},{$group:{_id:'$user_id',run:{$first:'$$ROOT'}}},{$replaceWith:'$run'},{$sort:finishSort},{$limit:50},
      {$lookup:{from:'pilots',localField:'user_id',foreignField:'_id',as:'pilot',pipeline:[{$project:{username:1,'profile.display_name':1,'profile.photo_version':1}}]}},
      {$unwind:'$pilot'}
    ]).toArray();
    return rows.map(({user_id:userId,pilot,car,elapsed:time,points,created_at:createdAt,build_key:buildKey,vehicle_build:vehicleBuild})=>{
      const portraitVersion=pilot.profile.photo_version;
      return {userId,username:pilot.username,displayName:pilot.profile.display_name,car,time,points,createdAt,portraitVersion,buildKey,vehicleBuild,
        build:JSON.parse(vehicleBuild),portraitUrl:portraitUrl(userId,portraitVersion)};
    });
  }
  async personal(id){
    const [stats,records]=await Promise.all([this.stats(id),this.runs.aggregate([
      {$match:{user_id:id,handling:HANDLING_VERSION,completed:1}},
      {$group:{_id:{track:'$track',car:'$car',source:'$source',manual:'$manual',wet:'$wet',night:'$night',buildKey:'$build_key'},time:{$min:'$elapsed'},points:{$max:'$points'}}},
      {$replaceWith:{$mergeObjects:['$_id',{time:'$time',points:'$points'}]}},{$sort:{track:1,time:1}}
    ]).toArray()]);
    return {stats,records};
  }
}
