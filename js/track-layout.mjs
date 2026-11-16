import {sample,worldAt} from './sim.mjs';
import {TURBINE_ROTOR,wallClear} from './route-landmarks.mjs';
import {readTerrainFills} from './terrain-patches.mjs';
import {assetKey,validModelPath} from './scenery-models.mjs';

export const MAX_LAYOUT_OBJECTS=150;
const PORTAL='tsuchisaka/tsuchisaka_tunnel_portal';
const TURBINE=TURBINE_ROTOR.replace('_rotor','_tower');
export const layoutUrl=id=>new URL(`../assets/track-layouts/${id}.json`,import.meta.url);
export {assetKey} from './scenery-models.mjs';
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;

export function readTrackLayout(value,track,catalog){
  if(value?.version!==1||value.track!==track.id||!Array.isArray(value.objects)||value.objects.length>MAX_LAYOUT_OBJECTS)throw Error('Formato, trayecto o número de objetos inválido.');
  const seen=new Set();
  const fills=readTerrainFills(value.fills??[]);
  return {version:1,track:track.id,fills,objects:value.objects.map(object=>{
    const {id,pack,file,s,lateral,lift,yaw,pitch=0,roll=0,scale}=object;
    if(typeof id!=='string'||!/^[-\w]{1,48}$/.test(id)||seen.has(id))throw Error('Identificador de objeto repetido o inválido.');
    if(!validModelPath(pack,file))throw Error('Modelo inválido.');
    const asset=catalog?.get(assetKey(pack,file));
    if(catalog&&!asset)throw Error('El modelo no está en el catálogo.');
    const bounds=asset?.bounds??object.bounds;
    if(!bounds||![bounds.min,bounds.max].every(axis=>Array.isArray(axis)&&axis.length===3&&axis.every(n=>finite(n,-10000,10000)))||
       bounds.min.some((n,i)=>n>bounds.max[i]))throw Error('Dimensiones del modelo inválidas.');
    if(!finite(s,-20,track.length+20)||!finite(lateral,-150,150)||!finite(lift,-40,80)||![yaw,pitch,roll].every(n=>finite(n,-360,360))||
       !Array.isArray(scale)||scale.length!==3||!scale.every(n=>finite(n,.02,8)))throw Error('Posición, giro o escala fuera del rango.');
    const portal=object.portal===true;
    if(portal&&(pack!==1||file!==PORTAL||track.id!=='tsuchisaka'))throw Error('Portal de pista inválido.');
    seen.add(id);
    return {id,pack,file,s,lateral,lift,yaw,pitch,roll,scale,bounds,...portal&&{portal,exit:object.exit===true}};
  })};
}

function placementMatrix(x,y,z,yaw,pitch,roll,[sx,sy,sz]){
  const cy=Math.cos(yaw),syaw=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
  return new Float32Array([
    (cy*cr+syaw*sp*sr)*sx,cp*sr*sx,(-syaw*cr+cy*sp*sr)*sx,0,
    (-cy*sr+syaw*sp*cr)*sy,cp*cr*sy,(syaw*sr+cy*sp*cr)*sy,0,
    syaw*cp*sz,-sp*sz,cy*cp*sz,0,x,y,z,1
  ]);
}

function footprintHull(points,y){
  const order=points.map(([x,,z])=>[x,y,z]).sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
  const half=vertices=>{
    const path=[];
    for(const p of vertices){
      while(path.length>=2){
        const a=path.at(-2),b=path.at(-1);
        if((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0])>1e-6)break;
        path.pop();
      }
      path.push(p);
    }
    return path.slice(0,-1);
  };
  const hull=[...half(order),...half([...order].reverse())];
  if(hull.length>=3)return hull;
  const loX=order[0][0]-.04,hiX=order.at(-1)[0]+.04;
  const loZ=Math.min(...order.map(p=>p[2]))-.04,hiZ=Math.max(...order.map(p=>p[2]))+.04;
  return [[loX,y,loZ],[loX,y,hiZ],[hiX,y,hiZ],[hiX,y,loZ]];
}

export function placementSpot(track,ground,object){
  const {min,max}=object.bounds;
  const point=worldAt(track,object.s,object.lateral);
  const y=(ground.groundAt(point.x,point.z)??ground.heightAt(point.x,point.z))+object.lift;
  const rad=Math.PI/180,angle=point.heading+object.yaw*rad;
  const matrix=placementMatrix(0,0,0,angle,(object.pitch??0)*rad,(object.roll??0)*rad,object.scale);
  const corners=[];
  for(const x of [min[0],max[0]])for(const h of [min[1],max[1]])for(const z of [min[2],max[2]]){
    corners.push([point.x+matrix[0]*x+matrix[4]*h+matrix[8]*z,y+matrix[1]*x+matrix[5]*h+matrix[9]*z,point.z+matrix[2]*x+matrix[6]*h+matrix[10]*z]);
  }
  matrix[12]=point.x;matrix[13]=y;matrix[14]=point.z;
  const elevations=corners.map(p=>p[1]),base=Math.min(...elevations),height=Math.max(...elevations)-base;
  const footprint=footprintHull(corners,y);
  return {...point,...object,y,angle,matrix,footprint,height,base,
    radius:Math.max(.2,...footprint.map(([x,,z])=>Math.hypot(x-point.x,z-point.z))),
    detail:object.pack===1?1:2,rotor:object.pack===1&&object.file===TURBINE};
}

export function placementWarning(spot,roadIndex,environment){
  if(spot.portal)return '';
  if(!roadIndex.polygonClear(spot.footprint,.45))return 'Invade la calzada o el guardarraíl.';
  if(!wallClear(spot.footprint,spot.base,spot.height,environment.blockers))return 'La huella cruza un muro o un talud.';
  const {ground}=environment,y=ground.groundAt(spot.x,spot.z)??ground.heightAt(spot.x,spot.z);
  if(spot.base>y+.6)return 'La base queda elevada sobre el terreno.';
  if(spot.base<y-Math.max(.9,spot.height*.4))return 'Parte del objeto puede quedar enterrada.';
  return '';
}

export function generatedLayout(track,environment,catalog){
  const objects=environment.landmarks.flatMap((spot,index)=>{
    const asset=catalog.get(assetKey(spot.pack,spot.file));
    if(!asset)return [];
    const point=sample(track,spot.s),c=Math.cos(point.heading),s=Math.sin(point.heading);
    const ground=environment.ground.groundAt(spot.x,spot.z)??environment.ground.heightAt(spot.x,spot.z);
    return [{id:`auto-${index+1}`,pack:spot.pack,file:spot.file,s:spot.s,
      lateral:(spot.x-point.x)*c-(spot.z-point.z)*s,lift:spot.y-ground,
      yaw:(spot.angle-point.heading)*180/Math.PI,pitch:0,roll:0,scale:[...spot.scale],bounds:asset.bounds,
      ...spot.portal&&{portal:true,exit:spot.exit}}];
  });
  return {version:1,track:track.id,objects,fills:[]};
}
