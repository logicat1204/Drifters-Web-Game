import { CARS, sample, worldAt, mix, clamp } from './sim.mjs';
import { createRoadIndex } from './scenery.mjs';

const V = (x=0,y=0,z=0) => [x,y,z];
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => { const l = Math.hypot(...a)||1; return a.map(v=>v/l); };
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export function rearCameraPose(track,race){
  const p=worldAt(track,race.s,race.lateral),angle=p.heading+race.yaw,grade=sample(track,race.s-32);
  const eye=[p.x-Math.sin(angle)*1.1,p.y+1.22,p.z-Math.cos(angle)*1.1];
  return {eye,target:[eye[0]-Math.sin(angle)*32,grade.y+1.22,eye[2]-Math.cos(angle)*32]};
}
const rgb = c => typeof c === 'string' ? [parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255,0] : [...c,0].slice(0,4);
const identity = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function transform(x,y,z,r=0,scale=1) { const c=Math.cos(r)*scale,s=Math.sin(r)*scale; return new Float32Array([c,0,-s,0,0,scale,0,0,s,0,c,0,x,y,z,1]); }
function perspective(fov,aspect,near,far) { const f=1/Math.tan(fov/2),q=1/(near-far); return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*q,-1,0,0,2*far*near*q,0]); }
function lookAt(eye,target) { const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x); return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]); }

