// Creates editable resource folders and seeds existing introductions once.
import {mkdir,writeFile,readFile,copyFile,access}from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath}from 'node:url';
import {CAMPAIGN_STAGES,CAMPAIGN_CHAPTERS}from '../js/campaign.mjs';
import {CAMPAIGN_CHESTS,campaignEvents} from '../js/campaign-events.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),legacy=JSON.parse(await readFile(new URL('../assets/campaign-media.json',import.meta.url),'utf8')),index=[];
const stories=['story_start','story_end','narrative_music_start','narrative_music_end','story_sounds_start','story_sounds_end'];
async function prepare(folder,names){
 for(const name of names)await mkdir(path.join(folder,name),{recursive:true});
}
for(const chapter of CAMPAIGN_CHAPTERS)await prepare(path.join(root,'campaign_files',chapter.id,'_chapter'),['cover','event_map',...stories]);
const stages=new Map([...CAMPAIGN_STAGES,...campaignEvents()].map(stage=>[stage.baseId||stage.id,stage]));
for(const [id,stage] of stages){
 const relative=path.join('campaign_files',stage.chapter,id),folder=path.join(root,relative);index.push({campaign:stage.chapter,level:id,rival:stage.name,path:relative.split(path.sep).join('/')});
 await prepare(folder,['music','portraits',...stories]);
 if(CAMPAIGN_CHAPTERS.find(c=>c.id===stage.chapter)?.expansion){
  const dialogue={start:[stage.kind==='trial'?
    'Un recorrido completo contra el reloj. Mantén la trazada y cruza la meta dentro de la marca exigida.':
    stage.name+' te espera en '+stage.team+'. '+(stage.style==='Grip'?'Vigila su aceleración tras cada curva.':stage.style==='Skiller'?'No dejes que gane distancia en las enlazadas.':'Fíjate en su trazada de entrada y salida.')],
    end:[stage.kind==='trial'?'Clasificación superada. El siguiente paso de montaña te espera.':'Has superado a '+stage.short+' en '+stage.team+'.']};
  try{await writeFile(path.join(folder,'dialogue.json'),JSON.stringify(dialogue,null,2)+'\n',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
 }
 for(const [i,url]of(legacy.stages[id]?.comics||[]).entries()){
  const source=path.resolve(root,decodeURIComponent(url).replace(/^\//,''));if(!source.startsWith(path.join(root,'assets')+path.sep))throw Error('Ruta de cómic inválida');
  const target=path.join(folder,'story_start',String(i+1).padStart(3,'0')+path.extname(source));try{await access(target);}catch{await copyFile(source,target);}
 }
}
for(const chest of CAMPAIGN_CHESTS){
 const folder=path.join(root,'campaign_files',chest.chapter,'reward_chest');
 await prepare(folder,['cover']);
 try{await writeFile(path.join(folder,'reward.json'),JSON.stringify(chest.reward,null,2)+'\n',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
}
await writeFile(new URL('../campaign_files/index.json',import.meta.url),JSON.stringify(index,null,2)+'\n');await mkdir(path.join(root,'songs','shop'),{recursive:true});await writeFile(path.join(root,'songs','shop','.gitkeep'),'');
console.log('Recursos preparados:',index.length,'eventos. Se conservaron las imágenes y escenas existentes.');
