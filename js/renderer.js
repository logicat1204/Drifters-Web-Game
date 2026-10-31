import {applyBuild,appearanceKey} from './tuning.mjs';
import { ALL_CARS as CARS, sample, worldAt, mix, clamp } from './sim.mjs';
import { createRoadIndex } from './scenery.mjs';
import {FOCUS_TYPES} from './focus.mjs';
import {chunkVisible,viewPlanes,mirrorLayout} from './render-performance.mjs';
import {createEnvironment} from './environment.mjs';
import {TEXTURES} from './scenery-assets.mjs';

const V = (x=0,y=0,z=0) => [x,y,z];
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => { const l = Math.hypot(...a)||1; return a.map(v=>v/l); };
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export function raceVisibility(race,day){
  // Ashinoko is a short-range navigation challenge. Measure from the car so
  // chase, bonnet, cockpit and mirrors all share the same world visibility.
  if(race?.fog&&race.track?.id==='ashinoko')return {near:8,far:60,color:[.64,.68,.72],fromCar:true};
  if(race?.fog)return {near:35,far:185,color:[.55,.62,.69],fromCar:false};
  return day?{near:210,far:1350,color:[.39,.55,.60],fromCar:false}:{near:85,far:440,color:[.012,.022,.034],fromCar:false};
}
export function rearCameraPose(track,race){
  const p=worldAt(track,race.s,race.lateral),angle=p.heading+race.yaw,grade=sample(track,race.s-32);
  const eye=[p.x-Math.sin(angle)*1.1,p.y+1.22,p.z-Math.cos(angle)*1.1];
  return {eye,target:[eye[0]-Math.sin(angle)*32,grade.y+1.22,eye[2]-Math.cos(angle)*32]};
}
const rgb = c => typeof c === 'string' ? [parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255,0] : [...c,0].slice(0,4);
const identity = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const IDENTITY=identity();
function transform(x,y,z,r=0,scale=1) { const c=Math.cos(r)*scale,s=Math.sin(r)*scale; return new Float32Array([c,0,-s,0,0,scale,0,0,s,0,c,0,x,y,z,1]); }
function perspective(fov,aspect,near,far) { const f=1/Math.tan(fov/2),q=1/(near-far); return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*q,-1,0,0,2*far*near*q,0]); }
function lookAt(eye,target) { const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x); return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]); }

class Geometry {
  constructor() { this.data=[]; }
  triangle(a,b,c,color,uv=null,tiles=[-1,-1]) { const n=norm(cross(sub(b,a),sub(c,a))),col=rgb(color);let i=0;for(const p of [a,b,c])this.data.push(...p,...n,...col,...(uv?.[i++]||[0,0]),...tiles); }
  quad(a,b,c,d,color) { this.triangle(a,b,c,color); this.triangle(a,c,d,color); }
  surface(a,b,c,d,texture,uv=[[0,0],[1,0],[1,1],[0,1]],tint=[1,1,1,0],night=texture){this.triangle(a,b,c,tint,[uv[0],uv[1],uv[2]],[texture,night]);this.triangle(a,c,d,tint,[uv[0],uv[2],uv[3]],[texture,night]);}
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
  upload(gl) { const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.data),gl.STATIC_DRAW); const mesh={buffer,count:this.data.length/14}; this.data=[]; return mesh; }
}
function meshCar(gl,color,modelId,build={}) {
  const spec=CARS.find(c=>c.id===modelId),id=spec?.mesh||modelId;
  const g=new Geometry(),body=rgb(color),black='#151c21',glass='#253e48',trim='#22262b',silver='#adb1ae';
  const supra=id==='supra',silvia=id==='silvia',roadster=id==='s2000',midship=id==='mr2';
  const rim=build.wheels==='gold'?'#c7a45c':build.wheels==='black'?'#272d35':'#929a9e';
  let hoodSections=null;
  const sport=['rx7','mr2','s2000','gt86','supra'].includes(id),wide=id==='r32',coupe=id==='ae86coupe'||silvia,sileighty=id==='sileighty',w=wide?1.88:supra?1.84:roadster?1.75:1.72;
  if(sport){
    const sections=supra?[[-2.1,.77,.65],[-1.65,.92,.80],[-.65,.93,.79],[.65,.91,.76],[1.5,.88,.66],[2.1,.74,.53]]:midship?[[-2.1,.74,.66],[-1.65,.87,.80],[-.65,.87,.78],[.65,.85,.70],[1.5,.82,.57],[2.1,.70,.47]]:roadster?[[-2.1,.71,.61],[-1.65,.86,.72],[-.65,.87,.75],[.65,.85,.70],[1.5,.81,.61],[2.1,.68,.48]]:[[-2.1,.70,.58],[-1.65,.88,.74],[-.65,.91,.77],[.65,.89,.72],[1.5,.86,.63],[2.1,.70,.50]];
    hoodSections=sections;
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
      g.cylinderX(side*(w/2+.115),.34,z,.225,.018,rim,12);
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
  if(modelId==='ae86carbon')g.box(0,.742,1.37,1.64,.023,1.18,'#22252c');
  if(['alfa4c','a110','gt3rs'].includes(modelId))for(const x of [-.56,.56])g.cylinderZ(x,.66,2.12,.12,.05,'#e8e9d4');
  if(['ferrari488','r8','cayman'].includes(modelId))for(const side of [-1,1])g.box(side*.87,.56,-.66,.03,.29,.52,'#171d25');
  if(['r34','gt3rs','rx7amemiya','civic'].includes(modelId)){g.box(0,1.18,-1.91,1.72,.075,.29,body);for(const x of [-.64,.64])g.box(x,.97,-1.9,.06,.4,.08,trim);}
  if(modelId==='r8')for(const side of [-1,1])g.box(side*.88,.77,-.81,.025,.40,.30,'#1c252c');
  const hoodY=z=>{
    if(!hoodSections)return .742;
    const i=Math.max(0,hoodSections.findIndex(section=>section[0]>=z)-1),a=hoodSections[i],b=hoodSections[Math.min(i+1,hoodSections.length-1)],t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0]||1)));
    return a[2]+(b[2]-a[2])*t+.009;
  };
  if(build.hood==='carbon')for(let z=.88;z<1.99;z+=.08)g.quad(V(-w*.35,hoodY(z)+.006,z),V(w*.35,hoodY(z)+.006,z),V(w*.35,hoodY(z+.08)+.006,z+.08),V(-w*.35,hoodY(z+.08)+.006,z+.08),'#232a32');
  if(build.vinyl==='twin')for(const side of [-1,1]){
    g.box(side*roofW*.18,roofY+.063,(roofRear+.23)/2,.12,.009,.23-roofRear,'#edf2f4');
    for(let z=.9;z<2;z+=.08)g.quad(V(side*.22-.065,hoodY(z)+.016,z),V(side*.22+.065,hoodY(z)+.016,z),V(side*.22+.065,hoodY(z+.08)+.016,z+.08),V(side*.22-.065,hoodY(z+.08)+.016,z+.08),'#edf2f4');
  }
  if(build.vinyl==='apex')for(const side of [-1,1]){
    const x=side*(w/2+.035);g.quad(V(x,.42,-1.1),V(x,.42,1.2),V(x,.6,.62),V(x,.6,-1.6),'#dfe9f4');
    g.quad(V(x+side*.002,.48,-1.6),V(x+side*.002,.48,.35),V(x+side*.002,.63,-.15),V(x+side*.002,.63,-1.8),'#397dbb');
  }
  if(build.spoiler==='gt'){g.box(0,1.48,-1.91,w*1.06,.07,.38,'#232b35');for(const x of [-.59,.59])g.box(x,1.12,-1.91,.055,.68,.09,'#313a42');for(const side of [-1,1])g.box(side*w*.53,1.50,-1.91,.035,.18,.42,'#232b35');}
  return g.upload(gl);
}

