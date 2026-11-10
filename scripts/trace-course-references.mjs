// Rebuild the white road centre lines from the user-supplied reference sheets.
// Input images stay local; this script never downloads map data.
import sharp from 'sharp';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
const refs=[
 ['manazuru','7663f6da-c8d9-4b06-a332-bf720a499640',3574,true,[473,215]],
 ['odawara','3ce9641c-fc0c-412c-b2fe-e669daa65b48',4420,true,[453,226]],
 ['tsukuba','c2a5a61e-4821-4b96-a5e3-3675b41c590a',6808,false,[264,55],[289,638],[1724,1680,1750,1654]],
 ['iroha','dbeb8329-1a8b-45c4-90b2-b7d11e6c2b84',5116,false,[41,467],[632,367],[1320,1332,1240,1224]],
 ['usui','997dc110-e7b4-4d21-8d5d-c1ee25c90541',3972,true,[414,393]],
 ['tsubaki','29108227-b3f2-426f-bcd9-0fa9412b4d6b',7312,false,[214,49],[120,577],[1888,1936,1840,1648]],
 ['akagi','7ca2bd52-eef1-43c0-a960-dc24bbe95c66',5804,false,[566,55],[103,616],[1550,1306,1494,1454]],
 ['akina','c4200885-8104-4f54-9e85-bfd5aa96c4ce',7552,false,[114,605],[573,130],[1680,1692,1884,2296]]
];
// The Akina sheet's printed sectors sum to 7,282m, not its 7,552m total.
// Keep the total and allocate the 270m discrepancy to the final sector.
await mkdir('assets/course-references',{recursive:true});
await mkdir('data/course-references',{recursive:true});
const results={};
for(const [id,file,length,closed,start,end,sectionLengths] of refs){
 const target=`assets/course-references/${id}.png`;
 if(process.argv[2])await copyFile(`${process.argv[2]}/codex-clipboard-${file}.png`,target);
 const {data,info:{width:w,height:h,channels:c}}=await sharp(target).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const white=new Uint8Array(w*h),seen=new Uint8Array(w*h),mask=new Uint8Array(w*h);
 for(let i=0;i<white.length;i++){const r=data[i*c],g=data[i*c+1],b=data[i*c+2];white[i]=Math.min(r,g,b)>(id==='tsukuba'?135:183)&&Math.max(r,g,b)-Math.min(r,g,b)<45?1:0;}
 const components=[];
 for(let i=0;i<white.length;i++)if(white[i]&&!seen[i]){
  const q=[i];seen[i]=1;for(let k=0;k<q.length;k++){const p=q[k],x=p%w,y=Math.floor(p/w);for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(n>=0&&white[n]&&!seen[n]){seen[n]=1;q.push(n);}}
  let green=0;for(const p of q)for(const d of [-5,5,-5*w,5*w]){const n=p+d;if(n<0||n>=white.length)continue;const r=data[n*c],g=data[n*c+1],b=data[n*c+2];if(g>r*1.12&&g>b*1.12)green++;}
  if(q.length>=4&&q.length<w*h*.08&&green/q.length>.12){components.push(q.length);for(const p of q)mask[p]=1;}
 }
 // Zhang-Suen thinning retains both large and small hairpins.
 let changed=true;
 while(changed){changed=false;for(let phase=0;phase<2;phase++){const remove=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const p=y*w+x;if(!mask[p])continue;const n=[mask[p-w],mask[p-w+1],mask[p+1],mask[p+w+1],mask[p+w],mask[p+w-1],mask[p-1],mask[p-w-1]],sum=n.reduce((a,b)=>a+b,0),edges=n.reduce((a,v,i)=>a+(!v&&n[(i+1)%8]?1:0),0);
  if(sum<2||sum>6||edges!==1)continue;
  if(phase===0?(n[0]*n[2]*n[4]||n[2]*n[4]*n[6]):(n[0]*n[2]*n[6]||n[0]*n[4]*n[6]))continue;remove.push(p);
 }if(remove.length)changed=true;for(const p of remove)mask[p]=0;}}
 const pixels=[];for(let p=0;p<mask.length;p++)if(mask[p])pixels.push([p%w,Math.floor(p/w)]);
 results[id]={length,closed,start,end,sectionLengths,pixels,width:w,height:h};
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="../../assets/course-references/${id}.png" width="${w}" height="${h}"/>${pixels.map(([x,y])=>`<rect x="${x}" y="${y}" width="1.2" height="1.2" fill="#00aaff"/>`).join('')}</svg>`;
 await writeFile(`data/course-references/${id}-trace.svg`,svg);
 console.log(id,components.sort((a,b)=>b-a).slice(0,14),'skeleton',pixels.length);
}
await writeFile('data/course-references/traces.json',JSON.stringify(results));
const tiles=[];let tileIndex=0;
for(const [id,d] of Object.entries(results)){
 const s=Math.min(400/d.width,400/d.height),ox=(400-d.width*s)/2,oy=(400-d.height*s)/2;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">${d.pixels.map(([x,y])=>`<circle cx="${x*s+ox}" cy="${y*s+oy}" r=".7" fill="blue"/>`).join('')}</svg>`;
 const input=await sharp(`assets/course-references/${id}.png`).resize(400,400,{fit:'contain',background:'#fff'}).composite([{input:Buffer.from(svg)}]).png().toBuffer();
 tiles.push({input,left:tileIndex%4*400,top:Math.floor(tileIndex/4)*400});tileIndex++;
}
await sharp({create:{width:1600,height:800,channels:3,background:'#fff'}}).composite(tiles).png().toFile('data/course-references/trace-review.png');
