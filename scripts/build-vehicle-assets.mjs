// Rebuilds only our original vehicle folder; never opens the exhibition model.
import {spawn} from 'node:child_process';
import {access,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseVehicleModel} from '../js/vehicle-model.mjs';
import {VEHICLE_FILES} from '../js/vehicle-catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),blender=process.env.BLENDER_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe':'blender');
if(process.platform==='win32')await access(blender);
const catalogOnly=process.argv.includes('--catalog'),ae86Only=process.argv.includes('--ae86');
for(const script of [!catalogOnly&&'build-ae86.py',!ae86Only&&'build-car-catalog.py'].filter(Boolean)){
 const status=await new Promise((resolve,reject)=>{const child=spawn(blender,['--factory-startup','-b','--python-exit-code','1','--python',fileURLToPath(new URL(script,import.meta.url)),'--',root],{cwd:root,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',resolve);});if(status!==0)throw Error('Blender no pudo construir el modelo: '+status);
}
const files=[...new Set(Object.values(VEHICLE_FILES))].filter(id=>catalogOnly?id!=='ae86':ae86Only?id==='ae86':true);
for(const id of files){const bytes=await readFile(new URL('../assets/cars/original/'+id+'.glb',import.meta.url)),model=parseVehicleModel(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));console.log('Modelo original validado:',id,bytes.byteLength,'bytes,',model.parts.map(parts=>Object.keys(parts).length).join('/'),'piezas por LOD.');}
