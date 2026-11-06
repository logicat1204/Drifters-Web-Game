// Creates editable resource folders and seeds existing introductions once.
import {mkdir,writeFile,readFile,copyFile,access}from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath}from 'node:url';
import {CAMPAIGN_STAGES,CAMPAIGN_CHAPTERS}from '../js/campaign.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),legacy=JSON.parse(await readFile(new URL('../assets/campaign-media.json',import.meta.url),'utf8')),index=[];
for(const chapter of CAMPAIGN_CHAPTERS)for(const phase of ['story_start','story_end','narrative_music_start','narrative_music_end']){const dir=path.join(root,'campaign_files',chapter.id,'_chapter',phase);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'.gitkeep'),'');}
for(const stage of CAMPAIGN_STAGES){
 const relative=path.join('campaign_files',stage.chapter,stage.id),folder=path.join(root,relative);index.push({campaign:stage.chapter,level:stage.id,rival:stage.name,path:relative.split(path.sep).join('/')});
 for(const name of ['music','story_start','narrative_music_start','story_end','narrative_music_end']){const dir=path.join(folder,name);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'.gitkeep'),'');}
 for(const [i,url]of(legacy.stages[stage.id]?.comics||[]).entries()){
  const source=path.resolve(root,decodeURIComponent(url).replace(/^\//,''));if(!source.startsWith(path.join(root,'assets')+path.sep))throw Error('Ruta de cómic inválida');
  const target=path.join(folder,'story_start',String(i+1).padStart(3,'0')+path.extname(source));try{await access(target);}catch{await copyFile(source,target);}
 }
}
await writeFile(new URL('../campaign_files/index.json',import.meta.url),JSON.stringify(index,null,2)+'\n');await mkdir(path.join(root,'songs','shop'),{recursive:true});await writeFile(path.join(root,'songs','shop','.gitkeep'),'');
console.log('Recursos preparados:',index.length,'rivales. Las imágenes existentes no se sobrescriben.');
