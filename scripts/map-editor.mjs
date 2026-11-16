import http from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readdir,readFile,realpath,rename,stat,writeFile,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ALL_TRACKS} from '../js/sim.mjs';
import {layoutUrl,readTrackLayout} from '../js/track-layout.mjs';
import {assetKey,ROUTE_MODEL_PACKS,CITY_MODEL_PACKS,CUSTOM_MODEL_PACK,validModelPath,sceneryAssetUrl,sceneryModelRoot,textureInsideModelRoot} from '../js/scenery-models.mjs';
import {parseMenuModel} from '../js/menu-model.mjs';

const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const address='127.0.0.1';
const port=Number(process.env.MAP_EDITOR_PORT)||4175;
const host=`${address}:${port}`;
const origin=`http://${host}`;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};

const builtInCatalog=new Map();
const modelLabel=file=>file.split('/').at(-1).replaceAll(/[_-]+/g,' ').replace(/^./,letter=>letter.toUpperCase());
async function readAsset(pack,file,label=modelLabel(file)){
 const assetUrl=sceneryAssetUrl(pack,file),folder=sceneryModelRoot(pack);
 const directory=await realpath(fileURLToPath(folder));
 const modelPath=await realpath(fileURLToPath(assetUrl));
 if(!modelPath.startsWith(directory+path.sep))throw Error('El modelo debe estar dentro de su paquete.');
 const bytes=await readFile(modelPath);
 const model=parseMenuModel(Uint8Array.from(bytes).buffer,{assetUrl,worldScale:1,preserveHeight:true});
 const bounds=model.sourceBounds;
 if(!model.triangles||![...bounds.min,...bounds.max].every(value=>Number.isFinite(value)&&Math.abs(value)<=10000))throw Error('El modelo no contiene geometría válida para el editor.');
 for(const image of model.images){
  if(!image.url||/^data:image\//i.test(image.url))continue;
  if(!textureInsideModelRoot(image.url,folder))throw Error('La textura debe estar dentro de la carpeta del paquete.');
  const location=await realpath(fileURLToPath(image.url)).catch(error=>{
   if(error.code==='ENOENT')throw Error('Falta la textura '+decodeURIComponent(new URL(image.url).pathname.split('/').at(-1))+'.');
   throw error;
  });
  if(!location.startsWith(directory+path.sep))throw Error('La textura debe estar dentro de la carpeta del paquete.');
 }
 return {key:assetKey(pack,file),pack,file,label,bounds,triangles:model.triangles};
}
async function modelFiles(pack){
 const directory=fileURLToPath(sceneryModelRoot(pack));
 const entries=await readdir(directory,{withFileTypes:true,recursive:true});
 return entries.filter(entry=>entry.isFile()&&entry.name.endsWith('.glb'))
  .map(entry=>path.relative(directory,path.join(entry.parentPath,entry.name)).split(path.sep).join('/').slice(0,-4))
  .sort((a,b)=>a.localeCompare(b,'es'));
}
for(const pack of ROUTE_MODEL_PACKS){
 const base=new URL('assets.json',sceneryModelRoot(pack));
 const {assets}=JSON.parse(await readFile(base,'utf8'));
 for(const entry of assets){
  const file=entry.file.replace(/\.glb$/,'');
  if(!validModelPath(pack,file)||/_road_|_rotor$/.test(file))continue;
  const asset=await readAsset(pack,file,entry.desc);
  builtInCatalog.set(asset.key,asset);
 }
}
for(const pack of CITY_MODEL_PACKS)for(const file of await modelFiles(pack)){
 const asset=await readAsset(pack,file);
 builtInCatalog.set(asset.key,asset);
}

const customCache=new Map();
let scanning;
async function scanCustom(){
 const assets=[],warnings=[],files=new Set(await modelFiles(CUSTOM_MODEL_PACK).catch(error=>{
  if(error.code==='ENOENT')return [];
  throw error;
 }));
 for(const file of customCache.keys())if(!files.has(file))customCache.delete(file);
 for(const file of files){
  if(!validModelPath(CUSTOM_MODEL_PACK,file)){
   warnings.push({file,message:'Usa un nombre de archivo y subcarpeta válido.'});
   continue;
  }
  try{
   const {mtimeMs,size}=await stat(sceneryAssetUrl(CUSTOM_MODEL_PACK,file)),version=`${mtimeMs}:${size}`;
   let cached=customCache.get(file);
   if(cached?.version!==version){
    cached={version,asset:await readAsset(CUSTOM_MODEL_PACK,file)};
    customCache.set(file,cached);
   }
   assets.push({...cached.asset,revision:version});
  }catch(error){warnings.push({file,message:error.message});}
 }
 return {assets,warnings};
}
function customModels(){
 scanning??=scanCustom().finally(()=>{scanning=null;});
 return scanning;
}

function json(res,status,v){res.writeHead(status,{'Content-Type':MIME['.json'],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(v));}
async function getSaved(track){
 try{
  const body=await readFile(layoutUrl(track.id),'utf8');
  return {layout:readTrackLayout(JSON.parse(body),track),revision:createHash('sha256').update(body).digest('hex')};
 }catch(error){if(error.code==='ENOENT')return {layout:null,revision:null};throw error;}
}
async function requestBody(req){
 const chunks=[];let length=0;
 for await(const chunk of req){
  length+=chunk.length;
  if(length>256*1024)throw Object.assign(Error('El archivo es demasiado grande.'),{status:413});
  chunks.push(chunk);
 }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const writes=new Map();
function writeLayout(track,expected,value){
 const operation=(writes.get(track.id)??Promise.resolve()).catch(()=>{}).then(async()=>{
  const {revision,layout:previous}=await getSaved(track);
  if(expected!==revision)throw Object.assign(Error('El archivo cambió. Recarga el trayecto antes de guardar.'),{status:409});
  const catalog=new Map(builtInCatalog);
  for(const asset of (await customModels()).assets)catalog.set(asset.key,asset);
  for(const object of previous?.objects??[]){
   const key=assetKey(object.pack,object.file);
   if(!catalog.has(key))catalog.set(key,{bounds:object.bounds});
  }
  const layout=readTrackLayout(value,track,catalog),filename=fileURLToPath(layoutUrl(track.id));
  const directory=path.dirname(filename);
  await mkdir(directory,{recursive:true});
  if(await realpath(directory)!==path.join(root,'assets','track-layouts'))throw Error('Directorio de mapas inválido.');
  const temporary=path.join(directory,`.${randomUUID()}.tmp`),body=JSON.stringify(layout,null,2)+'\n';
  try{await writeFile(temporary,body,{flag:'wx'});await rename(temporary,filename);}
  finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  return {layout,revision:createHash('sha256').update(body).digest('hex')};
 });
 writes.set(track.id,operation);
 return operation.finally(()=>{if(writes.get(track.id)===operation)writes.delete(track.id);});
}

const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==host){json(res,403,{error:'Abre el editor con su dirección local.'});return;}
  const url=new URL(req.url,origin),pathname=decodeURIComponent(url.pathname);
  if(pathname==='/api/catalog'&&req.method==='GET'){json(res,200,[...builtInCatalog.values(),...(await customModels()).assets]);return;}
  if(pathname==='/api/custom-models'&&req.method==='GET'){json(res,200,await customModels());return;}
  const id=/^\/api\/layouts\/([a-z0-9-]+)$/.exec(pathname)?.[1];
  if(id){
   const track=ALL_TRACKS.find(item=>item.id===id);
   if(!track){json(res,404,{error:'Trayecto desconocido.'});return;}
   if(req.method==='GET'){json(res,200,await getSaved(track));return;}
   if(req.method!=='PUT'||req.headers.origin!==origin||!/^application\/json\b/i.test(req.headers['content-type']||'')){json(res,403,{error:'Petición de guardado inválida.'});return;}
   const {revision,layout}=await requestBody(req);
   json(res,200,await writeLayout(track,revision,layout));return;
  }
  const relative=pathname==='/'?'editor/index.html':pathname.slice(1);
  if(!['GET','HEAD'].includes(req.method)||!['editor/','assets/','js/'].some(prefix=>relative.startsWith(prefix))||
     relative.split(/[\\/]/).some(segment=>segment.startsWith('.'))){res.writeHead(404).end();return;}
  const filename=await realpath(path.resolve(root,relative));
  const type=MIME[path.extname(filename).toLowerCase()];
  if(!filename.startsWith(root+path.sep)||!type){res.writeHead(404).end();return;}
  const {size}=await stat(filename);
  res.writeHead(200,{'Content-Type':type,'Content-Length':size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();
  else createReadStream(filename).on('error',()=>res.destroy()).pipe(res);
 }catch(error){if(res.headersSent){res.destroy();return;}json(res,error.status??(error.code==='ENOENT'?404:400),{error:error.code==='ENOENT'?'Archivo no encontrado.':error.message});}
});
server.listen(port,address,()=>console.log(`Editor de mapas · ${origin}`));
