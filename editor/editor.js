import {Renderer} from '/js/renderer.js';
import {ALL_TRACKS,CARS,makeTrack,createRace,sample,worldAt,clamp} from '/js/sim.mjs';
import {createRoadIndex} from '/js/scenery.mjs';
import {assetKey,generatedLayout,placementSpot,placementWarning,readTrackLayout,MAX_LAYOUT_OBJECTS} from '/js/track-layout.mjs';
import {readTerrainFills,MAX_TERRAIN_FILLS} from '/js/terrain-patches.mjs';
import {CUSTOM_MODEL_PACK,placementModelKey} from '/js/scenery-models.mjs';

const $=id=>document.getElementById(id);
const world=$('world'),overview=$('overview'),ctx=overview.getContext('2d');
const terrainOverlay=$('terrain-overlay'),overlayCtx=terrainOverlay.getContext('2d');
const fields=[...$('transform').querySelectorAll('input[type=number]')];
const folderFor=id=>({iroha:'irohazaka',enna:'ennaskyline'}[id]??id);
const rounded=n=>Math.round(n*1000)/1000;
const message=value=>{$('status').textContent=value;};
const el=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
const selected=()=>layout?.objects.find(item=>item.id===selectedId);
const nameOf=object=>catalog.get(assetKey(object.pack,object.file))?.label??object.file.split('/').at(-1);
const packLabel=pack=>typeof pack==='number'?`Rutas · Parte ${pack}`:pack===CUSTOM_MODEL_PACK?'Modelos propios':`Touge City · Parte ${pack.at(-1)}`;
const searchable=value=>value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
let customBusy=false,customSignature='';

let renderer,catalog,track,roadIndex,race,layout,automatic,revision,selectedId=null;
let spots=[],dirty=false,editVersion=0,saving=false,loading=false,cameraS=0,azimuth=-.78,elevation=.42,distance=43,day=true;
let markerNodes=new Map(),mapTransform,mouse=null,mapDrag=null,frameId=0,until=0,lastFrame=0;
let terrainMode=false,draftFill=null,activeFillId=null,showGaps=false,gaps=[],viewCamera=null;
const activeFill=()=>layout?.fills.find(fill=>fill.id===activeFillId);
const fillCenter=({points})=>[0,1].map(axis=>points.reduce((sum,p)=>sum+p[axis],0)/points.length);

async function api(url,options){
  const response=await fetch(url,options);
  const body=await response.json();
  if(!response.ok)throw Error(body.error??'Petición fallida.');
  return body;
}

