// Plan-view references determine the path. Heights are explicitly estimated
// regional profiles because the supplied course diagrams have no height data.
const TAU=Math.PI*2;
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const mix=(a,b,t)=>a+(b-a)*t;
const angleDelta=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));

const elevationProfiles={
  akina:[[0,0],[.17,-.12],[.37,-.38],[.61,-.60],[.82,-.86],[1,-1]],
  akagi:[[0,0],[.18,-.12],[.40,-.40],[.65,-.60],[.83,-.85],[1,-1]],
  iroha:[[0,0],[.20,-.14],[.55,-.56],[.78,-.83],[1,-1]],
  tsukuba:[[0,0],[.18,-.20],[.38,-.34],[.62,-.68],[.81,-.78],[1,-1]],
  tsubaki:[[0,0],[.22,-.15],[.43,-.42],[.66,-.65],[.84,-.88],[1,-1]],
  usui:[[0,0],[.18,-.38],[.40,-1],[.60,-.70],[.82,-.20],[1,0]],
  odawara:[[0,0],[.20,.42],[.42,1],[.60,.78],[.82,.22],[1,0]],
  manazuru:[[0,0],[.20,.30],[.42,.78],[.62,1],[.84,.40],[1,0]],
  ashinoko:[[0,0],[.17,.34],[.38,1],[.61,.62],[.80,.18],[1,0]]
};

function cleanPoints(points,closed){
  if(!Array.isArray(points)||points.length<(closed?3:2))throw Error('El trazado necesita más puntos de referencia.');
  const clean=[];
  for(const point of points){
    if(!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite))throw Error('Punto de trazado inválido.');
    if(!clean.length||distance(clean.at(-1),point)>1e-6)clean.push(point.slice(0,2));
  }
  if(closed&&distance(clean[0],clean.at(-1))<1e-6)clean.pop();
  if(clean.length<(closed?3:2))throw Error('El trazado contiene puntos duplicados.');
  return clean;
}

function splinePoint(p0,p1,p2,p3,u){
  // Centripetal Catmull-Rom avoids loops and cusps within a control segment,
  // including the sharply spaced controls around the reference hairpins.
  const t0=0,t1=Math.sqrt(distance(p0,p1)),t2=t1+Math.sqrt(distance(p1,p2)),t3=t2+Math.sqrt(distance(p2,p3));
  const t=mix(t1,t2,u);
  return [0,1].map(axis=>{
    const a1=mix(p0[axis],p1[axis],(t-t0)/(t1-t0));
    const a2=mix(p1[axis],p2[axis],(t-t1)/(t2-t1));
    const a3=mix(p2[axis],p3[axis],(t-t2)/(t3-t2));
    const b1=mix(a1,a2,(t-t0)/(t2-t0)),b2=mix(a2,a3,(t-t1)/(t3-t1));
    return mix(b1,b2,(t-t1)/(t2-t1));
  });
}

function smoothReference(controls,closed,sourceStep){
  const count=controls.length,pointAt=index=>{
    if(closed)return controls[(index+count)%count];
    if(index<0)return controls[0].map((value,axis)=>2*value-controls[1][axis]);
    if(index>=count)return controls.at(-1).map((value,axis)=>2*value-controls.at(-2)[axis]);
    return controls[index];
  };
  const dense=[];
  for(let i=0;i<(closed?count:count-1);i++){
    const p0=pointAt(i-1),p1=pointAt(i),p2=pointAt(i+1),p3=pointAt(i+2);
    const samples=Math.min(512,Math.max(4,Math.ceil(distance(p1,p2)/sourceStep)));
    for(let j=0;j<samples;j++)dense.push(splinePoint(p0,p1,p2,p3,j/samples));
  }
  dense.push(closed?controls[0].slice():controls.at(-1).slice());
  return dense;
}

function heightSampler(knots,closed){
  if(knots[0]?.[0]!==0||knots.at(-1)?.[0]!==1)throw Error('El perfil de altura debe cubrir de 0 a 1.');
  for(let i=0;i<knots.length;i++){
    if(!knots[i].every(Number.isFinite)||i>0&&knots[i][0]<=knots[i-1][0])throw Error('Perfil de altura inválido.');
  }
  if(closed&&Math.abs(knots[0][1]-knots.at(-1)[1])>1e-6)throw Error('La altura del circuito debe cerrar en la salida.');
  const slopes=knots.slice(1).map((point,i)=>(point[1]-knots[i][1])/(point[0]-knots[i][0]));
  const tangent=(left,right,leftSpan,rightSpan)=>{
    if(left*right<=0)return 0;
    const a=2*rightSpan+leftSpan,b=rightSpan+2*leftSpan;
    return (a+b)/(a/left+b/right);
  };
  const tangents=knots.map((_,i)=>{
    if(i===0||i===knots.length-1){
      return closed?tangent(slopes.at(-1),slopes[0],1-knots.at(-2)[0],knots[1][0]):i===0?slopes[0]:slopes.at(-1);
    }
    return tangent(slopes[i-1],slopes[i],knots[i][0]-knots[i-1][0],knots[i+1][0]-knots[i][0]);
  });
  return fraction=>{
    const i=Math.max(0,knots.findIndex((point,index)=>index>0&&fraction<=point[0])-1);
    const a=knots[i],b=knots[i+1],span=b[0]-a[0],t=Math.max(0,Math.min(1,(fraction-a[0])/span)),t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*span*tangents[i]+(-2*t3+3*t2)*b[1]+(t3-t2)*span*tangents[i+1];
  };
}

