import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {CosmeticPacks} from '../server/cosmetic-packs.mjs';
import {installCosmetics,avatarOptions,defaultAvatar,validateAvatar,avatarLayers} from '../js/avatar.mjs';
import {Store,avatarSvg} from '../server/store.mjs';
import {CAMPAIGN_STAGES} from '../js/campaign.mjs';
import {MediaLibrary} from '../server/media.mjs';
test('new cosmetic packs extend each existing rig, enforce server price and persist ownership independently',async()=>{
 const packs=new CosmeticPacks(path.resolve('.'));installCosmetics(await packs.reload());assert.deepEqual(packs.warnings,[]);assert.equal(packs.items.length,10);const db=new Store(':memory:');
 try{const a=await db.register('PackPilot24','password-24'),b=await db.register('OtherPack24','password-24');db.db.prepare('UPDATE wallets SET balance=1000 WHERE user_id=?').run(a.id);
  for(const item of packs.items){const base=item.bases[0],avatar={...defaultAvatar(base),[item.slot]:item.key};assert.equal(validateAvatar(avatar)[item.slot],item.key);assert.ok(avatarLayers(avatar).some(l=>l.url?.startsWith('/assets/shop/packs/')));assert.match(avatarSvg(avatar),/data:image\/png;base64/);}
  const item=packs.items.find(i=>i.slot==='outfit'&&i.bases[0]==='female');assert.throws(()=>db.updateProfile(a.id,{avatar:{...defaultAvatar('female'),outfit:item.key}}),/inventario/);const result=db.buy(a.id,'cosmetic',item.id);assert.equal(result.user.coins,1000-item.price);assert.equal(db.buy(a.id,'cosmetic',item.id).user.coins,result.user.coins);assert.ok(!db.user(b.id).cosmetics.includes(item.id));
  const profile=db.updateProfile(a.id,{avatar:{...defaultAvatar('female'),outfit:item.key}});assert.equal(profile.avatar.outfit,item.key);assert.match(db.portrait(a.id).bytes.toString(),/data:image\/png/);assert.ok(!db.user(a.id).cosmetics.includes('male.outfit.'+item.key));
  item.availableForSale=false;assert.throws(()=>db.buy(b.id,'cosmetic',item.id),/inválido/);assert.doesNotThrow(()=>db.updateProfile(a.id,{displayName:'Returning pilot'}));
  installCosmetics([]);assert.doesNotThrow(()=>db.portrait(a.id));assert.ok(!avatarOptions('female').outfit.some(([id])=>id===item.key));
 }finally{db.close();installCosmetics([]);}
});
test('pack scanning rejects invalid rig, traversal, non-alpha sizes, duplicate IDs and partial publication',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'touge-pack-')),folder=path.join(root,'assets/shop/packs/v99');await mkdir(folder,{recursive:true});const image=await readFile('assets/avatars/v2/layers/female/makeup-blush.png'),source={id:'female.makeup.test-paint',base:'female',rig:'portrait-v2-female',slot:'makeup',name:'Test paint',price:150,rarity:'rare',layers:{image:'image.png'}};
 try{await writeFile(path.join(folder,'image.png'),image);await writeFile(path.join(folder,'pack.json'),JSON.stringify({schemaVersion:1,items:['item.json']}));const packs=new CosmeticPacks(root);
  const check=async(value,accepted)=>{await writeFile(path.join(folder,'item.json'),JSON.stringify(value));assert.equal((await packs.reload()).length,accepted);assert.equal(packs.warnings.length,accepted?0:1);};
  await check(source,1);await check({...source,rig:'portrait-v2-male'},0);await check({...source,price:-20},0);await check({...source,layers:{image:'../../../../../outside.png'}},0);
  const bad=Buffer.from(image);bad.writeUInt32BE(123,16);await writeFile(path.join(folder,'image.png'),bad);await check(source,0);await writeFile(path.join(folder,'image.png'),image);
  await writeFile(path.join(folder,'pack.json'),JSON.stringify({schemaVersion:1,items:['item.json','item.json']}));await check(source,0);
  await writeFile(path.join(folder,'pack.json'),JSON.stringify({schemaVersion:1,items:['item.json','missing.json']}));await check(source,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('chapter stories are independent of duel stories, sorted naturally and gate persisted reading by actual progress',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'touge-chapter-')),filename=path.join(folder,'users.sqlite');let db=new Store(filename);
 try{const a=await db.register('ChapterPilot24','password-24'),b=await db.register('ChapterOther24','password-24');const session=db.createSession(a.id);assert.equal(db.db.prepare('PRAGMA user_version').get().user_version,7);assert.throws(()=>db.markChapterStory(a.id,'akina','end'),/anteriores/);assert.throws(()=>db.markChapterStory(a.id,'akagi','start'),/anteriores/);assert.throws(()=>db.markChapterStory(a.id,'unknown','start'),/inválida/);
  db.markChapterStory(a.id,'akina','start');db.markChapterStory(a.id,'akina','start');assert.deepEqual(db.user(a.id).chapterStories,['akina:start']);assert.deepEqual(db.user(b.id).chapterStories,[]);
  for(const s of CAMPAIGN_STAGES.filter(s=>s.chapter==='akina'))db.db.prepare('INSERT INTO campaign_progress(user_id,level_id,best_time,best_points,reward_coins,cleared_at) VALUES(?,?,?,?,?,?)').run(a.id,s.id,200,100,0,Date.now());db.markChapterStory(a.id,'akina','end');db.markChapterStory(a.id,'akagi','start');assert.equal(db.user(a.id).coins,0);db.close();db=new Store(filename);assert.equal(db.session(session.token).user.chapterStories.length,3);assert.equal(db.db.prepare('SELECT COUNT(*) n FROM economy_ledger').get().n,0);
  const dir=path.join(folder,'campaign_files/akina/_chapter/story_start');await mkdir(dir,{recursive:true});for(const n of ['10.png','2.png','001.png'])await writeFile(path.join(dir,n),'fixture');const m=new MediaLibrary(folder),story=await m.chapterMedia({id:'akina'});assert.deepEqual(story.storyStart.map(u=>path.basename(u)),['001.png','2.png','10.png']);assert.deepEqual((await m.stageMedia({id:'kenji',chapter:'akina'})).storyStart,[]);
 }finally{db.close();await rm(folder,{recursive:true,force:true});}
});