function refreshSave(){
  $('save').disabled=!layout||!dirty||saving||loading||!!draftFill;
  $('track').disabled=saving||loading;
}
function refreshCatalog(){
  const previous=$('asset').value,scope=$('scope').value;
  const query=searchable($('asset-search').value.trim()),groups=new Map();
  const options=[...catalog.values()].filter(asset=>{
    const matches=scope==='all'||scope===asset.pack||scope==='route'&&typeof asset.pack==='number'&&asset.file.startsWith(folderFor(track.id)+'/');
    return matches&&(!query||searchable(asset.label+' '+asset.file).includes(query));
  });
  for(const asset of options){
    if(!groups.has(asset.pack)){
      const group=document.createElement('optgroup');group.label=packLabel(asset.pack);
      groups.set(asset.pack,group);
    }
    groups.get(asset.pack).append(new Option(asset.label,asset.key));
  }
  $('asset').replaceChildren(...groups.values());
  if(options.some(asset=>asset.key===previous))$('asset').value=previous;
  assetInfo();
}
function assetInfo(){
  const asset=catalog.get($('asset').value);
  const empty=$('scope').value===CUSTOM_MODEL_PACK&&!$('asset-search').value?'Copia archivos .glb en assets/editor-models/.':'No hay coincidencias.';
  $('asset-info').textContent=asset?`${asset.triangles.toLocaleString('es')} triángulos · ${asset.file.split('/').at(-1)}.glb`:empty;
  $('add').disabled=!asset||layout.objects.length>=MAX_LAYOUT_OBJECTS;
}
async function refreshCustomModels(){
  if(customBusy||document.hidden)return;
  customBusy=true;
  try{
    const result=await api('/api/custom-models');
    const signature=JSON.stringify(result);
    if(signature===customSignature)return;
    customSignature=signature;
    const previous=new Map([...catalog].filter(([,asset])=>asset.pack===CUSTOM_MODEL_PACK));
    const next=new Map(result.assets.map(asset=>[asset.key,asset]));
    for(const key of previous.keys())catalog.delete(key);
    for(const [key,asset] of next)catalog.set(key,asset);
    for(const key of new Set([...previous.keys(),...next.keys()])){
      if(previous.get(key)?.revision===next.get(key)?.revision)continue;
      renderer.invalidateSceneryModel(key);
    }
    $('scope').querySelector('option[value="custom"]').textContent=`Modelos propios (${result.assets.length})`;
    const warning=result.warnings[0];
    $('custom-models-status').textContent=warning?`${warning.file}.glb · ${warning.message}`:'';
    if(track){refreshCatalog();refreshObjects();showWarning();repaint();}
  }catch{
    $('custom-models-status').textContent='No se pudo comprobar la carpeta de modelos propios.';
  }finally{customBusy=false;}
}
function refreshObjects(){
  $('object-count').textContent=String(layout.objects.length);
  $('objects').replaceChildren(...layout.objects.map(object=>{
    const button=el('button',nameOf(object));
    button.type='button';button.dataset.id=object.id;
    button.setAttribute('aria-pressed',String(object.id===selectedId));
    button.append(el('small',Math.round(object.s)+' m'));
    button.addEventListener('click',()=>selectObject(object.id,true));
    return button;
  }));
  markerNodes=new Map(layout.objects.map(object=>{
    const button=el('button',nameOf(object));button.type='button';button.className='marker';button.hidden=true;button.dataset.id=object.id;
    button.addEventListener('click',()=>selectObject(object.id));
    return [object.id,button];
  }));
  $('markers').replaceChildren(...markerNodes.values());
  assetInfo();
}
function refreshTransform(){
  const object=selected();
  $('transform').disabled=!object;
  for(const field of fields){
    const key=field.dataset.field;
    const number=key?(object?.[key]??(object&&['pitch','roll'].includes(key)?0:undefined)):object?.scale[Number(field.dataset.axis)];
    field.value=number===undefined?'':rounded(number);
  }
  fields[0].min=-20;
  fields[0].max=track.length+20;
  showWarning();
}
function showWarning(){
  const spot=spots.find(spot=>spot.id===selectedId);
  $('warning').textContent=spot?catalog.has(assetKey(spot.pack,spot.file))?placementWarning(spot,roadIndex,renderer.environment):'El archivo de este modelo no está disponible.': '';
}

function setStation(value,keepSelection=false){
  cameraS=clamp(value,0,track.length);
  if(!keepSelection&&selectedId){selectedId=null;refreshTransform();}
  if(!keepSelection&&activeFillId){activeFillId=null;refreshTerrainPanel();}
  $('station').value=Math.round(cameraS);
  $('station-output').textContent=`${Math.round(cameraS).toLocaleString('es')} m`;
  updateSelection();
  if(terrainMode&&showGaps)scanTerrain(false);
  repaint();
}
function updateSelection(){
  for(const button of $('objects').children)button.setAttribute('aria-pressed',String(button.dataset.id===selectedId));
}
function selectObject(id,center=false){
  selectedId=id;
  if(center)focusObject();
  else{
    refreshTransform();
    updateSelection();
    repaint();
  }
}
function focusObject(){
  const object=selected();
  if(!object)return;
  refreshTransform();
  setStation(object.s,true);
}
function syncPreview({list=false,changed=false}={}){
  spots=layout.objects.map(object=>placementSpot(track,renderer.environment.ground,object));
  renderer.setLandmarkPreview(spots);
  if(changed){dirty=true;editVersion++;}
  if(list)refreshObjects();
  showWarning();
  refreshSave();
  repaint();
}

