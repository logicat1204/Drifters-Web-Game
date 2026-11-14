import {open,readdir} from 'node:fs/promises';

const source=new URL('../assets/license-backgrounds/',import.meta.url);
const filename=/^(\d{3,8})\.(webp|png)$/;

function dimensions(data,format){
  if(format==='png'&&data.length>=24&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&data.toString('ascii',12,16)==='IHDR')return [data.readUInt32BE(16),data.readUInt32BE(20)];
  if(format!=='webp'||data.length<30||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP')return [];
  const chunk=data.toString('ascii',12,16);
  if(chunk==='VP8X')return [1+data.readUIntLE(24,3),1+data.readUIntLE(27,3)];
  if(chunk==='VP8 '&&data[23]===157&&data[24]===1&&data[25]===42)return [data.readUInt16LE(26)&16383,data.readUInt16LE(28)&16383];
  if(chunk==='VP8L'&&data[20]===47){const bits=data.readUInt32LE(21);return [1+(bits&16383),1+((bits>>>14)&16383)];}
  return [];
}

export async function licenseBackgrounds(){
  let entries;
  try{entries=await readdir(source,{withFileTypes:true});}
  catch(error){if(error.code==='ENOENT')return [];throw error;}
  const images=entries.filter(entry=>entry.isFile()&&filename.test(entry.name)).sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true}));
  const backgrounds=new Map();
  for(const entry of images){
    const [,id,format]=filename.exec(entry.name);
    try{
      if(backgrounds.has(id))continue;
      const file=await open(new URL(entry.name,source));
      try{
        const {buffer,bytesRead}=await file.read({buffer:Buffer.alloc(30)});
        const [width,height]=dimensions(buffer.subarray(0,bytesRead),format);
        if(width===512&&height===512)backgrounds.set(id,{id,url:'/assets/license-backgrounds/'+entry.name});
      }finally{await file.close();}
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return [...backgrounds.values()];
}
