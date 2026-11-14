import {CAMPAIGN_CHAPTERS,CAMPAIGN_SEASONS,CAMPAIGN_STAGES,campaignStages,seasonStageId} from './campaign.mjs';
import {CAMPAIGN_WORLDS} from './campaign-worlds.mjs';
import {EXPANSION_DRIVERS} from './expansion-drivers.mjs';

const drivers=Object.fromEntries(CAMPAIGN_STAGES.map(stage=>[stage.id,stage]));
const guest=(id,name,car,color,level,style)=>({id,name,short:name,car,color,level,style});
const roster={
  ...drivers,
  yanagida:guest('yanagida','Takuya Yanagida','m6f13','#b56840',4,'Grip'),
  ishigami:guest('ishigami','Fūjin Ishigami','gt3','#dfdada',4,'Complete'),
  ohtani:guest('ohtani','Yōsuke Ōtani','amggtr','#426586',3,'Complete')
};
const mfStages={
  odawara:[['odawara-grid',2,'nozomi','kakeru'],'jackson'],
  ashinoko:[['ashinoko-grid',2,'jackson','yanagida','ishigami'],'akaba'],
  manazuru:[['manazuru-grid-1',1,'ohtani','sakamoto','maezono'],['manazuru-grid-2',1,'moroboshi','ishigami','akaba'],['manazuru-grid-3',1,'sawatari','beckenbauer','kanata-final'],'kanata-final']
};
// Mean speeds in km/h for the qualifying mark, tuned per route.
const targetPace={akina:105,akagi:102,iroha:94,usui:111,tsukuba:105,tsubaki:95,odawara:107,ashinoko:137,manazuru:102,
  myogi:125,momiji:110,nanamagari:121,nagao:112,happogahara:96,sadamine:115,turnpike:166,enna:110,tsuchisaka:118,yabitsu:112};
const stageId=(season,id)=>seasonStageId(id,season);

function makeEvents(season){
  const duels=campaignStages(season),ngplus=season==='ngplus';
  const chapters=CAMPAIGN_WORLDS.flatMap(world=>world.chapters).map(id=>CAMPAIGN_CHAPTERS.find(c=>c.id===id));
  return chapters.flatMap((chapter,chapterIndex)=>{
    const mf=Boolean(mfStages[chapter.id]);
    if(mf&&season==='rain')return [];
    const common={season,chapter:chapter.id,track:chapter.track,index:chapterIndex*2,ngplus,team:chapter.name,world:mf?'mf-ghost':'initial-d'};
    const trial={...common,id:stageId(season,'trial-'+chapter.id),baseId:'trial-'+chapter.id,kind:'trial',name:'Time Trial',short:'Time Trial',level:ngplus?4:2,
      pace:targetPace[chapter.id]*(ngplus?(chapter.expansion||chapter.id==='akagi'?1.065:1.14):season==='rain'?.92:1)};
    const duel=id=>{
      const stage=duels.find(s=>s.id===stageId(season,id));
      return {...stage,baseId:id,world:common.world,kind:'duel',season,...(season==='dry'&&stage.unlock?{id:'event-'+id,legacyId:id}:{})};
    };
    if(chapter.expansion){
      const rivals=EXPANSION_DRIVERS.filter(([destination])=>destination===chapter.id).map(([,baseId,name,car,color,level,style,portrait])=>({
        ...common,id:stageId(season,baseId),baseId,name,short:name.split(' · ')[0],car,color,style,level:ngplus?Math.min(5,level+1):level,
        kind:'duel',folder:baseId,portrait
      }));
      return [...rivals,trial];
    }
    if(!mf)return [...duels.filter(s=>s.chapter===chapter.id).map(stage=>duel(stage.baseId||stage.id)),trial];
    return [trial,...mfStages[chapter.id].map(event=>{
      if(typeof event==='string')return duel(event);
      const [baseId,laps,...ids]=event;
      const rivals=ids.map(id=>({...roster[id],boss:null,signature:null,level:ngplus?Math.min(5,roster[id].level+1):roster[id].level,
        ngplus,gridPace:ngplus&&chapter.id!=='ashinoko'?.97:1}));
      const name={'manazuru-grid-1':'Carrera múltiple 1','manazuru-grid-2':'Carrera múltiple 2','manazuru-grid-3':'Final de parrilla'}[baseId]||'Carrera múltiple';
      return {...common,id:stageId(season,baseId),baseId,kind:'grid',name,short:name,laps,level:Math.max(...rivals.map(r=>r.level)),rivals};
    })];
  });
}

