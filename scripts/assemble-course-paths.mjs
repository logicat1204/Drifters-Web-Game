import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const traces=JSON.parse(await readFile('data/course-references/traces.json'));
const courses={};
for(const [id,d] of Object.entries(traces)){
 const pts=d.pixels,byXY=new Map(pts.map(([x,y],i)=>[x+','+y,i])),adj=pts.map(()=>new Set());
 pts.forEach(([x,y],i)=>{for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const n=byXY.get((x+dx)+','+(y+dy));if(n!==undefined)adj[i].add(n);}});
 const dist=(a,b)=>Math.hypot(pts[a][0]-pts[b][0],pts[a][1]-pts[b][1]);
 const components=()=>{const group=new Int32Array(pts.length).fill(-1),all=[];for(let i=0;i<pts.length;i++)if(group[i]<0){const q=[i],index=all.length;group[i]=index;for(let k=0;k<q.length;k++)for(const n of adj[q[k]])if(group[n]<0){group[n]=index;q.push(n);}all.push(q);}return {group,all};};
 // Only join gaps cut by the red start/checkpoint markers, never parallel legs.
 for(let pass=0;pass<20;pass++){
  const {group}=components(),ends=adj.map((a,i)=>a.size===1?i:-1).filter(i=>i>=0),options=[];
  const outward=i=>{const q=[i],seen=new Set(q);for(let k=0;k<q.length&&q.length<7;k++)for(const n of adj[q[k]])if(!seen.has(n)){seen.add(n);q.push(n);}const p=pts[q.at(-1)],v=[pts[i][0]-p[0],pts[i][1]-p[1]],l=Math.hypot(...v)||1;return v.map(v=>v/l);};
  for(let a=0;a<ends.length;a++)for(let b=a+1;b<ends.length;b++){const i=ends[a],j=ends[b],distance=dist(i,j);if(group[i]===group[j]||distance>(id==='tsukuba'?23:18))continue;const u=outward(i),v=outward(j),dx=(pts[j][0]-pts[i][0])/distance,dy=(pts[j][1]-pts[i][1])/distance;if(u[0]*dx+u[1]*dy>.25&&v[0]*dx+v[1]*dy<-.25)options.push({i,j,distance});}
  options.sort((a,b)=>a.distance-b.distance);if(!options.length)break;
  const {i,j}=options[0];adj[i].add(j);adj[j].add(i);
 }
 const nearest=([x,y],indices=pts.map((_,i)=>i))=>indices.reduce((best,i)=>Math.hypot(pts[i][0]-x,pts[i][1]-y)<Math.hypot(pts[best][0]-x,pts[best][1]-y)?i:best,indices[0]);
 // The leader at Tsukuba's second checkpoint covers 21 pixels of the ribbon.
 if(id==='tsukuba'){const a=nearest([385,315]),b=nearest([401,328]);adj[a].add(b);adj[b].add(a);}
 const {all}=components(),main=all.reduce((a,b)=>a.length>b.length?a:b),keep=new Set(main);
 let start=nearest(d.start,main),end=d.end?nearest(d.end,main):null;
 if(d.closed){
  // Red start dots cut the closed ribbon into a single long chain.
  const ends=main.filter(i=>adj[i].size===1).sort((a,b)=>Math.hypot(pts[a][0]-d.start[0],pts[a][1]-d.start[1])-Math.hypot(pts[b][0]-d.start[0],pts[b][1]-d.start[1]));
  if(ends.length>=2&&dist(ends[0],ends[1])<22){start=ends[0];end=ends[1];}
  else{const n=[...adj[start]][0];adj[start].delete(n);adj[n].delete(start);end=n;}
 }
 // Dijkstra selects the road through small pixel-level junctions. Guide points
 // can be added if a sheet contains an illustrated optional branch.
 const route=(from,to)=>{const costs=new Float64Array(pts.length).fill(Infinity),prev=new Int32Array(pts.length).fill(-1),open=new Set([from]);costs[from]=0;while(open.size){let i=-1;for(const n of open)if(i<0||costs[n]<costs[i])i=n;open.delete(i);if(i===to)break;for(const n of adj[i])if(keep.has(n)){const cost=costs[i]+dist(i,n);if(cost<costs[n]){costs[n]=cost;prev[n]=i;open.add(n);}}}if(!Number.isFinite(costs[to]))throw Error(id+': referencia desconectada');const result=[];for(let n=to;n>=0;n=prev[n])result.unshift(n);return result;};
 const path=route(start,end),smooth=path.map((_,k)=>{
  let x=0,y=0,weight=0;for(let off=(id==='iroha'?-12:-5);off<=(id==='iroha'?12:5);off++){const i=Math.max(0,Math.min(path.length-1,k+off)),p=pts[path[i]],w=Math.exp(-off*off/(id==='iroha'?40:8));x+=p[0]*w;y+=p[1]*w;weight+=w;}return [x/weight,y/weight];
 });
 const simplify=(p)=>{if(p.length<3)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;let worst=.65,index=0;for(let i=1;i<p.length-1;i++){const t=Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dy)/(len||1))),e=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dy);if(e>worst){worst=e;index=i;}}return index?[...simplify(p.slice(0,index+1)).slice(0,-1),...simplify(p.slice(index))]:[a,b];};
 const points=simplify(smooth).map(p=>p.map(v=>Math.round(v*100)/100));
 points[0]=d.start;points[points.length-1]=d.closed?points.at(-1):d.end;
 // Circuit direction follows the first long outbound limb in the sheet.
 if(d.closed&&points[1][1]>points[0][1])points.reverse();
 courses[id]={length:d.length,closed:d.closed,points,...(id==='iroha'?{minimumLegSeparation:22}:{}),...(d.sectionLengths?{sectionLengths:d.sectionLengths}:{}),reference:{image:`assets/course-references/${id}.png`,method:'white-road trace',estimatedElevation:true}};
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}"><polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#00aaff" stroke-width="3"/>${points.filter((_,i)=>i%10===0).map(([x,y],i)=>`<text x="${x}" y="${y}" font-size="9" fill="red">${i*10}</text>`).join('')}</svg>`;
 await sharp(`assets/course-references/${id}.png`).composite([{input:Buffer.from(svg)}]).png().toFile(`data/course-references/${id}-route.png`);
 console.log(id,'components',all.map(a=>a.length).sort((a,b)=>b-a).slice(0,8),'route',path.length,'controls',points.length,'endpoints',pts[start],pts[end]);
}
await writeFile('js/authored-courses.mjs','// Traced from supplied course diagrams; elevations are estimates.\nexport const AUTHORED_COURSES='+JSON.stringify(courses,null,0)+';\n');

