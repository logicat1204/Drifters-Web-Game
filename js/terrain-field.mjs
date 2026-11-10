// A shared world-space ground surface, rather than independent suspended ribbons.
const CELL=16,BUCKET=64,RADIUS=128;
export function createTerrainField(track,roadIndex){
 const count=track.renderSegments??Math.min(track.points.length-1,Math.ceil(track.length/track.step)),buckets=new Map(),tiles=new Map();
 const floor=Math.min(...track.points.map(p=>p.y))-35;
 for(let i=0;i<count;i++){
  const p=track.points[i],key=Math.floor(p.x/BUCKET)+','+Math.floor(p.z/BUCKET);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);
  if(i%Math.max(1,Math.round(16/track.step)))continue;
  for(let x=Math.floor((p.x-RADIUS)/96);x<=Math.floor((p.x+RADIUS)/96);x++)for(let z=Math.floor((p.z-RADIUS)/96);z<=Math.floor((p.z+RADIUS)/96);z++)tiles.set(x+','+z,[x,z]);
 }
 const query=(x,z)=>{
  const candidates=[];
  for(let gx=Math.floor(x/BUCKET)-3;gx<=Math.floor(x/BUCKET)+3;gx++)for(let gz=Math.floor(z/BUCKET)-3;gz<=Math.floor(z/BUCKET)+3;gz++)for(const i of buckets.get(gx+','+gz)||[]){
   const a=track.points[i],b=track.points[i+1],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1))),px=a.x+t*dx,pz=a.z+t*dz,d=Math.hypot(x-px,z-pz);if(candidates.length<12||d<candidates.at(-1).d){let at=candidates.findIndex(p=>p.d>d);if(at<0)at=candidates.length;candidates.splice(at,0,{d,y:a.y+(b.y-a.y)*t});if(candidates.length>12)candidates.pop();}
  }
  if(!candidates.length)return {y:floor,d:Infinity};
  const nearest=candidates[0];let sum=0,weight=0;
  for(const p of candidates.slice(0,12)){const w=1/(p.d*p.d+16)**2;sum+=p.y*w;weight+=w;}
  const distance=nearest.d,blend=Math.max(0,Math.min(1,(distance-72)/(RADIUS-72))),smooth=blend*blend*(3-2*blend);
  return {y:(sum/weight-Math.min(8,distance*.12))*(1-smooth)+floor*smooth,d:distance};
 };
 const nodes=new Map(),node=(x,z)=>{const key=x+','+z;if(!nodes.has(key))nodes.set(key,query(x*CELL,z*CELL));return nodes.get(key);};
 const heightAt=(x,z)=>{
  const gx=Math.floor(x/CELL),gz=Math.floor(z/CELL),u=x/CELL-gx,v=z/CELL-gz,a=node(gx,gz).y,b=node(gx+1,gz).y,c=node(gx+1,gz+1).y,d=node(gx,gz+1).y;
  return v<=u?a+(b-a)*u+(c-b)*v:a+(c-d)*u+(d-a)*v;
 };
 const waterHeight=['atami','tsubaki','odawara','manazuru','ashinoko'].includes(track.id)?floor+23:null;
 const surfaces=[],support=new Map();
 function register(vertices,kind){const face={kind,vertices};surfaces.push(face);for(let x=Math.floor(Math.min(...vertices.map(p=>p[0]))/CELL);x<=Math.floor(Math.max(...vertices.map(p=>p[0]))/CELL);x++)for(let z=Math.floor(Math.min(...vertices.map(p=>p[2]))/CELL);z<=Math.floor(Math.max(...vertices.map(p=>p[2]))/CELL);z++){const key=x+','+z;if(!support.has(key))support.set(key,[]);support.get(key).push(face);}}
 function groundAt(x,z){
  for(const {vertices:v}of support.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))||[])for(const [a,b,c]of [[v[0],v[1],v[2]],[v[0],v[2],v[3]]]){
   const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)continue;
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,w=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,t=1-u-w;
   if(Math.min(u,w,t)>=-1e-6)return a[1]*u+b[1]*w+c[1]*t;
  }return null;
 }
 function build(g,beginTile,texture){let id=0;for(const [tx,tz]of tiles.values()){
  beginTile(id++,heightAt(tx*96,tz*96));
  for(let x=tx*6;x<(tx+1)*6;x++)for(let z=tz*6;z<(tz+1)*6;z++){
   const a=node(x,z),b=node(x+1,z),c=node(x+1,z+1),d=node(x,z+1);if(Math.min(a.d,b.d,c.d,d.d)>RADIUS+24)continue;
   const vertices=[[x*CELL,a.y,z*CELL],[x*CELL,d.y,(z+1)*CELL],[(x+1)*CELL,c.y,(z+1)*CELL],[(x+1)*CELL,b.y,z*CELL]];
   if(!roadIndex.polygonClear(vertices))continue;
   // Match heightAt's diagonal (southwest to northeast).
   g.surface(...vertices,texture,vertices.map(p=>[p[0]/8,p[2]/8]),[.76,.83,.71,0]);
   register(vertices,'ground-field');
  }
 }
 // Exact roadside collar seals grid cells removed to protect the driving corridor.
 for(let i=0;i<count;i++){
  const a=track.points[i],b=track.points[i+1];if(i%Math.max(1,Math.round(96/track.step))===0)beginTile(id++,a.y);
  const point=(p,l)=>{const x=p.x+Math.cos(p.heading)*l,z=p.z-Math.sin(p.heading)*l;return [x,Math.abs(l)<6.21?p.y-.04:heightAt(x,z),z];};
  for(const side of [-1,1])for(const [lo,hi]of [[5.55,6.2],[6.2,12],[12,28]]){
   const calm=p=>Math.abs(p.curve||0)<.02;
   if(lo>6&&i%2===1&&calm(a)&&calm(track.points[i-1]))continue;
   const end=lo>6&&i%2===0&&calm(a)&&calm(b)?track.points[Math.min(count,i+2)]:b;
   let v=[point(a,side*lo),point(end,side*lo),point(end,side*hi),point(a,side*hi)];if(!roadIndex.polygonClear(v,.12))continue;if(side<0)v=[v[0],v[3],v[2],v[1]];
   g.surface(...v,texture,v.map(p=>[p[0]/8,p[2]/8]),[.76,.83,.71,0]);register(v,'ground-collar');
  }
 }
 }
 return {heightAt,groundAt,surfaces,register,build,waterHeight};
}
