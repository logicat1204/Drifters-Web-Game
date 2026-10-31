import {CAMPAIGN_LEVELS,DRIVER_STYLES,stageAvailable} from './campaign.mjs';
import {defaultAvatar} from './avatar.mjs';
import {FOCUS_TYPES} from './focus.mjs';
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const portrait=(src,alt,cls)=>{const img=node('img',cls);img.src=src;img.alt=alt;img.loading='lazy';return img;};
export class ProgressionClient {
  constructor(account,callbacks){
    this.account=account;this.callbacks=callbacks;this.user=account.user;this.chapter=null;this.selected=null;this.category='car';this.base='male';this.comicOpen=false;
    document.querySelectorAll('[data-shop-category]').forEach(button=>button.onclick=()=>{this.category=button.dataset.shopCategory;this.item=null;this.renderShop();});
    $('shop-base').onchange=()=>{this.base=$('shop-base').value;this.item=null;this.renderShop();};
    $('comic-cancel').onclick=()=>this.closeComic();$('comic-next').onclick=()=>this.nextComic();
    $('comic-zoom').onclick=()=>{const zoom=$('comic-reader').classList.toggle('zoomed');$('comic-zoom').textContent=zoom?'AJUSTAR':'AMPLIAR';};
    window.addEventListener('keydown',event=>{if(!this.comicOpen)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.closeComic();}if(event.key==='Tab'){const buttons=[$('comic-zoom'),$('comic-cancel'),$('comic-next')];if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}}},true);
  }
  setUser(user){this.user=user;if(!user)return;$('menu-coins').textContent=user.coins.toLocaleString();if(this.catalog)this.renderCampaign();if(this.shop)this.renderShop();}
  async load(){if(this.loading)return this.loading;this.loading=Promise.all([this.account.request('/api/campaign'),this.account.request('/api/shop')]).then(([catalog,shop])=>{this.catalog=catalog;this.shop=shop;this.user=catalog.user;}).finally(()=>{this.loading=null;});return this.loading;}
  cleared(){return (this.user?.campaign||[]).map(stage=>stage.id);}
  async openCampaign(){this.callbacks.screen('campaign');$('campaign-status').textContent='Preparando las nueve campañas…';try{await this.load();const next=this.catalog.stages.find(stage=>!this.cleared().includes(stage.id))||this.catalog.stages.at(-1);this.chapter??=next.chapter;this.selected??=next.id;this.renderCampaign();$('campaign-status').textContent='Las victorias y las recompensas se verifican al terminar la carrera.';}catch(error){$('campaign-status').textContent=error.message;}}
  renderCampaign(){
    if(!this.catalog||!this.user)return;const cleared=this.cleared();$('campaign-counter').textContent=`${cleared.length} / ${this.catalog.stages.length} VICTORIAS`;$('campaign-coins').textContent='◈ '+this.user.coins.toLocaleString();
    const chapters=$('campaign-chapters');chapters.replaceChildren();
    for(const [i,chapter]of this.catalog.chapters.entries()){
      const stages=this.catalog.stages.filter(s=>s.chapter===chapter.id),done=stages.filter(s=>cleared.includes(s.id)).length,button=node('button',chapter.id===this.chapter?'selected':'');button.dataset.chapter=chapter.id;
      button.append(node('small','',String(i+1).padStart(2,'0')),node('span','',chapter.name),node('b','',`${done}/${stages.length}`));button.onclick=()=>{this.chapter=chapter.id;this.selected=stages.find(s=>stageAvailable(s,cleared)&&!cleared.includes(s.id))?.id||stages[0].id;this.renderCampaign();};chapters.append(button);
    }
    const chapter=this.catalog.chapters.find(c=>c.id===this.chapter)||this.catalog.chapters[0];this.chapter=chapter.id;
    $('campaign-tag').textContent=chapter.tag;$('campaign-chapter-name').textContent=chapter.name;$('campaign-conditions').textContent=chapter.wet?'LLUVIA OBLIGATORIA · NIEBLA · ASFALTO MOJADO':chapter.id==='odawara'||chapter.id==='manazuru'?'MFG · ASFALTO SECO · DÍA':'DESCENSO NOCTURNO · ASFALTO SECO';
    const list=$('campaign-stages');list.replaceChildren();
    for(const stage of this.catalog.stages.filter(s=>s.chapter===chapter.id)){
      const available=stageAvailable(stage,cleared),done=cleared.includes(stage.id),button=node('button','campaign-stage'+(stage.id===this.selected?' selected':'')+(!available?' locked':''));button.dataset.stage=stage.id;button.setAttribute('aria-pressed',String(stage.id===this.selected));
      button.append(portrait(stage.media.portrait,stage.name));const info=node('div');info.append(node('small','',done?'✓ VICTORIA':available?'DESAFÍO DISPONIBLE':'BLOQUEADO'),node('b','',stage.name),node('span','',stage.carInfo.brand+' '+stage.carInfo.code),node('em','',`${stage.level} · ${CAMPAIGN_LEVELS[stage.level-1]} / ${stage.style}`));button.append(info);button.onclick=()=>{this.selected=stage.id;this.renderCampaign();if(window.matchMedia('(max-width:760px)').matches)$('campaign-detail').scrollIntoView({block:'start'});};list.append(button);
    }
    const stage=this.catalog.stages.find(s=>s.id===this.selected&&s.chapter===this.chapter)||this.catalog.stages.find(s=>s.chapter===this.chapter);this.selected=stage.id;
    const detail=$('campaign-detail');detail.replaceChildren();detail.append(portrait(stage.media.portrait,stage.name,'campaign-hero'));
    detail.classList.toggle('boss-detail',!!stage.signature);if(stage.signature)detail.style.setProperty('--boss-color',stage.signature.color);const copy=node('div','campaign-detail-copy');copy.append(node('small','eyebrow',`NIVEL ${stage.level} / ${CAMPAIGN_LEVELS[stage.level-1].toUpperCase()}`),node('h2','',stage.name),node('p','campaign-model',stage.carInfo.brand+' '+stage.carInfo.name+' · '+stage.carInfo.code),node('p','',DRIVER_STYLES[stage.style].description));
    if(stage.signature){const signature=node('div','boss-signature');signature.append(node('b','',stage.signature.name),node('p','',stage.signature.description));copy.append(signature);}
    const row=node('div','campaign-car-color');const swatch=node('i');swatch.style.background=stage.color;row.append(swatch,node('span','',stage.colorName+' / '+stage.body));copy.append(row);
    if(stage.unlock)copy.append(node('p','campaign-unlock','◈ DESBLOQUEA '+FOCUS_TYPES[stage.unlock].name.toUpperCase()));
    const best=this.user.campaign.find(p=>p.id===stage.id);copy.append(node('p','campaign-prize',best?`✓ Superado · ${best.bestPoints.toLocaleString()} pts · Premio principal: ${best.rewardCoins} monedas. Repite para conseguir ${35+stage.level*5}–${60+stage.level*5} monedas más.`:`Primera victoria: ${220+stage.level*80+Math.floor(stage.index/3)*25} monedas + hasta 160 por conducción`));
    const start=node('button','start-button full',stageAvailable(stage,cleared)?best?'VOLVER A DESAFIAR →':'VER INTRODUCCIÓN →':'SUPERA EL DUELO ANTERIOR');start.disabled=!stageAvailable(stage,cleared);start.id='campaign-start';start.onclick=()=>this.begin(stage);copy.append(start);detail.append(copy);
  }
  begin(stage){
    if(!stageAvailable(stage,this.cleared()))return;if(this.callbacks.prepare(stage)===false)return;this.chapter=stage.chapter;this.selected=stage.id;this.renderCampaign();
    this.introStage=stage;this.page=0;this.comicOpen=true;this.comicFocus=$('campaign-start');$('app').inert=true;$('comic-overlay').classList.remove('hidden');$('comic-reader').classList.remove('zoomed');$('comic-zoom').textContent='AMPLIAR';$('comic-title').textContent=stage.name;$('comic-eyebrow').textContent=`${this.catalog.chapters.find(c=>c.id===stage.chapter).name.toUpperCase()} / NIVEL ${stage.level} · ${stage.style.toUpperCase()}`;this.renderComic();$('comic-next').focus();
  }
  renderComic(){$('comic-image').src=this.introStage.media.comics[this.page];$('comic-page').textContent=`PRÓLOGO / ${this.page+1} DE ${this.introStage.media.comics.length}`;$('comic-reader').scrollTop=0;}
  closeComic(){this.comicOpen=false;$('comic-overlay').classList.add('hidden');$('app').inert=false;this.comicFocus?.focus({preventScroll:true});}
  nextComic(){if(!this.comicOpen)return;if(this.page+1<this.introStage.media.comics.length){this.page++;this.renderComic();return;}const stage=this.introStage;this.closeComic();this.callbacks.start(stage);}
  nextStage(id){const index=this.catalog?.stages.findIndex(stage=>stage.id===id);return index>=0?this.catalog.stages[index+1]:null;}
  async openShop(){this.callbacks.screen('shop');$('shop-status').textContent='Abriendo el taller…';try{await this.load();this.base=this.user.avatar.base;$('shop-base').value=this.base;this.renderShop();$('shop-status').textContent='Las compras son permanentes. Los cosméticos no modifican el rendimiento.';}catch(error){$('shop-status').textContent=error.message;}}
  items(){return this.category==='car'?(this.shop?.cars||[]).map(c=>({...c,kind:'car'})):(this.shop?.cosmetics||[]).filter(c=>c.slot===this.category&&c.bases.includes(this.base)).map(c=>({...c,kind:'cosmetic'}));}
  owns(item){return item.kind==='car'?this.user.cars.includes(item.id):this.user.cosmetics.includes(item.id);}
  preview(item){const base=item.bases[0],avatar={...defaultAvatar(base),...(this.user.avatar.base===base?this.user.avatar:{}),[item.slot]:item.key};return '/api/avatar/preview?'+new URLSearchParams(avatar);}
  renderShop(){
    if(!this.shop||!this.user)return;$('shop-coins').textContent='◈ '+this.user.coins.toLocaleString();$('shop-base-label').classList.toggle('hidden',this.category==='car');
    for(const button of document.querySelectorAll('[data-shop-category]'))button.setAttribute('aria-selected',String(button.dataset.shopCategory===this.category));
    const items=this.items();if(!items.some(item=>item.id===this.item))this.item=items[0]?.id;const grid=$('shop-items');grid.replaceChildren();
    for(const item of items){const button=node('button','shop-item'+(this.item===item.id?' selected':''));button.dataset.item=item.id;button.dataset.slot=item.slot||'car';
      if(item.kind==='cosmetic')button.append(portrait(this.preview(item),item.name));else{const car=node('div','shop-car-art');car.style.setProperty('--car-color',item.color);car.append(node('span','',item.code),node('i'));button.append(car);}
      const rarity=item.rarity==='legendary'?'LEGENDARIO':item.kind==='car'?item.brand:'COLECCIÓN '+(this.base==='male'?'HOMBRE':'MUJER');button.append(node('small',item.rarity==='legendary'?'legendary':'',rarity),node('b','',item.name),node('span','shop-price',this.owns(item)?'✓ EN TU COLECCIÓN':'◈ '+item.price.toLocaleString()));button.onclick=()=>{this.item=item.id;this.renderShop();if(item.kind==='car')this.callbacks.preview(item);if(window.matchMedia('(max-width:760px)').matches)$('shop-detail').scrollIntoView({block:'start'});};grid.append(button);
    }
    const item=items.find(c=>c.id===this.item),detail=$('shop-detail');detail.replaceChildren();if(!item){detail.append(node('p','','No hay artículos en esta colección.'));return;}
    if(item.kind==='cosmetic')detail.append(portrait(this.preview(item),item.name,'shop-preview'));else detail.append(node('div','shop-car-name',item.code));
    detail.append(node('small',item.rarity==='legendary'?'legendary eyebrow':'eyebrow',item.kind==='car'?item.brand:item.rarity==='legendary'?'EDICIÓN LEGENDARIA':'COSMÉTICO / '+(this.base==='male'?'HOMBRE':'MUJER')),node('h2','',item.name),node('p','',item.kind==='car'?`${item.drive} · ${item.power} CV · ${item.weight} KG · ${item.profile==='agile'?'Skiller':item.profile==='power'?'Grip':'Complete'}`:'Pieza exclusiva de su base. Puedes equiparla en tu licencia.'),node('b','shop-detail-price','◈ '+item.price.toLocaleString()));
    const owned=this.owns(item),button=node('button','start-button full',owned?'EQUIPAR →':this.user.coins<item.price?'MONEDAS INSUFICIENTES':'COMPRAR →');button.id='shop-buy';button.disabled=!owned&&this.user.coins<item.price;button.onclick=()=>owned?this.equip(item):this.buy(item);detail.append(button);
  }
  async buy(item){$('shop-buy').disabled=true;try{const result=await this.account.request('/api/shop/buy',{method:'POST',body:JSON.stringify({kind:item.kind,id:item.id})});this.account.accept(result);this.setUser(result.user);$('shop-status').textContent=result.alreadyOwned?'Ya tenías este artículo. No se descontaron monedas.':'Compra guardada. Ya puedes equipar '+item.name+'.';}catch(error){$('shop-status').textContent=error.message;}finally{this.renderShop();}}
  async equip(item){$('shop-buy').disabled=true;try{const avatar=item.kind==='cosmetic'?{...defaultAvatar(item.bases[0]),...(this.user.avatar.base===item.bases[0]?this.user.avatar:{}),[item.slot]:item.key}:null;const result=await this.account.request('/api/profile',{method:'PATCH',body:JSON.stringify(avatar?{avatar,portraitMode:'avatar'}:{defaultCar:item.id})});this.account.accept(result);this.setUser(result.user);$('shop-status').textContent='Equipado en tu licencia: '+item.name;}catch(error){$('shop-status').textContent=error.message;}finally{this.renderShop();}}
}