function playableHairpins(path,step,closed,gap){
  // Tiny printed hairpins have no physical road-width scale. Widen only those
  // whose returning legs could overlap the guardrails, then redistribute metres.
  const n=path.length-1,points=path.map(p=>[p.x,p.z]),at=i=>points[closed?(i+n)%n:Math.max(0,Math.min(n,i))];
  for(let pass=0;pass<70;pass++){
    const delta=points.map(()=>[0,0]),grid=new Map(),cell=gap;
    for(let i=0;i<(closed?n:n+1);i++){
      const p=points[i],x=Math.floor(p[0]/cell),y=Math.floor(p[1]/cell);
      for(let xx=x-1;xx<=x+1;xx++)for(let yy=y-1;yy<=y+1;yy++)for(const j of grid.get(xx+','+yy)||[]){
        const along=Math.min((i-j)*step,closed?(n-i+j)*step:Infinity);if(along<24)continue;
        const q=points[j],dx=p[0]-q[0],dy=p[1]-q[1],d=Math.hypot(dx,dy);if(d<gap&&d>.01){const force=(gap-d)*.035/d;delta[i][0]+=dx*force;delta[i][1]+=dy*force;delta[j][0]-=dx*force;delta[j][1]-=dy*force;}
      }
      const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
    }
    for(let i=closed?0:1;i<n;i++){
      const a=at(i-1),b=points[i],c=at(i+1);
      delta[i][0]+=(a[0]+c[0]-2*b[0])*.13;delta[i][1]+=(a[1]+c[1]-2*b[1])*.13;
      const size=Math.hypot(...delta[i]),factor=Math.min(1,.65/(size||1));b[0]+=delta[i][0]*factor;b[1]+=delta[i][1]*factor;
    }
    if(closed)points[n]=points[0].slice();
  }
  const cumulative=[0];for(let i=1;i<=n;i++)cumulative.push(cumulative[i-1]+distance(points[i-1],points[i]));
  const total=cumulative[n],scale=n*step/total,origin=points[0];let cursor=1;
  for(let i=0;i<=n;i++){
    const wanted=i/n*total;while(cursor<n&&cumulative[cursor]<wanted)cursor++;
    const a=points[cursor-1],b=points[cursor],t=(wanted-cumulative[cursor-1])/Math.max(.0001,cumulative[cursor]-cumulative[cursor-1]);
    path[i]={x:(mix(a[0],b[0],t)-origin[0])*scale,z:(mix(a[1],b[1],t)-origin[1])*scale};
  }
}

