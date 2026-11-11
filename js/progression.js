import {CAMPAIGN_LEVELS,DRIVER_STYLES,stageAvailable,CAMPAIGN_SEASONS,seasonUnlocked,campaignReward,campaignReplayReward,campaignConditions} from './campaign.mjs';
import {defaultAvatar,installCosmetics} from './avatar.mjs';
import {decorateCampaignMap} from './campaign-map.js';
import {FOCUS_TYPES} from './focus.mjs';
import {campaignPreparationIssue,buildKey} from './tuning.mjs';
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const portrait=(src,alt,cls)=>{const img=node('img',cls);img.src=src;img.alt=alt;img.loading='lazy';return img;};
export class ProgressionClient {
  constructor(account,callbacks){
    this.account=account;this.callbacks=callbacks;this.user=account.user;this.season='dry';this.chapter=null;this.selected=null;this.category='car';this.base='male';this.comicOpen=false;this.musicSelections={};
    document.querySelectorAll('[data-shop-category]').forEach(button=>button.onclick=()=>{this.category=button.dataset.shopCategory;this.item=null;this.renderShop();});
    $('shop-base').onchange=()=>{this.base=$('shop-base').value;this.item=null;this.renderShop();};
    $('comic-cancel').onclick=()=>this.closeComic();$('comic-next').onclick=()=>this.nextComic();
    $('comic-prev').onclick=()=>{if(this.page>0){this.page--;this.renderComic();}};
    $('comic-zoom').onclick=()=>{const zoom=$('comic-reader').classList.toggle('zoomed');$('comic-zoom').textContent=zoom?'AJUSTAR':'AMPLIAR';};
    window.addEventListener('keydown',event=>{if(!this.comicOpen)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.closeComic();}if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==='ArrowRight')this.nextComic();else $('comic-prev').click();}if(event.key==='Tab'){const buttons=[$('comic-zoom'),$('comic-cancel'),$('comic-prev'),$('comic-next')].filter(b=>!b.disabled);if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}}},true);
  }
  setUser(user){if(user&&this.user?.id!==user.id){this.season='dry';this.chapter=this.selected=null;if(this.rootCatalog)this.catalog=this.rootCatalog.seasons?.[0]||this.rootCatalog;}this.user=user;if(!user)return;if(this.musicUser!==user.id){this.musicUser=user.id;try{this.musicSelections=JSON.parse(localStorage.getItem('touge-campaign-songs:'+user.id)||'{}');}catch{this.musicSelections={};}}$('menu-coins').textContent=user.coins.toLocaleString();if(this.catalog)this.renderCampaign();if(this.shop)this.renderShop();}
  async load(){if(this.loading)return this.loading;this.loading=Promise.all([this.account.request('/api/campaign'),this.account.request('/api/shop')]).then(([catalog,shop])=>{this.rootCatalog=catalog;this.catalog=catalog.seasons?.find(s=>s.id===this.season)||catalog;this.shop=shop;this.user=catalog.user;installCosmetics(shop.cosmetics.filter(i=>i.pack));}).finally(()=>{this.loading=null;});return this.loading;}
  selectSeason(id){if(!seasonUnlocked(id,this.cleared()))return;this.season=id;this.catalog=this.rootCatalog.seasons.find(s=>s.id===id);const next=this.catalog.stages.find(s=>!this.cleared().includes(s.id)&&stageAvailable(s,this.cleared()))||this.catalog.stages.at(-1);this.selected=next.id;this.chapter=next.chapter;this.renderCampaign();this.maybeChapterStory('start');}
  cleared(){return (this.user?.campaign||[]).map(stage=>stage.id);}
  controller(buttons,old){
    const pressed=i=>buttons[i]&&!old[i];
    if(this.comicOpen){if(pressed(0)||pressed(15))this.nextComic();if(pressed(14))$('comic-prev').click();if(pressed(1))this.closeComic();return;}
    const focus=[...$('campaign').querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length),index=Math.max(0,focus.indexOf(document.activeElement));
    if(pressed(12)||pressed(13)){focus[(index+(pressed(13)?1:focus.length-1))%focus.length]?.focus();document.activeElement.scrollIntoView({block:'nearest'});}
    if(pressed(14)||pressed(15))document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:pressed(15)?'ArrowRight':'ArrowLeft',bubbles:true}));
    if(pressed(0))document.activeElement?.click();if(pressed(1))this.callbacks.screen('menu');
  }
  async openCampaign(){this.callbacks.screen('campaign');$('campaign-status').textContent='Preparando las nueve campañas…';try{await this.load();const order=CAMPAIGN_SEASONS.findIndex(s=>s.id===this.season);if(this.catalog.stages.every(s=>this.cleared().includes(s.id))&&CAMPAIGN_SEASONS[order+1]&&seasonUnlocked(CAMPAIGN_SEASONS[order+1].id,this.cleared())){this.season=CAMPAIGN_SEASONS[order+1].id;this.catalog=this.rootCatalog.seasons.find(s=>s.id===this.season);this.chapter=this.selected=null;}const next=this.catalog.stages.find(stage=>!this.cleared().includes(stage.id))||this.catalog.stages.at(-1);this.chapter??=next.chapter;this.selected??=next.id;this.renderCampaign();document.querySelector('[data-chapter="'+this.chapter+'"]')?.focus({preventScroll:true});$('campaign-status').textContent='Elige una región, conoce su historia y desafía a sus pilotos.';this.maybeChapterStory('start');}catch(error){$('campaign-status').textContent=error.message;}}
  renderCampaign(){
    if(!this.catalog||!this.user)return;const cleared=this.cleared();$('campaign-counter').textContent=`${this.catalog.stages.filter(s=>cleared.includes(s.id)).length} / ${this.catalog.stages.length} VICTORIAS`;$('campaign-coins').textContent='◈ '+this.user.coins.toLocaleString();
    const seasonNav=$('campaign-seasons'),expanded=seasonUnlocked('rain',cleared);$('campaign-title').classList.toggle('hidden',expanded);seasonNav.classList.toggle('hidden',!expanded);seasonNav.replaceChildren();
    for(const season of CAMPAIGN_SEASONS){if(season.id==='ngplus'&&!seasonUnlocked(season.id,cleared))continue;const b=node('button',this.season===season.id?'selected':'',season.name);b.dataset.season=season.id;b.disabled=!seasonUnlocked(season.id,cleared);b.setAttribute('aria-pressed',String(this.season===season.id));b.onclick=()=>this.selectSeason(season.id);seasonNav.append(b);}
    $('campaign-completion').textContent=this.catalog.stages.every(s=>cleared.includes(s.id))?(this.season==='ngplus'?'JUEGO COMPLETADO · Conservas el trono. Puedes repetir los duelos con su dificultad final.':this.season==='rain'?'TEMPORADA LLUVIOSA COMPLETADA · NG+ desbloqueado: defiende el trono.':'TEMPORADA SECA COMPLETADA · La temporada lluviosa está disponible.'):(this.season==='ngplus'?'Defiende tu título frente a los aspirantes de Japón.':'');
    const chapters=$('campaign-chapters');chapters.replaceChildren();
    for(const [i,chapter]of this.catalog.chapters.entries()){
      const stages=this.catalog.stages.filter(s=>s.chapter===chapter.id),done=stages.filter(s=>cleared.includes(s.id)).length,button=node('button',chapter.id===this.chapter?'selected':'');button.dataset.chapter=chapter.id;
      button.classList.toggle('chapter-locked',!stageAvailable(stages[0],cleared));button.classList.toggle('chapter-cleared',done===stages.length);button.setAttribute('aria-pressed',String(chapter.id===this.chapter));button.setAttribute('aria-label',chapter.name+' · '+done+' de '+stages.length+' victorias');button.append(node('small','',String(i+1).padStart(2,'0')),node('span','',chapter.name),node('b','',`${done}/${stages.length}`));button.onclick=()=>{this.chapter=chapter.id;this.selected=stages.find(s=>stageAvailable(s,cleared)&&!cleared.includes(s.id))?.id||stages[0].id;this.renderCampaign();this.maybeChapterStory('start');};chapters.append(button);
    }
    const chapter=this.catalog.chapters.find(c=>c.id===this.chapter)||this.catalog.chapters[0];this.chapter=chapter.id;
    decorateCampaignMap(chapters,this.chapter,this.catalog.chapters);
    const nextButton=$('campaign-next');if(nextButton){const next=this.catalog.stages.find(s=>!cleared.includes(s.id)&&stageAvailable(s,cleared));nextButton.disabled=!next;nextButton.textContent=next?'SIGUIENTE / '+next.short:(this.season==='ngplus'?'JUEGO COMPLETADO ✓':'TEMPORADA COMPLETADA ✓');nextButton.onclick=()=>{this.chapter=next.chapter;this.selected=next.id;this.renderCampaign();if(!this.maybeChapterStory('start'))$('campaign-start').focus();};}
    for(const phase of ['start','end']){const b=$('chapter-story-'+phase);if(b){b.disabled=!this.chapterEligible(chapter,phase)||!(chapter.media?.[phase==='start'?'storyStart':'storyEnd']?.length||chapter.media?.[phase==='start'?'dialogueStart':'dialogueEnd']?.length);b.onclick=()=>this.chapterStory(chapter,phase);}}
    $('campaign-tag').textContent=chapter.tag;$('campaign-chapter-name').textContent=chapter.name;
    const list=$('campaign-stages');list.replaceChildren();
    for(const stage of this.catalog.stages.filter(s=>s.chapter===chapter.id)){
      const available=stageAvailable(stage,cleared),done=cleared.includes(stage.id),button=node('button','campaign-stage'+(stage.id===this.selected?' selected':'')+(!available?' locked':''));button.dataset.stage=stage.id;button.setAttribute('aria-pressed',String(stage.id===this.selected));
      button.append(portrait(stage.media.portrait,stage.name));const info=node('div');info.append(node('small','',done?'✓ VICTORIA':available?'DESAFÍO DISPONIBLE':'BLOQUEADO'),node('b','',stage.name),node('span','',stage.carInfo.brand+' '+stage.carInfo.code),node('em','',`${stage.level} · ${CAMPAIGN_LEVELS[stage.level-1]} / ${DRIVER_STYLES[stage.style].label}`));button.append(info);button.onclick=()=>{this.selected=stage.id;this.renderCampaign();if(window.matchMedia('(max-width:760px)').matches)$('campaign-detail').scrollIntoView({block:'start'});};list.append(button);
    }
    const stage=this.catalog.stages.find(s=>s.id===this.selected&&s.chapter===this.chapter)||this.catalog.stages.find(s=>s.chapter===this.chapter);this.selected=stage.id;
    const conditions=campaignConditions(stage),rematch=conditions.rematch;
    $('campaign-conditions').textContent=[stage.index<14?'NOCHE':'DÍA',conditions.wet?'LLUVIA':'ASFALTO SECO',chapter.fog?'NIEBLA':null,rematch?'REVANCHA':null].filter(Boolean).join(' · ');
    const detail=$('campaign-detail');detail.replaceChildren();detail.append(portrait(stage.media.portrait,stage.name,'campaign-hero'));
    detail.classList.toggle('boss-detail',!!stage.signature);if(stage.signature)detail.style.setProperty('--boss-color',stage.signature.color);const copy=node('div','campaign-detail-copy');copy.append(node('small','eyebrow',`NIVEL ${stage.level} / ${CAMPAIGN_LEVELS[stage.level-1].toUpperCase()}`),node('h2','',stage.name),node('p','campaign-model',stage.carInfo.brand+' '+stage.carInfo.name+' · '+stage.carInfo.code),node('p','',DRIVER_STYLES[stage.style].description));
    if(stage.signature){const signature=node('div','boss-signature');signature.append(node('b','',stage.signature.name),node('p','',stage.signature.description));copy.append(signature);}
    const row=node('div','campaign-car-color');const swatch=node('i');swatch.style.background=stage.color;row.append(swatch,node('span','',stage.colorName+' / '+stage.body));copy.append(row);
    if(stage.unlock)copy.append(node('p','campaign-unlock','◈ DESBLOQUEA '+FOCUS_TYPES[stage.unlock].name.toUpperCase()));
    const best=this.user.campaign.find(p=>p.id===stage.id);copy.append(node('p','campaign-prize',best?`✓ Superado · ${best.bestPoints.toLocaleString()} pts · Premio principal: ${best.rewardCoins} monedas. Repetición: ${campaignReplayReward(stage,0)}–${campaignReplayReward(stage,15000)} monedas.`:`Primera victoria: ${campaignReward(stage,0)}–${campaignReward(stage,24000)} monedas`));
    const car=this.callbacks.car?.()||this.shop?.cars.find(c=>c.id===this.user.defaultCar),build=car?.build||this.user.garage?.[car?.id]?.build;
    const issue=campaignPreparationIssue(stage,car,build);
    if(stage.ngplus){copy.append(node('p','campaign-model',`TU COCHE: ${car?.code||'—'} · CATEGORÍA ${car?.competitionTier||1} · ${buildKey(build)}`));if(issue){copy.append(node('p','campaign-unlock',issue));const garage=node('button','secondary-button full','IR AL GARAJE');garage.onclick=()=>car?.competitionTier>=3?this.callbacks.garage?.():this.callbacks.screen('garage');const shop=node('button','secondary-button full','VER COCHES EN TIENDA');shop.onclick=()=>this.openShop('car');copy.append(garage,shop);}}
    const start=node('button','start-button full',issue?'PREPARACIÓN NG+ REQUERIDA':stageAvailable(stage,cleared)?best?'VOLVER A COMPETIR →':'VER INTRODUCCIÓN →':'SUPERA EL DUELO ANTERIOR');start.disabled=!stageAvailable(stage,cleared)||!!issue;start.id='campaign-start';start.onclick=()=>this.begin(stage);copy.append(start);
    const control=node('div','campaign-soundtrack'),label=node('label','','BANDA SONORA DEL DUELO'),select=node('select');label.htmlFor='campaign-song';select.id='campaign-song';select.onchange=()=>{this.musicSelections[stage.id]=select.value;try{localStorage.setItem('touge-campaign-songs:'+this.user.id,JSON.stringify(this.musicSelections));}catch{}};control.append(label,select,node('small','','La música de las escenas acompaña el cómic; aquí eliges la de la carrera.'));copy.append(control);detail.append(copy);this.refreshMusicControls();
  }
  songChoices(stage){const seen=new Set();return [...(stage.media.music||[]),...(this.callbacks.songs?.()||[])].filter(song=>!seen.has(song.id)&&seen.add(song.id));}
  musicFor(stage){const choices=this.songChoices(stage),selected=this.musicSelections[stage.id];return choices.find(s=>s.id===selected)||(stage.media.music||[])[0]||choices.find(s=>s.id==='synth')||{id:'none',name:'Solo el motor'};}
  refreshMusicControls(){const select=$('campaign-song'),stage=this.catalog?.stages.find(s=>s.id===this.selected);if(!select||!stage)return;const choices=this.songChoices(stage),fallback=(stage.media.music||[])[0]||choices.find(s=>s.id==='synth');select.replaceChildren();const option=node('option','','Por defecto · '+(fallback?.name||'Solo el motor'));option.value='default';select.append(option);for(const song of choices){const o=node('option','',song.name);o.value=song.id;select.append(o);}select.value=choices.some(s=>s.id===this.musicSelections[stage.id])?this.musicSelections[stage.id]:'default';}
  begin(stage){
    if(!stageAvailable(stage,this.cleared()))return;
    const car=this.callbacks.car?.()||this.shop?.cars.find(c=>c.id===this.user.defaultCar),issue=campaignPreparationIssue(stage,car,car?.build||this.user.garage?.[car?.id]?.build);
    if(issue){$('campaign-status').textContent=issue;return;}
    if(this.callbacks.prepare(stage)===false)return;this.chapter=stage.chapter;this.selected=stage.id;this.renderCampaign();
    const duel=()=>{if(!this.openStory(stage,'start',()=>this.callbacks.start(stage)))this.callbacks.start(stage);};if(!this.maybeChapterStory('start',duel))duel();
  }
  chapterEligible(chapter,phase){const stages=this.catalog.stages.filter(s=>s.chapter===chapter.id),cleared=this.cleared();return stages.length>0&&(phase==='start'?stageAvailable(stages[0],cleared):stages.every(s=>cleared.includes(s.id)));}
  chapterStory(chapter,phase,complete=()=>{}){if(!this.chapterEligible(chapter,phase)||this.comicOpen)return false;return this.openStory({name:chapter.name,chapter:chapter.id,chapterStory:true,media:chapter.media||{}},phase,async()=>{try{const data=await this.account.request('/api/campaign/story',{method:'POST',body:JSON.stringify({chapter:chapter.storyKey||chapter.id,phase})});this.account.accept(data);this.user=data.user;document.querySelector('[data-chapter="'+this.chapter+'"]')?.focus({preventScroll:true});}catch(error){$('campaign-status').textContent='No se pudo guardar la lectura: '+error.message;}complete();});}
  maybeChapterStory(phase,complete){const chapter=this.catalog?.chapters.find(c=>c.id===this.chapter);return chapter&&!(this.user.chapterStories||[]).includes((chapter.storyKey||chapter.id)+':'+phase)?this.chapterStory(chapter,phase,complete):false;}
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
  ending(id){const stage=this.catalog?.stages.find(s=>s.id===id);if(!stage)return;this.chapter=stage.chapter;const chapterEnd=()=>this.maybeChapterStory('end');if(!this.openStory(stage,'end',chapterEnd))chapterEnd();}
  nextStage(id){const index=this.catalog?.stages.findIndex(stage=>stage.id===id);return index>=0?this.catalog.stages[index+1]:null;}
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