async function openTrack(id){
  const config=ALL_TRACKS.find(item=>item.id===id);
  if(!config||loading||saving)return;
  if((dirty||draftFill?.length)&&!confirm('Hay cambios pendientes. ¿Descartar y cambiar de trayecto?')){$('track').value=track.id;return;}
  loading=true;refreshSave();message('Cargando '+config.name+'…');
  try{
    const next=makeTrack(config),saved=await api('/api/layouts/'+id);
    renderer.setTrack(next,null);
    const generated=generatedLayout(next,renderer.environment,catalog);
    if(saved.layout)renderer.setTrack(next,saved.layout);
    track=next;roadIndex=createRoadIndex(track);race=createRace(CARS[0],track,{mode:'time'});
    automatic=generated;layout=saved.layout??structuredClone(automatic);revision=saved.revision;
    selectedId=null;dirty=false;draftFill=null;activeFillId=null;gaps=[];viewCamera=null;distance=43;azimuth=-.78;elevation=.42;
    $('track').value=id;$('station').max=Math.round(track.length);
    if(![...catalog.values()].some(asset=>typeof asset.pack==='number'&&asset.file.startsWith(folderFor(id)+'/'))&&$('scope').value==='route')$('scope').value='all';
    refreshCatalog();syncPreview({list:true});refreshTransform();refreshTerrainPanel();setStation(layout.objects[0]?.s??30);
    message(revision?'Archivo local cargado.':'Se está editando la distribución automática del trayecto.');
  }catch(error){
    if(track)$('track').value=track.id;
    message(error.message);
  }finally{loading=false;refreshSave();}
}

function addObject(){
  const asset=catalog.get($('asset').value);
  if(!asset||layout.objects.length>=MAX_LAYOUT_OBJECTS)return;
  const extent=Math.max(...asset.bounds.min.map((min,i)=>asset.bounds.max[i]-min));
  const size=rounded(clamp(40/Math.max(1,extent),.02,1));
  const object={id:crypto.randomUUID(),pack:asset.pack,file:asset.file,bounds:asset.bounds,s:cameraS,lateral:12,
    lift:rounded(clamp(-asset.bounds.min[1]*size,-40,80)),yaw:-90,pitch:0,roll:0,scale:[size,size,size]};
  for(const lateral of [12,-12,18,-18,25,-25,35,-35,48,-48,65,-65,90,-90,120,-120]){
    object.lateral=lateral;object.yaw=lateral>0?-90:90;
    const spot=placementSpot(track,renderer.environment.ground,object);
    if(!placementWarning(spot,roadIndex,renderer.environment))break;
  }
  layout.objects.push(object);
  selectedId=object.id;
  syncPreview({list:true,changed:true});
  focusObject();
}
function updateField(field,finish=false){
  const object=selected(),number=field.valueAsNumber;
  if(!object||!Number.isFinite(number)){if(finish)refreshTransform();return;}
  const result=clamp(number,Number(field.min),Number(field.max));
  if(field.dataset.field)object[field.dataset.field]=result;
  else object.scale[Number(field.dataset.axis)]=result;
  if(finish)field.value=rounded(result);
  syncPreview({list:finish&&field.dataset.field==='s',changed:true});
}
function rotateSelected(increment){
  const object=selected();
  if(!object)return;
  const axis=$('rotation-axis').value;
  const angle=(object[axis]??0)+increment;
  object[axis]=increment?rounded(((angle+180)%360+360)%360-180):0;
  syncPreview({changed:true});
  refreshTransform();
}
async function saveTrack(){
  if(!dirty||saving||loading||draftFill)return;
  const warned=spots.filter(spot=>placementWarning(spot,roadIndex,renderer.environment)).length;
  if(warned&&!confirm(`${warned} objeto(s) tienen avisos de colocación. ¿Guardar esta distribución?`))return;
  saving=true;refreshSave();message('Guardando…');
  try{
    const submitted=readTrackLayout(layout,track),version=editVersion;
    const result=await api('/api/layouts/'+track.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,layout:submitted})});
    revision=result.revision;
    const changedWhileSaving=editVersion!==version;
    if(!changedWhileSaving){
      layout=result.layout;
      renderer.setTrack(track,layout);
      dirty=false;syncPreview({list:true});
    }
    message(changedWhileSaving?'Archivo guardado. Quedan cambios por guardar.':`Guardado en assets/track-layouts/${track.id}.json`);
  }catch(error){message(error.message);}
  finally{saving=false;refreshSave();}
}

