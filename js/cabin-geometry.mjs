// Original cockpit meshes, in metres. +X is the driver's right, -Z is forward.
// Families share construction tools, while every car has explicit dimensions,
// driving side, dashboard layout, instruments, trim and wheel configuration.
const rows=[
 ['ae86','classic',.36,1.13,1.64,'#423c34','#b3d4a3',3,'analog'],
 ['ae86carbon','classic',.36,1.13,1.64,'#292a2c','#dae6db',3,'race'],
 ['ae86coupe','classic',.36,1.12,1.64,'#423a34','#c8d5b2',2,'analog'],
 ['rx7','rotary',.35,1.08,1.72,'#252c30','#efb279',3,'center'],
 ['rx7amemiya','rotary',.35,1.06,1.72,'#1e252c','#eee0ab',3,'race'],
 ['r32','skyline',.37,1.16,1.76,'#303137','#b7d5bd',4,'analog'],
 ['r34','skyline',.37,1.15,1.80,'#272d35','#f5dfc6',3,'center'],
 ['mr2','midship',.34,1.08,1.66,'#303439','#c2d8b4',3,'analog'],
 ['s2000','roadster',.34,1.09,1.68,'#292d34','#f2a450',3,'digital'],
 ['silvia','nissan',.35,1.12,1.70,'#35413f','#bed5b3',3,'analog'],
 ['180sx','nissan',.35,1.11,1.70,'#343a3c','#c9d8bf',3,'analog'],
 ['sileighty','nissan',.35,1.10,1.70,'#282f37','#b7cbd7',3,'analog'],
 ['s14','nissan',.36,1.13,1.74,'#303239','#d4d8bf',4,'center'],
 ['supra','touring',.37,1.10,1.79,'#2e3036','#d9ddbd',3,'center'],
 ['evo3','rally',.36,1.20,1.70,'#303239','#d6dcd2',3,'analog'],
 ['alfa4c','exotic',-.34,1.03,1.78,'#272b30','#eab5a1',2,'digital'],
 ['exige','lightweight',-.32,1.00,1.69,'#303238','#e9e4c3',3,'center'],
 ['gt3rs','porsche',-.36,1.08,1.82,'#2c3037','#dce7e9',3,'five'],
 ['r8','audi',-.36,1.08,1.84,'#252c34','#dce9ee',3,'virtual'],
 ['civic','honda',.37,1.22,1.79,'#30343b','#f1c7c5',3,'digital'],
 ['ferrari488','ferrari',-.35,1.04,1.82,'#302b2c','#f3d667',3,'center'],
 ['grsupra','modern',.36,1.10,1.82,'#2c3038','#e6e9e7',3,'virtual'],
 ['a110','alpine',-.34,1.06,1.73,'#2b343d','#a5d4e8',3,'digital'],
 ['cayman','porsche',-.35,1.09,1.78,'#303238','#e1e4dd',3,'center'],
 ['gt86','modern',.35,1.12,1.72,'#2d3036','#e9d4ca',3,'center']
];
export const CABIN_PROFILES=Object.freeze(Object.fromEntries(rows.map(([id,family,seat,height,width,trim,accent,spokes,instruments],i)=>[id,Object.freeze({id,family,seat,height,width,trim,accent,spokes,instruments,yOffset:height-1.13,depth:.97+(i%4)*.025,wheelRadius:id==='exige'?.17:.188,open:id==='s2000',sport:['ae86carbon','rx7amemiya','gt3rs','exige'].includes(id),roundVents:['rotary','exotic','lightweight','alpine','audi','midship'].includes(family)})])));
export const cabinProfile=id=>CABIN_PROFILES[id]||CABIN_PROFILES.ae86;
const rgb=c=>typeof c==='string'?[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255):c;
const normal=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;return n.map(v=>v/l);};
export class CabinMesh {
 constructor(){this.data=[];}
 tri(a,b,c,color,uv=null,kind=0,emission=0){const n=normal(a,b,c),col=rgb(color);[a,b,c].forEach((p,i)=>this.data.push(...p,...n,...col,emission,...(uv?.[i]||[0,0]),kind,0));}
 quad(a,b,c,d,color,uv=null,kind=0,emission=0){this.tri(a,b,c,color,uv?[uv[0],uv[1],uv[2]]:null,kind,emission);this.tri(a,c,d,color,uv?[uv[0],uv[2],uv[3]]:null,kind,emission);}
 box(x,y,z,w,h,d,c){const a=x-w/2,b=x+w/2,e=y-h/2,f=y+h/2,g=z-d/2,j=z+d/2;this.quad([a,e,j],[b,e,j],[b,f,j],[a,f,j],c);this.quad([b,e,g],[a,e,g],[a,f,g],[b,f,g],c);this.quad([a,f,j],[b,f,j],[b,f,g],[a,f,g],c);this.quad([a,e,g],[b,e,g],[b,e,j],[a,e,j],c);this.quad([a,e,g],[a,e,j],[a,f,j],[a,f,g],c);this.quad([b,e,j],[b,e,g],[b,f,g],[b,f,j],c);}
 bevel(x,y,z,w,h,d,r,c){r=Math.min(r,w/3,h/3,d/3);const outline=(inset,depth)=>{const a=w/2-inset,b=h/2-inset,k=Math.max(.001,r-inset);return [[-a+k,-b],[a-k,-b],[a,-b+k],[a,b-k],[a-k,b],[-a+k,b],[-a,b-k],[-a,-b+k]].map(([u,v])=>[x+u,y+v,z+depth]);},rings=[outline(r,d/2),outline(0,d/2-r),outline(0,-d/2+r),outline(r,-d/2)];for(let i=0;i<3;i++)for(let j=0;j<8;j++)this.quad(rings[i][j],rings[i][(j+1)%8],rings[i+1][(j+1)%8],rings[i+1][j],c);for(const [i,sign]of [[0,1],[3,-1]])for(let j=1;j<7;j++)sign>0?this.tri(rings[i][0],rings[i][j],rings[i][j+1],c):this.tri(rings[i][0],rings[i][j+1],rings[i][j],c);}
 beam(a,b,r,c,sides=8){const d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d)||1,n=d.map(v=>v/l),up=Math.abs(n[1])>.9?[1,0,0]:[0,1,0],cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],u=cross(n,up),ul=Math.hypot(...u),v=cross(n,u.map(v=>v/ul)),point=(p,t)=>p.map((x,i)=>x+r*(Math.cos(t)*u[i]/ul+Math.sin(t)*v[i]));for(let i=0;i<sides;i++){const t=i/sides*Math.PI*2,k=(i+1)/sides*Math.PI*2;this.quad(point(a,t),point(a,k),point(b,k),point(b,t),c);this.tri(a,point(a,k),point(a,t),c);this.tri(b,point(b,t),point(b,k),c);}}
 ring(x,y,z,r,t,c,segments=48,flat=false){for(let i=0;i<segments;i++)for(let j=0;j<8;j++){const p=(a,b)=>[x+Math.cos(a)*(r+Math.cos(b)*t),y+(flat?Math.max(-r*.78,Math.sin(a)*r):Math.sin(a)*r)+Math.sin(a)*Math.cos(b)*t,z+Math.sin(b)*t],a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,u=j/8*Math.PI*2,v=(j+1)/8*Math.PI*2;this.quad(p(a,u),p(b,u),p(b,v),p(a,v),c);}}
 panel(x,y,z,w,h,uv,kind=1){this.quad([x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z],'#ffffff',[[uv[0],uv[3]],[uv[2],uv[3]],[uv[2],uv[1]],[uv[0],uv[1]]],kind,kind===1?.65:0);}
 finish(){return new Float32Array(this.data);}
}
export function buildCabin(p){
 const g=new CabinMesh(),half=p.width/2,x=p.seat,d=p.depth,classic=p.family==='classic',curved=['rotary','touring','exotic','ferrari','alpine'].includes(p.family),dark='#11151b',edge='#44484a';
 // Dashboard is a genuine volume, with an angled crash pad and lower fascia.
 const z=-d,top=.82;
 g.bevel(0,.65,z+.04,p.width,.25,.35,.035,p.trim);g.quad([-half,top,z+.22],[half,top,z+.22],[half,.77,z-.36],[-half,.77,z-.36],p.trim);
 g.box(0,.49,z+.04,p.width-.04,.12,.27,dark);
 // Recess the binnacle into the dash, below the driving sightline.
 g.bevel(x,.74,z+.14,.60,.285,.19,.028,dark);g.panel(x,.805,z+.238,.54,.135,[0,0,1,.5]);
 g.bevel(x,.89,z+.17,.61,.035,.19,.010,p.trim);
 if(curved){for(let i=0;i<9;i++){const t=i/8,a=x-.29+t*.58;g.bevel(a,.875+Math.sin(t*Math.PI)*.022,z+.17,.075,.028,.19,.008,p.trim);}}
 // Passenger glovebox seam, pull handle and sculpted door cards.
 const passenger=-Math.sign(x)*.46;g.box(passenger,.66,z+.224,.41,.008,.009,edge);g.box(passenger,.64,z+.232,.065,.014,.013,'#6c7072');
 for(const side of [-1,1]){g.box(side*(half-.015),.63,-.04,.055,.36,1.55,p.trim);g.box(side*(half-.05),.77,-.08,.07,.05,1.43,dark);g.box(side*(half-.08),.64,-.12,.06,.045,.24,edge);g.box(side*(half-.08),.72,-.03,.025,.012,.09,'#a1a5a4');
  if(!p.open)g.beam([side*(half-.03),.78,-1.25],[side*(half-.15),1.50,-.60],.027,dark,12);
 }
 if(!p.open){g.box(0,1.50,-.6,p.width-.23,.075,.19,dark);g.box(0,1.55,.12,p.width,.07,1.40,'#24272b');}
 // HVAC and stereo are textured onto a recessed, model-specific centre stack.
 const center=p.family==='touring'?-Math.sign(x)*.04:0;
 g.bevel(center,.62,z+.28,.29,.36,.12,.018,dark);g.panel(center,.62,z+.345,.255,.31,[0,.5,.5,1]);
 if(p.id==='r32'){for(let i=0;i<3;i++){g.ring(-.085+i*.085,.85,z+.24,.034,.004,edge,16);g.box(-.085+i*.085,.85,z+.24,.002,.037,.002,'#db9b6b');}}
 if(p.id==='r34'){g.bevel(0,.87,z+.24,.24,.11,.025,.006,dark);g.panel(0,.87,z+.257,.215,.08,[.5,.87,1,1]);}
 for(const xx of [-half+.13,half-.13,...(p.family==='roadster'?[]:[-.08,.08])]){
  if(p.roundVents){g.ring(xx,.82,z+.25,.047,.008,edge,20);g.box(xx,.82,z+.24,.08,.075,.02,dark);for(let j=-2;j<=2;j++)g.box(xx,.82+j*.013,z+.26,.078,.003,.007,'#5b6266');}
  else{g.box(xx,.80,z+.254,.14,.055,.018,dark);for(let j=-2;j<=2;j++)g.box(xx,.80+j*.008,z+.27,.128,.002,.009,edge);}
 }
 // Gear tunnel, boots, handbrake and a labelled badge in the passenger fascia.
 g.box(center,.39,-.17,.25,.19,.94,dark);g.box(center,.50,-.35,.15,.055,.17,'#303238');
 g.box(0,.19,0,p.width,.10,2.8,'#111820');
 for(let i=0;i<4;i++)g.box(center,.52+i*.007,-.35,.14-i*.02,.012,.16-i*.022,i%2?dark:edge);
 g.beam([center,.50,-.01],[center,.57,.15],.018,dark);g.beam([center,.57,.15],[center,.57,.04],.025,'#292d32');
 g.panel(passenger,.735,z+.235,.26,.045,[.5,.5,1,.69]);
 // Rubber seals, speaker grille and etched demister slots catch grazing light.
 for(let i=-9;i<=9;i++)g.box(i*.075,.782,z-.27,.034,.004,.055,dark);
 if(p.sport){g.beam([-half+.08,.30,.35],[-half+.08,1.43,.20],.021,'#a5a8a6');g.beam([half-.08,.30,.35],[half-.08,1.43,.20],.021,'#a5a8a6');}
 const flat=['r8','ferrari488','gt3rs','civic'].includes(p.id),wheel=new CabinMesh();wheel.ring(0,0,0,p.wheelRadius,.018,'#14181c',64,flat);wheel.ring(0,0,.012,p.wheelRadius-.008,.002,'#5f6467',64,flat);
 for(let i=0;i<p.spokes;i++){const a=p.spokes===3?[0,Math.PI,-Math.PI/2][i]:i/p.spokes*Math.PI*2+Math.PI/4;wheel.beam([Math.cos(a)*.035,Math.sin(a)*.035,-.004],[Math.cos(a)*p.wheelRadius*.89,Math.sin(a)*p.wheelRadius*.89,0],classic?.014:.024,p.sport?'#7f8589':'#34393d',12);}
 wheel.bevel(0,0,.017,classic||p.sport?.079:.12,classic||p.sport?.07:.10,.045,.01,'#242930');
 wheel.panel(0,0,.041,.057,.027,[.5,.70,.85,.87]);
 wheel.box(0,p.wheelRadius,.014,.012,.023,.006,p.sport?'#e7bd56':'#7b827b');
 const lever=new CabinMesh();lever.beam([0,0,0],[0,.11,0],.012,'#a2a8ac');lever.ring(0,.12,0,.023,.012,'#2b3035',18);lever.box(0,.12,0,.039,.025,.034,'#20242a');
 const mirror=new CabinMesh();mirror.box(0,0,-.008,.345,.112,.025,dark);mirror.panel(0,0,.008,.322,.088,[0,0,1,1],2);mirror.beam([0,.05,-.008],[0,.12,-.015],.009,dark);
 const hand=new CabinMesh();hand.bevel(0,0,0,.068,.080,.042,.013,'#252d36');for(let i=0;i<4;i++){const length=i===0||i===3?.031:.041;hand.beam([-.025+i*.016,.023,-.007],[-.024+i*.016,length,-.025],.008,'#3e4a56',10);hand.beam([-.024+i*.016,length,-.025],[-.024+i*.016,.022,-.046],.007,'#303b47',10);}hand.beam([-.032,0,.01],[-.045,.023,-.013],.012,'#45515b',12);hand.bevel(0,-.023,.022,.050,.017,.009,.002,p.sport?'#bca969':'#909eab');for(const side of [-1,1])hand.beam([side*.026,-.03,.019],[side*.027,.02,.019],.0015,'#abb7c1',5);
 const arm=new CabinMesh();arm.beam([0,-.027,0],[.09,-.19,.17],.033,'#202b36',14);arm.beam([.08,-.17,.15],[.20,-.32,.36],.038,'#17232f',14);
 const wiper=new CabinMesh();wiper.beam([0,0,0],[0,.25,0],.006,'#22292e');wiper.beam([-.02,.13,.008],[.02,.49,.008],.007,'#0d1217');
 const needle=new CabinMesh();needle.tri([-.003,-.011,.001],[.003,-.011,.001],[0,.06,.001],'#ff8353',null,0,1);
 const body=g.finish();for(let i=1;i<body.length;i+=14)body[i]+=p.yOffset;
 return {body,wheel:wheel.finish(),lever:lever.finish(),mirror:mirror.finish(),hand:hand.finish(),arm:arm.finish(),wiper:wiper.finish(),needle:needle.finish(),profile:p};
}
