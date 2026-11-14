const $=id=>document.getElementById(id);
function element(tag,text,className){
  const node=document.createElement(tag);
  if(text)node.textContent=text;
  if(className)node.className=className;
  return node;
}
const tiers={common:'Común',rare:'Rara',special:'Especial',legendary:'Legendaria'};
function newReceipt(){
  if(crypto.randomUUID)return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function cardTile(card,quantity){
  const tile=element('article',null,'collection-card');
  tile.dataset.tier=card.tier;
  const image=element('img');image.src=card.image;image.alt='';image.loading='lazy';
  const description=element('p',card.description);description.tabIndex=0;
  tile.append(element('small',tiers[card.tier]+(quantity>1?' · ×'+quantity:'')),element('h3',card.title),image,description);
  return tile;
}

export class Collectibles {
  constructor(account,{screen,preview,view,cars,tracks}){
    Object.assign(this,{account,screen,preview,view,cars,tracks});
    for(const button of document.querySelectorAll('[data-collection-tab]'))button.onclick=()=>this.show(button.dataset.collectionTab);
    for(const input of [$('collection-angle'),$('collection-zoom')])input.oninput=()=>this.updateView();
    $('profile-favorite-card').onclick=()=>this.licenseCard();
    $('shop-buy-chest').onclick=()=>this.buyChest();
  }
  async open(){
    if(!this.account.require())return;
    this.screen('collection');
    this.show('cars');
  }
  show(tab){
    this.tab=tab;
    $('collection').dataset.tab=tab;
    for(const button of document.querySelectorAll('[data-collection-tab]'))button.setAttribute('aria-pressed',String(button.dataset.collectionTab===tab));
    $('collection-cars').classList.toggle('hidden',tab!=='cars');
    $('collection-cards').classList.toggle('hidden',tab!=='cards');
    if(tab==='cars'){this.renderCars();return;}
    this.loadCards();
  }
  renderCars(){
    const owned=this.cars.filter(car=>this.account.user.cars.includes(car.id));
    const selected=owned.find(car=>car.id===this.selected)||owned[0];
    const roster=$('collection-car-items'),focused=roster.contains(document.activeElement);
    this.selected=selected?.id;
    $('collection-car-name').textContent=selected?selected.brand+' '+selected.name:'Tu garaje está vacío.';
    roster.replaceChildren(...owned.map(car=>{
      const button=element('button',car.code,'dealer-car');button.setAttribute('aria-pressed',String(car===selected));
      button.onclick=()=>{this.selected=car.id;this.renderCars();};
      return button;
    }));
    if(focused)roster.querySelector('[aria-pressed=true]')?.focus();
    if(selected)this.preview(selected);
    this.updateView();
  }
  updateView(){this.view(Number($('collection-angle').value)*Math.PI/180,Number($('collection-zoom').value)/100);}
  async loadCards(){
    $('collection-status').textContent='Cargando colección…';
    try{
      const data=await this.account.request('/api/collectibles');
      const grid=$('collection-card-items');
      grid.replaceChildren(...data.owned.flatMap(({id,quantity})=>{
        const card=data.catalog.find(item=>item.id===id);
        return card?[cardTile(card,quantity)]:[];
      }));
      $('collection-status').textContent=grid.childElementCount?'':'Consigue tus primeras cartas en la Miscelánea.';
    }catch(error){$('collection-status').textContent=error.message;}
  }
  async licenseCard(){
    const dialog=$('pilot-card-dialog'),title=$('pilot-card-title'),content=$('pilot-card-content');
    title.textContent='Carta favorita';content.textContent='Cargando colección…';
    if(!dialog.open)dialog.showModal();
    try{
      const data=await this.account.request('/api/collectibles');
      if(!dialog.open)return;
      const select=element('select');select.setAttribute('aria-label','Carta favorita');
      select.append(new Option('Sin carta favorita',''),...data.owned.flatMap(({id})=>{
        const card=data.catalog.find(item=>item.id===id);
        return card?[new Option(card.title,id)]:[];
      }));
      select.value=data.favorite||'';
      const status=element('p'),preview=element('div');
      status.setAttribute('role','status');
      const redraw=()=>{const current=data.catalog.find(card=>card.id===select.value);preview.replaceChildren(...(current?[cardTile(current)]:[]));};
      select.onchange=redraw;redraw();
      const save=element('button','Guardar carta favorita','secondary-button');
      save.onclick=async()=>{
        save.disabled=true;
        try{await this.account.request('/api/collectibles/favorite',{method:'PATCH',body:JSON.stringify({id:select.value||null})});status.textContent='Carta favorita guardada.';}
        catch(error){status.textContent=error.message;}
        finally{save.disabled=false;}
      };
      if(data.owned.length)content.replaceChildren(select,preview,save,status);
      else content.textContent='Consigue cartas en la Miscelánea para mostrar una en tu licencia.';
    }catch(error){content.textContent=error.message;}
  }
  async publicLicense(userId){
    const dialog=$('pilot-card-dialog'),title=$('pilot-card-title'),content=$('pilot-card-content');
    title.textContent='Licencia de piloto';content.textContent='Cargando licencia…';
    if(!dialog.open)dialog.showModal();
    try{
      const license=await this.account.request('/api/users/'+encodeURIComponent(userId)+'/license');
      if(!dialog.open)return;
      title.textContent=license.displayName;
      const list=element('ul',null,'pilot-records');
      for(const record of license.records){
        const track=this.tracks.find(track=>track.id===record.track)?.name||record.track;
        const car=this.cars.find(car=>car.id===record.car)?.code||record.car;
        const time=Math.floor(record.time/60)+':'+(record.time%60).toFixed(3).padStart(6,'0');
        list.append(element('li',[track,car,time,record.night?'noche':'día',record.wet?'lluvia':'seco',record.manual?'MT':'AT',record.source==='online'?'online':'solo'].join(' · ')));
      }
      content.replaceChildren(license.favorite?cardTile(license.favorite):element('p','Sin carta favorita.'),element('h3','Récords'),list);
      if(!list.childElementCount)list.append(element('li','Aún no hay récords verificados.'));
    }catch(error){content.textContent=error.message;}
  }
  async buyChest(){
    const button=$('shop-buy-chest'),status=$('shop-status');
    if(button.disabled)return;
    const userId=this.account.user.id,storageKey='touge-card-chest:'+userId;
    let receipt=this.receipts?.[userId];
    try{receipt??=localStorage.getItem(storageKey);}catch{}
    receipt??=newReceipt();
    (this.receipts??={})[userId]=receipt;
    try{localStorage.setItem(storageKey,receipt);}catch{}
    button.disabled=true;
    try{
      const result=await this.account.request('/api/shop/card-chest',{method:'POST',body:JSON.stringify({receipt})});
      this.account.accept(result);
      delete this.receipts[userId];
      try{localStorage.removeItem(storageKey);}catch{}
      $('pilot-card-title').textContent='Cartas obtenidas';
      const grid=element('div',null,'collection-card-grid');
      grid.append(...result.cards.map(card=>cardTile(card)));
      $('pilot-card-content').replaceChildren(grid);
      if(!$('pilot-card-dialog').open)$('pilot-card-dialog').showModal();
      status.textContent='';
    }catch(error){status.textContent=error.message;}
    finally{button.disabled=false;}
  }
}
