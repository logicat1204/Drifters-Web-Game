import {PART3_MODELS} from './scenery-part3.mjs';
import {COMPLEMENT_MODELS} from './roadside-complements.mjs';
import {PART2_MODELS} from './scenery-part2.mjs';
import {TEXTURES as T,SCENERY_MODELS as BASE_MODELS} from './scenery-assets.mjs';

const MODELS={...BASE_MODELS,...PART2_MODELS,...PART3_MODELS,...COMPLEMENT_MODELS};
export const ENVIRONMENTS={
 akina:{name:'Bosque de cedros y miradores',tree:'cedar',uphill:1,forest:1},
 akagi:{name:'Bosque mixto y galería de montaña',tree:'pine',uphill:-1,forest:1,tunnel:[.36,.405]},
 iroha:{name:'Laderas de otoño y muros de piedra',tree:'autumn',uphill:1,forest:1.2},
 usui:{name:'Bosque húmedo y patrimonio ferroviario',tree:'green',uphill:-1,forest:1},
 tsukuba:{name:'Huertos, setos y pueblos de montaña',tree:'green',uphill:1,forest:.8},
 tsubaki:{name:'Bosque costero y miradores al mar',tree:'pine',uphill:1,forest:.9,coast:true},
 atami:{name:'Ciudad termal, túnel y costa',tree:'green',uphill:1,forest:.75,coast:true,tunnel:[.42,.46]},
 odawara:{name:'Acceso urbano y paso de montaña',tree:'cedar',uphill:-1,forest:1,tunnel:[.54,.58]},
 ashinoko:{name:'Ribera del lago, embarcaderos y bosque',tree:'green',uphill:1,forest:1,lake:true},
 manazuru:{name:'Pueblos pesqueros y pinar costero',tree:'pine',uphill:1,forest:.9,coast:true,tunnel:[.22,.25]},
 myogi:{name:'Barrancos y cedros de Myogi',tree:'cedar',uphill:-1,forest:1.05},
 momiji:{name:'Bosque de arces de Momiji',tree:'autumn',uphill:1,forest:1.2},
 nanamagari:{name:'Antiguo Tōkaidō',tree:'green',uphill:-1,forest:1.05},
 nagao:{name:'Arcenes estrechos de Nagao',tree:'pine',uphill:1,forest:.85},
 happogahara:{name:'Túnel Yūhi y bosque de Tochigi',tree:'cedar',uphill:1,forest:1.1,tunnel:[.672,.693]},
 sadamine:{name:'Paredes de Saitama',tree:'green',uphill:-1,forest:1.08},
 turnpike:{name:'Rectas panorámicas y peaje',tree:'pine',uphill:-1,forest:.73,toll:.965},
 enna:{name:'Descenso del Todo School',tree:'cedar',uphill:1,forest:.9},
 tsuchisaka:{name:'Galería y laderas de Tsuchisaka',tree:'pine',uphill:-1,forest:.92,tunnel:[.075,.095]},
 yabitsu:{name:'Bosque y mirador de Yabitsu',tree:'autumn',uphill:1,forest:1.05}
};
export function environmentZone(id,t){
 if(id==='atami')return t<.24||t>.87?'urban':t>.57&&t<.74?'coast':'forest';
 if(id==='odawara')return t<.12||t>.9?'village':'forest';
 if(id==='manazuru')return t<.15||t>.86?'village':t>.4&&t<.68?'coast':'forest';
 if(id==='ashinoko')return t<.1||t>.88?'lakeside':'forest';
 if(id==='tsukuba')return Math.floor(t*9)%3===1?'orchard':t>.88?'village':'forest';
 if(id==='tsubaki')return t>.72?'coast':'forest';
 return t>.91?'village':'forest';
}

