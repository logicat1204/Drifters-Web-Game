import {readdir,readFile,realpath}from 'node:fs/promises';
import path from 'node:path';
import {createHash}from 'node:crypto';
import {inflateSync}from 'node:zlib';
import {COSMETICS}from '../js/avatar.mjs';
const builtins=new Set(COSMETICS.map(i=>i.id)),slots=new Set(['hair','eyes','mouth','outfit','accessory','makeup']);
function validLayerPng(bytes){
 if(bytes.length<45||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==512||bytes.readUInt32BE(20)!==640||bytes[24]!==8||![4,6].includes(bytes[25])||bytes[26]||bytes[27]||bytes[28])return false;
 const chunks=[];let offset=8,ended=false;while(offset+12<=bytes.length){const size=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);if(size>bytes.length-offset-12)return false;if(type==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+size));offset+=size+12;if(type==='IEND'){ended=true;break;}}
 if(!ended||!chunks.length)return false;const row=512*(bytes[25]===6?4:2)+1,data=inflateSync(Buffer.concat(chunks),{maxOutputLength:row*640});if(data.length!==row*640)return false;for(let y=0;y<640;y++)if(data[y*row]>4)return false;return true;
}
export class CosmeticPacks {
 constructor(root){this.root=path.resolve(root);this.directory=path.join(this.root,'assets/shop/packs');this.items=[];this.warnings=[];}
 async reload(){if(this.loading)return this.loading;this.loading=this.scan().finally(()=>this.loading=null);return this.loading;}
 async scan(){
  const items=[],warnings=[],ids=new Set(builtins);let packs;try{packs=await readdir(this.directory,{withFileTypes:true});}catch{this.warnings=[];return this.items=[];}
  for(const pack of packs.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}))){if(!pack.isDirectory()||pack.isSymbolicLink()||pack.name.startsWith('.'))continue;
   try{const folder=path.join(this.directory,pack.name),manifest=JSON.parse(await readFile(path.join(folder,'pack.json'),'utf8'));if(manifest.schemaVersion!==1||!Array.isArray(manifest.items)||manifest.items.length>200)throw Error('Manifiesto inválido');
    const realFolder=await realpath(folder);if(!realFolder.startsWith(await realpath(this.directory)+path.sep))throw Error('Carpeta inválida');const batch=[],batchIds=new Set();
    const resolve=async(relative,extension)=>{if(typeof relative!=='string'||relative.includes('\\')||relative.startsWith('/')||relative.split('/').some(s=>!s||s.startsWith('.'))||!extension.test(relative))throw Error('Ruta de recurso inválida');const absolute=await realpath(path.resolve(folder,relative));if(!absolute.startsWith(realFolder+path.sep))throw Error('Recurso fuera del paquete');return absolute;};
    for(const relative of manifest.items){const source=await resolve(relative,/\.json$/i),raw=await readFile(source),data=JSON.parse(raw),base=data.base,slot=data.slot,key=data.id?.split('.').slice(2).join('.');
     if(!['male','female'].includes(base)||!slots.has(slot)||!key||!/^[a-z0-9][a-z0-9-]{1,63}$/.test(key)||data.id!==`${base}.${slot}.${key}`||ids.has(data.id)||batchIds.has(data.id)||data.rig!==`portrait-v2-${base}`||typeof data.name!=='string'||!data.name.trim()||data.name.length>70||!Number.isInteger(data.price)||data.price<1||data.price>1000000||!['rare','legendary','common'].includes(data.rarity))throw Error('Artículo inválido o ID duplicado');
     const layerNames=slot==='hair'?['back','color','lines']:slot==='outfit'?['color','lines']:['image'],layers={};let digest=createHash('sha256').update(raw);
     const resource=async(file,png=true)=>{const rel=path.relative(folder,path.join(path.dirname(source),file||'')).split(path.sep).join('/'),absolute=await resolve(rel,png?/\.png$/i:/\.(png|webp)$/i),bytes=await readFile(absolute);if(bytes.length>2500000)throw Error('Imagen demasiado grande');
      if(png&&!validLayerPng(bytes))throw Error('Las capas deben ser PNG RGBA de 8 bits, sin entrelazar, de 512×640');digest.update(bytes);return '/'+path.relative(this.root,absolute).split(path.sep).map(encodeURIComponent).join('/');};
     for(const name of layerNames)layers[name]=await resource(data.layers?.[name]);const preview=data.preview?await resource(data.preview,false):null;
     batchIds.add(data.id);batch.push({id:data.id,key,slot,name:data.name.trim(),price:data.price,rarity:data.rarity,starter:false,bases:[base],rig:data.rig,pack:pack.name,availableForSale:data.availableForSale!==false,layers,preview,revision:digest.digest('hex').slice(0,16)});
    }
    for(const item of batch){ids.add(item.id);items.push(item);}
   }catch(error){warnings.push({pack:pack.name,error:error.message});}
  }
  this.items=items;this.warnings=warnings;return items;
 }
}
