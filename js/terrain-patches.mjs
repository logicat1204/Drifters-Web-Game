const LIMIT=16;
export const MAX_TERRAIN_FILLS=48;

const cross=([x,z],[u,v],[a,b])=>(u-x)*(b-z)-(v-z)*(a-x);
function segmentsCross(a,b,c,d){
 const overlap=(i)=>Math.max(Math.min(a[i],b[i]),Math.min(c[i],d[i]))<=Math.min(Math.max(a[i],b[i]),Math.max(c[i],d[i]));
 return overlap(0)&&overlap(1)&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
}

export function polygonBounds(points){
 const xs=points.map(point=>point[0]),zs=points.map(point=>point[1]);
 return [Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
}
export function pointInTerrainPolygon(points,x,z){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [a,b]=points[i],[c,d]=points[j];
  if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)inside=!inside;
 }
 return inside;
}
export function terrainEdgeDistance(points,x,z){
 let nearest=Infinity;
 for(let i=0;i<points.length;i++){
  const [a,b]=points[i],[c,d]=points[(i+1)%points.length],dx=c-a,dz=d-b;
  const t=Math.max(0,Math.min(1,((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz||1)));
  nearest=Math.min(nearest,Math.hypot(x-a-dx*t,z-b-dz*t));
 }
 return nearest;
}

export function readTerrainFills(value){
 if(!Array.isArray(value)||value.length>MAX_TERRAIN_FILLS)throw Error('Cantidad de rellenos inválida.');
 const ids=new Set();
 return value.map(item=>{
  const {id,points,lift=0}=item??{};
  if(typeof id!=='string'||!/^[-\w]{1,48}$/.test(id)||ids.has(id))throw Error('Identificador de relleno inválido o repetido.');
  if(!Array.isArray(points)||points.length<3||points.length>LIMIT||points.some(point=>!Array.isArray(point)||point.length!==2||point.some(n=>!Number.isFinite(n)||Math.abs(n)>50000)))throw Error('El relleno debe tener de 3 a 16 vértices válidos.');
  if(!Number.isFinite(lift)||lift< -10||lift>10)throw Error('La altura del relleno debe estar entre −10 y 10 m.');
  const [x0,z0,x1,z1]=polygonBounds(points);
  let area=0;
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length];
   if(Math.hypot(a[0]-b[0],a[1]-b[1])<.25)throw Error('Separa un poco más los vértices.');
   area+=a[0]*b[1]-a[1]*b[0];
   for(let j=i+2;j<points.length;j++){
    if(i===0&&j===points.length-1)continue;
    if(segmentsCross(a,b,points[j],points[(j+1)%points.length]))throw Error('El contorno del relleno se cruza consigo mismo.');
   }
  }
  if(Math.abs(area)<4||x1-x0>160||z1-z0>160)throw Error('Dibuja un área entre 2 m² y 160 m de ancho o largo.');
  ids.add(id);
  return {id,points,lift};
 });
}
