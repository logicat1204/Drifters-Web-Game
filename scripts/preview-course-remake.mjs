import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {ALL_TRACKS,makeTrack} from '../js/sim.mjs';
const courses=ALL_TRACKS.filter(t=>t.id!=='atami'),panels=[];
for(const [index,cfg] of courses.entries()){
 const t=makeTrack(cfg),p=t.points.slice(0,t.renderSegments+1),minX=Math.min(...p.map(p=>-p.x)),maxX=Math.max(...p.map(p=>-p.x)),minY=Math.min(...p.map(p=>-p.z)),maxY=Math.max(...p.map(p=>-p.z)),scale=Math.min(345/(maxX-minX),270/(maxY-minY)),ox=200-(maxX+minX)/2*scale,oy=195-(maxY+minY)/2*scale;
 const at=p=>[ox-p.x*scale,oy-p.z*scale],path=p.map(at).map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' '),[sx,sy]=at(p[0]),[ex,ey]=at(p.at(-1));
 const markers=t.sectionEnds.slice(0,-1).map((s,i)=>{const [x,y]=at(p[Math.round(s/t.step)]);return `<circle cx="${x}" cy="${y}" r="4" fill="#1e87da"/><text x="${x+7}" y="${y-5}" font-size="11" fill="#1e87da">${i+1}</text>`;}).join('');
 panels.push(`<g transform="translate(${index%3*400} ${Math.floor(index/3)*370})"><rect x="9" y="9" width="382" height="352" rx="12" fill="#f8fafc" stroke="#d6dce3"/><text x="24" y="36" font-size="17" font-weight="700">${cfg.name}</text><polyline points="${path}" fill="none" stroke="#152031" stroke-width="3" stroke-linejoin="round"/>${markers}<circle cx="${sx}" cy="${sy}" r="5" fill="#27a56b" stroke="white"/><circle cx="${ex}" cy="${ey}" r="3" fill="#d94853"/><text x="24" y="343" font-size="12" fill="#445266">${(t.length/1000).toFixed(3)} km · ${t.closed?'CIRCUITO / 1 VUELTA':'TRAYECTO'}${cfg.id==='ashinoko'?' · SILUETA PARCIAL ESTIMADA':''}</text></g>`);
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1110" font-family="Arial,sans-serif" fill="#152031"><rect width="1200" height="1110" fill="white"/>${panels.join('')}</svg>`;
await mkdir('screenshots',{recursive:true});await mkdir('data',{recursive:true});await writeFile('data/course-remake-overview.svg',svg);await sharp(Buffer.from(svg)).png().toFile('screenshots/course-remake-overview.png');