function setTerrainMode(enabled){
  terrainMode=enabled;
  $('objects-mode').setAttribute('aria-pressed',String(!enabled));
  $('terrain-mode').setAttribute('aria-pressed',String(enabled));
  for(const panel of document.querySelectorAll('[data-objects-panel]'))panel.hidden=enabled;
  $('terrain-panel').hidden=!enabled;
  $('markers').hidden=enabled;
  terrainOverlay.hidden=!enabled;
  if(enabled&&showGaps)scanTerrain(false);
  refreshTerrainPanel();
  repaint();
}

function refreshTerrainPanel(){
  if(!layout)return;
  const fill=activeFill();
  $('fill-draft').hidden=!draftFill;
  $('fill-progress').textContent=draftFill?`${draftFill.length} vértices de 16`:'';
  $('commit-fill').disabled=!draftFill||draftFill.length<3;
  $('undo-fill').disabled=!draftFill?.length;
  $('start-fill').disabled=!!draftFill||layout.fills.length>=MAX_TERRAIN_FILLS;
  $('fill-controls').disabled=!fill||!!draftFill;
  $('fill-lift').value=fill?.lift??0;
  $('view-help').textContent=terrainMode?(draftFill?'Clic para añadir vértices · Arrastre derecho para orbitar':'Arrastra para orbitar · Rueda para acercar · Minimapa ampliado'):'Arrastra para orbitar · Rueda para acercar · Selecciona un marcador';
  $('fills').replaceChildren(...layout.fills.map((patch,index)=>{
    const button=el('button',`Relleno ${index+1} · ${patch.points.length} vértices`);
    button.type='button';button.setAttribute('aria-pressed',String(patch.id===activeFillId));
    button.addEventListener('click',()=>{if(draftFill)return;activeFillId=patch.id;focusFill();});
    return button;
  }));
  refreshSave();
}

function scanTerrain(report=true){
  gaps=[];
  const ground=renderer.environment.ground,found=new Set();
  for(let s=Math.max(0,cameraS-88);s<Math.min(track.length,cameraS+88);s+=3){
    for(const side of [-1,1])for(const distance of [6.5,8,10,13,16,20,24,28,34]){
      const {x,z}=worldAt(track,s,side*distance);
      const key=Math.round(x/2)+':'+Math.round(z/2);
      if(found.has(key)||roadIndex.distance(x,z,24)<track.width/2+.8||ground.groundAt(x,z)!==null)continue;
      const y=ground.heightAt(x,z);
      if(ground.waterHeight!==null&&y<=ground.waterHeight)continue;
      found.add(key);gaps.push([x,y+.2,z]);
    }
  }
  if(report)message(gaps.length?`Puntos sin suelo en este sector: ${gaps.length}.`:'El muestreo de este sector encontró suelo continuo.');
}
function focusFill(){
  const fill=activeFill();
  if(!fill)return;
  refreshTerrainPanel();
  setStation(roadCoordinate(...fillCenter(fill)).s,true);
}
function rebuildTerrain(){
  renderer.setTrack(track,layout);
  if(showGaps)scanTerrain(false);
  syncPreview({changed:true});
  refreshTerrainPanel();
}
function addFillPoint(x,z){
  if(!draftFill||draftFill.length>=16)return;
  const previous=draftFill.at(-1);
  if(previous&&Math.hypot(previous[0]-x,previous[1]-z)<.25)return;
  draftFill.push([rounded(x),rounded(z)]);
  refreshTerrainPanel();repaint();
}
function commitFill(){
  try{
    const id=crypto.randomUUID(),before=renderer.environment.ground.repairCounts.manual;
    layout.fills=readTerrainFills([...layout.fills,{id,points:draftFill,lift:0}]);
    activeFillId=id;draftFill=null;
    rebuildTerrain();focusFill();
    message(renderer.environment.ground.repairCounts.manual>before?'Relleno aplicado. Guarda el trayecto para usarlo en el juego.':'En esta zona ya hay suelo continuo o la calzada ocupa el área del relleno.');
  }catch(error){message(error.message);}
}

