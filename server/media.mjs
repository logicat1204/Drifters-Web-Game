import {seasonDialogue,seasonChapterDialogue} from '../js/season-stories.mjs';
import {readdir,realpath,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const AUDIO_EXTENSIONS=new Set(['.mp3','.ogg','.wav','.m4a','.aac','.flac','.opus','.webm']);
const IMAGES=new Set(['.png','.jpg','.jpeg','.webp','.gif']);
async function dialogue(folder,fallback){try{const value=JSON.parse(await readFile(path.join(folder,'dialogue.json'),'utf8'));return Object.fromEntries(['start','end'].map(key=>[key,Array.isArray(value[key])&&value[key].length>0&&value[key].length<=20&&value[key].every(s=>typeof s==='string'&&s.length<=2000)?value[key]:fallback[key]]));}catch{return fallback;}}
const natural=(a,b)=>a.name.localeCompare(b.name,'es',{numeric:true,sensitivity:'base'});
export function pageSounds(pages,files){
 const stem=file=>path.parse(file).name.normalize('NFKC').toLowerCase();
 const number=name=>/^(\d+)(?:[-_ .]|$)/.exec(name)?.[1];
 return pages.map((page,index)=>{
  const name=stem(decodeURIComponent(page.split('/').at(-1))),pageNumber=number(name)??String(index+1);
  const file=files.find(file=>stem(file.name)===name)||
   files.find(file=>{const n=number(stem(file.name));return n!==undefined&&Number(n)===Number(pageNumber);});
  return file?{name:path.parse(file.name).name,url:file.url}:null;
 });
}
export function parseShopSong(filename){
 if(!AUDIO_EXTENSIONS.has(path.extname(filename).toLowerCase()))return null;
 const match=/^(.+)_([^_]+)_(\d+)$/.exec(path.parse(filename).name);if(!match)return null;
 const price=Number(match[3]),title=match[1].replaceAll('_',' ').trim(),author=match[2].trim();if(!title||!author||!Number.isSafeInteger(price)||price<1||price>1000000)return null;
 const id='song-'+createHash('sha256').update(title.normalize('NFKC').toLowerCase()+'\0'+author.normalize('NFKC').toLowerCase()).digest('hex').slice(0,24);
 return {id,title,author,name:title+' - '+author,price,kind:'music'};
}
export class MediaLibrary {
 constructor(root){this.root=path.resolve(root);this.songsRoot=path.join(this.root,'songs');this.shopRoot=path.join(this.songsRoot,'shop');this.campaignRoot=path.join(this.root,'campaign_files');}
 async files(dir,extensions,recursive=false){
  try{
   const actual=await realpath(dir),base=await realpath(this.root);if(!actual.startsWith(base+path.sep))return [];
   const result=[];for(const entry of(await readdir(dir,{withFileTypes:true})).sort(natural)){
    if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;const full=path.join(dir,entry.name);
    if(entry.isDirectory()&&recursive)result.push(...await this.files(full,extensions,true));
    else if(entry.isFile()&&extensions.has(path.extname(entry.name).toLowerCase()))result.push({name:entry.name,absolute:full,url:'/'+path.relative(this.root,full).split(path.sep).map(encodeURIComponent).join('/')});
   }return result;
  }catch{return [];}
 }
 async freeSongs(){return(await this.files(this.songsRoot,AUDIO_EXTENSIONS,true)).filter(f=>!this.isShopFile(f.absolute)).map(f=>({id:path.relative(this.songsRoot,f.absolute).split(path.sep).join('/'),name:path.parse(f.name).name,url:f.url}));}
 isShopFile(filename){return path.resolve(filename).toLowerCase().startsWith(this.shopRoot.toLowerCase()+path.sep);}
 async shopSongs(){const found=new Map();for(const file of await this.files(this.shopRoot,AUDIO_EXTENSIONS,true)){const song=parseShopSong(file.name);if(song&&!found.has(song.id))found.set(song.id,{...song,absolute:file.absolute,url:'/api/music/'+song.id});}return [...found.values()];}
 async stageMedia(stage,legacy={}){
  const inherited=stage.season?await this.stageMedia({...stage,id:stage.baseId,season:undefined},legacy):null;
  const folder=path.join(this.campaignRoot,stage.chapter,stage.baseId||stage.id,...(stage.season?[stage.season]:[])),[music,start,end,introAudio,endAudio,startSounds,endSounds,portraits]=await Promise.all([
   this.files(path.join(folder,'music'),AUDIO_EXTENSIONS),this.files(path.join(folder,'story_start'),IMAGES),this.files(path.join(folder,'story_end'),IMAGES),this.files(path.join(folder,'narrative_music_start'),AUDIO_EXTENSIONS),this.files(path.join(folder,'narrative_music_end'),AUDIO_EXTENSIONS),
   this.files(path.join(folder,'story_sounds_start'),AUDIO_EXTENSIONS),this.files(path.join(folder,'story_sounds_end'),AUDIO_EXTENSIONS),this.files(path.join(folder,'portraits'),IMAGES)
  ]);
  const duel=!stage.kind||stage.kind==='duel';
  const script=await dialogue(folder,stage.season&&duel?
    {start:seasonDialogue(stage),end:seasonDialogue(stage,true)}:{start:[],end:[]});
  const audio=f=>({id:'campaign:'+stage.id+':'+f.url,name:path.parse(f.name).name,url:f.url,detail:'BANDA SONORA DEL NIVEL'}),comics=start.length?start.map(f=>f.url):(stage.season?[]:legacy.comics||[]);
  const storyEnd=end.map(f=>f.url);
  return {...legacy,portraits:{...inherited?.portraits,...Object.fromEntries(portraits.map(file=>[path.parse(file.name).name,file.url]))},dialogueStart:script.start,dialogueEnd:script.end,comics,storyStart:comics,storyEnd,storySoundsStart:pageSounds(comics.length?comics:script.start.map((_,i)=>String(i+1)),startSounds),storySoundsEnd:pageSounds(storyEnd.length?storyEnd:script.end.map((_,i)=>String(i+1)),endSounds),music:music.length?music.map(audio):inherited?.music||[],narrativeStart:introAudio[0]?audio(introAudio[0]):inherited?.narrativeStart||null,narrativeEnd:endAudio[0]?audio(endAudio[0]):inherited?.narrativeEnd||null};
 }
 async chapterMedia(chapter){
  const base=chapter.world?path.join(this.campaignRoot,'_worlds',chapter.id):path.join(this.campaignRoot,chapter.id,'_chapter');
  const folder=path.join(base,...(chapter.season?[chapter.season]:[])),[start,end,introAudio,endAudio,startSounds,endSounds,cover,eventMap]=await Promise.all([
   ...['story_start','story_end','narrative_music_start','narrative_music_end','story_sounds_start','story_sounds_end'].map((dir,i)=>this.files(path.join(folder,dir),i<2?IMAGES:AUDIO_EXTENSIONS)),this.files(path.join(base,'cover'),IMAGES),this.files(path.join(base,'event_map'),IMAGES)
  ]);
  const script=await dialogue(folder,chapter.fallback||(chapter.season?{start:seasonChapterDialogue(chapter),end:seasonChapterDialogue(chapter,true)}:{start:[],end:[]}));
  const audio=f=>f?{id:'chapter:'+chapter.id+':'+f.url,name:path.parse(f.name).name,url:f.url}:null;
  const storyStart=start.map(f=>f.url),storyEnd=end.map(f=>f.url);
  return {dialogueStart:script.start,dialogueEnd:script.end,cover:cover[0]?.url||null,eventMap:eventMap[0]?.url||null,storyStart,storyEnd,storySoundsStart:pageSounds(storyStart.length?storyStart:script.start.map((_,i)=>String(i+1)),startSounds),storySoundsEnd:pageSounds(storyEnd.length?storyEnd:script.end.map((_,i)=>String(i+1)),endSounds),narrativeStart:audio(introAudio[0]),narrativeEnd:audio(endAudio[0])};
 }
 async worldCovers(worlds){
  const folder=path.join(this.root,'assets','campaing_miniworld');
  return Object.fromEntries(await Promise.all(worlds.map(async world=>{
   const files=await this.files(path.join(folder,world.id),IMAGES);
   return [world.id,{cover:files.find(file=>path.parse(file.name).name==='cover')?.url||null,map:files.find(file=>path.parse(file.name).name==='map')?.url||null}];
  })));
 }
}