class Geometry {
  constructor() { this.data=[]; }
  triangle(a,b,c,color) { const n=norm(cross(sub(b,a),sub(c,a))),col=rgb(color); for(const p of [a,b,c]) this.data.push(...p,...n,...col); }
  quad(a,b,c,d,color) { this.triangle(a,b,c,color); this.triangle(a,c,d,color); }
  box(x,y,z,w,h,d,c) {
    const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;
    this.quad(V(x0,y1,z0),V(x0,y1,z1),V(x1,y1,z1),V(x1,y1,z0),c);
    this.quad(V(x0,y0,z1),V(x0,y1,z1),V(x0,y1,z0),V(x0,y0,z0),c);
    this.quad(V(x1,y0,z0),V(x1,y1,z0),V(x1,y1,z1),V(x1,y0,z1),c);
    this.quad(V(x0,y0,z1),V(x1,y0,z1),V(x1,y1,z1),V(x0,y1,z1),c);
    this.quad(V(x1,y0,z0),V(x0,y0,z0),V(x0,y1,z0),V(x1,y1,z0),c);
    this.quad(V(x0,y0,z0),V(x1,y0,z0),V(x1,y0,z1),V(x0,y0,z1),c);
  }
  cone(x,y,z,r,h,c,sides=7) { for(let i=0;i<sides;i++) {const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2; this.triangle(V(x+Math.cos(a)*r,y,z+Math.sin(a)*r),V(x,y+h,z),V(x+Math.cos(b)*r,y,z+Math.sin(b)*r),c); } }
  cylinderX(x,y,z,r,w,c,sides=12) {
    for(let i=0;i<sides;i++) { const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;
      const p=(dx,t)=>V(x+dx,y+Math.cos(t)*r,z+Math.sin(t)*r);
      this.quad(p(-w/2,a),p(w/2,a),p(w/2,b),p(-w/2,b),c);
      this.triangle(V(x-w/2,y,z),p(-w/2,a),p(-w/2,b),c); this.triangle(V(x+w/2,y,z),p(w/2,b),p(w/2,a),c);
    }
  }
  cylinderZ(x,y,z,r,w,c,sides=12) {
    for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,p=(dz,t)=>V(x+Math.cos(t)*r,y+Math.sin(t)*r,z+dz);this.quad(p(-w/2,a),p(-w/2,b),p(w/2,b),p(w/2,a),c);this.triangle(V(x,y,z-w/2),p(-w/2,b),p(-w/2,a),c);this.triangle(V(x,y,z+w/2),p(w/2,a),p(w/2,b),c);}
  }
  upload(gl) { const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.data),gl.STATIC_DRAW); const mesh={buffer,count:this.data.length/10}; this.data=[]; return mesh; }
}
function meshCar(gl,color,id) {
  const g=new Geometry(),body=rgb(color),black='#151c21',glass='#253e48',trim='#22262b',silver='#adb1ae';
  const supra=id==='supra',silvia=id==='silvia',roadster=id==='s2000',midship=id==='mr2';
  const sport=['rx7','mr2','s2000','gt86','supra'].includes(id),wide=id==='r32',coupe=id==='ae86coupe'||silvia,sileighty=id==='sileighty',w=wide?1.88:supra?1.84:roadster?1.75:1.72;
  if(sport){
    const sections=supra?[[-2.1,.77,.65],[-1.65,.92,.80],[-.65,.93,.79],[.65,.91,.76],[1.5,.88,.66],[2.1,.74,.53]]:midship?[[-2.1,.74,.66],[-1.65,.87,.80],[-.65,.87,.78],[.65,.85,.70],[1.5,.82,.57],[2.1,.70,.47]]:roadster?[[-2.1,.71,.61],[-1.65,.86,.72],[-.65,.87,.75],[.65,.85,.70],[1.5,.81,.61],[2.1,.68,.48]]:[[-2.1,.70,.58],[-1.65,.88,.74],[-.65,.91,.77],[.65,.89,.72],[1.5,.86,.63],[2.1,.70,.50]];
    const ring=([z,r,h])=>[V(-r*.85,.30,z),V(r*.85,.30,z),V(r,.39,z),V(r,h-.10,z),V(r*.79,h,z),V(-r*.79,h,z),V(-r,h-.10,z),V(-r,.39,z)];
    for(let i=0;i<sections.length-1;i++){const a=ring(sections[i]),b=ring(sections[i+1]);for(let j=0;j<8;j++)g.quad(a[j],a[(j+1)%8],b[(j+1)%8],b[j],body);}
    for(const section of [sections[0],sections.at(-1)]){const r=ring(section);for(let i=1;i<r.length-1;i++)g.triangle(r[0],r[i],r[i+1],body);}
  }else g.box(0,.52,0,w,.43,4.12,body);
  g.box(0,.32,0,w+.025,.16,4.18,black);
  if(!sport){g.box(0,.61,1.51,w,.16,1.02,body);g.box(0,wide?.75:.65,-1.56,w,.19,.93,body);}
  g.box(0,.40,2.11,w+.04,.22,.11,trim); g.box(0,.39,-2.11,w+.04,.24,.12,trim);
  // Angular greenhouse, windscreen and hatch.
  const roofY=roadster?1.14:supra?1.19:sport?1.10:wide?1.32:silvia?1.23:1.27,roofW=w*(sport?.67:.73),rearGlassEnd=wide||coupe||midship?-1.28:roadster?-1.0:-1.61;
  const roofRear=roadster?-.70:midship?-.60:-.94;
  g.quad(V(-w*.46,.77,.82),V(w*.46,.77,.82),V(roofW/2,roofY,.23),V(-roofW/2,roofY,.23),glass);
  g.quad(V(-roofW/2,roofY,roofRear),V(roofW/2,roofY,roofRear),V(w*.45,.78,rearGlassEnd),V(-w*.45,.78,rearGlassEnd),glass);
  g.box(0,roofY+.025,(roofRear+.23)/2,roofW+.06,.065,.23-roofRear,roadster?black:body);
  for(const side of [-1,1]) {
    g.quad(V(side*w*.46,.77,.82),V(side*roofW/2,roofY,.23),V(side*roofW/2,roofY,roofRear),V(side*w*.45,.78,rearGlassEnd),glass);
    g.box(side*(roofW/2+.01),1.04,-.49,.065,.45,.07,body);
    g.box(side*(w/2+.015),.67,-.22,.025,.018,1.68,trim);
    g.box(side*(w/2+.015),.78,.83,.20,.12,.23,trim);
    g.box(side*(w/2+.012),.73,-.62,.025,.035,.17,trim);
    g.box(side*(w/2+.014),.47,.0,.026,sport?.055:.115,2.3,sport?body:black);
    for(const z of [-1.28,1.22]) {
      g.cylinderX(side*w/2,.34,z,.355,.22,'#101418',14);
      g.cylinderX(side*(w/2+.115),.34,z,.225,.018,'#929a9e',12);
      g.cylinderX(side*(w/2+.13),.34,z,.16,.023,'#323942',8);
      g.cylinderX(side*(w/2+.15),.34,z,.065,.03,silver,8);
    }
  }
  g.box(0,.52,-2.18,.48,.15,.02,'#d4d4b8');
  g.box(0,.54,2.17,.43,.12,.02,'#d4d4b8');
  g.box(0,.70,-2.08,w*.87,.10,.045,black);
  if(wide||sport) { for(const x of [-.62,-.36,.36,.62]) { g.cylinderZ(x,.67,-2.13,wide?.095:.082,.035,[1,.075,.045,1]); } }
  else for(const side of [-1,1]) {g.box(side*.58,.68,-2.12,.46,.13,.04,[.85,.055,.035,1]); g.box(side*.75,.68,-2.145,.10,.1,.025,[1,.33,.04,.8]);}
  for(const side of [-1,1]) {
    if(supra){g.box(side*.59,.69,2.08,.45,.19,.045,black);for(let i=0;i<3;i++)g.cylinderZ(side*(.44+i*.14),.70,2.11,.058,.025,[.85,.93,.8,1]);}
    else if(!wide&&!sileighty&&!silvia&&!['s2000','gt86'].includes(id)) {g.box(side*.58,.83,1.56,.42,.19,.38,body);g.box(side*.58,.84,1.765,.34,.13,.025,[.85,.93,.8,1]);}
    else g.box(side*.60,.70,2.075,.40,.15,.04,[.85,.93,.8,1]);
    g.box(side*.72,.47,2.155,.14,.07,.025,[1,.5,.09,.6]);
  }
  if(sport||wide||sileighty||silvia) {const wingY=supra?1.29:roadster?.83:id==='gt86'?.83:1.04;g.box(0,wingY,-1.9,w*.96,.065,.24,body);for(const x of [-.6,.6])g.box(x,(wingY+.76)/2,-1.9,.06,wingY-.76,.1,trim);}
  if(midship){for(const side of [-1,1])g.box(side*(w/2+.014),.66,-.78,.026,.16,.40,black);for(let i=0;i<6;i++)g.box(0,.82,-1.25-i*.085,.88,.018,.035,trim);g.box(0,roofY+.06,-.15,.065,.02,.75,trim);}
  if(supra)g.box(0,.42,2.18,.74,.19,.025,black);
  if(silvia){g.box(0,.72,2.13,.45,.075,.04,black);g.box(0,.69,-2.15,.52,.07,.025,body);}
  if(id==='ae86') { // Door typography rendered as small geometric strokes.
    for(const side of [-1,1])for(let i=0;i<9;i++) {const z=-.55+i*.105;g.box(side*(w/2+.018),.64,z,.016,.075,.024,trim);g.box(side*(w/2+.02),.65,z,.016,.014,.072,trim);}
  }
  return g.upload(gl);
}

