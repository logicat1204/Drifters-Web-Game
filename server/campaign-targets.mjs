import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {trialTime} from '../js/campaign-events.mjs';

const root=fileURLToPath(new URL('../campaign_files/',import.meta.url));
const styles=new Map([['Grip','Grip'],['Balance','Complete'],['Complete','Complete'],['Skiller','Skiller']]);

export class CampaignTargets {
  constructor(directory=root){
    this.root=directory;
    this.warnings=new Map();
  }
  read(parts,filename){
    const file=path.join(this.root,...parts,filename);
    try{
      const value=JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
      if(!value||Array.isArray(value)||typeof value!=='object')throw Error('se esperaba un objeto JSON');
      return value;
    }catch(error){
      if(error.code!=='ENOENT')this.warn(file,error.message);
      return {};
    }
  }
  warn(file,message){
    if(this.warnings.get(file)===message)return;
    this.warnings.set(file,message);
    console.warn(`${path.relative(this.root,file)} · ${message}`);
  }
  time(value,season,parts,filename){
    const seconds=value?.targetTimeSec?.[season];
    if(seconds==null)return null;
    if(typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>=15&&seconds<=800)return seconds;
    this.warn(path.join(this.root,...parts,filename),`targetTimeSec.${season} debe estar entre 15 y 800 segundos`);
    return null;
  }
  trial(stage,length){
    const parts=[stage.chapter,stage.baseId||stage.id];
    return this.time(this.read(parts,'trial.json'),stage.season||'dry',parts,'trial.json')??trialTime(stage,length);
  }
  rival(stage,driver=stage){
    const parts=[stage.chapter,stage.baseId||stage.id];
    if(stage.kind==='grid')parts.push(driver.id);
    const value=this.read(parts,'rival.json');
    const style=styles.get(value.style);
    if(value.style!=null&&!style)this.warn(path.join(this.root,...parts,'rival.json'),'style debe ser Grip, Balance o Skiller');
    const targetTimeSec=this.time(value,stage.season||'dry',parts,'rival.json');
    return {...driver,style:style||driver.style,...(targetTimeSec!==null?{targetTimeSec}:{})};
  }
}
