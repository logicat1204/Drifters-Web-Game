import {ALL_CARS as CARS,ALL_TRACKS as TRACKS,STARTER_CARS,CAR_PROFILES} from './sim.mjs';
import {AVATAR_OPTIONS,DEFAULT_AVATAR,avatarOptions,defaultAvatar,cosmeticId,installCosmetics,renderableAvatar} from './avatar.mjs';
import {FOCUS_TYPES} from './focus.mjs';
const $=id=>document.getElementById(id),time=s=>{const ms=Math.floor(s*1000);return `${Math.floor(ms/60000)}′${String(Math.floor(ms/1000)%60).padStart(2,'0')}″${String(ms%1000).padStart(3,'0')}`;};
const label={base:'BASE',skin:'TONO DE PIEL',hair:'CABELLO',hairColor:'COLOR DEL CABELLO',eyes:'OJOS',mouth:'LABIOS',outfit:'ROPA',outfitColor:'COLOR DE ROPA',accessory:'ACCESORIO',makeup:'MAQUILLAJE'};
const cosmeticLabels={outfit:'Ropa',hair:'Cabello',eyes:'Ojos',mouth:'Labios',accessory:'Accesorios',makeup:'Maquillaje'};
const cosmeticColors={outfit:'outfitColor',hair:'hairColor'};
export class AccountClient {
  constructor(callbacks={}){
    this.callbacks=callbacks;this.user=null;this.csrf=null;this.ready=false;this.authMode='login';this.draft={...DEFAULT_AVATAR};this.recordRequest=0;
    this.backgrounds=[];
    for(const [key,items] of Object.entries(AVATAR_OPTIONS)){const field=document.createElement('label');field.textContent=label[key];const select=document.createElement('select');select.id='avatar-'+key;select.setAttribute('aria-label',label[key]);for(const [id,name] of items)select.add(new Option(name,id));select.onchange=()=>{if(key==='base')this.changeBase(select.value);else this.draft[key]=select.value;this.preview();};field.append(select);$('avatar-options').append(field);}
    $('profile-car').onchange=()=>this.describeCar();
    for(const t of TRACKS)$('records-track').add(new Option(t.name,t.id));for(const c of CARS)$('records-car').add(new Option(c.code,c.id));
    document.querySelectorAll('[data-auth-mode]').forEach(b=>b.onclick=()=>this.mode(b.dataset.authMode));
    $('auth-form').onsubmit=e=>{e.preventDefault();this.authenticate();};$('auth-username').oninput=()=>this.availability();
    $('legacy-login').onclick=()=>this.mode(this.authMode==='legacy'?'login':'legacy');
    $('link-email-open').onclick=()=>this.openLinkEmail();$('link-email-close').onclick=()=>$('link-email-dialog').close();
    $('link-email-form').onsubmit=event=>{event.preventDefault();this.linkEmail();};
    $('background-prev').onclick=()=>this.moveBackground(-1);$('background-next').onclick=()=>this.moveBackground(1);
    $('cosmetic-browse').onclick=()=>this.renderCosmetics(true);
    $('cosmetic-color').onchange=event=>{this.draft[cosmeticColors[this.cosmeticSlot]]=event.target.value;this.refreshAvatarOptions();this.preview();this.renderCosmetics(!$('cosmetic-grid').classList.contains('hidden'));};
    for(const [slot,title] of Object.entries(cosmeticLabels)){
      const field=$('avatar-'+slot).parentElement,button=document.createElement('button');
      button.type='button';button.className='secondary-button';button.textContent='Cambiar '+title.toLowerCase();button.onclick=()=>{this.cosmeticSlot=slot;this.renderCosmetics(false);$('cosmetic-dialog').showModal();};
      field.after(button);field.hidden=true;
      if(cosmeticColors[slot])$('avatar-'+cosmeticColors[slot]).parentElement.hidden=true;
    }
    $('account-close').onclick=()=>this.close();$('account-logout').onclick=()=>this.logout();
    $('profile-form').onsubmit=e=>{e.preventDefault();this.saveProfile();};$('profile-photo').onchange=()=>this.uploadPhoto();
    $('portrait-mode').onchange=()=>this.preview();
    $('profile-focus-open').onclick=()=>this.openFocus();
    $('profile-focus-close').onclick=()=>$('profile-focus-dialog').close();
    document.querySelectorAll('[data-license-tab]').forEach(b=>b.onclick=()=>this.tab(b.dataset.licenseTab));
    for(const id of ['records-track','records-car','records-source','records-weather','records-day','records-transmission'])$(id).onchange=()=>this.loadRecords();
    $('records-refresh').onclick=()=>this.loadRecords();$('auth-retry').onclick=()=>this.init();
    $('account-panel').addEventListener('keydown',e=>{if(e.code==='Escape'&&this.user?.onboarded){e.stopPropagation();this.close();}if(e.key==='Tab'){const focus=[...$('account-panel').querySelectorAll('button,input,select')].filter(x=>!x.disabled&&x.getClientRects().length);if(e.shiftKey&&document.activeElement===focus[0]){e.preventDefault();focus.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===focus.at(-1)){e.preventDefault();focus[0]?.focus();}}});
    this.mode('login');this.init();
  }
  async request(url,options={}){const response=await fetch(url,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(this.csrf?{'X-CSRF-Token':this.csrf}:{}),...options.headers}});let data;try{data=await response.json();}catch{throw Error('El servidor no respondió. Revisa que JUGAR.bat siga abierto.');}if(!response.ok){if(response.status===401&&url!=='/api/login'&&url!=='/api/profile/email'){this.user=null;this.csrf=null;this.close(true);this.renderIdentity();this.callbacks.onSessionLost?.();}const error=Error(data.error||'No se pudo completar la acción.');error.status=response.status;throw error;}return data;}
  async refreshCatalog(){const data=await this.request('/api/avatar/catalog');installCosmetics(data.items.filter(i=>i.pack));}
  async init(){try{const [session]=await Promise.all([this.request('/api/session'),this.refreshCatalog(),this.loadBackgrounds()]);this.accept(session);$('auth-status').textContent='';$('auth-retry').classList.add('hidden');}catch(error){$('auth-status').textContent=error.message;$('auth-retry').classList.remove('hidden');}finally{this.ready=true;$('auth-submit').disabled=false;}}
  accept(data){this.user=data.user;this.csrf=data.csrf??this.csrf;this.renderIdentity();this.callbacks.onUser?.(this.user);if(this.user&&!this.user.onboarded&&!document.body.classList.contains('title-screen'))this.open(true);}
  renderIdentity(){const user=this.user;document.body.classList.toggle('auth-required',!user?.onboarded);$('auth-gate').classList.toggle('hidden',!!user);$('account-close').classList.toggle('hidden',!user?.onboarded);}
  require(){if(this.user?.onboarded)return true;if(this.user)this.open(true);else $('auth-gate').classList.remove('hidden');return false;}
  mode(mode){
    this.authMode=mode;
    for(const [id,visible] of [['email',mode!=='legacy'],['username',mode!=='login'],['confirm',mode==='register']]){
      $('auth-'+id+'-row').classList.toggle('hidden',!visible);
      const field=$('auth-'+id);field.required=visible;field.disabled=!visible;
    }
    $('legacy-login').classList.toggle('hidden',mode==='register');
    $('legacy-login').textContent=mode==='legacy'?'Volver al acceso por correo':'Tengo una cuenta anterior';
    $('auth-username').autocomplete=mode==='register'?'off':'username';
    $('auth-email').autocomplete=mode==='register'?'email':'username';
    $('auth-password').autocomplete=mode==='register'?'new-password':'current-password';
    $('auth-submit').textContent=mode==='register'?'CREAR PILOTO ↗':'ENTRAR A LA MONTAÑA ↗';
    $('auth-status').textContent='';document.querySelectorAll('[data-auth-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.authMode===(mode==='legacy'?'login':mode))));this.availability();
  }
  availability(){clearTimeout(this.availabilityTimer);const epoch=this.availabilityEpoch=(this.availabilityEpoch||0)+1;$('username-status').textContent='';if(this.authMode!=='register')return;const name=$('auth-username').value;if(!/^[a-zA-Z0-9]{3,24}$/.test(name)){$('username-status').textContent='3–24 letras y números, sin espacios.';return;}this.availabilityTimer=setTimeout(async()=>{try{const data=await this.request('/api/username?name='+encodeURIComponent(name));if(epoch===this.availabilityEpoch)$('username-status').textContent=data.available?'✓ Nombre disponible':'Ese nombre ya está ocupado.';}catch(error){if(epoch===this.availabilityEpoch)$('username-status').textContent=error.message;}},350);}
  async authenticate(){
    if(!$('auth-form').reportValidity())return;
    const mode=this.authMode,password=$('auth-password').value;
    if(mode==='register'&&password!==$('auth-confirm').value){$('auth-status').textContent='Las contraseñas no coinciden.';return;}
    const credentials={password};
    if(mode!=='legacy')credentials.email=$('auth-email').value;
    if(mode!=='login')credentials.username=$('auth-username').value;
    $('auth-submit').disabled=true;$('auth-status').textContent='Abriendo tu licencia…';
    try{
      const data=await this.request('/api/'+(mode==='register'?'register':'login'),{method:'POST',body:JSON.stringify(credentials)});
      $('auth-password').value=$('auth-confirm').value='';$('auth-status').textContent='';this.accept(data);
      if(mode==='legacy'&&!data.user.hasEmail)this.openLinkEmail();
    }catch(error){$('auth-status').textContent=error.message;}
    finally{$('auth-submit').disabled=false;}
  }
  openLinkEmail(){
    $('link-email-form').reset();$('link-email-status').textContent='';$('link-email-dialog').showModal();
  }
  async linkEmail(){
    const form=$('link-email-form'),button=form.querySelector('[type=submit]');button.disabled=true;
    try{
      const data=await this.request('/api/profile/email',{method:'POST',body:JSON.stringify({email:$('link-email-address').value,password:$('link-email-password').value})});
      $('link-email-dialog').close();this.accept(data);$('link-email-open').classList.add('hidden');
    }catch(error){$('link-email-status').textContent=error.message;$('link-email-password').focus();}
    finally{button.disabled=false;$('link-email-password').value='';}
  }
  async logout(){try{await this.request('/api/logout',{method:'POST'});this.user=null;this.csrf=null;this.close(true);this.renderIdentity();this.callbacks.onLogout?.();this.mode('login');$('auth-email').focus();}catch(error){$('profile-status').textContent=error.message;}}
  async loadBackgrounds(){
    try{this.backgrounds=(await this.request('/api/license-backgrounds')).backgrounds;}
    catch{this.backgrounds=[];}
  }
  applyBackground(element,id){
    const item=this.backgrounds.find(background=>background.id===id);
    if(item)element.style.setProperty('--license-background',`url("${item.url}")`);
    else element.style.removeProperty('--license-background');
  }
  renderBackground(){
    const selection=this.backgrounds.find(background=>background.id===this.background);
    this.applyBackground($('license-portrait-background'),this.background);
    $('background-selection').textContent=selection?'Fondo '+selection.id:'Fondo original';
    $('background-prev').disabled=$('background-next').disabled=!this.backgrounds.length;
    this.preview();
  }
  moveBackground(direction){
    const options=[null,...this.backgrounds.map(item=>item.id)];
    const current=Math.max(0,options.indexOf(this.background));
    this.background=options[(current+direction+options.length)%options.length];this.renderBackground();
  }
  portraitPreview(avatar,transparent=false){
    const params=new URLSearchParams(avatar);params.delete('version');if(transparent)params.set('transparent','1');return '/api/avatar/preview?'+params;
  }
  renderCosmetics(gallery){
    const slot=this.cosmeticSlot,items=avatarOptions(this.draft.base),current=this.draft[slot],color=cosmeticColors[slot];
    const owned=items[slot].filter(([id])=>this.user.cosmetics.includes(cosmeticId(this.draft.base,slot,id)));
    $('cosmetic-title').textContent=cosmeticLabels[slot];
    $('cosmetic-name').textContent=owned.find(([id])=>id===current)?.[1]||'';
    $('cosmetic-preview').src=this.portraitPreview(this.draft);
    $('cosmetic-color-row').hidden=!color;
    if(color){$('cosmetic-color').replaceChildren(...items[color].map(([id,name])=>new Option(name,id)));$('cosmetic-color').value=this.draft[color];}
    $('cosmetic-browse').textContent=slot==='outfit'?'Cambiar ropa':'Ver inventario';
    const grid=$('cosmetic-grid');grid.classList.toggle('hidden',!gallery);grid.replaceChildren();
    if(!gallery)return;
    for(const [id,title] of owned){
      const button=document.createElement('button'),image=document.createElement('img'),name=document.createElement('span');
      button.type='button';button.dataset.cosmetic=id;button.setAttribute('aria-pressed',String(id===current));
      image.src=this.portraitPreview({...this.draft,[slot]:id});image.alt='';image.loading='lazy';name.textContent=title;
      button.onclick=()=>{this.draft[slot]=id;this.refreshAvatarOptions();this.preview();this.renderCosmetics(false);$('cosmetic-browse').focus();};
      button.append(image,name);grid.append(button);
    }
  }
  open(first=false){if(!this.user)return;this.previousFocus=document.activeElement;$('account-panel').classList.remove('hidden');$('license-overlay').classList.remove('hidden');$('account-title').textContent=first?'TU PRIMERA LICENCIA.':'TU LICENCIA.';$('profile-username').textContent='@'+this.user.username;$('profile-display-name').value=this.user.displayName;this.showCarOptions();$('link-email-open').classList.toggle('hidden',this.user.hasEmail);this.background=this.user.licenseBackground;$('portrait-mode').value=this.user.portraitMode;this.selectedFocus=this.user.focusType;this.focusNote();this.draft=renderableAvatar(this.user.avatar);this.baseDrafts={};this.refreshAvatarOptions();$('profile-status').textContent=first?'Confirma tu nombre, personaliza tu retrato y elige tu coche inicial.':'';this.tab('profile');this.renderBackground();$('profile-display-name').focus({preventScroll:true});$('account-panel').scrollTop=0;}
  showCarOptions(){
    const select=$('profile-car'),choosing=!this.user.onboarded&&!this.user.cars.length;
    $('profile-starter').classList.toggle('hidden',!choosing);
    select.disabled=!choosing;
    if(!choosing)return;
    select.replaceChildren();
    const option=new Option('Elige uno de los tres estilos','');option.disabled=true;select.add(option);
    for(const car of STARTER_CARS)select.add(new Option(`${car.brand} ${car.code} · ${CAR_PROFILES[car.profile].name}`,car.id));
    select.value='';
    this.describeCar();
  }
  describeCar(){
    const car=CARS.find(c=>c.id===$('profile-car').value);
    $('profile-car-note').textContent=car?CAR_PROFILES[car.profile].description:'Tu primer coche es gratis. Los otros estarán disponibles en la tienda.';
  }
  refreshAvatarOptions(){for(const [key,items] of Object.entries(avatarOptions(this.draft.base))){const select=$('avatar-'+key);const owned=items.filter(([id])=>!['hair','eyes','mouth','outfit','accessory','makeup'].includes(key)||!this.user?.cosmetics||this.user.cosmetics.includes(cosmeticId(this.draft.base,key,id)));select.replaceChildren(...owned.map(([id,name])=>new Option(name,id)));select.value=this.draft[key];}}
  openFocus(){
    $('profile-focus-options').replaceChildren(...Object.values(FOCUS_TYPES).map(type=>{
      const item=document.createElement('div'),button=document.createElement('button'),detail=document.createElement('p');
      const unlocked=this.user.focusUnlocked.includes(type.id),selected=this.selectedFocus===type.id;
      button.type='button';button.className='secondary-button';button.disabled=!unlocked&&type.id!=='balance';
      button.textContent=type.name;button.setAttribute('aria-pressed',String(selected));
      detail.textContent=type.description+'.'+(unlocked?'':` ${type.unlock}.`);
      detail.style.borderColor=type.color;
      button.onclick=()=>{this.selectedFocus=type.id;this.focusNote();$('profile-focus-dialog').close();};
      item.append(button,detail);return item;
    }));
    $('profile-focus-dialog').showModal();
  }
  focusNote(){$('profile-focus-name').textContent=(FOCUS_TYPES[this.selectedFocus]||FOCUS_TYPES.balance).name;}
  changeBase(base){this.baseDrafts??={};this.baseDrafts[this.draft.base]={...this.draft};const {skin,hairColor,outfitColor}=this.draft;this.draft=this.baseDrafts[base]?{...this.baseDrafts[base]}:{...defaultAvatar(base),skin,hairColor,outfitColor};this.refreshAvatarOptions();}
  close(force=false){if(!force&&!this.user?.onboarded)return;for(const id of ['profile-focus-dialog','link-email-dialog','cosmetic-dialog'])$(id).close();$('account-panel').classList.add('hidden');$('license-overlay').classList.add('hidden');this.previousFocus?.focus();}
  tab(tab){if(!this.user?.onboarded&&tab==='records')return;document.querySelectorAll('[data-license-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.licenseTab===tab));b.disabled=!this.user.onboarded&&b.dataset.licenseTab==='records';});$('license-profile').classList.toggle('hidden',tab!=='profile');$('license-records').classList.toggle('hidden',tab!=='records');if(tab==='records')this.loadRecords();}
  preview(){const photo=$('portrait-mode').value==='photo';$('avatar-options').classList.toggle('hidden',photo);$('photo-options').classList.toggle('hidden',!photo);$('profile-preview').src=photo?(this.user.hasPhoto?'/api/profile/photo?v='+this.user.photoVersion:'/assets/avatars/v2/base-male.png'):this.portraitPreview(this.draft,this.backgrounds.some(item=>item.id===this.background));}
  async uploadPhoto(){const file=$('profile-photo').files[0];if(!file)return;$('profile-save').disabled=true;$('profile-status').textContent='Preparando foto…';try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Elige una foto PNG, JPEG o WebP de hasta 8 MB.');const bitmap=await createImageBitmap(file);if(bitmap.width>12000||bitmap.height>12000){bitmap.close();throw Error('La imagen es demasiado grande.');}const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;const ctx=canvas.getContext('2d');ctx.fillStyle='#273c43';ctx.fillRect(0,0,512,640);const scale=Math.max(512/bitmap.width,640/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;ctx.drawImage(bitmap,(512-w)/2,(640-h)/2,w,h);bitmap.close();const data=await this.request('/api/profile/photo',{method:'POST',body:JSON.stringify({image:canvas.toDataURL('image/jpeg',.86)})});this.user=data.user;this.renderIdentity();this.preview();$('profile-status').textContent='Foto cargada. Guarda tu perfil para usarla.';}catch(error){$('profile-status').textContent=error.message;}finally{$('profile-save').disabled=false;$('profile-photo').value='';}}
  async saveProfile(){
    $('profile-save').disabled=true;
    const first=!this.user.onboarded,car=$('profile-car');
    const values={displayName:$('profile-display-name').value,focusType:this.selectedFocus,portraitMode:$('portrait-mode').value,avatar:this.draft,licenseBackground:this.background,complete:true};
    if(!car.disabled)values.defaultCar=car.value;
    try{
      const data=await this.request('/api/profile',{method:'PATCH',body:JSON.stringify(values)});
      this.accept(data);$('profile-status').textContent='Licencia guardada.';this.close();
      if(first&&data.user.onboarded)this.callbacks.onWelcome?.(data.user);
    }catch(error){$('profile-status').textContent=error.message;}
    finally{$('profile-save').disabled=false;}
  }
  preferences(values){const id=this.user?.id;if(!id)return Promise.resolve();this.preferenceTail=(this.preferenceTail||Promise.resolve()).then(async()=>{if(this.user?.id!==id)return;try{const data=await this.request('/api/profile',{method:'PATCH',body:JSON.stringify(values)});if(this.user?.id!==id)return;this.user=data.user;this.renderIdentity();this.callbacks.onPreferences?.(this.user);}catch(error){this.callbacks.onError?.('No se guardó tu selección: '+error.message);}});return this.preferenceTail;}
  async loadRecords(){const epoch=++this.recordRequest;$('records-status').textContent='Leyendo tiempos de los pilotos…';try{const q=new URLSearchParams({track:$('records-track').value,car:$('records-car').value,source:$('records-source').value,wet:$('records-weather').value,night:$('records-day').value,manual:$('records-transmission').value});const [board,mine]=await Promise.all([this.request('/api/records?'+q),this.request('/api/records/me')]);if(epoch!==this.recordRequest)return;
      $('license-stats').textContent=`${mine.stats.races} CARRERAS · ${mine.stats.wins} VICTORIAS · ${mine.stats.points.toLocaleString()} PUNTOS DE CONDUCCIÓN`;
      $('records-board').replaceChildren();board.records.forEach((record,i)=>{const row=document.createElement('li'),rank=document.createElement('span'),portrait=document.createElement('img'),name=document.createElement('b'),detail=document.createElement('small'),lap=document.createElement('strong');rank.textContent=String(i+1).padStart(2,'0');portrait.src=record.portraitUrl;portrait.alt='';name.textContent=record.displayName;detail.textContent='@'+record.username+' · '+CARS.find(c=>c.id===record.car)?.code+' · '+(record.buildKey==='M0-C0-F0'?'DE SERIE':record.buildKey);const driver=document.createElement('div');driver.append(name,detail);lap.textContent=time(record.time);row.append(rank,portrait,driver,lap);row.classList.toggle('is-you',record.userId===this.user.id);$('records-board').append(row);});
      $('course-record').textContent=board.records.length?`RÉCORD DEL CURSO · ${board.records[0].displayName} · ${time(board.records[0].time)}`:'Este curso todavía espera su primer récord con estas condiciones.';
      $('personal-records').replaceChildren();for(const r of mine.records){const row=document.createElement('li'),name=document.createElement('div'),lap=document.createElement('b');name.textContent=`${TRACKS.find(t=>t.id===r.track)?.name} · ${CARS.find(c=>c.id===r.car)?.code}`;const conditions=document.createElement('small');conditions.textContent=`${r.source==='online'?'ONLINE':'INDIVIDUAL'} · ${r.wet?'MOJADO':'SECO'} · ${r.night?'NOCHE':'AMANECER'} · ${r.manual?'MT':'AT'} · ${r.buildKey==='M0-C0-F0'?'DE SERIE':r.buildKey}`;name.append(conditions);lap.textContent=time(r.time);row.append(name,lap);$('personal-records').append(row);}$('records-status').textContent=mine.records.length?'Solo se comparan tiempos con las mismas condiciones.':'Completa tu primer descenso para guardar tu marca personal.';
    }catch(error){if(epoch===this.recordRequest)$('records-status').textContent=error.message;}}
}
