// Precomputed driving plans. Traffic changes the requested lane in rival-ai;
// this module only supplies the road's solo racing line and feasible pace.
const cache=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const styles={
  Grip:{width:.97,shorten:0,corner:.84,brake:.82,acceleration:1,filter:1},
  Complete:{width:.84,shorten:.04,corner:.94,brake:.88,acceleration:.98,filter:2},
  Skiller:{width:.93,shorten:.12,corner:1.12,brake:.92,acceleration:.97,filter:2}
};
const levels=[0,.86,.90,.94,.98,1];
const speedLevels=[0,.88,.92,.96,.99,1];
const profileGrip={power:1.16,balanced:1.02,agile:.95};

function roadPoint(track,s){
 const f=clamp(s/track.step,0,track.points.length-1.001),i=Math.floor(f),t=f-i,a=track.points[i],b=track.points[i+1];
 return {x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),heading:mix(a.heading,b.heading,t),curve:mix(a.curve,b.curve,t)};
}

function racingLine(track,style){
 const n=Math.max(8,Math.ceil(track.length/8)),step=track.length/n,closed=!!track.closed;
 const center=Array.from({length:n+1},(_,i)=>roadPoint(track,i*step));
 const nx=Float64Array.from(center,p=>Math.cos(p.heading)),nz=Float64Array.from(center,p=>-Math.sin(p.heading));
 const limit=clamp((track.width||10.6)/2-1.4,.25,2.65)*style.width;
 let line=new Float64Array(n+1),next=new Float64Array(n+1);
 const index=i=>closed?(i%n+n)%n:clamp(i,0,n);
 // Minimise squared second differences in world space, projected into the
 // legal corridor. Unlike shortest-path smoothing, this spreads curvature
 // over an outside/apex/outside line rather than hugging every inside rail.
 for(let pass=0;pass<240;pass++){
  for(let i=0;i<(closed?n:n+1);i++){
   if(!closed&&(i<2||i>n-2)){next[i]=0;continue;}
   const a=index(i-2),b=index(i-1),c=index(i+1),d=index(i+2);
   const px=(4*(center[b].x+nx[b]*line[b]+center[c].x+nx[c]*line[c])-(center[a].x+nx[a]*line[a]+center[d].x+nx[d]*line[d]))/6;
   const pz=(4*(center[b].z+nz[b]*line[b]+center[c].z+nz[c]*line[c])-(center[a].z+nz[a]*line[a]+center[d].z+nz[d]*line[d]))/6;
   const projected=(px-center[i].x)*nx[i]+(pz-center[i].z)*nz[i];
   const apexBias=Math.sign(center[i].curve)*Math.min(1,Math.abs(center[i].curve)/.018)*style.shorten;
   next[i]=clamp(mix(line[i],projected+apexBias,.38),-limit,limit);
  }
  if(closed)next[n]=next[0];[line,next]=[next,line];
 }
 return {line,step,n,limit};
}

