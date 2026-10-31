// Offline compilation of the supplied pack. No GLTF loader or new engine is
// required at runtime: repeatable textures share an atlas and props are baked.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),sharp=require(process.env.SHARP_MODULE||'sharp');
const root=new URL('../assets/touge_city_assets/',import.meta.url),out=new URL('../assets/environment/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('assets.json',root),'utf8')),names=[...manifest.textures.map(n=>n.replace('.png','')),'water'];
await mkdir(out,{recursive:true});
const layers=[];
for(let i=0;i<names.length;i++){
 const water='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#286b81"/>'+Array.from({length:32},(_,j)=>`<path d="M-30 ${j*16} Q40 ${j*16-5} 110 ${j*16} T250 ${j*16} T390 ${j*16} T530 ${j*16}" fill="none" stroke="${j%3?'#4b8b99':'#a4c3c5'}" stroke-opacity=".28" stroke-width="${j%3?2:1}"/>`).join('')+'</svg>';
 const input=await sharp(names[i]==='water'?Buffer.from(water):await readFile(new URL('textures/'+names[i]+'.png',root))).resize(240,240,{fit:'fill'}).ensureAlpha().extend({top:8,bottom:8,left:8,right:8,extendWith:'copy'}).png().toBuffer();
 layers.push({input,left:i%8*256,top:Math.floor(i/8)*256});
}
await sharp({create:{width:2048,height:2048,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(fileURLToPath(new URL('atlas.png',out)));
const texture=Object.fromEntries(names.map((n,i)=>[n,i])),models={};
for(const file of manifest.models){
 const buffer=await readFile(new URL('models/'+file,root));if(buffer.readUInt32LE(0)!==0x46546c67)throw Error('Invalid GLB '+file);
 const length=buffer.readUInt32LE(12),json=JSON.parse(buffer.subarray(20,20+length).toString()),bin=buffer.subarray(28+length);
 const accessor=id=>{const a=json.accessors[id],v=json.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size=a.componentType===5126||a.componentType===5125?4:2,read=a.componentType===5126?'readFloatLE':a.componentType===5125?'readUInt32LE':'readUInt16LE',offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count*n},(_,i)=>bin[read](offset+Math.floor(i/n)*(v.byteStride||n*size)+(i%n)*size));};
 const data=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const primitive of json.meshes[0].primitives){
  const p=accessor(primitive.attributes.POSITION),n=accessor(primitive.attributes.NORMAL),uv=accessor(primitive.attributes.TEXCOORD_0),indices=accessor(primitive.indices),mat=json.materials[primitive.material],color=mat.pbrMetallicRoughness.baseColorFactor.slice(0,3),emission=mat.emissiveFactor?.some(v=>v>.1)?1:0;
  const ti=mat.pbrMetallicRoughness.baseColorTexture?.index,uri=ti===undefined?null:json.images[json.textures[ti].source].uri,name=uri?.split('/').at(-1).replace('.png',''),day=texture[name]??-1,night=texture[name+'_night']??day;
  for(const i of indices){for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[i*3+a]);max[a]=Math.max(max[a],p[i*3+a]);}data.push(...p.slice(i*3,i*3+3),...n.slice(i*3,i*3+3),...color,emission,...uv.slice(i*2,i*2+2),day,night);}
 }
 models[file.replace('.glb','')]={min,max,data:data.map(v=>Math.round(v*100000)/100000)};
}
await writeFile(new URL('../js/scenery-assets.mjs',import.meta.url),`// Generated from assets/touge_city_assets; run npm run assets:scenery.\nexport const TEXTURES=${JSON.stringify(texture)};\nexport const SCENERY_MODELS=${JSON.stringify(models)};\n`);
console.log(`SCENERY ASSETS: ${names.length} textures, ${Object.keys(models).length} models, one 2048px atlas.`);