export function buildAuthoredTrack(config,authored){
  const length=Number(authored.length??config.length),closed=authored.closed===true;
  if(!Number.isFinite(length)||length<=0)throw Error('Longitud de trazado inválida.');
  const controls=cleanPoints(authored.points,closed),requestedStep=Number(authored.step??config.geometryStep??4);
  if(!Number.isFinite(requestedStep)||requestedStep<1||requestedStep>8)throw Error('Resolución de trazado inválida.');
  const renderSegments=Math.max(2,Math.ceil(length/requestedStep)),step=length/renderSegments;
  const controlLength=controls.slice(1).reduce((sum,point,i)=>sum+distance(controls[i],point),0)+(closed?distance(controls.at(-1),controls[0]):0);
  const dense=smoothReference(controls,closed,step*controlLength/(length*3)),distances=[0];
  for(let i=1;i<dense.length;i++)distances.push(distances[i-1]+distance(dense[i-1],dense[i]));
  const sourceLength=distances.at(-1),scale=length/sourceLength,uniform=[];
  let cursor=1;
  for(let i=0;i<=renderSegments;i++){
    const wanted=i/renderSegments*sourceLength;
    while(cursor<distances.length-1&&distances[cursor]<wanted)cursor++;
    const a=dense[cursor-1],b=dense[cursor],fraction=(wanted-distances[cursor-1])/Math.max(1e-9,distances[cursor]-distances[cursor-1]);
    uniform.push({x:-(mix(a[0],b[0],fraction)-controls[0][0])*scale,z:-(mix(a[1],b[1],fraction)-controls[0][1])*scale});
  }
  uniform[0].x=0;uniform[0].z=0;
  if(closed)Object.assign(uniform[renderSegments],uniform[0]);
  if(authored.minimumLegSeparation)playableHairpins(uniform,step,closed,authored.minimumLegSeparation);
  const elevation=Number(config.elevation)||0,range=Number(authored.elevationRange??Math.min(elevation*.35,length*.035));
  const defaultKnots=elevationProfiles[config.id]||(closed?elevationProfiles.manazuru:[[0,0],[1,-1]]);
  const knots=authored.elevationProfile||defaultKnots.map(([at,height])=>[at,height*(closed?range:elevation)]);
  const height=heightSampler(knots,closed),heights=uniform.map((_,i)=>height(i/renderSegments));
  let peakGrade=0;
  for(let i=1;i<heights.length;i++)peakGrade=Math.max(peakGrade,Math.abs(heights[i]-heights[i-1])/step);
  const gradeScale=Math.min(1,.18/Math.max(.0001,peakGrade));
  const rawHeadings=uniform.map((_,i)=>{
    const previous=uniform[closed?(i+renderSegments-1)%renderSegments:Math.max(0,i-1)];
    const next=uniform[closed?(i+1)%renderSegments:Math.min(renderSegments,i+1)];
    return Math.atan2(next.x-previous.x,next.z-previous.z);
  });
  const points=[];
  for(let i=0;i<=renderSegments;i++){
    const heading=i===0?rawHeadings[i]:points[i-1].heading+angleDelta(rawHeadings[i]-points[i-1].heading);
    const previous=closed?rawHeadings[(i+renderSegments-1)%renderSegments]:rawHeadings[Math.max(0,i-1)];
    const next=closed?rawHeadings[(i+1)%renderSegments]:rawHeadings[Math.min(renderSegments,i+1)];
    const curve=angleDelta(next-previous)/(i===0||i===renderSegments?(closed?2:1)*step:2*step);
    points.push({...uniform[i],y:heights[i]*gradeScale,heading,curve,s:i*step});
  }
  const end=points[renderSegments],turn=closed?Math.round((end.heading-points[0].heading)/TAU)*TAU:0;
  const endGrade=(end.y-points[renderSegments-1].y)/step;
  for(let i=1;i<=80;i++){
    if(closed){
      const index=i%renderSegments,lap=1+Math.floor(i/renderSegments),point=points[index];
      points.push({...point,heading:point.heading+lap*turn,s:(renderSegments+i)*step});
    }else{
      points.push({x:end.x+Math.sin(end.heading)*i*step,z:end.z+Math.cos(end.heading)*i*step,y:end.y+endGrade*i*step,heading:end.heading,curve:0,s:(renderSegments+i)*step});
    }
  }
  const sectionLengths=authored.sectionLengths||[length/4,length/4,length/4,length/4];
  let sectionDistance=0;
  const sectionEnds=sectionLengths.map(value=>{sectionDistance+=value;return sectionDistance;});
  if(Math.abs(sectionDistance-length)>.01)throw Error('Los sectores deben sumar la longitud del trazado.');
  return {...config,length,closed,step,points,renderSegments,width:authored.width??config.width??10.6,sectionLengths,sectionEnds,
    geometryVersion:'reference-v1',reference:authored.reference||null,elevationSource:authored.elevationProfile?'authored estimate':'regional estimate',elevationGradeScale:gradeScale};
}

export function trackCrossings(track){
  const count=track.renderSegments??Math.min(track.points.length-1,Math.round(track.length/track.step)),buckets=new Map(),crossings=[],seen=new Set(),cell=48;
  const cross=(ax,az,bx,bz)=>ax*bz-az*bx;
  for(let i=0;i<count;i++){
    const a=track.points[i],b=track.points[i+1];
    for(let x=Math.floor(Math.min(a.x,b.x)/cell);x<=Math.floor(Math.max(a.x,b.x)/cell);x++)for(let z=Math.floor(Math.min(a.z,b.z)/cell);z<=Math.floor(Math.max(a.z,b.z)/cell);z++){
      const key=x+','+z,prior=buckets.get(key)||[];
      for(const j of prior){
        if(i-j<=2||track.closed&&count-(i-j)<=2)continue;
        const pair=j+':'+i;if(seen.has(pair))continue;seen.add(pair);
        const c=track.points[j],d=track.points[j+1],rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,denominator=cross(rx,rz,sx,sz);
        if(Math.abs(denominator)<1e-8)continue;
        const t=cross(c.x-a.x,c.z-a.z,sx,sz)/denominator,u=cross(c.x-a.x,c.z-a.z,rx,rz)/denominator;
        if(t>=-1e-6&&t<=1+1e-6&&u>=-1e-6&&u<=1+1e-6)crossings.push({s1:c.s+u*track.step,s2:a.s+t*track.step,x:a.x+t*rx,z:a.z+t*rz});
      }
      prior.push(i);buckets.set(key,prior);
    }
  }
  return crossings;
}
