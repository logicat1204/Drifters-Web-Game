// Offline-at-course-load packing. One GPU buffer, contiguous material layers,
// and independent bounds keep a distant tree from retaining an entire road tile.
export function packScene(data,spans){
 const source=data.slice(),chunks=[],nearFoliage=new Map();data.length=84;
 for(const kind of ['road','terrain','detail','foliage','foliage-far']){
  const sectors=new Map();for(const span of spans)if(span.kind===kind){const key=span.sector+':'+Math.floor((span.baseY||0)/16);if(!sectors.has(key))sectors.set(key,[]);sectors.get(key).push(span);}
  for(const [key,parts] of sectors){
   const first=data.length/14,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(const part of parts)for(let i=part.first*14;i<(part.first+part.count)*14;i+=14){for(let a=0;a<3;a++){min[a]=Math.min(min[a],source[i+a]);max[a]=Math.max(max[a],source[i+a]);}for(let a=0;a<14;a++)data.push(source[i+a]);}
   const chunk={first,count:data.length/14-first,min,max,baseY:Math.min(...parts.map(p=>p.baseY??min[1])),kind,distance:kind==='detail'?420:kind.startsWith('foliage')?620:Infinity};
   chunks.push(chunk);
   if(kind==='foliage')nearFoliage.set(key,chunk);
   if(kind==='foliage-far'&&nearFoliage.has(key))nearFoliage.get(key).farLod=chunk;
  }
 }
 return chunks;
}
export function boundsDistance(bounds,origin){let distance=0;for(let a=0;a<3;a++)distance+=Math.max(bounds.min[a]-origin[a],0,origin[a]-bounds.max[a])**2;return Math.sqrt(distance);}
export function chunkOpacity(chunk,origin,distance=boundsDistance(chunk,origin)){
 const fade=Number.isFinite(chunk.distance)?Math.max(0,Math.min(1,(chunk.distance-distance)/70)):1;
 return fade;
}
