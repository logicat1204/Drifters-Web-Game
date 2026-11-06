const $=id=>document.getElementById(id),format=s=>`${Math.floor(s/60)}′${(s%60).toFixed(3).padStart(6,'0')}″`;
const element=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
export class Ranking {
 constructor(account,{openModal,config,cars}){this.account=account;this.openModal=openModal;this.config=config;this.cars=cars;this.version=0;for(const car of cars){const option=element('option',car.brand+' '+car.code);option.value=car.id;$('ranking-car').append(option);}$('ranking-car').onchange=()=>this.refresh();$('ranking-refresh').onclick=()=>this.refresh();}
 open(){this.filters=this.config();$('ranking-title').textContent=this.filters.name;$('ranking-conditions').textContent=[this.filters.night?'Noche':'Amanecer',this.filters.wet?'Mojado':'Seco',this.filters.manual?'MT':'AT','Time Attack · marcas verificadas'].join(' · ');this.openModal('ranking');this.refresh();}
 async refresh(){
  const version=++this.version;const query=new URLSearchParams({track:this.filters.track,night:this.filters.night?'1':'0',wet:this.filters.wet?'1':'0',manual:this.filters.manual?'1':'0',car:$('ranking-car').value});$('ranking-status').textContent='Buscando las mejores trazadas…';$('ranking-list').replaceChildren();
  try{const data=await this.account.request('/api/rankings?'+query);if(version!==this.version)return;
   for(const record of data.records){const row=element('li','');row.className=record.userId===this.account.user.id?'ranking-you':'';const info=element('div',''),car=this.cars.find(c=>c.id===record.car);info.append(element('b',record.displayName),element('small',(car?.code||record.car)+' · '+record.buildKey));row.append(element('span',String(record.rank).padStart(2,'0')),info,element('strong',format(record.time)));$('ranking-list').append(row);}
   $('ranking-personal').textContent=data.personal?'Tu mejor marca: '+format(data.personal.time)+(data.personal.rank?' · Puesto '+data.personal.rank:' · Fuera del top 50'):'Aún no tienes una marca verificada en estas condiciones.';$('ranking-status').textContent=data.records.length?'Mejor tiempo por piloto · '+data.records.length+' marcas':'Este trayecto espera su primera marca. ¡Deja tu nombre!';
  }catch(error){if(version===this.version)$('ranking-status').textContent=error.message;}
 }
}