const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const cross=([a,b,c],[x,y,z])=>[b*z-c*y,c*x-a*z,a*y-b*x];
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
function projectMarkers(eye,target,fov){
  const forward=normalize(target.map((v,i)=>v-eye[i])),right=normalize(cross(forward,[0,1,0])),up=cross(right,forward);
  const w=world.clientWidth,h=world.clientHeight,factor=h/(2*Math.tan(fov*Math.PI/360)),limit=350;
  viewCamera={eye,forward,right,up,w,h,factor};
  if(terrainMode){
    projectTerrain(viewCamera);
    return;
  }
  for(const spot of spots){
    const marker=markerNodes.get(spot.id),delta=[spot.x-eye[0],spot.y+spot.height-eye[1],spot.z-eye[2]],z=dot(forward,delta);
    if(!marker)continue;
    const visible=z>1&&z<limit;
    const x=w/2+dot(right,delta)*factor/z,y=h/2-dot(up,delta)*factor/z;
    marker.hidden=!visible||x<0||x>w||y<0||y>h;
    if(marker.hidden)continue;
    marker.style.left=x+'px';marker.style.top=y+'px';
    marker.classList.toggle('active',spot.id===selectedId);
  }
}
function terrainPath(context,points,closed){
  if(!points.length)return;
  context.beginPath();
  context.moveTo(...points[0]);
  for(const point of points.slice(1))context.lineTo(...point);
  if(closed)context.closePath();
  context.stroke();
}
function projectTerrain({eye,forward,right,up,w,h,factor}){
  if(terrainOverlay.width!==w||terrainOverlay.height!==h){terrainOverlay.width=w;terrainOverlay.height=h;}
  overlayCtx.clearRect(0,0,w,h);
  const projection=(x,y,z)=>{
    const delta=[x-eye[0],y-eye[1],z-eye[2]],depth=dot(forward,delta);
    return depth>1?[w/2+dot(right,delta)*factor/depth,h/2-dot(up,delta)*factor/depth]:null;
  };
  const ground=renderer.environment.ground;
  const path2D=points=>points.map(([x,z])=>projection(x,(ground.groundAt(x,z)??ground.heightAt(x,z))+.3,z));
  for(const fill of layout.fills){
    const path=path2D(fill.points);
    if(path.some(p=>!p))continue;
    overlayCtx.strokeStyle=fill.id===activeFillId?'#6de7ff':'#7ccfbf';
    overlayCtx.lineWidth=fill.id===activeFillId?2.7:1.4;
    terrainPath(overlayCtx,path,true);
  }
  if(draftFill){
    const path=path2D(draftFill).filter(Boolean);
    overlayCtx.strokeStyle='#fff3a4';overlayCtx.lineWidth=2;
    terrainPath(overlayCtx,path,false);
    for(const point of path){overlayCtx.beginPath();overlayCtx.arc(...point,3,0,Math.PI*2);overlayCtx.stroke();}
  }
  for(const gap of gaps){
    const p=projection(...gap);
    if(!p)continue;
    overlayCtx.beginPath();overlayCtx.fillStyle='#ff917b';overlayCtx.arc(...p,2.5,0,Math.PI*2);overlayCtx.fill();
  }
}
function groundFromScreen(event){
  if(!viewCamera)return null;
  const {eye,forward,right,up,w,h,factor}=viewCamera,rect=world.getBoundingClientRect();
  const x=(event.clientX-rect.left-w/2)/factor,y=(h/2-event.clientY+rect.top)/factor;
  const direction=normalize(forward.map((part,axis)=>part+x*right[axis]+y*up[axis])),ground=renderer.environment.ground;
  const at=t=>eye.map((part,axis)=>part+t*direction[axis]);
  const diff=t=>{
    const [a,b,c]=at(t);
    return b-(ground.groundAt(a,c)??ground.heightAt(a,c));
  };
  let previous=1;
  if(diff(previous)<0)return null;
  for(let distance=3;distance<=210;distance+=2){
    if(diff(distance)>0){previous=distance;continue;}
    let lo=previous,hi=distance;
    for(let i=0;i<9;i++){const mid=(lo+hi)/2;if(diff(mid)>0)lo=mid;else hi=mid;}
    const [a,,c]=at((lo+hi)/2);
    return [a,c];
  }
  return null;
}
function drawOverview(){
  const width=Math.round(overview.clientWidth),height=Math.round(overview.clientHeight);
  if(overview.width!==width||overview.height!==height){overview.width=width;overview.height=height;}
  ctx.clearRect(0,0,width,height);
  const points=track.points.filter(point=>point.s<=track.length);
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z),x0=Math.min(...xs),z0=Math.min(...zs);
  const w=Math.max(1,Math.max(...xs)-x0),h=Math.max(1,Math.max(...zs)-z0);
  const here=sample(track,cameraS);
  const [centerX,centerZ]=terrainMode&&activeFill()?fillCenter(activeFill()):terrainMode?[here.x,here.z]:[x0+w/2,z0+h/2];
  const factor=terrainMode?Math.min(width,height)/135:Math.min((width-20)/w,(height-20)/h);
  const xy=(x,z)=>[width/2+(x-centerX)*factor,height/2+(z-centerZ)*factor];
  mapTransform={xy,toWorld:(x,y)=>[(x-width/2)/factor+centerX,(y-height/2)/factor+centerZ]};
  ctx.strokeStyle='#7892a2';ctx.lineWidth=1.5;ctx.beginPath();
  for(const point of points)ctx.lineTo(...xy(point.x,point.z));
  ctx.stroke();
  if(terrainMode){
    for(const fill of layout.fills){
      ctx.strokeStyle=fill.id===activeFillId?'#6de7ff':'#7ccfbf';
      terrainPath(ctx,fill.points.map(p=>xy(...p)),true);
    }
    if(draftFill){ctx.strokeStyle='#fff3a4';terrainPath(ctx,draftFill.map(p=>xy(...p)),false);}
    for(const [x,,z] of gaps){
      ctx.beginPath();ctx.fillStyle='#ff917b';ctx.arc(...xy(x,z),2,0,Math.PI*2);ctx.fill();
    }
  }else{
    for(const spot of spots){
      ctx.beginPath();ctx.fillStyle=spot.id===selectedId?'#7addff':'#f9c28a';
      ctx.arc(...xy(spot.x,spot.z),spot.id===selectedId?4:2.6,0,2*Math.PI);ctx.fill();
    }
  }
  ctx.beginPath();ctx.strokeStyle='#a6f0ff';ctx.arc(...xy(here.x,here.z),5.5,0,2*Math.PI);ctx.stroke();
}
function renderFrame(now){
  frameId=0;
  if(!track)return;
  const dt=lastFrame?clamp((now-lastFrame)/1000,.016,.06):.016;
  lastFrame=now;
  const point=sample(track,cameraS),focus=terrainMode?null:spots.find(spot=>spot.id===selectedId);
  let target=focus?[focus.x,focus.y+Math.min(focus.height*.38,13),focus.z]:[point.x,point.y+.8,point.z];
  if(terrainMode&&activeFill()){
    const [x,z]=fillCenter(activeFill()),ground=renderer.environment.ground;
    target=[x,(ground.groundAt(x,z)??ground.heightAt(x,z))+.3,z];
  }
  const heading=point.heading+azimuth,radius=distance*Math.cos(elevation);
  const eye=[target[0]+Math.sin(heading)*radius,target[1]+Math.sin(elevation)*distance,target[2]+Math.cos(heading)*radius],fov=56;
  race.s=cameraS;
  const focusKey=focus?placementModelKey(focus):null;
  renderer.editorFocusModel=focusKey;
  renderer.render(race,'paused',dt,{day,hidePlayer:true,replayCamera:{eye,target,fov}});
  projectMarkers(eye,target,fov);
  const selectedModel=focusKey&&renderer.routeModels?.get(focusKey);
  if(now<until||renderer.routeLoading||selectedModel?.status==='ready'&&renderer.time-selectedModel.readyAt<.45)frameId=requestAnimationFrame(renderFrame);
}
function repaint(){
  if(!track)return;
  drawOverview();
  until=performance.now()+1050;
  if(!frameId)frameId=requestAnimationFrame(renderFrame);
}

