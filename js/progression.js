import {CAMPAIGN_LEVELS,DRIVER_STYLES,CAMPAIGN_SEASONS,seasonStageId,campaignReward,campaignConditions} from './campaign.mjs';
import {defaultAvatar,installCosmetics} from './avatar.mjs';
import {decorateCampaignMap} from './campaign-map.js';
import {campaignNodeIcon,renderRegionPaths} from './campaign-region-map.js';
import {canViewStory,chestAvailable,eventAvailable,eventCleared,worldSeasonAvailable} from './campaign-events.mjs';
import {FOCUS_TYPES} from './focus.mjs';
import {campaignPreparationIssue,buildKey} from './tuning.mjs';
import {CAMPAIGN_WORLDS,INITIAL_D_REGIONS,WORLD_DESTINATIONS} from './campaign-worlds.mjs';
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const duration=seconds=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
const portrait=(src,alt,cls)=>{const img=node('img',cls);img.src=src;img.alt=alt;img.loading='lazy';return img;};
export class ProgressionClient {
  constructor(account,callbacks){
    this.account=account;this.callbacks=callbacks;this.user=account.user;this.season='dry';this.chapter=null;this.selected=null;this.category='car';this.base='male';this.comicOpen=false;this.musicSelections={};
    document.querySelectorAll('[data-shop-category]').forEach(button=>button.onclick=()=>{this.category=button.dataset.shopCategory;this.item=null;this.renderShop();});
    $('shop-base').onchange=()=>{this.base=$('shop-base').value;this.item=null;this.renderShop();};
    $('campaign-ngplus-dialog')?.addEventListener('close',event=>{if(event.currentTarget.returnValue==='start')this.setCampaignCycle('ngplus');});
    $('comic-cancel').onclick=()=>this.closeComic();$('comic-next').onclick=()=>this.nextComic();
    $('comic-prev').onclick=()=>{if(this.page>0){this.page--;this.renderComic();}};
    $('comic-zoom').onclick=()=>{const zoom=$('comic-reader').classList.toggle('zoomed');$('comic-zoom').textContent=zoom?'AJUSTAR':'AMPLIAR';};
    window.addEventListener('keydown',event=>{if(!this.comicOpen)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.closeComic();}if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==='ArrowRight')this.nextComic();else $('comic-prev').click();}if(event.key==='Tab'){const buttons=[$('comic-zoom'),$('comic-cancel'),$('comic-prev'),$('comic-next')].filter(b=>!b.disabled);if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}}},true);
  }
  setUser(user){if(user&&this.user?.id!==user.id){this.season='dry';this.chapter=this.selected=this.world=this.destination=this.view=null;if(this.rootCatalog)this.catalog=this.rootCatalog.seasons?.[0]||this.rootCatalog;}this.user=user;if(!user)return;if(this.musicUser!==user.id){this.musicUser=user.id;try{this.musicSelections=JSON.parse(localStorage.getItem('touge-campaign-songs:'+user.id)||'{}')||{};}catch{this.musicSelections={};}}$('menu-coins').textContent=user.coins.toLocaleString();if(this.catalog)this.renderCampaign();if(this.shop)this.renderShop();}
  async load(){if(this.loading)return this.loading;this.loading=Promise.all([this.account.request('/api/campaign'),this.account.request('/api/shop')]).then(([catalog,shop])=>{this.rootCatalog=catalog;this.catalog=catalog.seasons?.find(s=>s.id===this.season)||catalog;this.shop=shop;this.user=catalog.user;installCosmetics(shop.cosmetics.filter(i=>i.pack));}).finally(()=>{this.loading=null;});return this.loading;}
  selectSeason(id){
    if(!worldSeasonAvailable(id,this.cleared()))return;
    this.season=id;this.catalog=this.rootCatalog.seasons.find(s=>s.id===id);
    this.renderWorldMap();
    $('campaign-map-seasons').querySelector('[aria-pressed=true]')?.focus({preventScroll:true});
  }
  cleared(){return (this.user?.campaign||[]).map(stage=>stage.id);}
  controller(buttons,old){
    const pressed=i=>buttons[i]&&!old[i];
    if(this.comicOpen){if(pressed(0)||pressed(15))this.nextComic();if(pressed(14))$('comic-prev').click();if(pressed(1))this.closeComic();return;}
    const focus=[...$('campaign').querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length),index=Math.max(0,focus.indexOf(document.activeElement));
    const map=document.activeElement.closest('#campaign-stages,#campaign-map-destinations');
    if(pressed(12)||pressed(13)){
      if(map&&pressed(12))document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
      else if(map&&pressed(13)&&this.view==='region')($('campaign-start')||$('campaign-chest-open'))?.focus();
      else {focus[(index+(pressed(13)?1:focus.length-1))%focus.length]?.focus();document.activeElement.scrollIntoView({block:'nearest'});}
    }
    if(pressed(14)||pressed(15))document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:pressed(15)?'ArrowRight':'ArrowLeft',bubbles:true}));
    if(pressed(0))document.activeElement?.click();if(pressed(1))this.backCampaign();
  }
  campaignView(view){
    this.view=view;
    for(const name of ['worlds','world-map','region'])$('campaign-'+name).classList.toggle('hidden',name!==view);
    $('campaign-status').textContent='';
  }
  async openCampaign(){
    this.callbacks.screen('campaign');this.campaignView('worlds');
    $('campaign-status').textContent='Cargando la campaña…';
    $('campaign-world-list').replaceChildren();$('campaign-ngplus').classList.add('hidden');
    try{await this.load();if(this.view==='worlds')this.renderWorlds();}
    catch(error){$('campaign-status').textContent=error.message;}
  }
  renderWorlds(){
    this.campaignView('worlds');
    const ngplus=$('campaign-ngplus'),ready=worldSeasonAvailable('ngplus',this.cleared());
    const started=this.cleared().some(id=>id.startsWith('ngplus:'));
    const complete=this.rootCatalog.seasons.find(s=>s.id==='ngplus').stages.every(stage=>eventCleared(stage,this.cleared()));
    ngplus.classList.toggle('hidden',!ready);ngplus.textContent=this.season==='ngplus'?'Volver a la campaña inicial':started?'Continuar NG+':'Comenzar NG+';
    ngplus.onclick=()=>{
      if(this.season==='ngplus')this.setCampaignCycle('dry');
      else if(started)this.setCampaignCycle('ngplus');
      else{const dialog=$('campaign-ngplus-dialog');dialog.returnValue='';dialog.showModal();}
    };
    $('campaign-world-list').replaceChildren(...CAMPAIGN_WORLDS.map(world=>{
      const button=node('button','campaign-world-button');button.dataset.world=world.id;
      const first=this.rootCatalog.chapters.find(c=>c.id===world.chapters[0]);
      const cover=this.rootCatalog.worldMedia?.[world.id]?.cover||first.media.storyStart?.[0]||first.media.portrait;
      const copy=node('div');copy.append(node('h2','',world.name),node('p','',world.description));
      button.append(portrait(cover,''),copy);button.onclick=()=>this.openWorld(world);return button;
    }));
    $('campaign-world-list').querySelector('button')?.focus({preventScroll:true});
    $('campaign-status').textContent=complete?'Campaña completada. Puedes repetir los eventos de NG+.':this.season==='ngplus'?'NG+ · Defiende el trono.':'';
  }
  setCampaignCycle(season){
    this.season=season;this.catalog=this.rootCatalog.seasons.find(item=>item.id===season);this.renderWorlds();
  }
  openWorld(world){
    this.world=world;this.destination=null;this.region=null;
    if(world.id==='mf-ghost'&&this.season==='rain'){this.season='dry';this.catalog=this.rootCatalog.seasons[0];}
    this.renderWorldMap();
    $('campaign-map-destinations').querySelector('.selected')?.focus({preventScroll:true});
  }
  worldChapters(){return this.world.chapters.map(id=>this.catalog.chapters.find(c=>c.id===id)).filter(Boolean);}
  renderWorldMap(){
    if(!this.world)return;
    this.campaignView('world-map');
    $('campaign-world-name').textContent=this.world.name;
    const cleared=this.cleared(),allChapters=this.worldChapters();
    const suggested=allChapters.find(c=>c.id===this.destination)||allChapters.find(c=>this.catalog.stages.some(s=>s.chapter===c.id&&!eventCleared(s,cleared)&&eventAvailable(s,cleared)))||allChapters[0];
    const groups=this.world.id==='initial-d'?INITIAL_D_REGIONS:[{ids:this.world.chapters}];
    this.region??=Math.max(0,groups.findIndex(group=>group.ids.includes(suggested.id)));
    const chapters=groups[this.region].ids.map(id=>allChapters.find(c=>c.id===id));
    const chapter=chapters.find(c=>c.id===suggested.id)||chapters[0];
    this.destination=chapter.id;
    const seasons=$('campaign-map-seasons');seasons.replaceChildren();
    const regions=$('campaign-map-regions');regions.replaceChildren();
    if(groups.length>1)for(const [index,group] of groups.entries()){
      const button=node('button','secondary-button',group.name);
      button.setAttribute('aria-pressed',String(index===this.region));button.onclick=()=>{
        this.region=index;
        this.destination=group.ids.find(id=>this.catalog.stages.some(event=>event.chapter===id&&!eventCleared(event,cleared)&&eventAvailable(event,cleared)))||group.ids[0];
        this.renderWorldMap();regions.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});
      };regions.append(button);
    }
    if(this.world.id==='initial-d'&&this.season!=='ngplus')for(const season of CAMPAIGN_SEASONS.filter(s=>s.id!=='ngplus')){
      const button=node('button','secondary-button',season.name);button.dataset.season=season.id;button.disabled=!worldSeasonAvailable(season.id,cleared);
      button.setAttribute('aria-pressed',String(this.season===season.id));button.onclick=()=>this.selectSeason(season.id);seasons.append(button);
    }
    const nav=$('campaign-map-destinations');nav.replaceChildren(...chapters.map((c,i)=>{
      const events=this.catalog.stages.filter(s=>s.chapter===c.id),done=events.filter(s=>eventCleared(s,cleared)).length;
      const button=node('button',c.id===chapter.id?'selected':'');button.dataset.chapter=c.id;
      button.classList.toggle('chapter-locked',!eventAvailable(events[0],cleared));button.classList.toggle('chapter-cleared',done===events.length);
      button.setAttribute('aria-pressed',String(c.id===chapter.id));button.append(node('small','',String(i+1).padStart(2,'0')),node('span','',c.name));
      button.onclick=()=>{this.destination=c.id;this.renderWorldMap();nav.querySelector('.selected')?.focus({preventScroll:true});};return button;
    }));
    decorateCampaignMap(nav,chapter.id,chapters.map(c=>({...c,map:WORLD_DESTINATIONS[c.id]})),this.rootCatalog.worldMedia?.[this.world.id]?.map);
    const detail=$('campaign-destination'),copy=node('div','campaign-detail-copy');
    const milestones=this.catalog.stages.filter(stage=>stage.chapter===chapter.id);
    const wins=milestones.filter(stage=>eventCleared(stage,cleared)).length;
    copy.append(node('h2','',chapter.name),node('p','campaign-destination-description',WORLD_DESTINATIONS[chapter.id].description),node('p','campaign-model',`${wins} de ${milestones.length} eventos superados`));
    const available=this.chapterEligible(chapter,'start'),travel=node('button','start-button full',available?'Viajar':'Destino bloqueado');
    travel.id='campaign-travel';travel.disabled=!available;travel.onclick=()=>this.travel(chapter);copy.append(travel);
    const cover=chapter.media.cover||chapter.media.storyStart?.[0]||chapter.media.portrait;
    detail.replaceChildren(portrait(cover,'','campaign-hero'),copy);
  }
  travel(chapter){
    const cleared=this.cleared(),events=this.catalog.stages.filter(s=>s.chapter===chapter.id);
    this.chapter=chapter.id;this.selected=(events.find(s=>!eventCleared(s,cleared)&&eventAvailable(s,cleared))||events[0]).id;
    this.campaignView('region');this.renderCampaign();
    $('campaign').scrollTop=0;
    const chapterStart=()=>{if(!this.maybeChapterStory('start'))$('campaign-stages').querySelector('.selected')?.focus({preventScroll:true});};
    if(!this.maybeWorldStory('start',chapterStart))chapterStart();
  }
  backCampaign(){
    if(this.view==='region'){this.renderWorldMap();$('campaign').scrollTop=0;$('campaign-map-destinations').querySelector('.selected')?.focus({preventScroll:true});}
    else if(this.view==='world-map')this.renderWorlds();
    else{this.view=null;this.callbacks.screen('play');}
  }
  renderCampaign(){
    if(!this.catalog||!this.user||this.view!=='region')return;
    const cleared=this.cleared(),chapter=this.catalog.chapters.find(c=>c.id===this.chapter);
    const events=this.catalog.stages.filter(s=>s.chapter===chapter.id);
    const complete=events.every(s=>eventCleared(s,cleared));
    $('campaign-counter').textContent=events.filter(s=>eventCleared(s,cleared)).length+' / '+events.length+' EVENTOS';
    $('campaign-coins').textContent='◈ '+this.user.coins.toLocaleString();
    $('campaign-title').textContent=chapter.name;
    $('campaign-completion').textContent=complete?'Destino completado.':this.season==='ngplus'?'NG+ · Defiende el trono.':'';
    $('campaign-tag').textContent=chapter.tag;
    const next=events.find(s=>!eventCleared(s,cleared)&&eventAvailable(s,cleared)),nextButton=$('campaign-next');
    nextButton.disabled=!next;nextButton.textContent=next?'SIGUIENTE / '+next.short:'REGIÓN COMPLETADA ✓';
    nextButton.onclick=()=>{if(!next)return;this.selected=next.id;this.renderCampaign();$('campaign-start').focus();};
    for(const phase of ['start','end']){const b=$('chapter-story-'+phase);if(b){b.disabled=!this.chapterEligible(chapter,phase)||!(chapter.media?.[phase==='start'?'storyStart':'storyEnd']?.length||chapter.media?.[phase==='start'?'dialogueStart':'dialogueEnd']?.length);b.onclick=()=>this.chapterStory(chapter,phase);}}
    for(const phase of ['start','end']){const button=$('world-story-'+phase);button.disabled=!canViewStory(this.world.id,this.season,phase,cleared);button.onclick=()=>this.worldStory(phase);}
    const list=$('campaign-stages');list.replaceChildren();
    const chest=this.season==='dry'?this.rootCatalog.chests.find(item=>item.chapter===chapter.id):null;
    for(const event of [...events,...(chest?[chest]:[])]){
      const available=event.kind==='chest'?chestAvailable(event,cleared):eventAvailable(event,cleared);
      const done=event.kind==='chest'?this.user.campaignChests?.includes(event.id):eventCleared(event,cleared);
      const button=node('button','campaign-stage campaign-event'+(event.id===this.selected?' selected':'')+(!available?' locked':''));
      button.dataset.stage=event.id;button.dataset.kind=event.kind;button.classList.toggle('completed',!!done);
      button.setAttribute('aria-pressed',String(event.id===this.selected));
      const type={trial:'Time Trial',grid:event.short,chest:'Cofre',duel:'Duelo'}[event.kind];
      const icon=node('i','campaign-event-icon');
      icon.setAttribute('aria-hidden','true');icon.append(campaignNodeIcon(event.kind));
      if(done)icon.append(node('span','region-node-check','✓'));
      const info=node('div');info.append(node('b','',event.kind==='duel'?event.short:type));
      button.setAttribute('aria-label',(event.kind==='duel'?event.name:type)+' · '+(done?'Completado':available?'Disponible':'Bloqueado'));
      button.append(icon,info);
      button.onclick=()=>{this.selected=event.id;this.renderCampaign();list.querySelector('.selected')?.focus({preventScroll:true});if(window.matchMedia('(max-width:760px)').matches)$('campaign-detail').scrollIntoView({block:'start'});};
      list.append(button);
    }
    renderRegionPaths(list,chapter,events,chest);
    const stage=events.find(item=>item.id===this.selected)||(chest&&chest.id===this.selected?chest:events[0]);
    this.selected=stage.id;
    const detail=$('campaign-detail');detail.replaceChildren();
    detail.classList.toggle('boss-detail',!!stage.signature);
    if(stage.kind==='chest'){$('campaign-conditions').textContent='PREMIO DE CAMPAÑA';this.renderChest(stage);return;}
    const conditions=campaignConditions(stage);
    $('campaign-conditions').textContent=[conditions.night?'NOCHE':'DÍA',conditions.wet?'LLUVIA':'ASFALTO SECO',conditions.fog?'NIEBLA':null].filter(Boolean).join(' / ');
    const copy=node('div','campaign-detail-copy');
    if(stage.kind==='duel'){
      detail.append(portrait(stage.media.portrait,stage.name,'campaign-hero'));
      if(stage.signature)detail.style.setProperty('--boss-color',stage.signature.color);
      copy.append(node('small','eyebrow','DUELO · NIVEL '+stage.level+' / '+CAMPAIGN_LEVELS[stage.level-1].toUpperCase()),node('h2','',stage.name),
        node('p','campaign-model',stage.carInfo.brand+' '+stage.carInfo.name+' · '+stage.carInfo.code),node('p','',DRIVER_STYLES[stage.style].description));
      if(stage.signature){const signature=node('div','boss-signature');signature.append(node('b','',stage.signature.name),node('p','',stage.signature.description));copy.append(signature);}
    }else{
      copy.append(node('small','eyebrow',stage.kind==='trial'?'CLASIFICACIÓN':'PARRILLA · '+stage.laps+(stage.laps===1?' VUELTA':' VUELTAS')),node('h2','',stage.name));
      if(stage.kind==='trial')copy.append(node('p','campaign-model','Marca de clasificación · '+duration(stage.targetTime)),
        node('p','','Cruza la meta en ese tiempo o menos para desbloquear el próximo evento.'));
      else {
        copy.append(node('p','','Termina en primer lugar para avanzar.'));
        const drivers=node('div','campaign-grid-drivers');
        for(const rival of stage.rivals){
          const driver=node('div','campaign-grid-driver');
          driver.append(rival.portrait?portrait(rival.portrait,''):node('span','campaign-grid-placeholder',rival.name.split(' ').at(-1).charAt(0)));
          const bio=node('div');bio.append(node('b','',rival.name),node('small','',rival.carInfo.brand+' '+rival.carInfo.code+' · '+DRIVER_STYLES[rival.style].label));driver.append(bio);drivers.append(driver);
        }
        copy.append(drivers);
      }
    }
    const best=this.user.campaign.find(p=>p.id===stage.id)||this.user.campaign.find(p=>p.id===stage.legacyId);
    copy.append(node('p','campaign-prize',best?'✓ Superado'+(best.bestTime?' · '+duration(best.bestTime):'')+' · '+best.rewardCoins+' monedas de premio principal.':'Primer triunfo · '+campaignReward(stage,0)+'–'+campaignReward(stage,24000)+' monedas'));
    const car=this.callbacks.car?.()||this.shop?.cars.find(c=>c.id===this.user.defaultCar),build=car?.build||this.user.garage?.[car?.id]?.build;
    const issue=campaignPreparationIssue(stage,car,build);
    if(stage.ngplus){copy.append(node('p','campaign-model',`TU COCHE: ${car?.code||'—'} · CATEGORÍA ${car?.competitionTier||1} · ${buildKey(build)}`));if(issue){copy.append(node('p','campaign-unlock',issue));const garage=node('button','secondary-button full','IR AL GARAJE');garage.onclick=()=>car?.competitionTier>=3?this.callbacks.garage?.():this.callbacks.screen('garage');const shop=node('button','secondary-button full','VER COCHES EN TIENDA');shop.onclick=()=>this.openShop('car');copy.append(garage,shop);}}
    const start=node('button','start-button full',issue?'PREPARACIÓN NG+ REQUERIDA':eventAvailable(stage,cleared)?best?'VOLVER A COMPETIR →':stage.kind==='trial'?'INICIAR CONTRARRELOJ →':'ENTRAR AL EVENTO →':'SUPERA EL EVENTO ANTERIOR');
    start.disabled=!eventAvailable(stage,cleared)||!!issue;start.id='campaign-start';start.onclick=()=>this.begin(stage);
    const control=node('div','campaign-soundtrack');control.id='campaign-song';copy.append(control,start);detail.append(copy);this.refreshMusicControls();
  }
  renderChest(chest){
    const detail=$('campaign-detail'),copy=node('div','campaign-detail-copy'),done=this.user.campaignChests?.includes(chest.id);
    const reward=chest.reward,available=chestAvailable(chest,this.cleared());
    copy.append(node('small','eyebrow','PREMIO DE LA REGIÓN'),node('h2','',chest.name),
      node('p','campaign-model',reward.type==='focus'?FOCUS_TYPES[reward.id].name:reward.name));
    const button=node('button','start-button full',done?'COFRE ABIERTO':available?'ABRIR COFRE':'SUPERA EL EVENTO CONECTADO');
    button.id='campaign-chest-open';button.disabled=done||!available;button.onclick=async()=>{
      button.disabled=true;
      try{
        const result=await this.account.request('/api/campaign/chest',{method:'POST',body:JSON.stringify({id:chest.id})});
        this.account.accept(result);this.setUser(result.user);this.callbacks.refreshSongs?.();
        $('campaign-status').textContent='Premio agregado a tu licencia.';
      }catch(error){button.disabled=false;$('campaign-status').textContent=error.message;}
    };
    copy.append(button);detail.append(copy);
  }
  library(){return (this.callbacks.songs?.()||[]).filter((song,index,songs)=>songs.findIndex(item=>item.id===song.id)===index);}
  songChoices(stage){
    const library=this.library(),first=(stage.media.music||[])[0]||library.find(s=>s.id==='synth')||{id:'none',name:'Solo el motor'};
    const personal=Array.isArray(this.musicSelections.playlist)?this.musicSelections.playlist:[];
    return [first,...personal.slice(0,7).map(id=>library.find(song=>song.id===id)).filter(song=>song&&song.id!==first.id)];
  }
  musicFor(stage){const choices=this.songChoices(stage);return choices.find(song=>song.id===this.musicSelections[stage.id])||choices[0];}
  saveMusic(){try{localStorage.setItem('touge-campaign-songs:'+this.user.id,JSON.stringify(this.musicSelections));}catch{}}
  refreshMusicControls(){
    const control=$('campaign-song'),stage=this.catalog?.stages.find(s=>s.id===this.selected);if(!control||!stage)return;
    const choices=this.songChoices(stage),index=choices.findIndex(song=>song.id===this.musicFor(stage).id);
    const carousel=node('div','campaign-song-carousel'),current=node('span','',choices[index].name);current.setAttribute('aria-live','polite');
    const move=(label,offset,description)=>{
      const button=node('button','secondary-button',label);button.disabled=choices.length<2;button.setAttribute('aria-label',description);
      button.onclick=()=>{this.musicSelections[stage.id]=choices[(index+offset+choices.length)%choices.length].id;this.saveMusic();this.refreshMusicControls();control.querySelector(offset<0?'button':'button:nth-of-type(2)')?.focus();};return button;
    };
    carousel.append(move('‹',-1,'Canción anterior'),current,move('›',1,'Siguiente canción'));
    const editor=node('details','campaign-playlist');editor.open=control.querySelector('details')?.open||false;
    const personal=Array.isArray(this.musicSelections.playlist)?this.musicSelections.playlist:[];
    const library=this.library(),valid=personal.filter(id=>library.some(song=>song.id===id));
    const summary=node('summary','','Mi lista · '+valid.length+' / 7');editor.append(summary);
    for(const song of library){
      const selected=valid.includes(song.id),label=node('label'),check=node('input');check.type='checkbox';check.checked=selected;check.disabled=!selected&&valid.length>=7;
      check.onchange=()=>{this.musicSelections.playlist=check.checked?[...valid,song.id]:valid.filter(id=>id!==song.id);this.saveMusic();this.refreshMusicControls();[...control.querySelectorAll('input')].find(input=>input.value===song.id)?.focus();};
      check.value=song.id;label.append(check,node('span','',song.name));editor.append(label);
    }
    control.replaceChildren(node('small','eyebrow',index===0?'BANDA SONORA · POR DEFECTO':'BANDA SONORA · '+index+' / '+(choices.length-1)),carousel,editor);
  }
  begin(stage){
    if(!eventAvailable(stage,this.cleared()))return;
    const car=this.callbacks.car?.()||this.shop?.cars.find(c=>c.id===this.user.defaultCar),issue=campaignPreparationIssue(stage,car,car?.build||this.user.garage?.[car?.id]?.build);
    if(issue){$('campaign-status').textContent=issue;return;}
    if(this.callbacks.prepare(stage)===false)return;this.chapter=stage.chapter;this.selected=stage.id;this.renderCampaign();
    const launch=()=>{if(!this.openStory(stage,'start',()=>this.callbacks.start(stage)))this.callbacks.start(stage);};
    if(!this.maybeChapterStory('start',launch))launch();
  }
  chapterEligible(chapter,phase){return canViewStory(chapter.id,this.season,phase,this.cleared());}
  chapterStory(chapter,phase,complete=()=>{},world=false){
    if(!this.chapterEligible(chapter,phase)||this.comicOpen)return false;
    return this.openStory({name:chapter.name,chapter:world?this.chapter:chapter.id,chapterStory:true,media:chapter.media||{}},phase,async()=>{
      try{
        const data=await this.account.request('/api/campaign/story',{method:'POST',body:JSON.stringify({chapter:chapter.storyKey,phase})});
        this.account.accept(data);this.user=data.user;
        if(this.view==='region')$('campaign-stages').querySelector('.selected')?.focus({preventScroll:true});
      }catch(error){$('campaign-status').textContent='No se pudo guardar la lectura. '+error.message;}
      complete();
    });
  }
  maybeChapterStory(phase,complete){const chapter=this.catalog?.chapters.find(c=>c.id===this.chapter);return chapter&&!(this.user.chapterStories||[]).some(key=>key===chapter.storyKey+':'+phase||key===chapter.storyKey.slice(4)+':'+phase)?this.chapterStory(chapter,phase,complete):false;}
  worldStory(phase,complete,automatic=false){
    if(!this.world)return false;
    const id=this.world.id,storyKey='map:'+seasonStageId(id,this.season);
    if(automatic&&(this.user.chapterStories||[]).includes(storyKey+':'+phase))return false;
    const media={...this.catalog.worldStories?.[id],portrait:this.rootCatalog.worldMedia?.[id]?.cover||this.catalog.chapters.find(item=>item.id===this.chapter)?.media.portrait};
    return this.chapterStory({...this.world,storyKey,media},phase,complete,true);
  }
  maybeWorldStory(phase,complete){return this.worldStory(phase,complete,true);}
  openStory(stage,phase,complete=()=>{}){
    let pages=phase==='end'?(stage.media.storyEnd||[]):(stage.media.storyStart||stage.media.comics||[]);if(!pages.length)pages=(stage.media[phase==='end'?'dialogueEnd':'dialogueStart']||[]).map(text=>({image:stage.media.portrait,text}));if(!pages.length)return false;
    this.introStage=stage;this.storyPhase=phase;this.storyPages=pages;this.storyComplete=complete;this.page=0;this.comicOpen=true;this.comicFocus=stage.chapterStory?document.activeElement:phase==='end'?$('next-arcade'):$('campaign-start');$('app').inert=true;
    $('comic-overlay').classList.remove('hidden');$('comic-reader').classList.remove('zoomed');$('comic-zoom').textContent='AMPLIAR';$('comic-title').textContent=stage.name;$('comic-cancel').textContent=phase==='end'?'VER RESULTADOS ×':'VOLVER ×';$('comic-eyebrow').textContent=`${this.catalog.chapters.find(c=>c.id===stage.chapter).name.toUpperCase()} / ${phase==='end'?'VICTORIA':'PRÓLOGO'} · NIVEL ${stage.level}`;
    if(stage.chapterStory){$('comic-eyebrow').textContent='CRÓNICAS DE LA MONTAÑA / '+(phase==='end'?'EPÍLOGO DE CAMPAÑA':'PRÓLOGO DE CAMPAÑA');$('comic-cancel').textContent='VOLVER ×';}const song=phase==='end'?stage.media.narrativeEnd:stage.media.narrativeStart;$('comic-music').textContent=song?'♫ '+song.name:'LECTURA SIN MÚSICA';this.callbacks.storyAudio?.(song);this.renderComic();$('comic-next').focus();return true;
  }
  renderComic(){
    const image=$('comic-image'),token=this.storyPageToken=(this.storyPageToken||0)+1;
    const sound=this.introStage.media[this.storyPhase==='end'?'storySoundsEnd':'storySoundsStart']?.[this.page];
    this.callbacks.storyPage?.(null);
    image.classList.remove('comic-arriving');
    image.onload=()=>{
      if(!this.comicOpen||token!==this.storyPageToken)return;
      image.classList.remove('comic-arriving');
      requestAnimationFrame(()=>{if(this.comicOpen&&token===this.storyPageToken)image.classList.add('comic-arriving');});
      this.callbacks.storyPage?.(sound||null);
    };
    image.onerror=()=>{if(token===this.storyPageToken)$('comic-page').textContent+=' · Página no disponible. Puedes continuar.';};
    const page=this.storyPages[this.page],dialogue=typeof page==='object';$('comic-reader').classList.toggle('dialogue-scene',dialogue);$('comic-dialogue').textContent=dialogue?page.text.replaceAll('{player}',this.user.displayName):'';$('comic-dialogue').classList.toggle('hidden',!dialogue);image.src=dialogue?page.image:page;
    image.alt=`Página ${this.page+1} de ${this.storyPhase==='end'?'la victoria':'la introducción'} de ${this.introStage.name}`;
    $('comic-page').textContent=`${this.storyPhase==='end'?'DESENLACE':'PRÓLOGO'} / ${this.page+1} DE ${this.storyPages.length}`;
    $('comic-prev').disabled=this.page===0;
    $('comic-next').firstElementChild.textContent=this.page===this.storyPages.length-1?(this.introStage.chapterStory?'CONTINUAR':this.storyPhase==='end'?'VER RESULTADOS':'INICIAR DUELO'):'CONTINUAR';
    $('comic-reader').scrollTop=0;
  }
  closeComic(){this.comicOpen=false;this.storyPageToken++;this.callbacks.storyPage?.(null);this.callbacks.storyStop?.();$('comic-image').onload=null;$('comic-image').onerror=null;$('comic-overlay').classList.add('hidden');$('app').inert=false;this.comicFocus?.focus({preventScroll:true});}
  nextComic(){if(!this.comicOpen)return;if(this.page+1<this.storyPages.length){this.page++;this.renderComic();return;}const complete=this.storyComplete;this.closeComic();complete();}
  ending(id){
    const stage=this.catalog?.stages.find(s=>s.id===id);if(!stage)return;
    this.chapter=stage.chapter;
    const worldEnd=()=>this.maybeWorldStory('end');
    const chapterEnd=()=>{if(!this.maybeChapterStory('end',worldEnd))worldEnd();};
    if(!this.openStory(stage,'end',chapterEnd))chapterEnd();
  }
  nextStage(id){
    const stages=this.catalog?.stages,index=stages?.findIndex(stage=>stage.id===id)??-1;
    return index>=0&&stages[index+1]?.chapter===stages[index].chapter?stages[index+1]:null;
  }
  async openShop(category){
    if(category&&category!==this.category){this.category=category;this.item=null;}
    this.callbacks.screen('shop');this.base=this.user?.avatar.base||this.base;$('shop-base').value=this.base;$('shop-status').textContent='Abriendo la tienda…';try{await this.load();this.renderShop();$('shop-status').textContent='Las compras son permanentes. Los cosméticos no modifican el rendimiento.';}catch(error){$('shop-status').textContent=error.message;}
  }
  items(){return this.category==='car'?(this.shop?.cars||[]).map(c=>({...c,kind:'car'})):this.category==='music'?(this.shop?.songs||[]):(this.shop?.cosmetics||[]).filter(c=>c.slot===this.category&&c.bases.includes(this.base)&&(c.availableForSale!==false||this.user.cosmetics.includes(c.id))).map(c=>({...c,kind:'cosmetic'}));}
  owns(item){return item.kind==='car'?this.user.cars.includes(item.id):item.kind==='music'?(this.user.music||[]).includes(item.id):this.user.cosmetics.includes(item.id);}
  preview(item){const base=item.bases[0],avatar={...defaultAvatar(base),...(this.user.avatar.base===base?this.user.avatar:{}),[item.slot]:item.key};return '/api/avatar/preview?'+new URLSearchParams(avatar);}
  renderShop(){
    if(!this.shop||!this.user)return;$('shop-coins').textContent='◈ '+this.user.coins.toLocaleString();$('shop-base-label').classList.toggle('hidden',['car','music'].includes(this.category));
    for(const button of document.querySelectorAll('[data-shop-category]'))button.setAttribute('aria-selected',String(button.dataset.shopCategory===this.category));
    const items=this.items();if(!items.some(item=>item.id===this.item))this.item=items[0]?.id;const grid=$('shop-items');grid.replaceChildren();
    for(const item of items){const button=node('button','shop-item'+(this.item===item.id?' selected':''));button.dataset.item=item.id;button.dataset.slot=item.slot||item.kind;
      if(item.kind==='cosmetic')button.append(portrait(this.preview(item),item.name));else if(item.kind==='music')button.append(node('div','shop-song-art'));else{const car=node('div','shop-car-art');car.style.setProperty('--car-color',item.color);car.append(node('span','',item.code),node('i'));button.append(car);}
      const carBadge=item.competitionTier===3?`${item.brand} · CATEGORÍA 3`:item.brand;
      const rarity=item.kind==='music'?'MÚSICA / '+item.author:item.rarity==='legendary'?'LEGENDARIO':item.kind==='car'?carBadge:'COLECCIÓN '+(this.base==='male'?'HOMBRE':'MUJER');button.append(node('small',item.rarity==='legendary'?'legendary':'',rarity),node('b','',item.name),node('span','shop-price',this.owns(item)?'✓ EN TU COLECCIÓN':'◈ '+item.price.toLocaleString()));button.onclick=()=>{this.item=item.id;this.renderShop();if(item.kind==='car')this.callbacks.preview(item);if(window.matchMedia('(max-width:760px)').matches)$('shop-detail').scrollIntoView({block:'start'});};grid.append(button);
    }
    const item=items.find(c=>c.id===this.item),detail=$('shop-detail');detail.replaceChildren();if(!item){detail.append(node('p','','No hay artículos en esta colección.'));return;}
    if(item.kind==='cosmetic')detail.append(portrait(this.preview(item),item.name,'shop-preview'));else if(item.kind==='music')detail.append(node('div','shop-song-art'));else detail.append(node('div','shop-car-name',item.code));
    detail.append(node('small',item.rarity==='legendary'?'legendary eyebrow':'eyebrow',item.kind==='car'?item.brand:item.rarity==='legendary'?'EDICIÓN LEGENDARIA':'COSMÉTICO / '+(this.base==='male'?'HOMBRE':'MUJER')),node('h2','',item.name),node('p','',item.kind==='car'?`${item.drive} · ${item.power} CV · ${item.weight} KG · ${item.profile==='agile'?'Skiller':item.profile==='power'?'Grip':'Complete'}`:'Pieza exclusiva de su base. Puedes equiparla en tu licencia.'),node('b','shop-detail-price',item.kind==='car'&&this.owns(item)?'✓ EN TU GARAJE':'◈ '+item.price.toLocaleString()));
    if(item.kind==='music'){detail.replaceChildren(node('div','shop-song-art'),node('small','eyebrow','BANDA SONORA / '+item.author),node('h2','',item.title),node('p','','Desbloquea esta canción para seleccionarla en las carreras y en campaña.'),node('b','shop-detail-price',item.kind==='car'&&this.owns(item)?'✓ EN TU GARAJE':'◈ '+item.price.toLocaleString()));}
    if(item.kind==='car'&&item.competitionTier===3)detail.append(node('p','','CATEGORÍA 3 · Apto para NG+ con motor, chasis y frenos al máximo.'));
    const owned=this.owns(item),button=node('button','start-button full',owned?(item.kind==='music'?'SELECCIONAR CANCIÓN →':'EQUIPAR →'):this.user.coins<item.price?'MONEDAS INSUFICIENTES':'COMPRAR →');button.id='shop-buy';button.disabled=!owned&&this.user.coins<item.price;button.onclick=()=>owned?this.equip(item):this.buy(item);detail.append(button);
  }
  async buy(item){$('shop-buy').disabled=true;try{const result=await this.account.request('/api/shop/buy',{method:'POST',body:JSON.stringify({kind:item.kind,id:item.id})});this.account.accept(result);this.setUser(result.user);if(item.kind==='music')await this.callbacks.refreshSongs?.();$('shop-status').textContent=result.alreadyOwned?'Ya tenías este artículo. No se descontaron monedas.':'Compra guardada. Ya puedes equipar '+item.name+'.';}catch(error){$('shop-status').textContent=error.message;}finally{this.renderShop();}}
  async equip(item){$('shop-buy').disabled=true;try{if(item.kind==='music'){await this.callbacks.refreshSongs?.();this.callbacks.selectSong?.(item.id);$('shop-status').textContent='Seleccionada para Time Attack: '+item.name+'. También está disponible en los niveles de campaña.';return;}const avatar=item.kind==='cosmetic'?{...defaultAvatar(item.bases[0]),...(this.user.avatar.base===item.bases[0]?this.user.avatar:{}),[item.slot]:item.key}:null;const result=await this.account.request('/api/profile',{method:'PATCH',body:JSON.stringify(avatar?{avatar,portraitMode:'avatar'}:{defaultCar:item.id})});this.account.accept(result);this.setUser(result.user);$('shop-status').textContent='Equipado en tu licencia: '+item.name;}catch(error){$('shop-status').textContent=error.message;}finally{this.renderShop();}}
}
