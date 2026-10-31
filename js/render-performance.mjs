// Presentation only. Nothing here reads or advances the authoritative simulation.
export const FRAME_BUDGET_MS=1000/60;

export class FrameMonitor {
  constructor(capacity=180){this.intervals=new Float64Array(capacity);this.work=new Float64Array(capacity);this.reset();}
  reset(){this.last=null;this.count=0;this.cursor=0;this.intervalTotal=0;this.workTotal=0;}
  record(now,workMs,stats={}){
    this.stats=stats;
    const delta=this.last===null?0:now-this.last;this.last=now;
    if(!Number.isFinite(delta)||delta<=0)return;
    const i=this.cursor;
    if(this.count===this.intervals.length){this.intervalTotal-=this.intervals[i];this.workTotal-=this.work[i];}else this.count++;
    this.intervals[i]=delta;this.work[i]=Math.max(0,workMs||0);this.intervalTotal+=delta;this.workTotal+=this.work[i];this.cursor=(i+1)%this.intervals.length;
  }
  snapshot(){
    const sorted=Array.from(this.intervals.subarray(0,this.count)).sort((a,b)=>a-b),frameMs=this.count?this.intervalTotal/this.count:0;
    return {...this.stats,samples:this.count,fps:frameMs?1000/frameMs:0,frameMs,p95Ms:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:0,cpuMs:this.count?this.workTotal/this.count:0};
  }
}

export class AdaptiveResolution {
  constructor(){this.reset();}
  reset(){this.scale=1;this.low=0;this.high=0;this.last=null;this.settle=0;}
  update(now,metrics,active=true){
    if(!active){this.last=null;this.low=0;this.high=0;return this.scale;}
    const dt=this.last===null?0:Math.min(500,Math.max(0,now-this.last));this.last=now;
    this.settle+=dt;if(this.settle<2000||metrics.samples<30)return this.scale;
    // Hysteresis: respond to sustained misses, restore quality slowly. Resolution
    // cannot solve a CPU-bound scene, so never sacrifice more than this floor.
    if(metrics.fps<55){this.low+=dt;this.high=0;}else if(metrics.fps>=58&&metrics.cpuMs<13){this.high+=dt;this.low=0;}else {this.low=0;this.high=0;}
    if(this.low>=1500){this.scale=Math.max(.65,Math.round((this.scale-.05)*100)/100);this.low=0;this.high=0;}
    if(this.high>=8000){this.scale=Math.min(1,Math.round((this.scale+.05)*100)/100);this.low=0;this.high=0;}
    return this.scale;
  }
}

// Shared logical layout keeps the GPU image and the transparent cockpit opening
// aligned at every aspect ratio and device pixel ratio.
export function mirrorLayout(w,h){
  const scale=Math.max(w/1280,h/900),W=w/scale,H=h/scale,compact=w<600,narrow=w<1000;
  const x=W*(compact?.26:narrow?.25:.17),y=compact?H*.17:36,width=W*(compact?.33:narrow?.19:.22),height=compact?width*112/384:64;
  return {scale,W,H,x,y,width,height};
}

// OpenGL clip planes from projection * view. AABB checks are conservative:
// geometry intersecting a plane or the fog boundary is always retained.
export function viewPlanes(view,projection,out=new Float32Array(24)){
  const m=new Float64Array(16);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)m[col*4+row]+=projection[k*4+row]*view[col*4+k];
  for(let axis=0;axis<3;axis++)for(let side=0;side<2;side++){
    const offset=(axis*2+side)*4,sign=side?-1:1;
    for(let j=0;j<4;j++)out[offset+j]=m[j*4+3]+sign*m[j*4+axis];
  }
  return out;
}
export function chunkVisible(bounds,planes,origin,far){
  const {min,max}=bounds;let distance2=0;
  for(let a=0;a<3;a++){const d=Math.max(min[a]-origin[a],0,origin[a]-max[a]);distance2+=d*d;}
  if(distance2>far*far)return false;
  for(let i=0;i<24;i+=4)if(planes[i]*(planes[i]>=0?max[0]:min[0])+planes[i+1]*(planes[i+1]>=0?max[1]:min[1])+planes[i+2]*(planes[i+2]>=0?max[2]:min[2])+planes[i+3]<-.001)return false;
  return true;
}