function buildRoute(track,car,rival,wet){
 const style=styles[rival.style]||styles.Complete,level=clamp(Math.round(rival.level||3),1,5);
 const coarse=racingLine(track,style),n=Math.max(8,Math.ceil(track.length/Math.min(4,track.step))),step=track.length/n;
 const line=new Float64Array(n+1),road=Array.from({length:n+1},(_,i)=>roadPoint(track,i*step));
 const at=i=>track.closed?(i%n+n)%n:clamp(i,0,n);
 for(let i=0;i<=n;i++){
  const f=i*step/coarse.step,j=Math.min(coarse.n-1,Math.floor(f));line[i]=mix(coarse.line[j],coarse.line[j+1],f-j);
 }
 // Round interpolation joins without changing the track or moving a car.
 for(let pass=0;pass<3;pass++){
  const old=line.slice();for(let i=0;i<=n;i++)line[i]=(old[at(i-2)]+4*old[at(i-1)]+6*old[i]+4*old[at(i+1)]+old[at(i+2)])/16;
  if(track.closed)line[n]=line[0];
 }
 // Project onto a bounded lane-change angle. Averaging the upper and lower
 // Lipschitz envelopes avoids bias to either side. Sweep twice around a
 // closed circuit so the finish seam obeys the same bound as any other edge.
 // Skiller already spends tyre force rotating the body. Keep the wide line,
 // but enter it progressively so a fast transition doesn't cancel the drift.
 const delta=step*(rival.style==='Skiller'?.095:.115),upper=line.slice(),lower=line.slice(),end=track.closed?n-1:n;
 const limitAt=(i,j)=>{upper[i]=Math.min(upper[i],upper[j]+delta);lower[i]=Math.max(lower[i],lower[j]-delta);};
 for(let pass=0;pass<(track.closed?2:1);pass++){
  for(let i=track.closed?0:1;i<=end;i++)limitAt(i,at(i-1));
  for(let i=track.closed?end:end-1;i>=0;i--)limitAt(i,at(i+1));
 }
 for(let i=0;i<=end;i++)line[i]=(upper[i]+lower[i])*.5;
 if(track.closed)line[n]=line[0];
 const slopes=new Float64Array(n+1),curve=new Float64Array(n+1),scale=new Float64Array(n+1),distance=new Float64Array(n+1);
 for(let i=0;i<=n;i++)slopes[i]=(line[at(i+1)]-line[at(i-1)])/((!track.closed&&(i===0||i===n))?step:2*step);
 for(let i=0;i<=n;i++){
  const a=at(i-1),b=at(i+1),k=road[i].curve,l=line[i],slope=slopes[i],span=(!track.closed&&(i===0||i===n))?step:2*step;
  const second=(slopes[b]-slopes[a])/span,curvatureRate=(road[b].curve-road[a].curve)/span;
  const forward=clamp(1-k*l,.55,1.45);scale[i]=Math.hypot(forward,slope);
  // Exact Frenet offset-curve curvature, measured per world metre, not per
  // centreline metre. It includes lane slope and changing road curvature.
  curve[i]=(k*forward*forward+forward*second+curvatureRate*l*slope+2*k*slope*slope)/(scale[i]**3);
  if(i)distance[i]=distance[i-1]+step*(scale[i-1]+scale[i])*.5;
 }
 const grip=20*car.grip*(profileGrip[car.profile]||1.02)*(wet?.96:1);
 const max=car.max*speedLevels[level]*(wet?.997:1),brake=19*(car.brakePower||1)*style.brake;
 const speed2=new Float64Array(n+1);
 for(let i=0;i<=n;i++){
  // A narrow geometry kink is traversed by suspension/tyre response rather
  // than treated as an entire hairpin. Sustained tight bends retain their peak.
  let bend=0,weight=0;
  for(let j=-style.filter;j<=style.filter;j++){
   const w=style.filter+1-Math.abs(j);bend+=Math.abs(curve[at(i+j)])*w;weight+=w;
  }
  bend/=weight;
  speed2[i]=Math.min(max*max,grip*style.corner*levels[level]/Math.max(.00001,bend));
 }
 // One coherent braking zone per approaching limit, followed by the car's
 // actual acceleration envelope. No online derivative of a moving heuristic.
 for(let i=n-1;i>=0;i--){const ds=distance[i+1]-distance[i];speed2[i]=Math.min(speed2[i],speed2[i+1]+2*brake*ds);}
 for(let i=1;i<=n;i++){
  const v=Math.sqrt(speed2[i-1]),ds=distance[i]-distance[i-1];
  const acceleration=Math.max(.4,car.accel*Math.max(.15,1-v/(car.max*1.13))*style.acceleration-.00048*v*v-.6);
  speed2[i]=Math.min(speed2[i],speed2[i-1]+2*acceleration*ds);
 }
 const acceleration=new Float64Array(n+1),phase=Array(n+1);
 for(let i=0;i<=n;i++){
  const a=Math.max(0,i-1),b=Math.min(n,i+1),ds=distance[b]-distance[a];
  acceleration[i]=(speed2[b]-speed2[a])/(2*Math.max(.01,ds));
  phase[i]=acceleration[i]<-.7?'entry':Math.abs(curve[i])>.002?acceleration[i]>.7?'exit':'apex':'straight';
 }
 return {length:track.length,closed:track.closed,step,count:n,line,lineSlope:slopes,curve,roadCurve:Float64Array.from(road,p=>p.curve),speed2,acceleration,phase,distance};
}

export function rivalRoute(track,car,rival,wet=false){
 let plans=cache.get(track);if(!plans){plans=new Map();cache.set(track,plans);}
 const key=JSON.stringify([car.id,car.profile,car.max,car.accel,car.grip,car.brakePower||1,rival.style,rival.level,!!wet]);
 let route=plans.get(key);if(!route){route=buildRoute(track,car,rival,wet);if(plans.size>=32)plans.delete(plans.keys().next().value);plans.set(key,route);}
 return route;
}

export function routeSample(route,s){
 if(route.closed)s=((s%route.length)+route.length)%route.length;
 const f=clamp(s/route.step,0,route.count),i=Math.min(route.count-1,Math.floor(f)),t=f-i;
 return {line:mix(route.line[i],route.line[i+1],t),lineSlope:mix(route.lineSlope[i],route.lineSlope[i+1],t),curve:mix(route.curve[i],route.curve[i+1],t),roadCurve:mix(route.roadCurve[i],route.roadCurve[i+1],t),speed:Math.sqrt(Math.max(0,mix(route.speed2[i],route.speed2[i+1],t))),acceleration:mix(route.acceleration[i],route.acceleration[i+1],t),phase:route.phase[t<.5?i:i+1]};
}
