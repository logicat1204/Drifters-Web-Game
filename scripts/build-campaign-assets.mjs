import {readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_CHAPTERS,CAMPAIGN_STAGES} from '../js/campaign.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),result={version:1,stages:{}};
for(const stage of CAMPAIGN_STAGES){
 const chapter=CAMPAIGN_CHAPTERS.find(c=>c.id===stage.chapter),relative=path.join('assets','campanias',chapter.folder,stage.folder),folder=path.join(root,relative);
 const files=(await readdir(folder)).filter(name=>/\.(png|jpe?g|webp)$/i.test(name));
 if(files.length<2)throw Error('Faltan retrato y cómic: '+relative);
 const candidates=await Promise.all(files.map(async name=>({name,size:(await stat(path.join(folder,name))).size})));
 const explicit=candidates.filter(f=>/comic/i.test(f.name));
 const comics=explicit.length?explicit:candidates.filter(f=>!/photo|profile|face|thumb|screenshot/i.test(f.name));
 const pages=(explicit.length?explicit:[...(comics.length?comics:candidates)].sort((a,b)=>b.size-a.size).slice(0,1)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
 const portrait=candidates.find(f=>!pages.some(p=>p.name===f.name));if(!portrait)throw Error('No se identifica el retrato: '+relative);
 const url=name=>'/'+path.join(relative,name).split(path.sep).map(encodeURIComponent).join('/');
 result.stages[stage.id]={portrait:url(portrait.name),comics:pages.map(p=>url(p.name))};
}
await writeFile(path.join(root,'assets/campaign-media.json'),JSON.stringify(result,null,2)+'\n');
console.log('Campañas: '+Object.keys(result.stages).length+' retratos y cómics registrados.');
