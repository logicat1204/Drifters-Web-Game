export const ROUTE_MODEL_PACKS=[1,2,3];
export const CITY_MODEL_PACKS=['city-1','city-2','city-3','city-4','city-5'];
export const CUSTOM_MODEL_PACK='custom';
export const routeModelPath=/^[a-z0-9_-]+\/[a-z0-9_-]+$/;
export const assetKey=(pack,file)=>`${pack}:${file}`;
export const placementModelKey=({pack,file,portal})=>assetKey(pack,file)+(portal?':portal':'');

export function validModelPath(pack,file){
 if(typeof file!=='string'||file.length===0||file.length>240)return false;
 if(ROUTE_MODEL_PACKS.includes(pack))return routeModelPath.test(file);
 if(CITY_MODEL_PACKS.includes(pack))return /^models\/[a-z0-9_-]+$/.test(file);
 return pack===CUSTOM_MODEL_PACK&&file.split('/').every(part=>
  !!part&&!part.startsWith('.')&&!/[\\<>:"|?*%#\u0000-\u001f]/.test(part)&&!/\s$|\.$/.test(part)
 );
}

export function sceneryModelRoot(pack){
 let directory;
 if(ROUTE_MODEL_PACKS.includes(pack))directory='routes_part'+pack;
 else if(CITY_MODEL_PACKS.includes(pack))directory=pack==='city-1'?'touge_city_assets':'touge_city_assets_part'+pack.at(-1);
 else if(pack===CUSTOM_MODEL_PACK)directory='editor-models';
 else throw Error('Paquete de escenario inválido.');
 return new URL(`../assets/${directory}/`,import.meta.url);
}

export function sceneryAssetUrl(pack,file){
 if(!validModelPath(pack,file))throw Error('Nombre de modelo inválido.');
 return new URL(file.split('/').map(part=>encodeURIComponent(part)).join('/')+'.glb',sceneryModelRoot(pack));
}

export function textureInsideModelRoot(value,root){
 if(/^data:image\//i.test(value))return true;
 const url=new URL(value);
 return url.protocol===root.protocol&&url.host===root.host&&url.pathname.startsWith(root.pathname);
}