const eventsBySeason=Object.fromEntries(CAMPAIGN_SEASONS.map(({id})=>[id,makeEvents(id)]));
export const campaignEvents=(season='dry')=>eventsBySeason[season]||[];
const eventsById=new Map(Object.values(eventsBySeason).flat().map(event=>[event.id,event]));
export const campaignEvent=id=>eventsById.get(id)||campaignEvents().find(event=>event.legacyId===id);
export const trialTime=(event,length)=>Math.round(length*3.6/event.pace);
export const eventCleared=(event,cleared)=>Boolean(event&&(cleared.includes(event.id)||event.legacyId&&cleared.includes(event.legacyId)));
export const worldComplete=(world,season,cleared)=>{
  const events=campaignEvents(season).filter(event=>event.world===world);
  return Boolean(events.length)&&events.every(event=>eventCleared(event,cleared));
};
export function worldSeasonAvailable(season,cleared){
  if(season==='dry')return true;
  if(season==='rain')return worldComplete('initial-d','dry',cleared);
  return season==='ngplus'&&CAMPAIGN_WORLDS.every(world=>worldComplete(world.id,'dry',cleared));
}
export function eventAvailable(event,cleared){
  if(!event||!worldSeasonAvailable(event.season,cleared))return false;
  if(eventCleared(event,cleared))return true;
  const list=campaignEvents(event.season),index=list.findIndex(candidate=>candidate.id===event.id);
  return index>=0&&list.slice(0,index).every(previous=>eventCleared(previous,cleared));
}

const chestRewards={
  akina:['takumi-initial',{type:'focus',id:'balance'}],
  akagi:['keisuke-initial',{type:'focus',id:'time'}],
  iroha:['kai-campaign',{type:'focus',id:'drift'}],
  usui:['mako-campaign',{type:'cosmetic',slot:'accessory',key:'glasses-blue',name:'Gafas azules'}],
  tsukuba:['godhand-campaign',{type:'cosmetic',slot:'hair',key:'racer-cap',name:'Gorra de piloto'}],
  tsubaki:['keisuke-project',{type:'cosmetic',slot:'outfit',key:'racer',name:'Traje de piloto'}],
  odawara:['odawara-grid',{type:'cosmetic',slot:'accessory',key:'glasses-red',name:'Gafas rojas'}],
  ashinoko:['ashinoko-grid',{type:'music',id:'hakone-night',name:'Hakone nocturno'}],
  manazuru:['manazuru-grid-3',{type:'cosmetic',slot:'accessory',key:'glasses-gold',name:'Gafas doradas'}],
  myogi:['takeshi-myogi',{type:'cosmetic',slot:'eyes',keys:{male:'focused',female:'cat'},name:'Mirada de competición'}],
  momiji:['atsuro-momiji',{type:'cosmetic',slot:'hair',keys:{male:'undercut',female:'pixie'},name:'Cabello corto'}],
  nagao:['kai-nagao',{type:'cosmetic',slot:'accessory',key:'glasses-red',name:'Gafas rojas'}],
  happogahara:['sakai-happogahara',{type:'cosmetic',slot:'eyes',keys:{male:'bright',female:'starlight'},name:'Mirada brillante'}],
  turnpike:['ryosuke-turnpike',{type:'cosmetic',slot:'outfit',keys:{male:'rally',female:'sapphire'},name:'Traje especial'}],
  yabitsu:['omiya-yabitsu',{type:'cosmetic',slot:'accessory',key:'glasses-gold',name:'Gafas doradas'}]
};
export const CAMPAIGN_CHESTS=Object.entries(chestRewards).map(([chapter,[requires,reward]])=>({id:'chest-'+chapter,kind:'chest',chapter,requires,reward,name:'Cofre de recompensa'}));
export const campaignChest=id=>CAMPAIGN_CHESTS.find(chest=>chest.id===id);
export const chestAvailable=(chest,cleared)=>Boolean(chest&&eventCleared(campaignEvent(chest.requires),cleared));
export function campaignFocusUnlocks(legacyWins,claims){
  return CAMPAIGN_CHESTS.filter(({id,requires,reward})=>reward.type==='focus'&&(claims.includes(id)||legacyWins.includes(requires))).map(({reward})=>reward.id);
}
export function canViewStory(base,season,phase,cleared){
  if(!['start','end'].includes(phase))return false;
  const world=CAMPAIGN_WORLDS.some(w=>w.id===base);
  const list=campaignEvents(season).filter(e=>world?e.world===base:e.chapter===base);
  return list.length>0&&(phase==='start'?eventAvailable(list[0],cleared):list.every(event=>eventCleared(event,cleared)));
}
