// Original moving vehicle assets. Geometry and GPU buffers are shared; appearance
// and animation are instance state. Physics never reads these presentation poses.
import {VEHICLE_FILES,AE86_RIG} from './vehicle-catalog.mjs';
export const VEHICLE_MODEL_URL=new URL('../assets/cars/original/ae86.glb',import.meta.url).href;
export const ORIGINAL_CARS=new Set(Object.keys(VEHICLE_FILES));
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function vehicleMultiply(a,b){const r=new Float32Array(16);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;}
function localMatrix(n){if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,...t,1];}
const srgb=x=>x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055;
const semantics={paint:-2,glass:-3,metal:-4,rubber:-5,trim:-6,rim:-7,hood:-8};
export function parseVehicleModel(buffer){
 const dv=new DataView(buffer);if(dv.byteLength<28||dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==dv.byteLength)throw Error('Modelo de vehículo inválido');
 let json,bin;for(let p=12;p<dv.byteLength;){if(p+8>dv.byteLength)throw Error('GLB incompleto');const size=dv.getUint32(p,true),type=dv.getUint32(p+4,true);p+=8;if(p+size>dv.byteLength)throw Error('GLB incompleto');if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,p,size)));if(type===0x004e4942)bin=new DataView(buffer,p,size);p+=size;}
 if(!json||!bin)throw Error('GLB sin geometría');
 const read=id=>{const a=json.accessors?.[id],b=json.bufferViews?.[a?.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a?.type],size={5121:1,5123:2,5125:4,5126:4}[a?.componentType],method={5121:'getUint8',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a?.componentType];if(!b||!size||!components||a.sparse||b.buffer!==0)throw Error('Accessor de vehículo incompatible');const data=new Float32Array(a.count*components),start=(b.byteOffset||0)+(a.byteOffset||0),stride=b.byteStride||size*components;if(start+(a.count-1)*stride+size*components>bin.byteLength)throw Error('Accessor fuera del GLB');for(let i=0;i<a.count;i++)for(let j=0;j<components;j++)data[i*components+j]=bin[method](start+i*stride+j*size,true);return data;};
 const parts=[{},{}];let triangles=0;
 const walk=(id,parent,ancestors=new Set())=>{if(ancestors.has(id))throw Error('Jerarquía circular');const node=json.nodes[id],matrix=vehicleMultiply(parent,localMatrix(node)),next=new Set(ancestors);next.add(id);
  if(node.mesh!==undefined){const {part,lod}=node.extras||{};if(!/^(body|body_hatch|body_coupe|cabin|hood|glass|glass_hatch|glass_coupe|popup_l|popup_r|wheel|spoiler_stock|spoiler_gt|vinyl_twin|vinyl_apex|lettering|badges)$/.test(part)||![0,1].includes(lod))throw Error('Pieza de vehículo sin identificar');if(parts[lod][part])throw Error('Pieza de vehículo duplicada');const values=[],pivot=[matrix[12],matrix[13],matrix[14]];
   for(const primitive of json.meshes[node.mesh].primitives){if((primitive.mode??4)!==4||primitive.extensions?.KHR_draco_mesh_compression)throw Error('Malla incompatible');const positions=read(primitive.attributes.POSITION),normals=read(primitive.attributes.NORMAL),uv=primitive.attributes.TEXCOORD_0===undefined?null:read(primitive.attributes.TEXCOORD_0),indices=primitive.indices===undefined?Array.from({length:positions.length/3},(_,i)=>i):read(primitive.indices),material=json.materials[primitive.material],name=material.name.replace(/\.\d+$/,''),color=(material.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]),emissive=['front_lamp','tail_lamp'].includes(name)?1:0,semantic=semantics[name]??-1;
    if(indices.length%3)throw Error('Triángulos incompletos');for(const i of indices){if(i<0||i*3+2>=positions.length)throw Error('Índice fuera de la malla');const p=positions.subarray(i*3,i*3+3),n=normals.subarray(i*3,i*3+3),v=[0,1,2].map(j=>matrix[j]*p[0]+matrix[4+j]*p[1]+matrix[8+j]*p[2]),normal=[0,1,2].map(j=>matrix[j]*n[0]+matrix[4+j]*n[1]+matrix[8+j]*n[2]),length=Math.hypot(...normal);if(length<1e-8)throw Error('Normal inválida');values.push(...v,...normal.map(v=>v/length),...color.slice(0,3).map(srgb),emissive,uv?.[i*2]||0,uv?.[i*2+1]||0,semantic,color[3]);}triangles+=indices.length/3;
   }
   const data=new Float32Array(values);if(!data.length||!data.every(Number.isFinite))throw Error('Geometría de vehículo inválida');parts[lod][part]={data,count:data.length/14,pivot};
  }for(const child of node.children||[])walk(child,matrix,next);
 };
 for(const id of json.scenes[json.scene||0].nodes)walk(id,identity());
 for(const lod of parts)for(const name of ['body','hood','wheel',...(lod.cabin?['cabin','glass']:['body_hatch','glass_hatch'])])if(!lod[name])throw Error('Falta una pieza del vehículo');
 // Separate door livery from plate/badge text so a purchased side graphic can
 // replace the tofu lettering without erasing the licence plates.
 for(const lod of parts)if(lod.lettering){const door=[],badges=[];for(let i=0;i<lod.lettering.data.length;i+=42){const triangle=lod.lettering.data.subarray(i,i+42);(Math.abs(triangle[0])>.8?door:badges).push(...triangle);}for(const [name,values]of [['lettering',door],['badges',badges]])lod[name]={data:new Float32Array(values),count:values.length/14,pivot:[0,0,0]};}
 const encodedRig=json.scenes[json.scene||0].extras?.vehicleRig,rig=encodedRig?JSON.parse(encodedRig):{...AE86_RIG};
 for(const key of ['track','wheelY','radius','front','rear','popupAngle'])if(!Number.isFinite(rig[key]))throw Error('Rig de vehículo inválido');
 if(rig.track<.5||rig.track>1||rig.radius<.25||rig.radius>.4||rig.front-rig.rear<2||rig.front-rig.rear>3.2)throw Error('Medidas de vehículo inválidas');
 return {parts,triangles,rig,source:json.asset};
}
const translate=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const rotateX=a=>{const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];};
const rotateY=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];};
export function vehicleWheelMatrix(root,side,front,advance,steer=0,rig=AE86_RIG){return vehicleMultiply(vehicleMultiply(vehicleMultiply(root,translate(side*rig.track,rig.wheelY,front?rig.front:rig.rear)),rotateY(front?Math.max(-1,Math.min(1,steer))*.42:0)),rotateX(advance/rig.radius));}
export function vehiclePopupMatrix(root,pivot,opening,angle=.65){return vehicleMultiply(vehicleMultiply(root,translate(...pivot)),rotateX(-Math.max(0,Math.min(1,opening))*angle));}
export class VehicleModels {
 constructor(gl){this.gl=gl;this.status='idle';this.assets=new Map();this.instances=new Map();this.draws=0;this.cacheLimit=8;this.cacheClock=0;}
 trimCache(){const ready=[...this.assets.values()].filter(a=>a.status==='ready');const oldest=ready.filter(a=>a.file!=='ae86').sort((a,b)=>a.used-b.used);while(ready.length>this.cacheLimit&&oldest.length){const asset=oldest.shift();for(const lod of asset.parts)for(const part of Object.values(lod))this.gl.deleteBuffer(part.buffer);this.assets.delete(asset.file);ready.pop();}}
 statusFor(id){const file=VEHICLE_FILES[id];return this.assets.get(file)?.status||(file==='ae86'?this.status:'idle');}
 load(id='ae86'){
  const file=VEHICLE_FILES[id];if(!file)return Promise.resolve(false);const prior=this.assets.get(file);if(prior?.promise)return prior.promise;
  const asset={status:'loading',file};this.assets.set(file,asset);if(file==='ae86')this.status='loading';
  asset.promise=(async()=>{const url=new URL('../assets/cars/original/'+file+'.glb',import.meta.url),response=await fetch(url);if(!response.ok)throw Error('No se pudo cargar el modelo: '+id);const parsed=parseVehicleModel(await response.arrayBuffer());asset.rig=parsed.rig;asset.triangles=parsed.triangles;asset.parts=parsed.parts.map(parts=>Object.fromEntries(Object.entries(parts).map(([name,part])=>{const buffer=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,part.data,this.gl.STATIC_DRAW);return [name,{buffer,count:part.count,pivot:part.pivot}];})));asset.status='ready';asset.used=++this.cacheClock;if(file==='ae86'){this.status='ready';this.parts=asset.parts;this.triangles=asset.triangles;}this.trimCache();return true;})().catch(error=>{asset.status='error';asset.error=error.message;if(file==='ae86'){this.status='error';this.error=error.message;}return false;});
  return asset.promise;
 }
 draw(renderer,key,spec,model,pose,alpha){
  const gl=this.gl,u=renderer.uniforms,build=spec.build||{},now=renderer.time||0,headlights=pose.headlights!==false,previous=this.instances.get(key),distance=Math.hypot(model[12]-renderer.eye[0],model[13]-renderer.eye[1],model[14]-renderer.eye[2]);
  const file=VEHICLE_FILES[spec.id],asset=this.assets.get(file)||{parts:this.parts,rig:AE86_RIG},rig=asset.rig;asset.used=++this.cacheClock;
  const state=previous?.file===file?previous:{file,opening:headlights?1:0,lod:distance>70?1:0,at:now};state.opening+=(Number(headlights)-state.opening)*(1-Math.exp(-Math.min(.1,Math.max(0,now-state.at))*15));state.at=now;if(distance>78)state.lod=1;else if(distance<62)state.lod=0;this.instances.set(key,state);
  const parts=asset.parts[state.lod],variant=spec.id==='ae86coupe'?'coupe':'hatch',paint=[1,3,5].map(i=>parseInt(spec.color.slice(i,i+2),16)/255),rim=build.wheels==='gold'?[.72,.52,.22]:build.wheels==='black'?[.09,.11,.14]:[.23,.25,.28];
  const depthWrite=alpha>=1;gl.depthMask(depthWrite);gl.uniform1f(u.uVehicle,1);gl.uniform3fv(u.uVehiclePaint,paint);gl.uniform3fv(u.uWheelColor,rim);gl.uniform1f(u.uCarbon,spec.id==='ae86carbon'||build.hood==='carbon'?1:0);
  const draw=(name,m=model)=>{if(parts[name])renderer.draw(parts[name],m,alpha);};
  draw('body');draw(parts.cabin?'cabin':'body_'+variant);draw('hood');if(state.lod===0){draw('badges');if(variant==='hatch'&&build.vinyl!=='apex')draw('lettering');}
  draw(build.spoiler==='gt'?'spoiler_gt':'spoiler_stock');if(build.vinyl==='twin')draw('vinyl_twin');if(build.vinyl==='apex')draw('vinyl_apex');
  for(const side of [-1,1])for(const front of [true,false])draw('wheel',vehicleWheelMatrix(model,side,front,pose.s||0,pose.steer||0,rig));
  for(const name of ['popup_l','popup_r'])if(parts[name])draw(name,vehiclePopupMatrix(model,parts[name].pivot,state.opening,rig.popupAngle));
  gl.depthMask(false);draw(parts.glass?'glass':'glass_'+variant);gl.depthMask(depthWrite);gl.uniform1f(u.uVehicle,0);this.draws++;
 }
 forget(key){this.instances.delete(key);}
}
