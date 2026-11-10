// Selected untextured props and horizon meshes: baked once, no runtime loader.
import {readFile,writeFile} from 'node:fs/promises';
const models={};
for(const name of ['traffic_cone','tire_stack','car_parked_red','person_photo']){
 const b=await readFile(new URL(`../assets/touge_city_assets_part3/models/${name}.glb`,import.meta.url)),size=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+size)),bin=b.subarray(28+size);
 const read=id=>{const a=j.accessors[id],v=j.bufferViews[a.bufferView],n={VEC3:3,VEC2:2,SCALAR:1}[a.type],bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],method={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType];return Array.from({length:a.count*n},(_,i)=>bin[method]((v.byteOffset||0)+(a.byteOffset||0)+Math.floor(i/n)*(v.byteStride||n*bytes)+i%n*bytes));};
 const data=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const primitive of j.meshes[0].primitives){const p=read(primitive.attributes.POSITION),normal=read(primitive.attributes.NORMAL),indices=primitive.indices===undefined?Array.from({length:p.length/3},(_,i)=>i):read(primitive.indices),mat=j.materials[primitive.material],color=mat.pbrMetallicRoughness.baseColorFactor;
  if(mat.pbrMetallicRoughness.baseColorTexture)throw Error('This compiler accepts untextured assets only: '+name);
  for(const index of indices){const xyz=p.slice(index*3,index*3+3);for(let a=0;a<3;a++){min[a]=Math.min(min[a],xyz[a]);max[a]=Math.max(max[a],xyz[a]);}data.push(...xyz,...normal.slice(index*3,index*3+3),...color.slice(0,3),0,0,0,-1,-1);}
 }
 models[name]={min,max,data:data.map(n=>Math.round(n*100000)/100000)};
}
await writeFile(new URL('../js/scenery-part3.mjs',import.meta.url),'// Generated with node scripts/build-scenery-part3.mjs\nexport const PART3_MODELS='+JSON.stringify(models)+';\n');
console.log('Part 3: '+Object.keys(models).length+' baked models.');
