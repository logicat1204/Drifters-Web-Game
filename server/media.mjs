import {readdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const AUDIO_EXTENSIONS=new Set(['.mp3','.ogg','.wav','.m4a','.aac','.flac','.opus','.webm']);
const IMAGES=new Set(['.png','.jpg','.jpeg','.webp','.gif']);
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
  const folder=path.join(this.campaignRoot,stage.chapter,stage.id),[music,start,end,introAudio,endAudio,startSounds,endSounds]=await Promise.all([
   this.files(path.join(folder,'music'),AUDIO_EXTENSIONS),this.files(path.join(folder,'story_start'),IMAGES),this.files(path.join(folder,'story_end'),IMAGES),this.files(path.join(folder,'narrative_music_start'),AUDIO_EXTENSIONS),this.files(path.join(folder,'narrative_music_end'),AUDIO_EXTENSIONS),
   this.files(path.join(folder,'story_sounds_start'),AUDIO_EXTENSIONS),this.files(path.join(folder,'story_sounds_end'),AUDIO_EXTENSIONS)
  ]);
  const audio=f=>({id:'campaign:'+stage.id+':'+f.url,name:path.parse(f.name).name,url:f.url,detail:'BANDA SONORA DEL NIVEL'}),comics=start.length?start.map(f=>f.url):(legacy.comics||[]);
  const storyEnd=end.map(f=>f.url);
  return {...legacy,comics,storyStart:comics,storyEnd,storySoundsStart:pageSounds(comics,startSounds),storySoundsEnd:pageSounds(storyEnd,endSounds),music:music.map(audio),narrativeStart:introAudio[0]?audio(introAudio[0]):null,narrativeEnd:endAudio[0]?audio(endAudio[0]):null};
 }
 async chapterMedia(chapter){
  const folder=path.join(this.campaignRoot,chapter.id,'_chapter'),[start,end,introAudio,endAudio,startSounds,endSounds]=await Promise.all(['story_start','story_end','narrative_music_start','narrative_music_end','story_sounds_start','story_sounds_end'].map((dir,i)=>this.files(path.join(folder,dir),i<2?IMAGES:AUDIO_EXTENSIONS)));
  const audio=f=>f?{id:'chapter:'+chapter.id+':'+f.url,name:path.parse(f.name).name,url:f.url}:null;
  const storyStart=start.map(f=>f.url),storyEnd=end.map(f=>f.url);
  return {storyStart,storyEnd,storySoundsStart:pageSounds(storyStart,startSounds),storySoundsEnd:pageSounds(storyEnd,endSounds),narrativeStart:audio(introAudio[0]),narrativeEnd:audio(endAudio[0])};
 }
}
