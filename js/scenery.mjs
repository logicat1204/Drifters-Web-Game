// Spatial corridor shared by placement and regression tests. All heights are
// ignored deliberately: foliage must not hide a lower hairpin either.
export function createRoadIndex(track) {
  const cell=48,buckets=new Map();
  for(let i=0;i<track.points.length-1;i++){
    const a=track.points[i],b=track.points[i+1];
    for(let x=Math.floor(Math.min(a.x,b.x)/cell);x<=Math.floor(Math.max(a.x,b.x)/cell);x++)for(let z=Math.floor(Math.min(a.z,b.z)/cell);z<=Math.floor(Math.max(a.z,b.z)/cell);z++){
      const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);
    }
  }
  function distance(x,z,limit=100){
    let nearest=Infinity;const seen=new Set();
    for(let gx=Math.floor((x-limit)/cell);gx<=Math.floor((x+limit)/cell);gx++)for(let gz=Math.floor((z-limit)/cell);gz<=Math.floor((z+limit)/cell);gz++)for(const i of buckets.get(gx+','+gz)||[]){
      if(seen.has(i))continue;seen.add(i);const a=track.points[i],b=track.points[i+1],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));nearest=Math.min(nearest,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
    }
    return nearest;
  }
  return {distance,clear:(x,z,radius=0)=>distance(x,z,radius+track.width+16)>track.width/2+radius+1.8};
}
