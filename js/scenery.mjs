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
  function polygonClear(vertices,margin=.15){
    let turn=0;for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],c=vertices[(i+2)%vertices.length],cross=(b[0]-a[0])*(c[2]-b[2])-(b[2]-a[2])*(c[0]-b[0]);if(Math.abs(cross)<.00001)continue;const sign=Math.sign(cross);if(turn&&sign!==turn)return false;turn=sign;}
    const gap=track.width/2+margin,minX=Math.min(...vertices.map(p=>p[0]))-gap,maxX=Math.max(...vertices.map(p=>p[0]))+gap,minZ=Math.min(...vertices.map(p=>p[2]))-gap,maxZ=Math.max(...vertices.map(p=>p[2]))+gap,seen=new Set();
    const pointDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[2]-t*dz);};
    const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
    for(let x=Math.floor(minX/cell);x<=Math.floor(maxX/cell);x++)for(let z=Math.floor(minZ/cell);z<=Math.floor(maxZ/cell);z++)for(const i of buckets.get(x+','+z)||[]){
      if(seen.has(i))continue;seen.add(i);const a=[track.points[i].x,0,track.points[i].z],b=[track.points[i+1].x,0,track.points[i+1].z];
      let inside=false;for(let j=0,k=vertices.length-1;j<vertices.length;k=j++){const p=vertices[j],q=vertices[k];if((p[2]>a[2])!==(q[2]>a[2])&&a[0]<(q[0]-p[0])*(a[2]-p[2])/(q[2]-p[2])+p[0])inside=!inside;}if(inside)return false;
      for(let j=0;j<vertices.length;j++){const p=vertices[j],q=vertices[(j+1)%vertices.length];if(cross(a,b,p)*cross(a,b,q)<0&&cross(p,q,a)*cross(p,q,b)<0)return false;if(Math.min(pointDistance(a[0],a[2],p,q),pointDistance(b[0],b[2],p,q),pointDistance(p[0],p[2],a,b),pointDistance(q[0],q[2],a,b))<gap)return false;}
    }
    return true;
  }
  return {distance,polygonClear,clear:(x,z,radius=0)=>distance(x,z,radius+track.width+16)>track.width/2+radius+1.8};
}