export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;
    const gl=this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});
    if(!gl) throw new Error('Tu navegador no ofrece WebGL. Activa la aceleración gráfica y vuelve a cargar.');
    const vertex=`attribute vec3 aPos;attribute vec3 aNormal;attribute vec4 aColor;uniform mat4 uModel,uView,uProjection;varying vec4 vColor;varying vec3 vNormal,vWorld;void main(){vec4 p=uModel*vec4(aPos,1.);vWorld=p.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;gl_Position=uProjection*uView*p;}`;
    const fragment=`precision mediump float;
      varying vec4 vColor;varying vec3 vNormal,vWorld;
      uniform vec3 uFog,uEye,uCar,uRivalCar;uniform vec2 uForward,uRivalForward;
      uniform vec4 uNetCars[3];uniform vec2 uNetForward[3];
      uniform float uDay,uAlpha,uFogStart,uFogEnd,uHeadlights,uRivalLights,uLampState,uBrake;
      float beam(vec3 car,vec2 forward){
        vec2 delta=vWorld.xz-car.xz;float ahead=dot(delta,forward);
        float across=abs(delta.x*forward.y-delta.y*forward.x);
        float cone=smoothstep(1.,4.,ahead)*(1.-smoothstep(38.,110.,ahead))*(1.-smoothstep(1.3+ahead*.035,2.+ahead*.19,across));
        float height=1.-smoothstep(1.5,6.,abs(vWorld.y-car.y));
        return cone*height;
      }
      void main(){vec3 n=normalize(vNormal);float sun=max(0.,dot(n,normalize(vec3(-.35,.85,.4))));
        float light=mix(.075+sun*.065,.48+sun*.52,uDay);
        float headlights=max(beam(uCar,uForward)*uHeadlights,beam(uRivalCar,uRivalForward)*uRivalLights)*(1.-uDay)*1.85;
        for(int i=0;i<3;i++)headlights=max(headlights,beam(uNetCars[i].xyz,uNetForward[i])*uNetCars[i].w*(1.-uDay)*1.85);
        float noise=fract(sin(dot(floor(vWorld.xz*13.),vec2(12.9898,78.233)))*43758.5453);
        float grain=abs(n.y)>.7?.96+noise*.08:1.;
        float lamp=1.;if(vColor.a>.8&&vColor.r>.6&&vColor.g>.6&&vColor.b>.5)lamp=uLampState;
        float brake=1.;if(vColor.a>.8&&vColor.r>.6&&vColor.g<.2)brake=.55+uBrake*.65;
        vec3 c=mix(vColor.rgb*(light+headlights)*grain,vColor.rgb*1.35*brake,vColor.a*lamp);
        float f=smoothstep(uFogStart,uFogEnd,distance(vWorld,uEye));gl_FragColor=vec4(mix(c,uFog,f),uAlpha);}`;
    const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
    this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
    this.attrs={};for(const name of ['aPos','aNormal','aColor'])this.attrs[name]=gl.getAttribLocation(this.program,name);
    this.uniforms={};for(const name of ['uModel','uView','uProjection','uFog','uEye','uDay','uAlpha','uFogStart','uFogEnd','uCar','uForward','uHeadlights','uRivalCar','uRivalForward','uRivalLights','uLampState','uBrake','uNetCars[0]','uNetForward[0]'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.cars={};this.eye=[0,0,0];this.target=[0,0,0];this.time=0;this.quality=1.4;this.cameraMode=0;
    const shadow=new Geometry();for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;shadow.triangle(V(0,.045,0),V(Math.cos(a)*1.22,.045,Math.sin(a)*2.55),V(Math.cos(b)*1.22,.045,Math.sin(b)*2.55),'#000000');}this.shadow=shadow.upload(gl);
    const moon=new Geometry();for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;moon.triangle(V(0,0,0),V(Math.cos(a)*30,Math.sin(a)*30,0),V(Math.cos(b)*30,Math.sin(b)*30,0),[.92,.94,.81,1]);}this.moon=moon.upload(gl);
    const smoke=new Geometry();smoke.box(0,0,0,1,1,1,'#b7c2bd');this.smoke=smoke.upload(gl);
    this.particles=[];
  }
  setCar(car) {this.car=car;if(!this.cars[car.id])this.cars[car.id]=meshCar(this.gl,car.color,car.id);}
  setNetworkPlayers(players){for(const p of players){const car=CARS.find(c=>c.id===p.car);if(car&&!this.cars['network-'+car.id])this.cars['network-'+car.id]=meshCar(this.gl,car.color,car.id);}}
  setRival(rival){this.rival=rival;const key='rival-'+rival.id;if(!this.cars[key])this.cars[key]=meshCar(this.gl,rival.color,rival.car);}
  setTrack(track) {
    this.track=track;const gl=this.gl;
    if(this.scene)gl.deleteBuffer(this.scene.buffer);if(this.backdrop)gl.deleteBuffer(this.backdrop.buffer);
    const g=new Geometry(),roadIndex=createRoadIndex(track);this.sceneryBounds=[];let seed=track.seed*11231;
    const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const point=(p,l,y=0)=>V(p.x+Math.cos(p.heading)*l,p.y+y,p.z-Math.sin(p.heading)*l);
    const strip=(a,b,l1,l2,y,color)=>g.quad(point(a,l1,y),point(b,l1,y),point(b,l2,y),point(a,l2,y),color);
    const minY=Math.min(...track.points.map(p=>p.y))-75;
    const minX=Math.min(...track.points.map(p=>p.x))-1500,maxX=Math.max(...track.points.map(p=>p.x))+1500,minZ=Math.min(...track.points.map(p=>p.z))-1500,maxZ=Math.max(...track.points.map(p=>p.z))+1500;
    g.quad(V(minX,minY,minZ),V(minX,minY,maxZ),V(maxX,minY,maxZ),V(maxX,minY,minZ),track.theme==='city'?'#263b3e':'#22372d');
    for(let i=0;i<track.points.length-1;i++) {
      const a=track.points[i],b=track.points[i+1];
      // Narrow vertical embankments cannot stretch over another hairpin.
      for(const side of [-1,1])g.quad(point(a,side*5.58,-.12),point(b,side*5.58,-.12),point(b,side*5.58,-38),point(a,side*5.58,-38),track.theme==='autumn'?'#5a5142':'#35453c');
      strip(a,b,-5.3,5.3,0,i%3===0?'#4c5356':'#494f52');
      strip(a,b,-5.55,-5.3,.015,'#737771');strip(a,b,5.3,5.55,.015,'#737771');
      strip(a,b,-4.9,-4.78,.025,'#d0d2bb');strip(a,b,4.78,4.9,.025,'#d0d2bb');
      if(i%3!==0){strip(a,b,-.11,-.03,.03,'#cb9c4d');strip(a,b,.03,.11,.03,'#cb9c4d');}
      for(const side of [-1,1]) {
        strip(a,b,side*5.65,side*5.68,.75,'#9aaba8');strip(a,b,side*5.65,side*5.68,.97,'#aeb7b0');
        g.quad(point(a,side*5.68,.75),point(b,side*5.68,.75),point(b,side*5.68,.97),point(a,side*5.68,.97),'#a6b0a8');
        if(i%4===0){const p=point(a,side*5.68,.45);g.box(...p,.09,.9,.10,'#808c87');const q=point(a,side*5.62,.99);g.box(...q,.09,.10,.18,side<0?[.95,.18,.08,.12]:[.9,.88,.6,.12]);}
      }
      if(i%4===0)for(const side of [-1,1]) {
        const l=side*(14+rand()*28),p=point(a,l,-.5),h=7+rand()*10,radius=h*.27;
        if(!roadIndex.clear(p[0],p[2],Math.max(radius,8)))continue;
        this.sceneryBounds.push({x:p[0],z:p[2],radius:Math.max(radius,8)});
        g.cone(p[0],p[1]-26,p[2],8,26,track.theme==='autumn'?'#66533d':'#314437',8);
        g.box(p[0],p[1]+h*.3,p[2],.35,h*.6,.35,'#4b463d');
        const color=track.theme==='autumn'?(rand()>.5?'#9b6a34':'#80493a'):rand()>.5?'#1a3730':'#254137';
        for(let k=0;k<3;k++)g.cone(p[0],p[1]+h*(.2+k*.17),p[2],h*(.27-k*.055),h*.48,color);
      }
      if(track.theme==='city'&&i%15===0)for(const side of [-1,1]){const p=point(a,side*(30+rand()*35),0),size=8+rand()*8,height=10+rand()*27,radius=size*.72;if(roadIndex.clear(p[0],p[2],radius)){this.sceneryBounds.push({x:p[0],z:p[2],radius});g.box(p[0],p[1]+height/2,p[2],size,height,size,rand()>.5?'#58615d':'#6b6a60');for(let floor=3;floor<height;floor+=3.6)for(let col=-size*.3;col<size*.4;col+=2.4)g.box(p[0]+col,p[1]+floor,p[2]-size/2-.02,.8,1.2,.05,[.68,.65,.38,.5]);}}
      if(track.theme==='orchard'&&i%10===0){const p=point(a,-24,0);if(roadIndex.clear(p[0],p[2],8)){this.sceneryBounds.push({x:p[0],z:p[2],radius:8});g.box(p[0],p[1]-.5,p[2],10,1,10,'#53613a');for(const dx of [-3,0,3]){g.box(p[0]+dx,p[1]+1.3,p[2],.12,2.6,.12,'#665341');g.cone(p[0]+dx,p[1]+1.3,p[2],1.5,2.4,'#667a48',6);}}}
      if(i%18===0) {
        const p=point(a,7.5,4);g.box(...p,.22,8,.22,'#726c59');
        const b2=track.points[Math.min(i+18,track.points.length-1)],q=point(b2,7.5,8);
        for(const offset of [-.45,0,.45]){const aa=point(a,7.5+offset,8),bb=[q[0]+offset,q[1],q[2]];g.quad(aa,bb,[bb[0],bb[1]+.025,bb[2]],[aa[0],aa[1]+.025,aa[2]],'#373d39');}
      }
      if(Math.abs(a.curve)>.014&&i%7===0){
        const p=point(a,Math.sign(a.curve)*-6.2,1.55);g.box(p[0],p[1]-.4,p[2],.08,1.5,.08,'#acb5a4');g.box(...p,1,.6,.10,'#d9ce9c');
        const side=Math.sign(a.curve);g.triangle(V(p[0]-side*.2,p[1]-.2,p[2]-.065),V(p[0]+side*.13,p[1],p[2]-.065),V(p[0]-side*.2,p[1]+.2,p[2]-.065),'#b1452e');
      }
      if(i===4){for(const side of [-1,1]){const p=point(a,side*6,2.5);g.box(...p,.25,5,.25,'#cc5a43');}const p=point(a,0,5);g.box(...p,12.8,.35,.4,'#ce6048');g.box(p[0],p[1]+.4,p[2],13.4,.22,.6,'#353c37');}
      if(track.theme==='bridge'&&i===Math.floor(track.points.length*.27)){const p=point(a,31,-10);if(roadIndex.clear(p[0],p[2],15)){this.sceneryBounds.push({x:p[0],z:p[2],radius:15});g.box(p[0],p[1]+5,p[2],26,2,4,'#92654c');for(const dx of [-11,-4,4,11])g.box(p[0]+dx,p[1]-1,p[2],2,12,4,'#92654c');}}
      if(i===Math.floor(track.length/track.step))for(let k=0;k<12;k++)strip(a,b,-5.2+k*.87,-5.2+(k+1)*.87,.04,k%2?'#d1d2bd':'#171f22');
    }
    this.scene=g.upload(gl);
    const bg=new Geometry();for(let i=0;i<24;i++){const a=i/24*Math.PI*2,d=900+rand()*450;bg.cone(Math.cos(a)*d,-210,Math.sin(a)*d,350+rand()*190,270+rand()*400,i%2?'#293f44':'#31494c',7);}this.backdrop=bg.upload(gl);
    this.resetCamera=true;
  }
  draw(mesh,model=identity(),alpha=1) {if(!mesh)return;const gl=this.gl,u=this.uniforms;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);const stride=40;for(const [key,n,offset] of [['aPos',3,0],['aNormal',3,12],['aColor',4,24]]){const a=this.attrs[key];gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n,gl.FLOAT,false,stride,offset);}gl.uniformMatrix4fv(u.uModel,false,model);gl.uniform1f(u.uAlpha,alpha);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
  drawWorld(race,racing,p,angle,eye,target,aspect,fov,day,sky,hidePlayer=false){
    const gl=this.gl,u=this.uniforms,rival=racing&&race.mode!=='time'?worldAt(this.track,race.rivalS,race.rivalLateral):null;
    const others=racing?(race.netOpponents||[]).slice(0,3).map(o=>({...o,world:worldAt(this.track,o.s,o.lateral)})):[],netCars=new Float32Array(12),netForward=new Float32Array(6);
    others.forEach((o,i)=>{const q=o.world,a=q.heading+o.yaw;netCars.set([q.x,q.y,q.z,o.headlights?1:0],i*4);netForward.set([Math.sin(a),Math.cos(a)],i*2);});
    gl.uniform4fv(u['uNetCars[0]'],netCars);gl.uniform2fv(u['uNetForward[0]'],netForward);
    gl.uniformMatrix4fv(u.uView,false,lookAt(eye,target));gl.uniformMatrix4fv(u.uProjection,false,perspective(fov*Math.PI/180,aspect,.15,2200));
    gl.uniform3fv(u.uFog,sky);gl.uniform3fv(u.uEye,eye);gl.uniform3fv(u.uCar,[p.x,p.y,p.z]);gl.uniform2fv(u.uForward,[Math.sin(angle),Math.cos(angle)]);
    gl.uniform1f(u.uDay,day?1:!racing?.55:0);gl.uniform1f(u.uFogStart,day?210:85);gl.uniform1f(u.uFogEnd,day?1350:440);
    gl.uniform1f(u.uHeadlights,!racing||race.headlights?1:0);gl.uniform1f(u.uRivalLights,rival?1:0);
    const ra=rival?rival.heading+race.rivalYaw:0;gl.uniform3fv(u.uRivalCar,rival?[rival.x,rival.y,rival.z]:[0,0,0]);gl.uniform2fv(u.uRivalForward,[Math.sin(ra),Math.cos(ra)]);
    gl.uniform1f(u.uLampState,1);gl.uniform1f(u.uBrake,0);
    gl.depthMask(false);gl.disable(gl.DEPTH_TEST);
    this.draw(this.backdrop,transform(eye[0],eye[1]-100,eye[2]));
    if(!day)this.draw(this.moon,transform(eye[0]+310,eye[1]+245,eye[2]+850));
    gl.depthMask(true);gl.enable(gl.DEPTH_TEST);this.draw(this.scene);
    if(!hidePlayer){this.draw(this.shadow,transform(p.x,p.y,p.z,angle),.45);gl.uniform1f(u.uLampState,!racing||race.headlights?1:0);gl.uniform1f(u.uBrake,race?.braking?1:0);this.draw(this.cars[this.car.id],transform(p.x,p.y+.04,p.z,angle));}
    gl.uniform1f(u.uLampState,1);gl.uniform1f(u.uBrake,race?.rivalBraking?1:0);
    if(rival){this.draw(this.shadow,transform(rival.x,rival.y,rival.z,ra),.4);this.draw(this.cars['rival-'+race.rival.id],transform(rival.x,rival.y+.04,rival.z,ra));}
    for(const o of others){const q=o.world,a=q.heading+o.yaw;gl.uniform1f(u.uLampState,o.headlights?1:0);gl.uniform1f(u.uBrake,o.braking?1:0);this.draw(this.shadow,transform(q.x,q.y,q.z,a),.4);this.draw(this.cars['network-'+o.carId],transform(q.x,q.y+.04,q.z,a));}
    gl.uniform1f(u.uLampState,1);
    gl.uniform1f(u.uBrake,0);
  }
  initMirror(){
    const gl=this.gl,w=384,h=112;
    this.mirrorCanvas=document.createElement('canvas');this.mirrorCanvas.width=w;this.mirrorCanvas.height=h;this.mirrorContext=this.mirrorCanvas.getContext('2d');
    this.mirrorPixels=new Uint8Array(w*h*4);this.mirrorImage=this.mirrorContext.createImageData(w,h);
    this.mirrorFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.mirrorFbo);
    this.mirrorTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.mirrorTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.mirrorTexture,0);
    this.mirrorDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,this.mirrorDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.mirrorDepth);
    this.mirrorReady=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
  }
  renderMirror(race,p,angle,day,sky,w,h){
    if(!this.mirrorCanvas)this.initMirror();if(!this.mirrorReady)return;
    if(this.time-(this.mirrorTime??-1)<1/(this.quality<=1?16:24))return;this.mirrorTime=this.time;
    const gl=this.gl,mw=this.mirrorCanvas.width,mh=this.mirrorCanvas.height,pose=rearCameraPose(this.track,race);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.mirrorFbo);gl.viewport(0,0,mw,mh);gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    this.drawWorld(race,true,p,angle,pose.eye,pose.target,mw/mh,23,day,sky,true);
    gl.readPixels(0,0,mw,mh,gl.RGBA,gl.UNSIGNED_BYTE,this.mirrorPixels);
    const stride=mw*4;for(let row=0;row<mh;row++)this.mirrorImage.data.set(this.mirrorPixels.subarray((mh-row-1)*stride,(mh-row)*stride),row*stride);
    this.mirrorContext.putImageData(this.mirrorImage,0,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);
  }
  render(race,mode,dt,options={}) {
    if(!this.track||!this.car)return;
    this.time+=dt;const gl=this.gl,u=this.uniforms,canvas=this.canvas;
    const dpr=Math.min(window.devicePixelRatio||1,this.quality),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
    const day=options.day?1:0,sky=day?[.39,.55,.60]:[.012,.022,.034];
    gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
    const racing=mode==='race'||mode==='paused'||mode==='results';
    const s=racing?race.s:330,lat=racing?race.lateral:-1.7,p=worldAt(this.track,s,lat),angle=p.heading+(racing?race.yaw:0);
    let eye,target;
    if(racing) {
      const look=worldAt(this.track,s+18,lat*.5),back=8.5+race.speed*.035;
      if(this.cameraMode===3){const driver=worldAt(this.track,s+.35,lat-.35),aim=sample(this.track,s+32),relativeYaw=race.yaw*.65;eye=[driver.x,driver.y+1.17,driver.z];target=[driver.x+Math.sin(p.heading+relativeYaw)*32,aim.y+1.17,driver.z+Math.cos(p.heading+relativeYaw)*32];}
      else if(this.cameraMode===1){eye=[p.x+Math.sin(angle)*.6,p.y+1.1,p.z+Math.cos(angle)*.6];target=[look.x,look.y+1,look.z];}
      else if(this.cameraMode===2){eye=[p.x-Math.sin(p.heading)*5,p.y+3,p.z-Math.cos(p.heading)*5];target=[look.x,look.y+.4,look.z];}
      else {eye=[p.x-Math.sin(p.heading)*back,p.y+3.35+race.speed*.012,p.z-Math.cos(p.heading)*back];target=[look.x,look.y+.55,look.z];}
      const smoothing=1-Math.exp(-dt*([1,3].includes(this.cameraMode)?35:12));
      if(this.resetCamera){this.eye=eye;this.target=target;this.resetCamera=false;}else{this.eye=this.eye.map((v,i)=>mix(v,eye[i],smoothing));this.target=this.target.map((v,i)=>mix(v,target[i],smoothing));}
    } else {
      const t=this.time*.045,offset=mode==='garage'?0:1;
      const cameraAngle=p.heading+2.1+Math.sin(t)*.10;
      eye=[p.x+Math.sin(cameraAngle)*(mode==='garage'?8.7:10.8),p.y+2.75,p.z+Math.cos(cameraAngle)*(mode==='garage'?8.7:10.8)];
      target=[p.x+Math.cos(p.heading)*offset*2.3,p.y+(mode==='garage'?.7:-.10),p.z-Math.sin(p.heading)*offset*2.3];this.eye=eye;this.target=target;
    }
    const shake=racing&&options.shake!==false?race.collision*.12:0;
    const actualEye=this.eye.map((v,i)=>v+(i<2?Math.sin(this.time*95+i)*shake:0));
    this.drawWorld(race,racing,p,angle,actualEye,this.target,w/h,racing?(this.cameraMode===3?65:58)+race.speed*.18:44,day,sky,racing&&[1,3].includes(this.cameraMode));
    if(racing&&race.drift>.3&&race.speed>12&&mode==='race')for(const side of [-1,1])if(Math.random()<.65)this.particles.push({x:p.x+Math.cos(angle)*side*.8-Math.sin(angle)*1.3,y:p.y+.32,z:p.z-Math.sin(angle)*side*.8-Math.cos(angle)*1.3,life:1,size:.2+Math.random()*.2});
    gl.depthMask(false);this.particles=this.particles.filter(v=>v.life>0);for(const v of this.particles){v.life-=dt*.85;v.y+=dt*.35;v.size+=dt*.65;this.draw(this.smoke,transform(v.x,v.y,v.z,v.life,v.size),v.life*.13);}gl.depthMask(true);
    if(racing&&this.cameraMode===3)this.renderMirror(race,p,angle,day,sky,w,h);
  }
}
