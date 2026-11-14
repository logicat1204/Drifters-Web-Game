const MAX_SONGS=8;
const FALLBACK_COVER='/assets/touge_city_assets_part3/textures/sky/sky_sunset_equirect.jpg';
const $=id=>document.getElementById(id);

export class MenuMusic {
  constructor(settings,save,notify){
    this.settings=settings;
    this.save=save;
    this.notify=notify;
    this.library=[];
    this.dedicated=[];
    this.shared=[];
    this.playbackOrder=[];
    this.wantsPlayback=true;
    this.audio=$('menu-music-audio');
    this.audio.addEventListener('play',()=>this.updateControls());
    this.audio.addEventListener('pause',()=>this.updateControls());
    this.audio.addEventListener('ended',()=>this.move(1,true));
    this.audio.addEventListener('error',()=>{
      const song=this.current();
      if(this.active&&song&&this.loaded===song.url){
        this.wantsPlayback=false;
        this.audio.pause();
        this.notify('No se pudo reproducir '+song.name+'.');
      }
      this.updateControls();
    });
    $('menu-music-cover').onerror=()=>{
      if(!$('menu-music-cover').src.endsWith(FALLBACK_COVER))$('menu-music-cover').src=FALLBACK_COVER;
    };
    $('menu-music-prev').onclick=()=>this.move(-1);
    $('menu-music-toggle').onclick=()=>this.toggle();
    $('menu-music-next').onclick=()=>this.move(1);
    $('menu-playlist-refresh').onclick=()=>this.refresh(true);
    this.updateControls();
  }
  async refresh(notify=false){
    const request=this.request=(this.request||0)+1;
    try{
      const response=await fetch('/api/menu-songs',{cache:'no-store'});
      if(!response.ok)throw Error();
      const {songs}=await response.json();
      if(request!==this.request)return;
      this.dedicated=songs;
      if(notify)$('menu-playlist-status').textContent='Carpeta de música actualizada.';
    }catch{
      if(request!==this.request)return;
      if(notify)$('menu-playlist-status').textContent='No se pudo actualizar la carpeta de música.';
    }
    this.menuCatalogReady=true;
    this.setLibrary(this.shared);
  }
  setLibrary(shared=[]){
    this.shared=shared;
    if(!this.menuCatalogReady)return;
    const library=[...this.dedicated,...shared];
    const next=library.filter((song,i)=>song.url&&!song.url.startsWith('blob:')&&library.findIndex(item=>item.id===song.id)===i);
    if(JSON.stringify(this.library)===JSON.stringify(next))return;
    this.library=next;
    this.syncCurrent();
    this.renderEditor();
  }
  playlist(){
    const saved=this.settings.menuPlaylist;
    if(!Array.isArray(saved))return this.library.slice(0,3);
    return [...new Set(saved)].slice(0,MAX_SONGS).map(id=>this.library.find(song=>song.id===id)).filter(Boolean);
  }
  current(){return this.playlist().find(song=>song.id===this.selected);}
  startSession(){
    this.audio.pause();
    this.loaded=null;
    this.selected=null;
    this.playbackOrder=[];
    this.wantsPlayback=true;
    this.syncCurrent();
  }
  syncCurrent(){
    const ids=this.playlist().map(song=>song.id);
    this.playbackOrder=this.playbackOrder.filter(id=>ids.includes(id));
    const added=ids.filter(id=>!this.playbackOrder.includes(id));
    for(let i=added.length-1;i>0;i--){
      const index=Math.floor(Math.random()*(i+1));
      [added[i],added[index]]=[added[index],added[i]];
    }
    this.playbackOrder.push(...added);
    if(!this.playbackOrder.includes(this.selected))this.selected=this.playbackOrder[0];
    if(this.loaded!==this.current()?.url){this.audio.pause();this.loaded=null;}
    if(this.active&&this.wantsPlayback&&this.audio.paused)this.play();
    this.updateControls();
  }
  setActive(active){
    if(this.active===active)return;
    this.active=active;
    if(active&&this.wantsPlayback)this.play();
    if(!active)this.audio.pause();
  }
  volume(volume,muted){this.audio.volume=volume;this.audio.muted=muted;}
  async play(){
    const song=this.current();
    if(!this.active||!song)return;
    if(this.loaded!==song.url){this.loaded=song.url;this.audio.src=song.url;}
    try{await this.audio.play();}
    catch(error){
      if(error.name==='AbortError'||!this.active||this.loaded!==song.url)return;
      this.wantsPlayback=false;
      if(error.name==='NotAllowedError')this.notify('Pulsa reproducir para activar la música del menú.');
    }
    this.updateControls();
  }
  toggle(){
    if(!this.audio.paused){
      this.wantsPlayback=false;
      this.audio.pause();
      this.updateControls();
      return;
    }
    this.wantsPlayback=true;
    this.play();
  }
  move(offset,autoplay=this.wantsPlayback){
    const songs=this.playbackOrder,index=songs.indexOf(this.selected);
    if(index<0)return;
    this.selected=songs[(index+offset+songs.length)%songs.length];
    if(songs.length===1&&autoplay&&this.loaded)this.audio.currentTime=0;
    this.wantsPlayback=autoplay;
    this.syncCurrent();
  }
  updateControls(){
    const current=this.current(),playing=!this.audio.paused;
    const name=$('menu-music-name'),cover=$('menu-music-cover'),toggle=$('menu-music-toggle');
    const title=current?.name||'Música del menú';
    if(name.textContent!==title)name.textContent=title;
    const source=current?.cover||FALLBACK_COVER;
    if(cover.getAttribute('src')!==source)cover.src=source;
    toggle.disabled=!current;
    toggle.setAttribute('aria-label',playing?'Pausar':'Reproducir');
    toggle.querySelector('[data-play-icon]').toggleAttribute('hidden',playing);
    toggle.querySelector('[data-pause-icon]').toggleAttribute('hidden',!playing);
    const single=this.playlist().length<2;
    $('menu-music-prev').disabled=$('menu-music-next').disabled=single;
  }
  renderEditor(){
    const selected=this.playlist();
    $('menu-playlist-count').textContent=selected.length+' / '+MAX_SONGS;
    const list=$('menu-playlist-list'),focused=list.contains(document.activeElement)?document.activeElement.value:null;
    list.replaceChildren(...this.library.map(song=>{
      const label=document.createElement('label'),check=document.createElement('input'),name=document.createElement('span');
      check.type='checkbox';check.value=song.id;
      const index=selected.findIndex(item=>item.id===song.id);
      check.checked=index>=0;check.disabled=!check.checked&&selected.length>=MAX_SONGS;
      name.textContent=(index>=0?(index+1)+'. ':'')+song.name;
      check.onchange=()=>{
        const ids=selected.map(item=>item.id);
        this.settings.menuPlaylist=check.checked?[...ids,song.id]:ids.filter(id=>id!==song.id);
        this.save();this.syncCurrent();this.renderEditor();
      };
      label.append(check,name);return label;
    }));
    if(focused)[...list.querySelectorAll('input')].find(input=>input.value===focused)?.focus({preventScroll:true});
    $('menu-playlist-empty').hidden=this.library.length>0;
  }
}
