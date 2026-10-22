import { clamp, mix } from './sim.mjs';

// Original, reference-led 2D cabin geometry composited over the actual 3D view.
// Shared dashboard families with model-specific instruments and steering wheels.
export const CABINS = {
  ae86:{name:'SPRINTER TRUENO',badge:'TOYOTA',trim:'#403c36',top:'#282925',accent:'#b7d7a0',redline:7.5,shape:'angular',wheel:'classic'},
  rx7:{name:'RX-7 TYPE R',badge:'ɛ̃fini',trim:'#202a2c',top:'#141d20',accent:'#efb26f',redline:8,shape:'curved',wheel:'rotary'},
  r32:{name:'SKYLINE GT-R',badge:'GT-R',trim:'#2c3035',top:'#181d22',accent:'#c5d7c3',redline:8,shape:'square',wheel:'gtr'},
  mr2:{name:'MR2 G-LIMITED',badge:'TOYOTA',trim:'#30343c',top:'#20232c',accent:'#bdcca5',redline:7,shape:'angular',wheel:'sport',center:'MR2'},
  s2000:{name:'S2000 / VTEC',badge:'HONDA',trim:'#25282d',top:'#161b21',accent:'#f0a34e',redline:8.5,shape:'digital',wheel:'sport',center:'H'},
  silvia:{name:'SILVIA K’S',badge:'NISSAN',trim:'#35413e',top:'#202b2b',accent:'#c6d7b5',redline:7,shape:'square',wheel:'sport',center:'SILVIA'},
  supra:{name:'SUPRA RZ',badge:'TOYOTA',trim:'#2c3034',top:'#191d21',accent:'#c6dcbd',redline:7,shape:'curved',wheel:'sport',center:'TOYOTA'}
};
function path(c,pts,fill,stroke){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function box(c,x,y,w,h,fill,r=0,stroke){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function text(c,str,x,y,size=10,color='#c4ccc1',align='left',font='Consolas,monospace'){c.fillStyle=color;c.font=`${size}px ${font}`;c.textAlign=align;c.textBaseline='middle';c.fillText(str,x,y);}
function circle(c,x,y,r,fill,stroke,width=1){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function vent(c,x,y,w,h){box(c,x,y,w,h,'#060b0c',3,'#626861');for(let i=1;i<6;i++){c.strokeStyle='#4a504a';c.lineWidth=1.5;c.beginPath();c.moveTo(x+5,y+h*i/6);c.lineTo(x+w-5,y+h*i/6);c.stroke();}box(c,x+w*.45,y+3,4,h-6,'#72766a',1);}
function roundVent(c,x,y,r){circle(c,x,y,r+3,'#273333','#626e66',2);circle(c,x,y,r,'#050b0d');c.save();c.beginPath();c.arc(x,y,r-2,0,Math.PI*2);c.clip();for(let i=-3;i<=3;i++){c.strokeStyle='#63716a';c.lineWidth=2;c.beginPath();c.moveTo(x-r,y+i*r*.24);c.lineTo(x+r,y+i*r*.24);c.stroke();}c.restore();box(c,x-2,y-r+3,4,r*2-6,'#a2ada0',1);}
function dial(c,x,y,r,value,max,label,accent,redline=Infinity,numberScale=1){
  circle(c,x,y,r+3,'#090e0e','#4c5450',2);circle(c,x,y,r,'#101919','#020606',3);
  const gradient=c.createRadialGradient(x,y,1,x,y,r);gradient.addColorStop(0,'#252e27');gradient.addColorStop(1,'#0a1011');circle(c,x,y,r,gradient);
  for(let i=0;i<=max*5;i++){const major=i%5===0,a=(-220+(i/(max*5))*260)*Math.PI/180,rr=major?r*.76:r*.86;c.strokeStyle=i/5>=redline?'#e87252':accent;c.lineWidth=major?1.7:.7;c.beginPath();c.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);c.lineTo(x+Math.cos(a)*r*.94,y+Math.sin(a)*r*.94);c.stroke();if(major)text(c,String(i/5*numberScale),x+Math.cos(a)*r*.60,y+Math.sin(a)*r*.60,r*(numberScale>1?.12:.16),accent,'center');}
  text(c,label,x,y+r*.43,r*.12,accent,'center');const angle=(-220+clamp(value/max,0,1)*260)*Math.PI/180;
  c.save();c.shadowColor='#ef8558';c.shadowBlur=5;c.strokeStyle='#ef9b68';c.lineWidth=2.3;c.beginPath();c.moveTo(x-Math.cos(angle)*r*.14,y-Math.sin(angle)*r*.14);c.lineTo(x+Math.cos(angle)*r*.78,y+Math.sin(angle)*r*.78);c.stroke();c.restore();circle(c,x,y,r*.09,'#d0c7a6');
  c.beginPath();c.arc(x-r*.12,y-r*.09,r*.72,Math.PI*1.1,Math.PI*1.65);c.strokeStyle='#d3e4d50c';c.lineWidth=r*.24;c.stroke();
}
function wheel(c,x,y,r,angle,cabin){
  c.save();c.translate(x,y);c.rotate(angle);
  // Shadow, padded leather rim and stitched inside edge.
  circle(c,2,6,r,'#00000044');circle(c,0,0,r,null,'#030709',25);circle(c,0,0,r,null,'#282e2e',18);circle(c,0,0,r-2,null,'#414744',1.5);circle(c,0,0,r-10,null,'#111818',2);
  c.save();c.setLineDash([2,5]);circle(c,0,0,r-5,null,'#84847788',.8);c.restore();
  const classic=cabin.wheel==='classic',rotary=cabin.wheel==='rotary';
  if(classic){
    for(const side of [-1,1])path(c,[[side*r*.22,-10],[side*r*.91,-22],[side*r*.93,5],[side*r*.24,26]],'#282c2b','#73786c');
    path(c,[[-23,17],[23,17],[12,r*.91],[-12,r*.91]],'#252a28','#70776b');
    for(const side of [-1,1])for(let j=0;j<3;j++)circle(c,side*(r*.43+j*13),5,4,'#080c0b','#92978b',.7);
    circle(c,0,0,31,'#272e2a','#8b8d78',2);text(c,'TRUENO',0,0,10,'#d1d3bb','center');
  }else if(rotary){
    path(c,[[-r*.94,-18],[-42,-5],[-28,35],[-r*.80,19]],'#303a3a','#59635d');path(c,[[r*.94,-18],[42,-5],[28,35],[r*.80,19]],'#303a3a','#59635d');path(c,[[-24,23],[24,23],[27,r*.9],[-27,r*.9]],'#253031','#626964');
    box(c,-46,-35,92,82,'#202a2b',24,'#48534e');text(c,'ɛ̃fini',0,0,19,'#a2b1a6','center','serif');text(c,'SRS AIRBAG',0,27,6,'#728078','center');
  }else if(cabin.wheel==='sport'){
    for(const side of [-1,1])path(c,[[side*r*.27,-15],[side*r*.93,-27],[side*r*.87,17],[side*r*.25,30]],'#30383b','#626b69');
    path(c,[[-24,25],[24,25],[18,r*.9],[-18,r*.9]],'#232d30','#626b69');box(c,-40,-30,80,73,'#232b2e',20,'#677470');
    text(c,cabin.center,0,0,cabin.center==='H'?28:11,'#c9d3cb','center');text(c,'SRS',0,24,6,'#84938b','center');
  }else{
    path(c,[[-r*.93,-22],[-40,-12],[-28,39],[-r*.80,13]],'#282f35','#59606a');path(c,[[r*.93,-22],[40,-12],[28,39],[r*.80,13]],'#282f35','#59606a');path(c,[[-27,26],[27,26],[18,r*.9],[-18,r*.9]],'#232a30','#515a62');
    box(c,-48,-35,96,87,'#222b30',11,'#626d71');text(c,'NISSAN',0,-2,10,'#c2c9c4','center');text(c,'GT',0,17,10,'#bec7bf','center');text(c,'R',0,29,11,'#d96955','center');
  }
  // A small center reference stripe also makes countersteering readable.
  if(!classic){c.strokeStyle='#d5c694';c.lineWidth=3;c.beginPath();c.moveTo(-3,-r-8);c.lineTo(-3,-r+7);c.stroke();}
  c.restore();
}

export class Cockpit {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.rotation=0;this.shift=0;this.lastGear=1;}
  draw(r,visible,dt,options={}){
    const canvas=this.canvas;canvas.classList.toggle('hidden',!visible);document.body.classList.toggle('cockpit-view',visible);if(!visible||!r)return;
    const dpr=Math.min(window.devicePixelRatio||1,1.5),w=canvas.clientWidth,h=canvas.clientHeight;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const c=this.ctx,scale=Math.max(w/1280,h/900),W=w/scale,H=h/scale;c.setTransform(dpr*scale,0,0,dpr*scale,0,0);c.clearRect(0,0,W,H);
    const cabin=CABINS[r.car.id],accent=cabin.accent,top=H*.66,cx=W*.61,gy=top+67,gr=Math.min(59,W*.055),wr=Math.min(W*.155,163),wy=H-52;
    this.rotation=mix(this.rotation,-r.steer*2.1,1-Math.exp(-dt*17));if(r.gear!==this.lastGear){this.shift=1;this.lastGear=r.gear;}this.shift=Math.max(0,this.shift-dt*5);
    // Header, glass seal and perspective pillars. Windshield remains transparent.
    const roof=c.createLinearGradient(0,0,0,32);roof.addColorStop(0,'#111719');roof.addColorStop(1,'#29302b');box(c,0,0,W,20,roof);path(c,[[0,0],[24,0],[W*.09,top+35],[0,top+75]],cabin.trim,'#626a5e');path(c,[[W-24,0],[W,0],[W,top+75],[W*.94,top+25]],cabin.trim,'#626a5e');
    c.strokeStyle='#76857555';c.lineWidth=2;c.beginPath();c.moveTo(24,0);c.lineTo(W*.09,top+30);c.moveTo(W-24,0);c.lineTo(W*.94,top+25);c.stroke();
    // A second 3D camera renders the road and cars behind the rear window.
    const compact=w<600,narrow=w<1000,mx=W*(compact?.26:narrow?.25:.17),my=compact?H*.17:36,mw=W*(compact?.33:narrow?.19:.22),mh=compact?mw*112/384:64;
    box(c,mx+mw*.48,my-22,7,25,'#161e1e');box(c,mx-5,my-5,mw+10,mh+10,'#111a1c',8,'#646e65');box(c,mx,my,mw,mh,'#080e12',5);
    if(options.mirror){c.save();c.beginPath();c.roundRect(mx,my,mw,mh,5);c.clip();c.translate(mx+mw,my);c.scale(-1,1);c.drawImage(options.mirror,0,0,mw,mh);c.restore();}
    else text(c,'REAR VIEW',mx+mw/2,my+mh/2,8,'#687974','center');
    if(!narrow)text(c,r.headlights?'◉ FAROS':'○ FAROS OFF',mx+mw+15,my+mh-6,8,r.headlights?'#acd4bc':'#c79976');
    // Dash top differs significantly between the three cars.
    const dash=c.createLinearGradient(0,top-25,0,H);dash.addColorStop(0,cabin.top);dash.addColorStop(.25,cabin.trim);dash.addColorStop(1,'#0b1114');
    if(cabin.shape==='curved'){c.beginPath();c.moveTo(0,top+12);c.bezierCurveTo(W*.25,top+26,W*.34,top+5,W*.43,top-23);c.bezierCurveTo(W*.52,top-55,W*.76,top-45,W,top+30);c.lineTo(W,H);c.lineTo(0,H);c.closePath();c.fillStyle=dash;c.fill();}
    else path(c,[[0,top+8],[W*.40,top+8],[W*.44,top-24],[W*.78,top-24],[W*.83,top+8],[W,top+15],[W,H],[0,H]],dash,'#626b5a');
    // Fine ribs and seams on the crash pad, passenger glovebox and air vents.
    c.strokeStyle='#99a3931b';for(let y=top+22;y<H;y+=5){c.beginPath();c.moveTo(0,y);c.lineTo(W,y+10);c.stroke();}
    box(c,W*.05,top+60,W*.19,90,'#1b2422',3,'#3d4940');box(c,W*.13,top+73,31,5,'#626a5b',2);text(c,cabin.name,W*.07,top+120,10,'#8c9885');
    if(cabin.shape==='curved'){roundVent(c,W*.09,top+33,22);roundVent(c,W*.90,top+35,24);}else{vent(c,W*.055,top+17,W*.14,29);vent(c,W*.86,top+20,W*.085,36);}
    if(cabin.shape==='angular'){
      box(c,cx-gr*2.4,gy-gr*1.16,gr*4.8,gr*2.1,'#090e0d',4,'#6b7163');
      dial(c,cx-gr*1.02,gy,gr,r.speed*3.6/20,12,'km/h',accent,Infinity,20);dial(c,cx+gr*1.02,gy,gr,r.rpm/1000,9,'×1000 rpm',accent,cabin.redline);
      text(c,'E ▰▰▰ F',cx+gr*2.2,gy+gr*.60,7,accent,'right');
    }else if(cabin.shape==='curved'){
      box(c,cx-gr*2.7,gy-gr*1.18,gr*5.25,gr*2.15,'#0c1315',gr*.8,'#48544c');
      dial(c,cx,gy,gr*1.07,r.rpm/1000,9,'×1000 r/min',accent,cabin.redline);dial(c,cx-gr*1.85,gy+5,gr*.72,r.speed*3.6/20,14,'km/h',accent,Infinity,20);dial(c,cx+gr*1.78,gy+5,gr*.68,5.8,10,'FUEL / TEMP',accent);
    }else if(cabin.shape==='digital'){
      box(c,cx-gr*2.55,gy-gr*.95,gr*5.1,gr*1.8,'#070d11',14,'#5b6260');
      for(let i=0;i<45;i++){const a=(-165+i*3.3)*Math.PI/180,x=cx+Math.cos(a)*gr*2.2,y=gy+gr*.8+Math.sin(a)*gr*1.4;box(c,x,y,gr*.065,gr*.19,i<r.rpm/200?(i>=42?'#ef7155':accent):'#292d26',1);}
      for(let i=0;i<=9;i++)text(c,String(i),cx-gr*2.1+i*gr*.46,gy-gr*.61,9,accent,'center');
      text(c,String(Math.round(r.speed*3.6)),cx+gr*.8,gy+gr*.25,46,accent,'center');text(c,'km/h',cx+gr*1.8,gy+gr*.5,9,accent);text(c,'VTEC · ×1000 rpm',cx-gr*2,gy+gr*.5,8,accent);
    }else{
      box(c,cx-gr*2.7,gy-gr*1.16,gr*5.35,gr*2.12,'#090e13',5,'#69737a');
      dial(c,cx-gr*.98,gy,gr,r.rpm/1000,9,'×1000 r/min',accent,cabin.redline);dial(c,cx+gr*1.05,gy,gr,r.speed*3.6/20,14,'km/h',accent,Infinity,20);text(c,r.car.id==='r32'?'ATTESA E-TS':cabin.name,cx,gy+gr*.90,7,'#b9c7ba','center');
    }
    // Center stack: rectangular AE86 HVAC, driver-facing FD console, R32 trio.
    const consoleX=W*.28,consoleW=W*.16;
    box(c,consoleX,top+18,consoleW,H-top-18,cabin.shape==='angular'?'#282b25':'#182125',cabin.shape==='curved'?17:4,'#5c655b');
    if(r.car.id==='r32'){for(let i=0;i<3;i++)dial(c,consoleX+consoleW*(.2+i*.30),top+50,consoleW*.13,[5,6,4.5][i],10,['BOOST','OIL','VOLT'][i],accent);}
    else{if(cabin.shape==='curved'){roundVent(c,consoleX+consoleW*.28,top+47,19);roundVent(c,consoleX+consoleW*.73,top+47,19);}else vent(c,consoleX+11,top+31,consoleW-22,31);box(c,consoleX+consoleW*.48,top+65,14,10,'#873e32',2);text(c,'△',consoleX+consoleW*.52,top+70,8,'#e8b29b','center');}
    box(c,consoleX+11,top+91,consoleW-22,35,'#050d0d',2,'#3d4c3f');text(c,'FM  86.0   STEREO',consoleX+20,top+103,8,accent);text(c,String(options.song||'MIDNIGHT TRANSMISSION').slice(0,22).toUpperCase(),consoleX+20,top+116,7,accent);
    if(cabin.shape==='angular'){for(let i=0;i<3;i++){box(c,consoleX+15,top+141+i*19,consoleW-30,3,'#81887a');box(c,consoleX+30+i*25,top+136+i*19,9,12,'#babca6',1);}text(c,'COOL   TEMP   HOT',consoleX+15,top+203,7,'#91a58e');}
    else{for(let i=0;i<3;i++){const xx=consoleX+consoleW*(.23+i*.27);circle(c,xx,top+159,14,'#10191b','#788478',2);c.strokeStyle=accent;c.lineWidth=2;c.beginPath();c.moveTo(xx,top+149);c.lineTo(xx,top+155);c.stroke();}text(c,'AUTO   A/C   ECON',consoleX+consoleW/2,top+187,8,accent,'center');}
    // Transmission tunnel and live gear lever, to the driver's left (JDM RHD).
    path(c,[[consoleX+18,top+220],[consoleX+consoleW-18,top+220],[consoleX+consoleW+24,H],[consoleX-20,H]],'#17201f','#485347');
    const shx=consoleX+consoleW*.54,shy=H-48;box(c,shx-32,shy-18,64,53,'#0a1011',13,'#535f55');for(let k=0;k<4;k++)box(c,shx-27+k*3,shy-11+k*5,54-k*6,30-k*3,'#27312d',6,'#465347');
    const leverOffset=this.shift*(r.gear%2?7:-7);c.strokeStyle='#c2c9b8';c.lineWidth=7;c.beginPath();c.moveTo(shx,shy+3);c.lineTo(shx+leverOffset,shy-29);c.stroke();circle(c,shx+leverOffset,shy-36,19,'#151d1c','#8c9586',2);text(c,String(r.gear),shx+leverOffset,shy-37,12,'#e5e5cf','center');
    // Column, stalks, then the articulated wheel, with no hands obscuring gauges.
    box(c,cx-30,wy-40,60,90,'#101718',15);box(c,cx-wr*.85,wy-54,wr*.62,10,'#10191a',3);box(c,cx+wr*.26,wy-54,wr*.62,10,'#10191a',3);
    wheel(c,cx,wy,wr,this.rotation,cabin);
    const badgeY=H-15;text(c,`${r.car.code} / ${r.manual?'5MT':'AT'}  ·  ${Math.round(r.speed*3.6)} KM/H`,W-22,badgeY,9,'#b4c7a0','right');
    // Tiny warning lamps and a reactive shift light, separate from the steering.
    text(c,'◀',cx-gr*2,gy+gr*.86,10,Math.sin(r.elapsed*5)>0&&r.steer>.3?'#b3de8d':'#3e5140');text(c,'▶',cx+gr*2,gy+gr*.86,10,Math.sin(r.elapsed*5)>0&&r.steer<-.3?'#b3de8d':'#3e5140');
    if(r.rpm>7400){box(c,cx-19,gy+gr*.78,38,10,'#b33e29',2);text(c,'SHIFT',cx,gy+gr*.87,7,'#fff0ca','center');}
  }
}
