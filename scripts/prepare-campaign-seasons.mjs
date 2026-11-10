import {mkdir,writeFile} from 'node:fs/promises';
import {campaignStages,CAMPAIGN_CHAPTERS} from '../js/campaign.mjs';
import {seasonDialogue,seasonChapterDialogue} from '../js/season-stories.mjs';
const dirs=['music','story_start','story_end','narrative_music_start','narrative_music_end','story_sounds_start','story_sounds_end'];
async function create(folder,script){await mkdir(folder,{recursive:true});for(const dir of dirs)await mkdir(folder+'/'+dir,{recursive:true});for(const [file,contents]of [['dialogue.json',JSON.stringify(script,null,2)+'\n'],['README.md','# Recursos de temporada\n\n`dialogue.json` contiene las escenas de diálogo. Las imágenes en `story_start/` y `story_end/` reemplazan esos diálogos.\n\nCarpetas: '+dirs.map(d=>'`'+d+'/`').join(', ')+'. Se mantiene la ordenación natural y la asociación de sonidos por nombre o número de página.\n']])try{await writeFile(folder+'/'+file,contents,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}}
for(const season of ['rain','ngplus']){
 for(const s of campaignStages(season))await create(`campaign_files/${s.chapter}/${s.baseId}/${season}`,{start:seasonDialogue(s),end:seasonDialogue(s,true)});
 for(const c of CAMPAIGN_CHAPTERS)await create(`campaign_files/${c.id}/_chapter/${season}`,{start:seasonChapterDialogue({...c,season}),end:seasonChapterDialogue({...c,season},true)});
}
console.log('Prepared rain and NG+ resources without overwriting custom files.');