export function createEnvironment(track,g,roadIndex,sceneryBounds,{layer=()=>{},ground=null}={}){
 const profile=ENVIRONMENTS[track.id]||ENVIRONMENTS.akina,counts={},props=[],surfaces=[],lights=[],tunnels=[],occupied=new Map();
 let seed=(track.seed*93407+731)>>>0,lastPole=null;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const inc=key=>counts[key]=(counts[key]||0)+1;
 const point=(p,l,y=0)=>[p.x+Math.cos(p.heading)*l,p.y+y,p.z-Math.sin(p.heading)*l];
 const reserve=(p,r,allow)=>{const key=Math.floor(p[0]/32)+','+Math.floor(p[2]/32);if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push({x:p[0],z:p[2],radius:r,solid:true,reservation:true,allow});};
 const neighbors=(p,r)=>{const result=[];for(let x=Math.floor((p[0]-r)/32);x<=Math.floor((p[0]+r)/32);x++)for(let z=Math.floor((p[2]-r)/32);z<=Math.floor((p[2]+r)/32);z++)result.push(...occupied.get(x+','+z)||[]);return result;};
 const place=(kind,p,r,solid=false)=>{
  if(!roadIndex.clear(p[0],p[2],r))return false;
  if(ground&&!['dock','railway-bridge'].includes(kind)){const y=ground.groundAt(p[0],p[2]);if(y===null||ground.waterHeight!==null&&y<ground.waterHeight-.05)return false;p[1]=y+(kind==='bench'?.5:0);}
  if(neighbors(p,r+30).some(o=>!(o.reservation&&o.allow.includes(kind))&&(solid||o.solid)&&Math.hypot(o.x-p[0],o.z-p[2])<r+o.radius+.8))return false;
  const entry={kind,x:p[0],y:p[1],z:p[2],radius:r,solid};props.push(entry);sceneryBounds.push(entry);const key=Math.floor(p[0]/32)+','+Math.floor(p[2]/32);if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(entry);inc(kind);return true;
 };
 const patch=(kind,vertices,tile,uv,tint)=>{if(ground&&kind==='rest-stop')vertices=vertices.map(p=>[p[0],ground.heightAt(p[0],p[2]),p[2]]);if(!roadIndex.polygonClear(vertices))return false;if(['terrain','shoulder'].includes(kind)){const a=vertices[0],b=vertices[1],c=vertices[2],normalY=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(normalY<0){vertices=[vertices[0],vertices[3],vertices[2],vertices[1]];if(uv)uv=[uv[0],uv[3],uv[2],uv[1]];}}g.surface(...vertices,T[tile],uv,tint);surfaces.push({kind,vertices});if(kind==='rest-stop')ground?.register(vertices,kind);inc(kind);return true;};
 function stamp(name,p,heading=0,scale=1,kind=name){
  const model=MODELS[name],sx=Array.isArray(scale)?scale[0]:scale,sy=Array.isArray(scale)?scale[1]:scale,sz=Array.isArray(scale)?scale[2]:scale,c=Math.cos(heading),s=Math.sin(heading);
  const radius=Math.hypot(Math.max(Math.abs(model.min[0]),Math.abs(model.max[0]))*sx,Math.max(Math.abs(model.min[2]),Math.abs(model.max[2]))*sz);
  if(!place(kind,p,Math.max(.4,radius),true))return false;
  p[1]-=model.min[1]*sy;
  for(let i=0;i<model.data.length;i+=14){const a=model.data,x=a[i]*sx,z=a[i+2]*sz,nx=a[i+3]/sx,ny=a[i+4]/sy,nz=a[i+5]/sz,n=Math.hypot(nx,ny,nz)||1;g.data.push(p[0]+x*c+z*s,p[1]+a[i+1]*sy,p[2]-x*s+z*c,(nx*c+nz*s)/n,ny/n,(-nx*s+nz*c)/n,...a.slice(i+6,i+14));}
  return true;
 }
 function tree(p,height,type,rotation=0){
  const width=height*(type==='cedar'?.38:type==='pine'?.48:.55),radius=width*.5;
  if(!place('tree-'+type,p,radius))return;
  const tile=T['sprite_tree_'+type],tint=[.88+rand()*.15,.88+rand()*.15,.84+rand()*.15,0];
  for(const angle of [rotation,rotation+Math.PI/2]){const x=Math.cos(angle)*width/2,z=Math.sin(angle)*width/2;g.surface([p[0]-x,p[1],p[2]-z],[p[0]+x,p[1],p[2]+z],[p[0]+x,p[1]+height,p[2]+z],[p[0]-x,p[1]+height,p[2]-z],tile,undefined,tint);}
 }
 function house(p,heading,color){
  if(!place('house',p,6.8,true))return;
  const c=Math.cos(heading),s=Math.sin(heading),v=(x,y,z)=>[p[0]+x*c+z*s,p[1]+y,p[2]-x*s+z*c],tile=T.facade_apartment;
  g.surface(v(-4,0,-3),v(4,0,-3),v(4,5,-3),v(-4,5,-3),tile,undefined,[color,1,color,0],T.facade_apartment_night);
  g.surface(v(4,0,3),v(-4,0,3),v(-4,5,3),v(4,5,3),tile,undefined,[color,1,color,0],T.facade_apartment_night);
  for(const side of [-1,1])g.surface(v(side*4,0,-3),v(side*4,0,3),v(side*4,5,3),v(side*4,5,-3),tile,undefined,[color,1,color,0],T.facade_apartment_night);
  g.quad(v(-4.7,5,-3.7),v(0,7.1,-3.7),v(0,7.1,3.7),v(-4.7,5,3.7),'#39424b');g.quad(v(0,7.1,-3.7),v(4.7,5,-3.7),v(4.7,5,3.7),v(0,7.1,3.7),'#424f58');
  for(const z of [-3,3])g.triangle(v(-4,5,z),v(4,5,z),v(0,7,z),'#a5a39a');
 }
 function restStop(a,side,shrine=false){
  const p=point(a,side*28,-.05),vertices=[point(a,side*16,-.06),point(a,side*40,-.06),point({...a,x:a.x+Math.sin(a.heading)*24,z:a.z+Math.cos(a.heading)*24},side*40,-.06),point({...a,x:a.x+Math.sin(a.heading)*24,z:a.z+Math.cos(a.heading)*24},side*16,-.06)];
  if(!patch('rest-stop',vertices,'gravel',[[0,0],[4,0],[4,4],[0,4]]))return;
  if(shrine)stamp('torii_gate',p,a.heading,1,'shrine');else {stamp('building_shop',point(a,side*35),a.heading+(side>0?-Math.PI/2:Math.PI/2),.9,'shop');stamp('vending_machine',point({...a,x:a.x+Math.sin(a.heading)*9,z:a.z+Math.cos(a.heading)*9},side*23),a.heading,1,'vending');}
  for(let k=0;k<3;k++){const pp=point({...a,x:a.x+Math.sin(a.heading)*(k*5+4),z:a.z+Math.cos(a.heading)*(k*5+4)},side*17,.01);g.box(...pp,4,.025,.1,'#c7c7b5');}
  const bench=point({...a,x:a.x+Math.sin(a.heading)*18,z:a.z+Math.cos(a.heading)*18},side*24,.5);if(place('bench',bench,1.9,true)){g.box(...bench,3,.15,.65,'#6b5741');g.box(bench[0],bench[1]+.45,bench[2]+.3,3,.6,.12,'#6b5741');for(const dx of [-1,1])g.box(bench[0]+dx,bench[1]-.3,bench[2],.1,.6,.55,'#444f50');}
  if(!shrine){stamp('car_parked_red',point({...a,x:a.x+Math.sin(a.heading)*7,z:a.z+Math.cos(a.heading)*7},side*21),a.heading,1,'parked-car');stamp('traffic_cone',point(a,side*17),a.heading,.8,'event-cone');stamp('person_photo',point(a,side*15),a.heading,.9,'spectator');}
 }
 if(profile.tunnel){
  const start=Math.floor(track.length*profile.tunnel[0]/track.step),end=Math.floor(track.length*profile.tunnel[1]/track.step);let clear=true;
  for(let i=start;i<=end&&clear;i+=3)for(let j=0;j<(track.renderSegments??track.points.length);j++){if(j>=start-7&&j<=end+7)continue;if(Math.hypot(track.points[i].x-track.points[j].x,track.points[i].z-track.points[j].z)<25){clear=false;break;}}
  if(clear)tunnels.push({start:track.points[start].s,end:track.points[end].s,first:start,last:end,clearance:5.65});
 }
 let bridgePlan=null;
 if(track.id==='usui'){const i=Math.floor(track.length*.27/track.step),a=track.points[i];for(const lateral of [58,-58,80,-80,110,-110]){const p=point(a,lateral,-17);if(roadIndex.clear(p[0],p[2],28)){p[1]=(ground?.groundAt(p[0],p[2])??ground?.heightAt(p[0],p[2])??p[1])+4;bridgePlan={i:Math.round(a.s/8),p};reserve(p,28,['railway-bridge']);break;}}}
 const dockPlans=[];
 if(profile.lake)for(const t of [.08,.84]){const i=Math.floor(track.length*t/track.step);for(const distance of [80,96,112,128,144]){const p=point(track.points[i],-profile.uphill*distance);if(ground&&(ground.heightAt(p[0],p[2])>ground.waterHeight||ground.waterHeight===null))continue;p[1]=(ground?.waterHeight??-17.2)+.3;if(roadIndex.clear(p[0],p[2],12)){dockPlans.push({i:Math.round(track.points[i].s/8),p});reserve(p,12,['dock']);break;}}}
 for(const i of [Math.round(208/track.step),Math.floor(track.length*.6/track.step)]){const a=track.points[i];if(Math.abs(a.curve)<.006)reserve(point(a,-profile.uphill*28),17,['shrine','shop','vending','bench','parked-car','event-cone','spectator']);}
 function tunnel(a,b,i,zone){
  const radius=7.5,height=6.2;
  for(let k=0;k<12;k++){const u=k/12*Math.PI,v=(k+1)/12*Math.PI,aa=point(a,Math.cos(u)*radius,Math.sin(u)*height),ab=point(b,Math.cos(u)*radius,Math.sin(u)*height),bb=point(b,Math.cos(v)*radius,Math.sin(v)*height),ba=point(a,Math.cos(v)*radius,Math.sin(v)*height);g.surface(aa,ab,bb,ba,T.tunnel_wall,[[a.s/4,k/3],[b.s/4,k/3],[b.s/4,(k+1)/3],[a.s/4,(k+1)/3]],[.8,.83,.85,0]);}
  for(const side of [-1,1]){g.surface(point(a,side*7.1,.1),point(b,side*7.1,.1),point(b,side*7.1,.6),point(a,side*7.1,.6),T.sign_chevron,[[0,0],[2,0],[2,1],[0,1]]);if(i%3===0){g.quad(point(a,side*2.8,5.7),point(b,side*2.8,5.7),point(b,side*3.05,5.7),point(a,side*3.05,5.7),[1,.86,.57,1]);}}
  if(i%3===0)lights.push({x:a.x,y:a.y,z:a.z,power:.5,s:a.s});
  if(i===zone.first||i===zone.last){for(let k=0;k<12;k++){const u=k/12*Math.PI,v=(k+1)/12*Math.PI;g.quad(point(a,Math.cos(u)*radius,Math.sin(u)*height),point(a,Math.cos(u)*(radius+1.2),Math.sin(u)*(height+1)),point(a,Math.cos(v)*(radius+1.2),Math.sin(v)*(height+1)),point(a,Math.cos(v)*radius,Math.sin(v)*height),'#7b817a');}}
  inc('tunnel-segment');
 }
 return {profile,props,surfaces,ground,counts,tunnels,lights,step(i,a,b){
  layer('terrain');
  const t=Math.min(1,a.s/track.length),zone=environmentZone(track.id,t),city=zone==='urban',village=['village','lakeside'].includes(zone),inside=tunnels.find(z=>i>=z.first&&i<=z.last),uphill=profile.uphill;
  const landHeight=(side,distance)=>{if(city||village)return 0;const high=side===uphill,near=high?3.6+Math.sin(a.s/100)*.8:-3.5,mid=high?near+5:-3.5,far=high?18+Math.sin(a.s/120)*4:-19;if(distance<11&&high)return -.35+(distance-8)/3*(near+.35);if(distance<=30)return high?near+(distance-11)/19*(mid-near):-.35+(distance-8)/22*(mid+.35);return mid+(distance-30)/36*(far-mid);};
  layer('road');
  if(inside){tunnel(a,b,i,inside);return;}
  if(!city&&!village&&Math.floor(a.s/140)%5!==4){
   const side=uphill,height=3.6+Math.sin(a.s/100)*.8,vertices=[point(a,side*7.7,-.35),point(b,side*7.7,-.35),point(b,side*10.4,height),point(a,side*10.4,height)];
   if(patch('retaining-wall',vertices,'concrete_wall',[[a.s/4,0],[b.s/4,0],[b.s/4,1.5],[a.s/4,1.5]])){g.quad(point(a,side*10.1,height+.05),point(b,side*10.1,height+.05),point(b,side*10.7,height+.05),point(a,side*10.7,height+.05),'#7b8376');}
   if(Math.floor(a.s/180)%4===2)patch('rock-face',[point(a,side*12,height),point(b,side*12,height),point(b,side*21,height+8),point(a,side*21,height+8)],'rock_cliff',[[a.s/7,0],[b.s/7,0],[b.s/7,2],[a.s/7,2]],[.85,.9,.82,0]);
  }
  // Preserve the previous 8m decoration spacing with denser road geometry.
  if(i%Math.max(1,Math.round(8/track.step))!==0)return;
  layer('detail');
  i=Math.round(a.s/8);
  if(profile.toll&&Math.abs(a.s-track.length*profile.toll)<4.05){
   for(const side of [-1,1]){
    const p=point(a,side*9.4);
    stamp('building_shop',p,a.heading,[.44,.60,.48],'toll-booth');
    stamp('traffic_cone',point(a,side*6.55),a.heading,.95,'toll-cone');
   }
  }
  if((city||village)&&i%(city?3:6)===0){
   for(const side of [-1,1]){const p=point(a,side*(city?23+rand()*8:21+rand()*9),0),h=a.heading+(side>0?-Math.PI/2:Math.PI/2);
    if(city){const name=rand()<.45?'building_office':rand()<.5?'building_apartment':'building_shop';if(stamp(name,p,h,[.65+rand()*.25,.65+rand()*.45,.7+rand()*.2],'building')&&name==='building_shop'){const c=Math.cos(h),s=Math.sin(h),v=(x,y,z)=>[p[0]+x*c+z*s,p[1]+y,p[2]-x*s+z*c],panel=i%4/4;g.surface(v(-2.5,3.2,3.3),v(2.5,3.2,3.3),v(2.5,4.3,3.3),v(-2.5,4.3,3.3),T.neon_signs,[[panel,0],[panel+.249,0],[panel+.249,1],[panel,1]],[1,1,1,1]);}}else if(i%12===0)stamp('building_shop',p,h,.8,'shop');else house(p,h,.85+rand()*.18);
   }
  }
  if((city||village||zone==='coast')&&i%9===0){const p=point(a,-uphill*9.3);if(stamp('streetlight',p,a.heading+(uphill>0?0:Math.PI),1,'streetlight'))lights.push({x:a.x,y:a.y,z:a.z,power:.65,s:a.s});}
  if(!city&&i%12===0){const pole=point(a,-uphill*12);if(stamp('utility_pole',pole,a.heading,1,'utility-pole')){if(lastPole&&a.s-lastPole.s<140&&Math.abs(a.heading-lastPole.heading)<.5)for(const offset of [-.6,0,.6]){const aa=point(a,-uphill*12+offset,pole[1]-a.y+8.1),bb=point(lastPole,-uphill*12+offset,lastPole.land+8.1);g.quad(aa,bb,[bb[0],bb[1]+.035,bb[2]],[aa[0],aa[1]+.035,aa[2]],'#373f3d');}lastPole={...a,land:pole[1]-a.y};}}
  if(i%28===0){const p=point(a,-uphill*8.8);if(place('road-sign',p,.8,true)){g.box(p[0],p[1]+1.25,p[2],.08,2.5,.08,'#8f9998');const h=a.heading,c=Math.cos(h)*.6,s=Math.sin(h)*.6,tile=T[Math.abs(a.curve)>.005?'sign_curve_warning':city?'sign_speed_40':'sign_speed_60'];g.surface([p[0]-c,p[1]+1.7,p[2]+s],[p[0]+c,p[1]+1.7,p[2]-s],[p[0]+c,p[1]+2.9,p[2]-s],[p[0]-c,p[1]+2.9,p[2]+s],tile);}}
  if(Math.abs(a.curve)>.008&&i%6===0)stamp('sign_chevron',point(a,-Math.sign(a.curve)*9.6),a.heading+Math.PI,.85,'chevron');
  if(i===12&&city)stamp('traffic_light',point(a,10),a.heading,1,'traffic-light');
  if((i===26||i===Math.round(track.length*.6/8))&&Math.abs(a.curve)<.006)restStop(a,-uphill,i===26&&!city&&!village);
  if(bridgePlan?.i===i){const p=bridgePlan.p;if(place('railway-bridge',p,28,true)){for(const x of [-24,-8,8,24])g.box(p[0]+x,p[1]+5,p[2],3,18,5,'#946d50');g.box(p[0],p[1]+15,p[2],53,2.2,5,'#8e6a50');for(const x of [-16,0,16])for(let k=0;k<10;k++){const u=k/10*Math.PI,v=(k+1)/10*Math.PI;g.quad([p[0]+x+Math.cos(u)*6.5,p[1]+6+Math.sin(u)*6.5,p[2]-2.6],[p[0]+x+Math.cos(u)*8,p[1]+6+Math.sin(u)*8,p[2]-2.6],[p[0]+x+Math.cos(v)*8,p[1]+6+Math.sin(v)*8,p[2]-2.6],[p[0]+x+Math.cos(v)*6.5,p[1]+6+Math.sin(v)*6.5,p[2]-2.6],'#b28c69');}}}
  const dock=dockPlans.find(d=>d.i===i);if(dock&&place('dock',dock.p,12,true)){const p=dock.p;g.box(p[0],p[1],p[2],6,.3,17,'#857154');for(const dx of [-2.7,2.7])for(const dz of [-7,0,7])g.box(p[0]+dx,p[1]-1.7,p[2]+dz,.35,3.4,.35,'#5e5443');for(let n=-7;n<=7;n++)g.box(p[0],p[1]+.17,p[2]+n,6,.025,.06,'#544d3b');g.box(p[0],p[1]+1.4,p[2]+4,3.4,2.6,3,'#b9b59e');g.box(p[0],p[1]+2.8,p[2]+4,4,.2,3.6,'#3d5664');}
  if(!city&&!village&&i%48===0)stamp(i%96?'boulder_a':'boulder_b',point(a,uphill*17,landHeight(uphill,17)),a.heading,.8,'roadside-boulder');
  if(i===26)stamp('stone_lantern',point(a,-uphill*13),a.heading,1,'stone-lantern');
  if(!city&&i%160===0&&Math.abs(a.curve)<.0035){stamp('traffic_cone',point(a,-uphill*11.2),a.heading,.75,'event-cone');stamp('person_photo',point(a,-uphill*15),a.heading,.9,'spectator');}
  if(!city&&i%32===0)stamp('mile_stone',point(a,-uphill*9.2),a.heading,1,'mile-stone');
  if(!city&&i%16===0)stamp('fern_cluster',point(a,uphill*12),a.heading,1,'fern-cluster');
  layer('foliage');
  const density=city?12:village?4:zone==='orchard'?3:1;
  if(i%density===0)for(const side of [-1,1])for(let row=0;row<(city||village?1:3);row++){
   if(rand()>(profile.forest||1)*.86)continue;
   const lateral=side*(row===0?12+rand()*8:row===1?26+rand()*13:46+rand()*15),p=point(a,lateral,landHeight(side,Math.abs(lateral))-.25),height=7+rand()*9,type=rand()<.22?(profile.tree==='autumn'?'cedar':'green'):profile.tree;
   if(row===0&&i%23===0&&!city)stamp(type==='autumn'?'tree_autumn':'tree_cedar',p,rand()*Math.PI,.8+rand()*.3,'tree-mesh');else tree(p,height,type,rand()*Math.PI);
  }
  if(!city&&i%2===0)for(const side of [-1,1]){const p=point(a,side*(9.5+rand()*3),-.1);if(place('shrubs',p,1.4)){const angle=a.heading,c=Math.cos(angle)*1.4,s=Math.sin(angle)*1.4;g.surface([p[0]-c,p[1],p[2]+s],[p[0]+c,p[1],p[2]-s],[p[0]+c,p[1]+2.1,p[2]-s],[p[0]-c,p[1]+2.1,p[2]+s],T.sprite_tree_green,[[0,.36],[1,.36],[1,1],[0,1]],[.8,.9,.7,0]);}}
  if(zone==='orchard'&&i%4===0)for(const side of [-1,1])for(let row=0;row<2;row++)tree(point(a,side*(21+row*9),0),5.4,'green',a.heading);
 }};
}
