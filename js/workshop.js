import {UPGRADES,VEHICLE_PARTS,PAINTS,stockBuild,applyBuild,buildLabel} from './tuning.mjs';
const $=id=>document.getElementById(id),node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;};
export class Workshop {
 constructor(account,callbacks){
  this.account=account;this.callbacks=callbacks;this.tab='performance';this.busy=false;this.paintPreview=undefined;
  document.querySelectorAll('[data-workshop-tab]').forEach(b=>b.onclick=()=>{this.tab=b.dataset.workshopTab;this.render();});
 }
 setUser(user){this.user=user;if(this.car&&this.callbacks.active())this.render();}
 async open(car){
  if(!this.account.require())return;this.car=car;this.paintPreview=undefined;this.callbacks.screen('workshop');$('workshop-status').textContent='Abriendo tu taller…';
  try{await this.account.preferenceTail;const data=await this.account.request('/api/garage');this.account.accept(data);this.user=data.user;this.render();$('workshop-status').textContent='Las compras se guardan por auto y están disponibles en campaña y online.';}catch(e){$('workshop-status').textContent=e.message;}
 }
 entry(){return this.user?.garage?.[this.car.id]||{build:stockBuild(),parts:[]};}
 preview(){const b=this.entry().build;this.callbacks.preview(applyBuild(this.car,{...b,...(this.paintPreview===undefined?{}:{color:this.paintPreview})}));}
 render(){
  if(!this.car||!this.user)return;const entry=this.entry(),car=applyBuild(this.car,entry.build),maxed=Object.keys(UPGRADES).every(k=>entry.build[k]===3);
  $('workshop-coins').textContent='◈ '+this.user.coins.toLocaleString();$('workshop-car').textContent=car.code;$('workshop-brand').textContent=car.brand+' / '+car.name;$('workshop-build').textContent=maxed?'PREPARACIÓN AL MÁXIMO':buildLabel(entry.build);
  $('workshop-summary').textContent=`${Math.round(car.max*3.6)} km/h · Aceleración +${Math.round((car.accel/this.car.accel-1)*100)}% · Agarre +${Math.round((car.grip/this.car.grip-1)*100)}% · Frenada +${entry.build.brakes*6}%`;
  for(const b of document.querySelectorAll('[data-workshop-tab]'))b.setAttribute('aria-selected',String(b.dataset.workshopTab===this.tab));
  $('workshop-performance').classList.toggle('hidden',this.tab!=='performance');$('workshop-appearance').classList.toggle('hidden',this.tab!=='appearance');
  this.renderPerformance(entry);this.renderAppearance(entry);this.preview();
 }
 renderPerformance(entry){
  const list=$('workshop-performance');list.replaceChildren();
  for(const [system,catalog]of Object.entries(UPGRADES)){
   const level=entry.build[system],card=node('article','upgrade-card'),top=node('div','upgrade-heading');top.append(node('h3','',catalog.name),node('b','',level===3?'MAX':`TIER ${level} / 3`));card.append(top,node('p','',catalog.description));
   const tiers=node('div','upgrade-tiers');for(let i=1;i<=3;i++){const tier=node('span',i<=level?'installed':i===level+1?'next':'',String(i));tiers.append(tier);}card.append(tiers);
   const delta=system==='engine'?`+${(level+1)*4}% aceleración · +${(level+1)*2}% punta`:system==='chassis'?`+${(level+1)*4}% agarre`:`+${(level+1)*6}% frenada`;
   card.append(node('p','upgrade-effect',level===3?'Instalación completa · mejora permanente':'Siguiente nivel: '+delta));
   const price=catalog.prices[level],button=node('button','secondary-button full',level===3?'NIVEL MÁXIMO':`INSTALAR TIER ${level+1} · ◈ ${price}`);button.id='upgrade-'+system;button.disabled=this.busy||level===3||this.user.coins<price;button.onclick=()=>this.purchase('/upgrade',{system,tier:level+1},'Mejora instalada.');card.append(button);list.append(card);
  }
  list.append(node('p','workshop-note','Al máximo: +6% punta, +12% aceleración y agarre, +18% frenada. Se conserva el perfil de tu auto. Las compras no cambian los coches de los rivales.'));
 }
 renderAppearance(entry){
  const panel=$('workshop-appearance');panel.replaceChildren();const owns=entry.parts.includes('paint'),paint=node('article','paint-card');paint.append(node('h3','','Pintura libre'),node('p','','Desbloquea una vez y cambia el color de este auto cuantas veces quieras.'));
  const row=node('div','paint-controls'),input=node('input');input.type='color';input.id='workshop-color';input.value=this.paintPreview??entry.build.color??this.car.color;input.setAttribute('aria-label','Color de la carrocería');input.disabled=this.busy;input.oninput=()=>this.chooseColor(input.value);
  row.append(input,node('span','paint-hex',input.value.toUpperCase()));paint.append(row);const swatches=node('div','paint-swatches');for(const color of PAINTS){const b=node('button');b.style.background=color;b.setAttribute('aria-label','Pintura '+color);b.disabled=this.busy;b.onclick=()=>this.chooseColor(color);swatches.append(b);}paint.append(swatches);
  const button=node('button','secondary-button full',owns?'GUARDAR COLOR':'DESBLOQUEAR PINTURA · ◈ 140');button.id='workshop-paint-save';button.disabled=this.busy||(!owns&&this.user.coins<140);button.onclick=()=>owns?this.customize({color:this.paintPreview??entry.build.color??this.car.color}):this.purchase('/buy',{part:'paint'},'Pintura desbloqueada. Guarda el color que prefieras.');paint.append(button,node('small','workshop-note',this.paintPreview!==undefined?'VISTA PREVIA · guarda para aplicar a tus carreras.':'Las piezas visuales no modifican el rendimiento.'));panel.append(paint);
  const parts=node('div','vehicle-parts');for(const part of VEHICLE_PARTS.filter(p=>p.slot!=='paint')){
   const owned=entry.parts.includes(part.id),equipped=entry.build[part.slot]===part.value,card=node('article','vehicle-part'),copy=node('div');copy.append(node('h3','',part.name),node('p','',part.description));const button=node('button','secondary-button',equipped?'EQUIPADO':owned?'EQUIPAR':`◈ ${part.price}`);button.dataset.vehiclePart=part.id;button.disabled=this.busy||equipped||(!owned&&this.user.coins<part.price);button.onclick=()=>owned?this.customize({[part.slot]:part.value}):this.purchase('/buy',{part:part.id},part.name+' instalado.');card.append(copy,button);parts.append(card);
  }panel.append(parts);const reset=node('button','text-button full','RESTAURAR ESTÉTICA DE SERIE');reset.id='workshop-stock';reset.disabled=this.busy;reset.onclick=()=>{this.paintPreview=undefined;this.customize({color:null,vinyl:'none',hood:'stock',spoiler:'stock',wheels:'stock'});};panel.append(reset,node('p','workshop-note','Los artículos comprados permanecen en tu inventario de este auto. Equipar o retirar piezas es gratis.'));
 }
 chooseColor(color){this.paintPreview=color;$('workshop-color').value=color;document.querySelector('#workshop .paint-hex').textContent=color.toUpperCase();document.querySelector('#workshop .paint-card .workshop-note').textContent='VISTA PREVIA · guarda para aplicar a tus carreras.';this.preview();}
 async purchase(route,data,message){
  if(this.busy)return;this.busy=true;this.render();try{const result=await this.account.request('/api/garage'+route,{method:'POST',body:JSON.stringify({car:this.car.id,...data})});this.account.accept(result);$('workshop-status').textContent=result.alreadyOwned?'Ya estaba comprado; no se descontaron monedas.':message;}catch(e){$('workshop-status').textContent=e.message;}finally{this.busy=false;this.render();}
 }
 async customize(appearance){
  if(this.busy)return;this.busy=true;this.render();try{const result=await this.account.request('/api/garage/customize',{method:'POST',body:JSON.stringify({car:this.car.id,appearance})});this.account.accept(result);if('color'in appearance)this.paintPreview=undefined;$('workshop-status').textContent='Estética guardada. Lista para tu próximo descenso.';}catch(e){$('workshop-status').textContent=e.message;}finally{this.busy=false;this.render();}
 }
}