export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;
    const gl=this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});
    if(!gl) throw new Error('Tu navegador no ofrece WebGL. Activa la aceleración gráfica y vuelve a cargar.');
    const vertex=`attribute vec3 aPos;attribute vec3 aNormal;attribute vec4 aColor,aSurface;uniform mat4 uModel,uView,uProjection;varying vec4 vColor,vSurface;varying vec3 vNormal,vWorld;void main(){vec4 p=uModel*vec4(aPos,1.);vWorld=p.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;vSurface=aSurface;gl_Position=uProjection*uView*p;}`;
    this.textureGrad=!!(gl.getExtension('OES_standard_derivatives')&&gl.getExtension('EXT_shader_texture_lod'));
    const fragment=`${this.textureGrad?'#extension GL_OES_standard_derivatives : enable\n#extension GL_EXT_shader_texture_lod : enable':''}
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec4 vColor,vSurface;varying vec3 vNormal,vWorld;
      uniform sampler2D uAtlas;uniform float uAtlasReady,uTunnel,uBackdrop;
      uniform vec4 uStreetLights[3];
      uniform vec3 uFog,uEye,uCar,uRivalCar;uniform vec2 uForward,uRivalForward;
      uniform vec4 uNetCars[3];uniform vec2 uNetForward[3];
      uniform float uDay,uAlpha,uFogStart,uFogEnd,uFogFromCar,uHeadlights,uRivalLights,uLampState,uBrake;
      float beam(vec3 car,vec2 forward){
        vec2 delta=vWorld.xz-car.xz;float ahead=dot(delta,forward);
        float across=abs(delta.x*forward.y-delta.y*forward.x);
        float cone=smoothstep(1.,4.,ahead)*(1.-smoothstep(38.,110.,ahead))*(1.-smoothstep(1.3+ahead*.035,2.+ahead*.19,across));
        float height=1.-smoothstep(1.5,6.,abs(vWorld.y-car.y));
        return cone*height;
      }
      void main(){float f=smoothstep(uFogStart,uFogEnd,distance(vWorld,mix(uEye,uCar,uFogFromCar)));
        vec4 texel=vec4(1.);float tile=-1.;if(vSurface.z>=0.){tile=floor((uDay>.5?vSurface.z:vSurface.w)+.5);if(uAtlasReady<.5){if(tile>=29.&&tile<=32.)discard;texel=vec4(.6,.65,.55,1.);}else {vec2 cell=vec2(mod(tile,8.),floor(tile/8.)),uv=(cell*256.+8.+vec2(fract(vSurface.x),1.-fract(vSurface.y))*240.)/2048.;
        ${this.textureGrad?'vec2 dx=dFdx(vSurface.xy)*vec2(240./2048.,-240./2048.),dy=dFdy(vSurface.xy)*vec2(240./2048.,-240./2048.);dx*=min(1.,.0078125/max(length(dx),.000001));dy*=min(1.,.0078125/max(length(dy),.000001));texel=texture2DGradEXT(uAtlas,uv,dx,dy);':'texel=texture2D(uAtlas,uv);'}
        if(texel.a<.45)discard;}}
        if(uBackdrop>.5){gl_FragColor=vec4(mix(texel.rgb*vColor.rgb*mix(.13,.95,uDay),uFog,uFogEnd<250.?1.:.32),uAlpha);return;}
        if(f>=1.){gl_FragColor=vec4(uFog,uAlpha);return;}
        vec3 n=normalize(vNormal);float sun=max(0.,dot(n,normalize(vec3(-.35,.85,.4))));
        float daylight=uDay*(1.-uTunnel*.85),light=mix(.075+sun*.065,.48+sun*.52,daylight);
        float headlights=0.;if(daylight<.999){headlights=max(beam(uCar,uForward)*uHeadlights,beam(uRivalCar,uRivalForward)*uRivalLights)*(1.-daylight)*1.85;
        for(int i=0;i<3;i++)headlights=max(headlights,beam(uNetCars[i].xyz,uNetForward[i])*uNetCars[i].w*(1.-daylight)*1.85);
        for(int i=0;i<3;i++){float falloff=max(0.,1.-length(vWorld.xz-uStreetLights[i].xz)/14.);light+=falloff*falloff*uStreetLights[i].w*(1.-daylight)*(1.-smoothstep(3.,10.,abs(vWorld.y-uStreetLights[i].y)));}}
        float noise=fract(sin(dot(floor(vWorld.xz*13.),vec2(12.9898,78.233)))*43758.5453);
        float grain=abs(n.y)>.7?.96+noise*.08:1.;
        float lamp=1.;if(vColor.a>.8&&vColor.r>.6&&vColor.g>.6&&vColor.b>.5)lamp=uLampState;
        float brake=1.;if(vColor.a>.8&&vColor.r>.6&&vColor.g<.2)brake=.55+uBrake*.65;
        vec3 base=vColor.rgb*texel.rgb,c=mix(base*(light+headlights)*grain,base*1.35*brake,vColor.a*lamp);
        if(uDay<.5&&((tile>=5.&&tile<=10.)||tile==17.)){float window=smoothstep(.55,.8,texel.r)*smoothstep(.5,.7,texel.g)*(1.-smoothstep(.75,.95,texel.b));c+=texel.rgb*window*.65;}
        gl_FragColor=vec4(mix(c,uFog,f),uAlpha);}`;
    const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
    this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
    this.attrs={};for(const name of ['aPos','aNormal','aColor','aSurface'])this.attrs[name]=gl.getAttribLocation(this.program,name);
    this.uniforms={};for(const name of ['uModel','uView','uProjection','uFog','uEye','uDay','uAlpha','uFogStart','uFogEnd','uFogFromCar','uCar','uForward','uHeadlights','uRivalCar','uRivalForward','uRivalLights','uLampState','uBrake','uNetCars[0]','uNetForward[0]'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
    for(const name of ['uAtlas','uAtlasReady','uTunnel','uBackdrop','uStreetLights[0]'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
    this.initAtlas();
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.cars={};this.eye=[0,0,0];this.target=[0,0,0];this.time=0;this.quality=1.4;this.cameraMode=0;
    this.resolutionScale=1;this.culling=true;this.planes=new Float32Array(24);this.stats={drawCalls:0,vertices:0,chunks:0,totalChunks:0,mirrorPasses:0};
    const shadow=new Geometry();for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;shadow.triangle(V(0,.045,0),V(Math.cos(a)*1.22,.045,Math.sin(a)*2.55),V(Math.cos(b)*1.22,.045,Math.sin(b)*2.55),'#000000');}this.shadow=shadow.upload(gl);
    const moon=new Geometry();for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;moon.triangle(V(0,0,0),V(Math.cos(a)*30,Math.sin(a)*30,0),V(Math.cos(b)*30,Math.sin(b)*30,0),[.92,.94,.81,1]);}this.moon=moon.upload(gl);
    const smoke=new Geometry();smoke.box(0,0,0,1,1,1,'#b7c2bd');this.smoke=smoke.upload(gl);
    this.particles=[];
    this.focusAuras={};for(const type of Object.values(FOCUS_TYPES)){
      const aura=new Geometry();for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2,tip=(a+b)/2;const color=type.id==='time'&&i%3===0?type.color:type.aura;const col=[parseInt(color.slice(1,3),16)/255,parseInt(color.slice(3,5),16)/255,parseInt(color.slice(5,7),16)/255,1];aura.triangle(V(Math.cos(a)*1.18,0,Math.sin(a)*2.35),V(Math.cos(b)*1.18,0,Math.sin(b)*2.35),V(Math.cos(tip)*1.04,.65+i%3*.22,Math.sin(tip)*2.15),col);}
      if(type.id==='drift')for(const side of [-1,1])for(let i=0;i<5;i++)aura.triangle(V(side*.7,.6,-1),V(side*(2+i*.13),1.5-i*.15,-1.5),V(side*1.2,.45,-1.65),[.65,.94,1,1]);this.focusAuras[type.id]=aura.upload(gl);
    }
    this.reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.buildBossMeshes();
    this.buildMenuScene();
    this.setNetworkPlayers([{car:'rx7'},{car:'r32'}]);
  }
  initAtlas(){
    const gl=this.gl;this.atlas=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.activeTexture(gl.TEXTURE0);
    this.atlasReady=new Promise(resolve=>{const img=new Image();img.onload=()=>{gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,this.textureGrad?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic');if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));gl.activeTexture(gl.TEXTURE0);this.atlasLoaded=true;resolve(true);};img.onerror=()=>{this.atlasError=true;resolve(false);};img.src=new URL('../assets/environment/atlas.png',import.meta.url).href;});
  }
  buildBossMeshes(){
    const light=hex=>[...rgb(hex).slice(0,3),1],ring=(g,color,vertical=false,y=.1)=>{
      for(let i=0;i<48;i++){const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;
        const point=(t,scale)=>vertical?V(Math.cos(t)*1.5*scale,1.15+Math.sin(t)*1.35*scale,0):V(Math.cos(t)*1.48*scale,y,Math.sin(t)*2.65*scale);
        g.quad(point(a,.97),point(b,.97),point(b,1.03),point(a,1.03),light(color));
      }
    };
    const ray=new Geometry();for(const x of [-.65,0,.65]){
      ray.quad(V(x-.035,.05,0),V(x+.035,.05,0),V(x+.09,8.5,0),V(x-.09,8.5,0),light('#e1f6ff'));
      ray.quad(V(0,.05,x-.035),V(0,.05,x+.035),V(0,8.5,x+.09),V(0,8.5,x-.09),light('#b3dbff'));
    }ray.quad(V(-.33,.1,0),V(.33,.1,0),V(.7,8.5,0),V(-.7,8.5,0),light('#487eac'));ring(ray,'#e1f6ff');this.bossRay=ray.upload(this.gl);
    const divine=new Geometry();ring(divine,'#fff5c7',true);ring(divine,'#ffffff',false,.2);ring(divine,'#e5c986',false,1.7);
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2,x=Math.cos(a)*1.5,z=Math.sin(a)*2.5;divine.triangle(V(x-.09,.2,z),V(x+.09,.2,z),V(x,2.3+(i%3)*.17,z),light(i%3?'#fff4d5':'#ffffff'));}
    this.bossDivine=divine.upload(this.gl);
    const flow=new Geometry();ring(flow,'#ffe282',false,.1);ring(flow,'#76aaff',false,1.8);
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;flow.triangle(V(Math.cos(a)*1.45,.1,Math.sin(a)*2.6),V(Math.cos(b)*1.45,.1,Math.sin(b)*2.6),V(Math.cos(a)*1.25,1.6+(i%3)*.3,Math.sin(a)*2.25),light(i%3?'#639aff':'#ffe282'));}this.bossFlow=flow.upload(this.gl);
    const crimson=new Geometry();ring(crimson,'#ff657b',false,.1);ring(crimson,'#ff859b',true);
    for(let i=0;i<30;i++){const a=i/30*Math.PI*2,b=(i+1)/30*Math.PI*2,c=light(i%3?'#ff345b':'#ffd2de');crimson.triangle(V(Math.cos(a)*1.4,.05,Math.sin(a)*2.55),V(Math.cos(b)*1.4,.05,Math.sin(b)*2.55),V(Math.cos(a)*1.2,1.7+i%4*.25,Math.sin(a)*2.3),c);}
    this.bossCrimson=crimson.upload(this.gl);
    const sparks=new Geometry();for(let i=0;i<22;i++){const a=i*2.39996,x=Math.cos(a)*(1.4+(i%4)*.12),z=Math.sin(a)*(2.4+(i%3)*.12),y=.35+(i%7)*.27,s=.035+(i%3)*.015;sparks.quad(V(x-s,y,z),V(x,y+s*2,z),V(x+s,y,z),V(x,y-s*2,z),light('#ffe3e9'));}
    this.bossSparks=sparks.upload(this.gl);
  }
  drawBoss(r,q,angle){
    const boss=r.boss;if(!boss)return;const gl=this.gl,still=this.reducedMotion?.matches,clock=still?0:r.elapsed;
    gl.depthMask(false);gl.uniform1f(this.uniforms.uLampState,1);gl.uniform1f(this.uniforms.uBrake,1);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    if(boss.id==='shinji-campaign'&&boss.ray>0)this.draw(this.bossRay,transform(q.x,q.y+.06,q.z,angle),still?.15:.5*Math.min(1,boss.ray/.25));
    if(boss.id==='takumi-project'){
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      if(boss.blur>.02&&!still){
        // Local afterimages of this rival only; the road, braking markers and HUD stay sharp.
        for(let i=4;i>=1;i--){const old=worldAt(this.track,r.rivalS-i*1.6,r.rivalLateral);this.draw(this.cars['rival-'+r.rival.id],transform(old.x,old.y+.05,old.z,old.heading+r.rivalYaw),boss.blur*(.13-i*.022));}
        for(const side of [-1,1])this.draw(this.cars['rival-'+r.rival.id],transform(q.x+Math.cos(angle)*side*.09,q.y+.04,q.z-Math.sin(angle)*side*.09,angle),boss.blur*.08);
      }
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      if(boss.wings>0)this.draw(this.focusAuras.drift,transform(q.x,q.y+.08,q.z,angle),still?.18:.55*Math.min(1,boss.wings/.4));
    }
    if(boss.id==='keisuke-project'&&boss.flow>0){this.draw(this.bossFlow,transform(q.x,q.y+.1,q.z,angle),.4*Math.min(1,boss.flow/.4));this.draw(this.bossSparks,transform(q.x,q.y,q.z,angle+clock*.45),.38);}
    if(boss.id==='beckenbauer'){this.draw(this.bossDivine,transform(q.x,q.y+.07,q.z,angle),.48);this.draw(this.bossDivine,transform(q.x,q.y+.07,q.z,angle,1.13),.09);this.draw(this.bossSparks,transform(q.x,q.y,q.z,angle+clock*.4),.38);}
    if(boss.id==='kanata-final'&&boss.enraged){const pulse=still?1:.92+Math.sin(clock*5)*.08;this.draw(this.bossCrimson,transform(q.x,q.y+.08,q.z,angle),pulse*(boss.boost>0?.50:.34));this.draw(this.bossSparks,transform(q.x,q.y,q.z,angle+clock*.7),pulse*.44);}
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
  }
  buildMenuScene(){
    const gl=this.gl,g=new Geometry(),sky=new Geometry(),hills=new Geometry(),lights=new Geometry();
    // A separate overlook leaves the race geometry and collision corridors untouched.
    sky.quad(V(-2200,-400,-1400),V(2200,-400,-1400),V(2200,900,-1400),V(-2200,900,-1400),[.13,.20,.29,1]);
    const colorQuad=(a,b,c,d,low,high)=>{const normal=[0,0,1];for(const [v,col]of [[a,low],[b,low],[c,high],[a,low],[c,high],[d,high]])sky.data.push(...v,...normal,...col);};
    colorQuad(V(-2200,-100,-1300),V(2200,-100,-1300),V(2200,430,-1300),V(-2200,430,-1300),[.61,.58,.57,1],[.12,.19,.29,1]);
    this.menuSky=sky.upload(gl);
    let seed=826;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let layer=0;layer<4;layer++){
      const z=-1000+layer*205,step=110-layer*15,colors=['#75818a','#5a6d7d','#3c5365','#293f50'];
      let a=V(-1800,40+rand()*130-layer*25,z);
      for(let i=1;i<40;i++){const b=V(-1800+i*step,20+rand()*(145-layer*12)-layer*18,z+rand()*12);hills.quad(V(a[0],-280,a[2]),V(b[0],-280,b[2]),b,a,colors[layer]);a=b;}
    }
    this.menuHills=hills.upload(gl);
    g.quad(V(-80,-.03,-45),V(80,-.03,-45),V(80,-.03,60),V(-80,-.03,60),'#3c4249');
    // Parking marks and the low concrete edge of the viewing point.
    for(let i=-3;i<5;i++)g.box((i+.5)*3.9,.006,-.3,.07,.012,7.9,'#a3a8ac');
    g.box(0,.009,-4.25,36,.018,.09,'#a3a8ac');
    g.box(0,.20,-10,140,.40,.8,'#666e74');
    for(let x=-64;x<=68;x+=4){g.box(x,.9,-10,.11,1.45,.11,'#687785');g.box(x,1.4,-10,4.15,.16,.13,'#93a0ab');g.box(x,1.05,-10,4.15,.10,.12,'#81909b');}
    for(const x of [-16,3]){
      g.box(x,2.85,-7,.15,5.7,.15,'#39434b');g.box(x-.65,5.7,-7,1.5,.12,.16,'#39434b');
      g.box(x-1.18,5.6,-7,.64,.09,.36,[1,.72,.36,1]);
      for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;lights.triangle(V(x-1.1,.025,-6),V(x-1.1+Math.cos(a)*4.8,.025,-6+Math.sin(a)*4),V(x-1.1+Math.cos(b)*4.8,.025,-6+Math.sin(b)*4),[.91,.78,.58,1]);}
    }
    for(const [x,z,h]of [[-27,-8,15],[-34,-12,19],[24,-16,16],[30,-18,21],[-42,-22,24],[39,-24,22]]){
      g.box(x,h*.36,z,.52,h*.72,.52,'#45494a');
      for(let i=0;i<4;i++)g.cone(x,h*(.18+i*.16),z,h*(.25-i*.045),h*.45,i%2?'#253d40':'#2b4245',9);
    }
    // A few lights on the distant mountain road, below the horizon.
    for(let i=0;i<35;i++){const x=-150+i*11,z=-155+Math.sin(i*.28)*16,y=-15+Math.sin(i*.19)*6;g.box(x,y,z,.24,.20,.24,[.94,.79,.55,1]);}
    this.menuGround=g.upload(gl);this.menuLightPools=lights.upload(gl);
  }
  renderMenu(mode,w,h){
    const gl=this.gl,u=this.uniforms,mobile=w/h<.85,garage=mode==='garage',workshop=mode==='workshop';
    const drift=this.reducedMotion?.matches?0:Math.sin(this.time*.08)*.24;
    const eye=mobile?(workshop?[8.5,3.4,12.3]:[9.5,3.8,13.8]):[8.4+drift,2.65,10.8-drift],target=mobile?(workshop?[0,.4,.3]:[-.2,1.8,.3]):[workshop?2.5:garage?0:-3.1,.95,1.35];
    this.eye=eye;this.target=target;
    gl.uniformMatrix4fv(u.uView,false,lookAt(eye,target));gl.uniformMatrix4fv(u.uProjection,false,perspective((mobile?49:38)*Math.PI/180,w/h,.15,2500));
    gl.uniform3fv(u.uFog,[.20,.28,.36]);gl.uniform3fv(u.uEye,eye);gl.uniform1f(u.uDay,.9);gl.uniform1f(u.uTunnel,0);gl.uniform4fv(u['uStreetLights[0]'],new Float32Array(12));gl.uniform1f(u.uFogStart,240);gl.uniform1f(u.uFogEnd,1600);gl.uniform1f(u.uFogFromCar,0);
    gl.uniform3fv(u.uCar,[0,0,0]);gl.uniform2fv(u.uForward,[0,1]);gl.uniform1f(u.uHeadlights,1);gl.uniform1f(u.uRivalLights,0);
    gl.uniform4fv(u['uNetCars[0]'],new Float32Array(12));gl.uniform2fv(u['uNetForward[0]'],new Float32Array(6));gl.uniform1f(u.uLampState,1);gl.uniform1f(u.uBrake,0);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);this.draw(this.menuSky);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
    this.draw(this.menuHills);this.draw(this.moon,transform(-650,150,-900,0,.4));this.draw(this.menuGround);
    this.draw(this.shadow,transform(0,0,0),.55);this.draw(this.cars[this.car.id],transform(0,.035,0));
    gl.depthMask(false);this.draw(this.menuLightPools,identity(),.12);gl.depthMask(true);
  }
  setCar(car) {this.car=car;this.meshLooks??={};const key=car.id,look=appearanceKey(car);if(!this.cars[key]||this.meshLooks[key]!==look){if(this.cars[key])this.gl.deleteBuffer?.(this.cars[key].buffer);this.cars[key]=meshCar(this.gl,car.color,car.id,car.build);this.meshLooks[key]=look;}}
  setNetworkPlayers(players){
    this.meshLooks??={};const keep=new Set();for(const p of players){const base=CARS.find(c=>c.id===p.car);if(!base)continue;const car=applyBuild(base,p.build),key='network-'+(p.id||car.id),look=appearanceKey(car);keep.add(key);
      if(!this.cars[key]||this.meshLooks[key]!==look){if(this.cars[key])this.gl.deleteBuffer?.(this.cars[key].buffer);this.cars[key]=meshCar(this.gl,car.color,car.id,car.build);this.meshLooks[key]=look;}
    }
    for(const key of this.networkKeys||[])if(!keep.has(key)&&!CARS.some(c=>key==='network-'+c.id)){this.gl.deleteBuffer?.(this.cars[key]?.buffer);delete this.cars[key];delete this.meshLooks[key];}this.networkKeys=keep;
  }
  setRival(rival){this.rival=rival;const key='rival-'+rival.id;if(!this.cars[key])this.cars[key]=meshCar(this.gl,rival.color,rival.car);}
  setTrack(track) {
    this.track=track;const gl=this.gl;
    if(this.scene)gl.deleteBuffer(this.scene.buffer);if(this.backdrop)gl.deleteBuffer(this.backdrop.buffer);
    const g=new Geometry(),roadIndex=createRoadIndex(track);this.sceneryBounds=[];let seed=track.seed*11231;
    const chunks=[];let chunkStart=6;
    const endChunk=()=>{const end=g.data.length/14;if(end===chunkStart)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=chunkStart*14;i<g.data.length;i+=14)for(let a=0;a<3;a++){min[a]=Math.min(min[a],g.data[i+a]);max[a]=Math.max(max[a],g.data[i+a]);}chunks.push({first:chunkStart,count:end-chunkStart,min,max});chunkStart=end;};
    const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const point=(p,l,y=0)=>V(p.x+Math.cos(p.heading)*l,p.y+y,p.z-Math.sin(p.heading)*l);
    const strip=(a,b,l1,l2,y,color)=>g.quad(point(a,l1,y),point(b,l1,y),point(b,l2,y),point(a,l2,y),color);
    const environment=this.environment=createEnvironment(track,g,roadIndex,this.sceneryBounds);
    const minY=Math.min(...track.points.map(p=>p.y))-75;
    const minX=Math.min(...track.points.map(p=>p.x))-1500,maxX=Math.max(...track.points.map(p=>p.x))+1500,minZ=Math.min(...track.points.map(p=>p.z))-1500,maxZ=Math.max(...track.points.map(p=>p.z))+1500;
    g.quad(V(minX,minY,minZ),V(minX,minY,maxZ),V(maxX,minY,maxZ),V(maxX,minY,minZ),track.theme==='city'?'#263b3e':'#22372d');
    for(let i=0;i<track.points.length-1;i++) {
      const a=track.points[i],b=track.points[i+1];
      // Narrow vertical embankments cannot stretch over another hairpin.
      for(const side of [-1,1])g.quad(point(a,side*5.58,-.12),point(b,side*5.58,-.12),point(b,side*5.58,-38),point(a,side*5.58,-38),track.theme==='autumn'?'#5a5142':'#35453c');
      g.surface(point(a,-5.3),point(b,-5.3),point(b,5.3),point(a,5.3),TEXTURES.asphalt,[[0,a.s/5],[0,b.s/5],[2.65,b.s/5],[2.65,a.s/5]],[1.15,1.15,1.15,0]);
      strip(a,b,-5.55,-5.3,.015,'#737771');strip(a,b,5.3,5.55,.015,'#737771');
      strip(a,b,-4.9,-4.78,.025,'#d0d2bb');strip(a,b,4.78,4.9,.025,'#d0d2bb');
      if(i%3!==0){strip(a,b,-.11,-.03,.03,'#cb9c4d');strip(a,b,.03,.11,.03,'#cb9c4d');}
      for(const side of [-1,1]) {
        strip(a,b,side*5.65,side*5.68,.75,'#9aaba8');strip(a,b,side*5.65,side*5.68,.97,'#aeb7b0');
        g.quad(point(a,side*5.68,.75),point(b,side*5.68,.75),point(b,side*5.68,.97),point(a,side*5.68,.97),'#a6b0a8');
        if(i%4===0){const p=point(a,side*5.68,.45);g.box(...p,.09,.9,.10,'#808c87');const q=point(a,side*5.62,.99);g.box(...q,.09,.10,.18,side<0?[.95,.18,.08,.12]:[.9,.88,.6,.12]);}
      }
      environment.step(i,a,b);
      if(i===4){for(const side of [-1,1]){const p=point(a,side*6.5,2.8);g.box(...p,.2,5.6,.2,'#747e83');}g.surface(point(a,-6.5,5.1),point(a,6.5,5.1),point(a,6.5,6.5),point(a,-6.5,6.5),TEXTURES.billboard_generic);}
      if(i===Math.floor(track.length/track.step))for(let k=0;k<12;k++)strip(a,b,-5.2+k*.87,-5.2+(k+1)*.87,.04,k%2?'#d1d2bd':'#171f22');
      if(i%24===23)endChunk();
    }
    endChunk();this.scene=g.upload(gl);this.scene.chunks=chunks;
    const bg=new Geometry();
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+1)/8*Math.PI*2,p=(angle,y,r)=>V(Math.sin(angle)*r,y,Math.cos(angle)*r);bg.surface(p(a,-900,1400),p(b,-900,1400),p(b,1100,1400),p(a,1100,1400),TEXTURES.sky_day,[[i/4,0],[(i+1)/4,0],[(i+1)/4,1],[i/4,1]],undefined,TEXTURES.sky_night);}
    for(let layer=0;layer<2;layer++)for(let i=0;i<12;i++){const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2,r=1000-layer*150,y=-100-layer*30,p=(angle,height)=>V(Math.sin(angle)*r,height,Math.cos(angle)*r);bg.surface(p(a,y),p(b,y),p(b,y+260-layer*20),p(a,y+260-layer*20),TEXTURES[layer?'mountains_mid':'mountains_far'],[[i%3/3,0],[(i%3+1)/3,0],[(i%3+1)/3,1],[i%3/3,1]],[.8,.88,.89,0]);}this.backdrop=bg.upload(gl);
    this.resetCamera=true;
  }
  draw(mesh,model=IDENTITY,alpha=1,first=0,count=mesh?.count) {if(!mesh)return;const gl=this.gl,u=this.uniforms;if(this.boundBuffer!==mesh.buffer){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);const a=this.attrs;gl.enableVertexAttribArray(a.aPos);gl.vertexAttribPointer(a.aPos,3,gl.FLOAT,false,56,0);gl.enableVertexAttribArray(a.aNormal);gl.vertexAttribPointer(a.aNormal,3,gl.FLOAT,false,56,12);gl.enableVertexAttribArray(a.aColor);gl.vertexAttribPointer(a.aColor,4,gl.FLOAT,false,56,24);gl.enableVertexAttribArray(a.aSurface);gl.vertexAttribPointer(a.aSurface,4,gl.FLOAT,false,56,40);this.boundBuffer=mesh.buffer;}gl.uniformMatrix4fv(u.uModel,false,model);gl.uniform1f(u.uAlpha,alpha);gl.drawArrays(gl.TRIANGLES,first,count);if(this.stats){this.stats.drawCalls++;this.stats.vertices+=count;}}
  drawScene(view,projection,origin,far){
    if(this.culling===false||!this.scene.chunks){this.draw(this.scene);return;}
    const planes=viewPlanes(view,projection,this.planes);this.draw(this.scene,IDENTITY,1,0,6);
    for(const chunk of this.scene.chunks)if(chunkVisible(chunk,planes,origin,far)){this.draw(this.scene,IDENTITY,1,chunk.first,chunk.count);this.stats.chunks++;}
    this.stats.totalChunks+=this.scene.chunks.length;
  }
  drawWorld(race,racing,p,angle,eye,target,aspect,fov,day,sky,hidePlayer=false){
    const gl=this.gl,u=this.uniforms,rival=racing&&race.mode!=='time'?worldAt(this.track,race.rivalS,race.rivalLateral):null;
    const others=racing?(race.netOpponents||[]).slice(0,3).map(o=>({...o,world:worldAt(this.track,o.s,o.lateral)})):[],netCars=new Float32Array(12),netForward=new Float32Array(6);
    others.forEach((o,i)=>{const q=o.world,a=q.heading+o.yaw;netCars.set([q.x,q.y,q.z,o.headlights?1:0],i*4);netForward.set([Math.sin(a),Math.cos(a)],i*2);});
    gl.uniform4fv(u['uNetCars[0]'],netCars);gl.uniform2fv(u['uNetForward[0]'],netForward);
    const view=lookAt(eye,target),projection=perspective(fov*Math.PI/180,aspect,.15,2200);
    gl.uniformMatrix4fv(u.uView,false,view);gl.uniformMatrix4fv(u.uProjection,false,projection);
    gl.uniform3fv(u.uFog,sky);gl.uniform3fv(u.uEye,eye);gl.uniform3fv(u.uCar,[p.x,p.y,p.z]);gl.uniform2fv(u.uForward,[Math.sin(angle),Math.cos(angle)]);
    const visibility=raceVisibility(race,day);
    this.streetLightData??=new Float32Array(12);
    if(this.lightingEnvironment!==this.environment||this.time-(this.lightingAt??-1)>.15){this.lightingEnvironment=this.environment;this.lightingAt=this.time;this.streetLightData.fill(0);const nearest=[];for(const lamp of this.environment?.lights||[]){const distance=(lamp.x-p.x)**2+(lamp.z-p.z)**2;if(distance>22500)continue;nearest.push({lamp,distance});nearest.sort((a,b)=>a.distance-b.distance);if(nearest.length>3)nearest.pop();}nearest.forEach(({lamp},i)=>this.streetLightData.set([lamp.x,lamp.y,lamp.z,lamp.power],i*4));}
    gl.uniform4fv(u['uStreetLights[0]'],this.streetLightData);const tunnel=this.environment?.tunnels.find(z=>race?.s>=z.start&&race?.s<=z.end);gl.uniform1f(u.uTunnel,tunnel?clamp(Math.min(race.s-tunnel.start,tunnel.end-race.s)/14,0,1):0);
    gl.uniform1f(u.uDay,day?1:!racing?.55:0);gl.uniform1f(u.uFogStart,visibility.near);gl.uniform1f(u.uFogEnd,visibility.far);gl.uniform1f(u.uFogFromCar,visibility.fromCar?1:0);
    gl.uniform1f(u.uHeadlights,!racing||race.headlights?1:0);gl.uniform1f(u.uRivalLights,rival?1:0);
    const ra=rival?rival.heading+race.rivalYaw:0;gl.uniform3fv(u.uRivalCar,rival?[rival.x,rival.y,rival.z]:[0,0,0]);gl.uniform2fv(u.uRivalForward,[Math.sin(ra),Math.cos(ra)]);
    gl.uniform1f(u.uLampState,1);gl.uniform1f(u.uBrake,0);
    gl.depthMask(false);gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(u.uBackdrop,1);this.draw(this.backdrop,transform(eye[0],eye[1]-100,eye[2]));gl.uniform1f(u.uBackdrop,0);
    if(!day)this.draw(this.moon,transform(eye[0]+310,eye[1]+245,eye[2]+850));
    gl.depthMask(true);gl.enable(gl.DEPTH_TEST);this.drawScene(view,projection,visibility.fromCar?[p.x,p.y,p.z]:eye,visibility.far+2);
    if(!hidePlayer){this.draw(this.shadow,transform(p.x,p.y,p.z,angle),.45);gl.uniform1f(u.uLampState,!racing||race.headlights?1:0);gl.uniform1f(u.uBrake,race?.braking?1:0);this.draw(this.cars[this.car.id],transform(p.x,p.y+.04,p.z,angle));if(race?.focus?.remaining>0){gl.depthMask(false);this.draw(this.focusAuras[race.focus.type]||this.focusAuras.balance,transform(p.x,p.y+.08,p.z,angle),.19);gl.depthMask(true);}}
    gl.uniform1f(u.uLampState,1);gl.uniform1f(u.uBrake,race?.rivalBraking?1:0);
    if(rival){this.draw(this.shadow,transform(rival.x,rival.y,rival.z,ra),.4);this.draw(this.cars['rival-'+race.rival.id],transform(rival.x,rival.y+.04,rival.z,ra));this.drawBoss(race,rival,ra);}
    for(const o of others){const q=o.world,a=q.heading+o.yaw;gl.uniform1f(u.uLampState,o.headlights?1:0);gl.uniform1f(u.uBrake,o.braking?1:0);this.draw(this.shadow,transform(q.x,q.y,q.z,a),.4);this.draw(this.cars['network-'+o.id]||this.cars['network-'+o.carId],transform(q.x,q.y+.04,q.z,a));if(o.focus?.remaining>0){gl.depthMask(false);this.draw(this.focusAuras[o.focus.type]||this.focusAuras.balance,transform(q.x,q.y+.08,q.z,a),.19);gl.depthMask(true);}}
    gl.uniform1f(u.uLampState,1);
    gl.uniform1f(u.uBrake,0);
  }
  initMirror(){
    const gl=this.gl,w=384,h=112;
    this.mirrorWidth=w;this.mirrorHeight=h;
    this.mirrorFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.mirrorFbo);
    this.mirrorTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.mirrorTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.mirrorTexture,0);
    this.mirrorDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,this.mirrorDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.mirrorDepth);
    this.mirrorReady=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
    this.mirrorProgram=gl.createProgram();const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 aPosition;uniform vec4 uRect;varying vec2 vUv;void main(){vUv=aPosition;gl_Position=vec4(uRect.xy+aPosition*uRect.zw,0.,1.);}'),fragment=compile(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D uImage;varying vec2 vUv;void main(){gl_FragColor=texture2D(uImage,vec2(1.-vUv.x,vUv.y));}');gl.attachShader(this.mirrorProgram,vertex);gl.attachShader(this.mirrorProgram,fragment);gl.linkProgram(this.mirrorProgram);if(!gl.getProgramParameter(this.mirrorProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.mirrorProgram));gl.deleteShader(vertex);gl.deleteShader(fragment);
    this.mirrorPosition=gl.getAttribLocation(this.mirrorProgram,'aPosition');this.mirrorRect=gl.getUniformLocation(this.mirrorProgram,'uRect');this.mirrorSampler=gl.getUniformLocation(this.mirrorProgram,'uImage');
    this.mirrorQuad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.mirrorQuad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);this.boundBuffer=null;
  }
  renderMirror(race,p,angle,day,sky,w,h){
    if(!this.mirrorFbo)this.initMirror();if(!this.mirrorReady)return;
    const gl=this.gl,mw=this.mirrorWidth,mh=this.mirrorHeight;
    if(this.time-(this.mirrorTime??-1)>=1/(this.quality<=1||this.resolutionScale<.85?16:24)){
    this.mirrorTime=this.time;const pose=rearCameraPose(this.track,race);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.mirrorFbo);gl.viewport(0,0,mw,mh);gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    this.drawWorld(race,true,p,angle,pose.eye,pose.target,mw/mh,23,day,sky,true);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);this.stats.mirrorPasses++;
    }
    // Compose directly from the GPU texture. The cockpit canvas clears just this
    // opening, keeping its frame above the image without any readPixels stalls.
    const cw=this.canvas.clientWidth,ch=this.canvas.clientHeight,layout=mirrorLayout(cw,ch),s=layout.scale;
    gl.useProgram(this.mirrorProgram);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.bindBuffer(gl.ARRAY_BUFFER,this.mirrorQuad);gl.enableVertexAttribArray(this.mirrorPosition);gl.vertexAttribPointer(this.mirrorPosition,2,gl.FLOAT,false,8,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.mirrorTexture);gl.uniform1i(this.mirrorSampler,0);gl.uniform4f(this.mirrorRect,-1+2*layout.x*s/cw,1-2*(layout.y+layout.height)*s/ch,2*layout.width*s/cw,2*layout.height*s/ch);gl.drawArrays(gl.TRIANGLES,0,6);this.stats.drawCalls++;this.stats.vertices+=6;gl.bindTexture(gl.TEXTURE_2D,null);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);this.boundBuffer=null;
  }
  render(race,mode,dt,options={}) {
    if(!this.track||!this.car)return;
    this.time+=dt;const gl=this.gl,u=this.uniforms,canvas=this.canvas;
    this.stats={drawCalls:0,vertices:0,chunks:0,totalChunks:0,mirrorPasses:0};
    const dpr=Math.min(window.devicePixelRatio||1,this.quality)*this.resolutionScale,w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
    Object.assign(this.stats,{width:w,height:h,scale:this.resolutionScale});
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
    const racing=mode==='race'||mode==='paused'||mode==='results';
    const day=options.day?1:0,sky=raceVisibility(racing?race:null,day).color;
    gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.uniform1i(u.uAtlas,1);gl.uniform1f(u.uAtlasReady,this.atlasLoaded?1:0);gl.activeTexture(gl.TEXTURE0);
    if(!racing&&mode!=='title'){this.renderMenu(mode,w,h);return;}
    const s=racing?race.s:340+(this.time*32)%Math.max(100,this.track.length-750),lat=racing?race.lateral:-1.7,p=worldAt(this.track,s,lat),angle=p.heading+(racing?race.yaw:Math.sin(this.time*.5)*.025);
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
      const look=worldAt(this.track,s+16,0),a=p.heading;
      eye=[p.x-Math.sin(a)*11+Math.cos(a)*4.5,p.y+3.0,p.z-Math.cos(a)*11-Math.sin(a)*4.5];
      target=[look.x,look.y+1.1,look.z];this.eye=eye;this.target=target;
    }
    const shake=racing&&options.shake!==false?race.collision*.12:0;
    const actualEye=this.eye.map((v,i)=>v+(i<2?Math.sin(this.time*95+i)*shake:0));
    const demo=mode==='title'?{mode:'time',headlights:true,netOpponents:[{carId:'rx7',s:s+18,lateral:1.4,yaw:0,headlights:true},{carId:'r32',s:s+38,lateral:-1.5,yaw:0,headlights:true}]}:null;
    this.drawWorld(demo||race,racing||!!demo,p,angle,actualEye,this.target,w/h,racing?(this.cameraMode===3?65:58)+race.speed*.18:49,mode==='title'?true:day,mode==='title'?[.12,.17,.24]:sky,racing&&[1,3].includes(this.cameraMode));
    if(racing&&race.drift>.3&&race.speed>12&&mode==='race')for(const side of [-1,1])if(this.particles.length<48&&Math.random()<1-Math.exp(-dt*63))this.particles.push({x:p.x+Math.cos(angle)*side*.8-Math.sin(angle)*1.3,y:p.y+.32,z:p.z-Math.sin(angle)*side*.8-Math.cos(angle)*1.3,life:1,size:.2+Math.random()*.2});
    gl.depthMask(false);this.particles=this.particles.filter(v=>v.life>0);for(const v of this.particles){v.life-=dt*.85;v.y+=dt*.35;v.size+=dt*.65;this.draw(this.smoke,transform(v.x,v.y,v.z,v.life,v.size),v.life*.13);}gl.depthMask(true);
    if(racing&&this.cameraMode===3)this.renderMirror(race,p,angle,day,sky,w,h);
  }
}