function cursorOnMap(event){
  const rect=overview.getBoundingClientRect();
  return [event.clientX-rect.left,event.clientY-rect.top];
}
function roadCoordinate(x,z){
  let best={distance:Infinity,s:0,lateral:0};
  for(let i=0;i<(track.renderSegments??track.points.length-1);i++){
    const a=track.points[i],b=track.points[i+1],dx=b.x-a.x,dz=b.z-a.z;
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
    const px=x-a.x-dx*t,pz=z-a.z-dz*t,d=px*px+pz*pz;
    if(d<best.distance){
      const heading=a.heading+(b.heading-a.heading)*t;
      best={distance:d,s:a.s+(b.s-a.s)*t,lateral:px*Math.cos(heading)-pz*Math.sin(heading)};
    }
  }
  return best;
}
function moveOnMap(event){
  const mapped=roadCoordinate(...mapTransform.toWorld(...cursorOnMap(event)));
  const item=selected();
  if(mapDrag&&item?.id===mapDrag){
    item.s=rounded(mapped.s);item.lateral=rounded(clamp(mapped.lateral,-150,150));
    setStation(item.s,true);syncPreview({changed:true});refreshTransform();
  }else setStation(mapped.s);
}

function bind(){
  $('track').addEventListener('change',event=>void openTrack(event.target.value));
  $('scope').addEventListener('change',refreshCatalog);$('asset').addEventListener('change',assetInfo);
  $('asset-search').addEventListener('input',refreshCatalog);
  $('add').addEventListener('click',addObject);$('save').addEventListener('click',()=>void saveTrack());
  $('station').addEventListener('input',event=>setStation(event.target.valueAsNumber));
  $('back').addEventListener('click',()=>setStation(cameraS-50));$('forward').addEventListener('click',()=>setStation(cameraS+50));
  $('day').addEventListener('click',event=>{day=!day;event.target.textContent=day?'Día':'Noche';event.target.setAttribute('aria-pressed',String(day));repaint();});
  for(const field of fields){field.addEventListener('input',()=>updateField(field));field.addEventListener('change',()=>updateField(field,true));}
  for(const button of $('transform').querySelectorAll('[data-rotate]'))button.addEventListener('click',()=>rotateSelected(Number(button.dataset.rotate)));
  $('focus').addEventListener('click',focusObject);
  $('duplicate').addEventListener('click',()=>{
    if(layout.objects.length>=MAX_LAYOUT_OBJECTS)return;
    const object=structuredClone(selected());
    object.id=crypto.randomUUID();object.s=clamp(object.s+7,0,track.length);
    layout.objects.push(object);selectedId=object.id;syncPreview({list:true,changed:true});focusObject();
  });
  $('remove').addEventListener('click',()=>{layout.objects=layout.objects.filter(item=>item.id!==selectedId);selectedId=null;syncPreview({list:true,changed:true});refreshTransform();});
  $('restore').addEventListener('click',()=>{
    if(!confirm('¿Reemplazar la distribución en edición por la automática?'))return;
    layout.objects=structuredClone(automatic.objects);selectedId=null;syncPreview({list:true,changed:true});refreshTransform();
  });
  $('objects-mode').addEventListener('click',()=>{
    if(draftFill?.length&&!confirm('¿Descartar el contorno sin aplicar?'))return;
    draftFill=null;setTerrainMode(false);
  });
  $('terrain-mode').addEventListener('click',()=>setTerrainMode(true));
  $('scan-gaps').addEventListener('click',event=>{
    showGaps=!showGaps;
    event.currentTarget.setAttribute('aria-pressed',String(showGaps));
    if(showGaps)scanTerrain();
    else gaps=[];
    repaint();
  });
  $('start-fill').addEventListener('click',()=>{draftFill=[];activeFillId=null;refreshTerrainPanel();repaint();});
  $('commit-fill').addEventListener('click',commitFill);
  $('undo-fill').addEventListener('click',()=>{draftFill.pop();refreshTerrainPanel();repaint();});
  $('cancel-fill').addEventListener('click',()=>{draftFill=null;refreshTerrainPanel();repaint();});
  $('focus-fill').addEventListener('click',focusFill);
  $('remove-fill').addEventListener('click',()=>{
    layout.fills=layout.fills.filter(fill=>fill.id!==activeFillId);activeFillId=null;rebuildTerrain();
  });
  $('fill-lift').addEventListener('change',event=>{
    const input=event.target,fill=activeFill();
    if(fill&&Number.isFinite(input.valueAsNumber)){fill.lift=clamp(input.valueAsNumber,-10,10);rebuildTerrain();}
    else refreshTerrainPanel();
  });
  world.addEventListener('pointerdown',event=>{
    if(draftFill&&event.button===0){
      const point=groundFromScreen(event);
      if(point)addFillPoint(...point);
      else message('Apunta hacia la ladera o usa el minimapa ampliado.');
      return;
    }
    world.setPointerCapture(event.pointerId);mouse={x:event.clientX,y:event.clientY};
  });
  world.addEventListener('contextmenu',event=>{if(terrainMode)event.preventDefault();});
  world.addEventListener('pointermove',event=>{
    if(!mouse)return;
    azimuth-=(event.clientX-mouse.x)*.007;elevation=clamp(elevation+(event.clientY-mouse.y)*.006,.10,1.47);
    mouse={x:event.clientX,y:event.clientY};repaint();
  });
  world.addEventListener('lostpointercapture',()=>{mouse=null;});
  world.addEventListener('wheel',event=>{event.preventDefault();distance=clamp(distance*Math.exp(event.deltaY*.0011),7,170);repaint();},{passive:false});
  overview.addEventListener('pointerdown',event=>{
    if(!mapTransform)return;
    if(terrainMode){
      const point=mapTransform.toWorld(...cursorOnMap(event));
      if(draftFill)addFillPoint(...point);
      else setStation(roadCoordinate(...point).s);
      return;
    }
    overview.setPointerCapture(event.pointerId);
    const [x,y]=cursorOnMap(event),hit=spots.findLast(spot=>Math.hypot(...mapTransform.xy(spot.x,spot.z).map((v,i)=>v-[x,y][i]))<7);
    if(hit){mapDrag=hit.id;selectObject(hit.id,true);}
    else moveOnMap(event);
  });
  overview.addEventListener('pointermove',event=>{if(mapDrag&&overview.hasPointerCapture(event.pointerId))moveOnMap(event);});
  overview.addEventListener('lostpointercapture',()=>{if(mapDrag)refreshObjects();mapDrag=null;repaint();});
  overview.addEventListener('keydown',event=>{
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
    event.preventDefault();setStation(cameraS+(event.key==='ArrowLeft'?-50:50));
  });
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void saveTrack();}
  });
  window.addEventListener('beforeunload',event=>{if(dirty||draftFill?.length)event.preventDefault();});
  new ResizeObserver(repaint).observe($('preview'));
}

try{
  renderer=new Renderer(world,{detailedScenery:true});
  renderer.editorPreview=true;
  renderer.setEnvironmentDetail(2);renderer.setCar(CARS[0]);renderer.renderDistance='long';
  catalog=new Map((await api('/api/catalog')).map(asset=>[asset.key,asset]));
  $('track').replaceChildren(...ALL_TRACKS.map(config=>new Option(config.name,config.id)));
  await openTrack(ALL_TRACKS[0].id);
  bind();
  void refreshCustomModels();
  setInterval(refreshCustomModels,2500);
  void renderer.atlasReady.then(repaint);
}catch(error){message(error.message);}
