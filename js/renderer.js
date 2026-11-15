import {COMPLEMENT_MODELS} from './roadside-complements.mjs';
import {createTerrainField} from './terrain-field.mjs';
import {PART2_MODELS} from './scenery-part2.mjs';
import {packScene,boundsDistance,chunkOpacity} from './scene-batches.mjs';
import {applyBuild,appearanceKey} from './tuning.mjs';
import { ALL_CARS as CARS, sample, worldAt, mix, clamp } from './sim.mjs';
import { createRoadIndex } from './scenery.mjs';
import {FOCUS_TYPES} from './focus.mjs';
import {chunkVisible,viewPlanes,mirrorLayout} from './render-performance.mjs';
import {createEnvironment} from './environment.mjs';
import {TEXTURES} from './scenery-assets.mjs';
import {MenuModel,parseMenuModel} from './menu-model.mjs';
import {VehicleModels,ORIGINAL_CARS} from './vehicle-model.mjs';
import {CabinView} from './cabin-view.js';
import {cabinProfile} from './cabin-geometry.mjs';
import {DriverCamera} from './driver-camera.mjs';
import {landmarkUrl,TURBINE_ROTOR} from './route-landmarks.mjs';

const V = (x=0,y=0,z=0) => [x,y,z];
const sceneryModel=(pack,name)=>new URL(`../assets/touge_city_assets_part${pack}/models/${name}.glb`,import.meta.url);
const SKID_SEGMENTS=256, SKID_VERTICES=12, SKID_BYTES=SKID_VERTICES*14*4;
const GARAGE_FIXTURES=[
  ['workbench_pegboard',1.35,[-4.3,0,-6.6]],
  ['toolbox_small',1.22,[-4.02,1.3,-6.55]],
  ['toolbox_rolling_chest',1.4,[3.4,0,-5.1]],
  ['tire_rack_3x4',1.28,[.3,0,-7.85]],
  ['tire_stack_4',1.4,[-6.65,0,-.75]],
  ['shelf_parts',1.3,[4.5,0,-7.65]],
  ['crate_parts',1.42,[2.3,0,-6.3]],
  ['sign_garage_hanging',1.55,[-.7,4.1,-8.85]],
  ['poster_frame_a',1.4,[4.7,3.55,-8.84]]
];
const WORKSHOP_FIXTURES=[
  ['tire_changer',1.4,[-5.9,0,-3.65]],
  ['hydraulic_jack',1.25,[3.1,.446,-1.6]],
  ['work_light_stand',1.3,[-6.4,0,-.1]],
  ['air_compressor',1.32,[5.55,0,-5.6]],
  ['wheel_rim_loose',1.3,[3.85,0,-5.15]]
];
function roadBankHeight(track,curve,lateral){
  if(!track.visualBank)return 0;
  const fade=clamp(1-(Math.abs(lateral)-4.5)*.5,0,1);
  return lateral*clamp(-curve*2.6,-track.visualBank,track.visualBank)*fade;
}
function visualRoadPose(track,s,lateral=0){
  const p=worldAt(track,s,lateral);
  p.y+=roadBankHeight(track,p.curve,lateral);
  return p;
}
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => { const l = Math.hypot(...a)||1; return a.map(v=>v/l); };
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export function courseSky(trackId,day,wet){
  if(wet)return day?'rain':'nightrain';
  if(!day)return 'night';
  return ['tsubaki','manazuru'].includes(trackId)?'sunset':'day';
}
export function raceVisibility(race,day){
  // Ashinoko is a short-range navigation challenge. Measure from the car so
  // chase, bonnet, cockpit and mirrors all share the same world visibility.
  if(race?.fog&&race.track?.id==='ashinoko')return {near:8,far:60,color:[.64,.68,.72],fromCar:true};
  if(race?.fog)return {near:35,far:185,color:[.55,.62,.69],fromCar:false};
  if(race?.wet)return day?{near:75,far:640,color:[.35,.44,.52],fromCar:false}:{near:55,far:340,color:[.032,.050,.069],fromCar:false};
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
function lookAt(eye,target,up=[0,1,0]) { const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x); return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]); }

class Geometry {
  constructor() { this.data=[]; }
  triangle(a,b,c,color,uv=null,tiles=[-1,-1]) { const n=norm(cross(sub(b,a),sub(c,a))),col=rgb(color);let i=0;for(const p of [a,b,c])this.data.push(...p,...n,...col,...(uv?.[i++]||[0,0]),...tiles); }
  quad(a,b,c,d,color,tiles) { this.triangle(a,b,c,color,null,tiles); this.triangle(a,c,d,color,null,tiles); }
  surface(a,b,c,d,texture,uv=[[0,0],[1,0],[1,1],[0,1]],tint=[1,1,1,0],night=texture){this.triangle(a,b,c,tint,[uv[0],uv[1],uv[2]],[texture,night]);this.triangle(a,c,d,tint,[uv[0],uv[2],uv[3]],[texture,night]);}
  box(x,y,z,w,h,d,c,tiles) {
    const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;
    this.quad(V(x0,y1,z0),V(x0,y1,z1),V(x1,y1,z1),V(x1,y1,z0),c,tiles);
    this.quad(V(x0,y0,z1),V(x0,y1,z1),V(x0,y1,z0),V(x0,y0,z0),c,tiles);
    this.quad(V(x1,y0,z0),V(x1,y1,z0),V(x1,y1,z1),V(x1,y0,z1),c,tiles);
    this.quad(V(x0,y0,z1),V(x1,y0,z1),V(x1,y1,z1),V(x0,y1,z1),c,tiles);
    this.quad(V(x1,y0,z0),V(x0,y0,z0),V(x0,y1,z0),V(x1,y1,z0),c,tiles);
    this.quad(V(x0,y0,z0),V(x1,y0,z0),V(x1,y0,z1),V(x0,y0,z1),c,tiles);
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
  const variant=spec?.body,hatch=variant==='hatch',sport=['rx7','mr2','s2000','gt86','supra'].includes(id),wide=id==='r32',coupe=id==='ae86coupe'||silvia,sileighty=id==='sileighty',w=spec?.width||(wide?1.88:supra?1.84:roadster?1.75:1.72);
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
  const roofY=hatch?1.34:roadster?1.14:supra?1.19:sport?1.10:wide?1.32:silvia?1.23:1.27,roofW=w*(sport?.67:.73),rearGlassEnd=hatch?-1.93:wide||coupe||midship?-1.28:roadster?-1.0:-1.61;
  const roofRear=hatch?-1.40:roadster?-.70:midship?-.60:-.94;
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
  if((sport||wide||sileighty||silvia)&&!['roadster','hatch','sedan','integra'].includes(variant)) {const wingY=supra?1.29:roadster?.83:id==='gt86'?.83:1.04;g.box(0,wingY,-1.9,w*.96,.065,.24,body);for(const x of [-.6,.6])g.box(x,(wingY+.76)/2,-1.9,.06,wingY-.76,.1,trim);}
  if(hatch)g.box(0,1.31,-1.47,w*.69,.062,.22,trim);
  if(['evo','gt'].includes(variant)){
    g.box(0,.46,2.176,w*.57,.19,.022,black);
    g.box(0,variant==='evo'?.745:.70,variant==='evo'?1.47:1.81,.55,.026,.18,trim);
    g.box(0,1.29,-1.88,w*.90,.065,.25,body);
    for(const side of [-1,1])g.box(side*.58,1.04,-1.88,.06,.5,.11,trim);
  }
  if(variant==='integra')for(const x of [-.66,-.48,.48,.66])g.cylinderZ(x,.68,2.142,.073,.027,[.85,.93,.8,1]);
  if(variant==='fc')g.box(0,.664,-2.159,w*.82,.135,.022,'#3f1118');
  if(modelId==='ek9spoon')g.box(0,.747,1.48,w*.74,.025,1.05,'#263650');
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
  if(spec?.lengthScale)for(let i=0;i<g.data.length;i+=14)g.data[i+2]*=spec.lengthScale;
  const mesh=g.upload(gl);mesh.vehicle={id:modelId,color,build};return mesh;
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
      uniform sampler2D uAtlas,uCourseSky,uRoadEffects;uniform float uAtlasReady,uTunnel,uBackdrop,uTerrain,uCourseSkyReady,uRoadEffectsReady;
      uniform vec4 uStreetLights[3];
      uniform vec3 uFog,uEye,uCar,uRivalCar;uniform vec2 uForward,uRivalForward;
      uniform vec4 uNetCars[3];uniform vec2 uNetForward[3];uniform vec3 uNetSlopes;
      uniform float uCarSlope,uRivalSlope;
      uniform float uDay,uWet,uWeatherTime,uAlpha,uFogStart,uFogEnd,uFogFromCar,uHeadlights,uRivalLights,uLampState,uBrake;
      uniform float uVehicle,uCarbon;uniform vec3 uVehiclePaint,uWheelColor;
      float beam(vec3 car,vec2 forward,float slope){
        vec2 delta=vWorld.xz-car.xz;float ahead=dot(delta,forward);
        float across=abs(delta.x*forward.y-delta.y*forward.x);
        float cone=smoothstep(1.,4.,ahead)*(1.-smoothstep(48.,140.,ahead))*(1.-smoothstep(1.7+ahead*.055,2.5+ahead*.24,across));
        float height=1.-smoothstep(1.5,6.,abs(vWorld.y-car.y-ahead*slope));
        return cone*height;
      }
      float hashRain(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
      // Dry rubber, wet rubber and four ripple frames.
      vec4 roadEffect(float tile,vec2 uv){
        return texture2D(uRoadEffects,(vec2(tile*256.+2.5,2.5)+uv*251.)/vec2(1024.,256.));
      }
      float rearReflection(vec3 car,vec2 forward){
        vec2 delta=vWorld.xz-car.xz;
        float depth=-dot(delta,forward),offset=abs(delta.x*forward.y-delta.y*forward.x);
        float streak=1.-smoothstep(.11,.40+max(0.,depth)*.011,abs(offset-.64));
        return streak*smoothstep(1.,3.,depth)*(1.-smoothstep(7.,27.,depth))*(1.-smoothstep(1.1,4.,abs(vWorld.y-car.y)));
      }
      void main(){
        if(uBackdrop>.5&&uBackdrop<1.5&&vSurface.z<-29.5){
          vec3 dir=normalize(vWorld-uEye);
          float elevation=asin(clamp(dir.y,-1.,1.));
          vec2 uv=vec2(atan(dir.z,dir.x)/6.2831853+.5,.5-elevation/3.1415927);
          vec3 fallback=mix(uFog,uFog*mix(1.6,.80,uDay),smoothstep(0.,.5,dir.y));
          vec3 sky=mix(fallback,texture2D(uCourseSky,uv).rgb*mix(1.22,1.,uDay),uCourseSkyReady);
          float haze=(1.-smoothstep(.02,.5,dir.y))*mix(.32,1.,1.-smoothstep(60.,250.,uFogEnd));
          gl_FragColor=vec4(mix(sky,uFog,haze),1.);return;
        }
        float f=smoothstep(uFogStart,uFogEnd,distance(vWorld,mix(uEye,uCar,uFogFromCar)));
        if(vSurface.z<-31.5){
          vec2 uv=vec2(mix(vSurface.x,.135+vSurface.x*.312,uWet),vSurface.y);
          vec4 rubber=roadEffect(uWet,uv);
          gl_FragColor=vec4(rubber.rgb*mix(.55,1.,uDay),rubber.a*vColor.a*(1.-f)*uRoadEffectsReady);
          return;
        }
        if(vSurface.z<-30.5){
          vec3 view=normalize(uEye-vWorld);
          vec3 normal=normalize(vNormal),reflection=reflect(-view,normal);
          float grazing=pow(1.-clamp(abs(dot(normal,view)),0.,1.),2.);
          float glare=beam(uCar,uForward,uCarSlope)*uHeadlights;
          vec2 skyUV=vec2(atan(reflection.z,reflection.x)/6.2831853+.5,.5-asin(clamp(reflection.y,-1.,1.))/3.1415927);
          vec3 water=mix(vec3(.035,.052,.068),vec3(.16,.23,.27),uDay);
          water=mix(water,texture2D(uCourseSky,skyUV).rgb,.67*grazing*uCourseSkyReady);
          water+=vec3(.29,.37,.46)*glare*grazing*(1.-uDay);
          float near=1.-smoothstep(17.,58.,distance(uEye,vWorld));
          if(near>.01){
            vec2 grid=vWorld.xz*1.4;
            float seed=hashRain(floor(grid));
            float phase=fract(uWeatherTime*(1.05+seed)+seed*11.);
            vec2 frame=fract(grid)*.94+.03;
            frame.x=(frame.x+floor(phase*4.))*.25;
            water+=roadEffect(3.,frame).a*vec3(.51,.66,.78)*near*(.45+uDay*.3+glare*.38);
          }
          float edge=smoothstep(0.,.19,vColor.a);
          gl_FragColor=vec4(water,(.48+.29*grazing)*edge*(1.-f)*uRoadEffectsReady);
          return;
        }
        vec4 texel=vec4(1.);float tile=-1.;if(vSurface.z>=0.){tile=floor((uDay>.5?vSurface.z:vSurface.w)+.5);if(uAtlasReady<.5){if(tile>=29.&&tile<=32.)discard;texel=vec4(.6,.65,.55,1.);}else {vec2 cell=vec2(mod(tile,8.),floor(tile/8.)),uv=(cell*256.+8.+vec2(fract(vSurface.x),1.-fract(vSurface.y))*240.)/2048.;
        ${this.textureGrad?'vec2 dx=dFdx(vSurface.xy)*vec2(240./2048.,-240./2048.),dy=dFdy(vSurface.xy)*vec2(240./2048.,-240./2048.);dx*=min(1.,.0078125/max(length(dx),.000001));dy*=min(1.,.0078125/max(length(dy),.000001));texel=texture2DGradEXT(uAtlas,uv,dx,dy);':'texel=texture2D(uAtlas,uv);'}
        if(texel.a<.45)discard;}}
        if(uBackdrop>1.5){gl_FragColor=vec4(texel.rgb*vColor.rgb,uAlpha);return;}
        if(uBackdrop>.5){
          vec3 backdrop=texel.rgb*vColor.rgb*mix(.13,.95,uDay);
          if(uWet>.5){
            float cloud=dot(backdrop,vec3(.28,.56,.16));
            backdrop=mix(backdrop,cloud*vec3(.71,.79,.90),.77);
          }
          gl_FragColor=vec4(mix(backdrop,uFog,uFogEnd<250.?1.:.32),uAlpha);return;
        }
        if(f>=1.){if(vSurface.z<-19.5&&vSurface.z>-20.5)discard;gl_FragColor=vec4(uFog,uAlpha);return;}
        vec3 n=normalize(vNormal);float sun=max(0.,dot(n,normalize(vec3(-.35,.85,.4))));
        float daylight=uDay*(1.-uTunnel*.85),light=mix(.075+sun*.065,.48+sun*.52,daylight)*(1.-uWet*daylight*.14);
        if(uTerrain>.5){float head=beam(uCar,uForward,uCarSlope)*uHeadlights*(1.-daylight)*1.85;vec3 c=vColor.rgb*texel.rgb*(light+head);gl_FragColor=vec4(mix(c,uFog,f),uAlpha);return;}
        float headlights=0.;if(daylight<.999){headlights=max(beam(uCar,uForward,uCarSlope)*uHeadlights,beam(uRivalCar,uRivalForward,uRivalSlope)*uRivalLights)*(1.-daylight)*1.85;
        for(int i=0;i<3;i++)headlights=max(headlights,beam(uNetCars[i].xyz,uNetForward[i],uNetSlopes[i])*uNetCars[i].w*(1.-daylight)*1.85);
        for(int i=0;i<3;i++){float falloff=max(0.,1.-length(vWorld.xz-uStreetLights[i].xz)/14.);light+=falloff*falloff*uStreetLights[i].w*(1.-daylight)*(1.-smoothstep(3.,10.,abs(vWorld.y-uStreetLights[i].y)));}}
        float noise=fract(sin(dot(floor(vWorld.xz*13.),vec2(12.9898,78.233)))*43758.5453);
        float grain=abs(n.y)>.7?.96+noise*.08:1.;
        float lamp=1.;if(vColor.a>.8&&vColor.r>.6&&vColor.g>.6&&vColor.b>.5)lamp=uLampState;
        float brake=1.;if(vColor.a>.8&&vColor.r>.6&&vColor.g<.2)brake=.55+uBrake*.65;
        vec3 base=vColor.rgb*texel.rgb;float kind=floor(-vSurface.z+.5);
        if(uVehicle>.5){grain=1.;if(kind==2.||kind==8.)base=uVehiclePaint;if(kind==7.)base=uWheelColor;if(kind==8.&&uCarbon>.5){float weave=mod(floor(vSurface.x*100.)+floor(vSurface.y*100.),2.);base=mix(vec3(.055,.065,.08),vec3(.075,.085,.10),weave);}}
        vec3 c=mix(base*(light+headlights)*grain,base*1.35*brake,vColor.a*lamp);float opacity=uAlpha;
        if(vSurface.z<-19.5&&vSurface.z>-20.5){
          float across=(vSurface.x-.5)*4.;
          opacity*=exp(-across*across)*(1.-smoothstep(.88,1.,vSurface.y));
        }
        if(uWet>.5&&tile==0.&&abs(n.y)>.65){
          vec3 toEye=uEye-vWorld;
          float eyeDistance=length(toEye);
          vec3 view=toEye/max(.001,eyeDistance);
          vec2 road=vSurface.xy;
          float grazing=pow(1.-clamp(abs(dot(n,view)),0.,1.),2.);
          float water=.44;
          float ripple=0.;
          float nearRoad=1.-smoothstep(12.,32.,eyeDistance);
          if(nearRoad>.01){
            vec2 grid=vWorld.xz*2.6;
            vec2 cell=floor(grid);
            float seed=hashRain(cell);
            float phase=fract(uWeatherTime*(1.5+seed)+seed*13.);
            vec2 center=.32+.34*vec2(seed,hashRain(cell+8.));
            float ring=abs(length(fract(grid)-center)-phase*.30);
            ripple=(1.-smoothstep(.009,.041,ring))*max(0.,1.-phase*1.55)*nearRoad;
          }
          float skyBand=smoothstep(.07,.61,reflect(-view,n).y);
          vec3 reflectedSky=mix(vec3(.028,.053,.083),vec3(.19,.30,.41),daylight);
          reflectedSky+=skyBand*mix(vec3(.020,.028,.040),vec3(.23,.24,.25),daylight);
          c=mix(c*.75,reflectedSky,water*(.17+grazing*.66));
          float streak=.88+.12*sin(road.y*42.+road.x*8.);
          c+=vec3(.72,.84,1.)*headlights*water*(.06+grazing*.16)*streak;
          float tail=0.;
          if(uRivalLights>.5)tail=rearReflection(uRivalCar,uRivalForward);
          for(int i=0;i<3;i++)if(uNetCars[i].w>.5)tail+=rearReflection(uNetCars[i].xyz,uNetForward[i]);
          c+=vec3(.68,.072,.045)*tail*(.19+water*.81)*(.36+grazing*.64)*(1.-daylight*.47)*streak;
          for(int i=0;i<3;i++){
            vec2 offset=(vWorld.xz-uStreetLights[i].xz)*vec2(.64,.16);
            float glint=1.-smoothstep(.16,1.85,length(offset));
            c+=vec3(.55,.38,.18)*glint*glint*uStreetLights[i].w*water*grazing*(1.-daylight);
          }
          c+=vec3(.31,.40,.50)*ripple*(.22+headlights*.31+daylight*.24)*.44;
        }
        if(uVehicle>.5){vec3 view=normalize(uEye-vWorld),h=normalize(view+normalize(vec3(-.35,.85,.4)));float fresnel=pow(1.-abs(dot(n,view)),4.),shine=pow(max(0.,dot(n,h)),kind==4.?70.:100.);float visibility=mix(.075,1.,daylight)+headlights*.22;
         if(kind==2.||kind==8.||kind==7.||kind==4.)c+=vec3(.66,.80,1.)*(fresnel*(.18+uWet*.07)+shine*(.38+uWet*.24))*visibility;
         if(kind==3.){c=base*mix(.09,.35,daylight)+mix(vec3(.16,.22,.31),vec3(.53,.67,.8),max(0.,n.y))*(.25+fresnel*.5)*visibility;opacity*=vSurface.w;}
        }
        if(uDay<.5&&((tile>=5.&&tile<=10.)||tile==17.)){float window=smoothstep(.55,.8,texel.r)*smoothstep(.5,.7,texel.g)*(1.-smoothstep(.75,.95,texel.b));c+=texel.rgb*window*.65;}
        gl_FragColor=vec4(mix(c,uFog,f),opacity);}`;
    const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
    this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
    this.attrs={};for(const name of ['aPos','aNormal','aColor','aSurface'])this.attrs[name]=gl.getAttribLocation(this.program,name);
    this.uniforms={};for(const name of ['uCarSlope','uRivalSlope','uNetSlopes','uTerrain','uModel','uView','uProjection','uFog','uEye','uDay','uAlpha','uFogStart','uFogEnd','uFogFromCar','uCar','uForward','uHeadlights','uRivalCar','uRivalForward','uRivalLights','uLampState','uBrake','uNetCars[0]','uNetForward[0]'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
    for(const name of ['uAtlas','uAtlasReady','uCourseSky','uCourseSkyReady','uTunnel','uBackdrop','uStreetLights[0]'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
    for(const name of ['uVehicle','uCarbon','uVehiclePaint','uWheelColor','uWet','uWeatherTime','uRoadEffects','uRoadEffectsReady'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
    this.initAtlas();
    this.courseSkyTexture=gl.createTexture();
    gl.uniform1i(this.uniforms.uCourseSky,4);
    gl.uniform1i(this.uniforms.uRoadEffects,5);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D,this.courseSkyTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    this.roadEffects=gl.createTexture();
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D,this.roadEffects);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.cars={};this.vehicleModels=new VehicleModels(gl);this.cabin=new CabinView(gl);this.driverCamera=new DriverCamera();this.eye=[0,0,0];this.target=[0,0,0];this.time=0;this.quality=1.4;this.cameraMode=0;
    this.resolutionScale=1;this.culling=true;this.planes=new Float32Array(24);this.stats={drawCalls:0,vertices:0,chunks:0,totalChunks:0,mirrorPasses:0};
    const shadow=new Geometry();for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;shadow.triangle(V(0,.045,0),V(Math.cos(a)*1.22,.045,Math.sin(a)*2.55),V(Math.cos(b)*1.22,.045,Math.sin(b)*2.55),'#000000');}this.shadow=shadow.upload(gl);
    const moon=new Geometry();for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;moon.triangle(V(0,0,0),V(Math.cos(a)*30,Math.sin(a)*30,0),V(Math.cos(b)*30,Math.sin(b)*30,0),[.92,.94,.81,1]);}this.moon=moon.upload(gl);
    const smoke=new Geometry();smoke.box(0,0,0,1,1,1,'#b7c2bd');this.smoke=smoke.upload(gl);
    const spray=new Geometry();spray.box(0,0,0,1,.3,1,'#bfd6e2');this.spray=spray.upload(gl);
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
  selectCourseSky(profile){
    if(this.courseSkyProfile===profile)return;
    this.courseSkyProfile=profile;
    this.courseSkyLoaded=false;
    const img=new Image();
    img.onload=()=>{
      if(this.courseSkyProfile!==profile)return;
      const gl=this.gl;
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D,this.courseSkyTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
      if((img.width&(img.width-1))===0&&(img.height&(img.height-1))===0)gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.activeTexture(gl.TEXTURE0);
      this.courseSkyLoaded=true;
    };
    const pack=profile==='nightrain'?4:3;
    img.src=new URL(`../assets/touge_city_assets_part${pack}/textures/sky/sky_${profile}_equirect.jpg`,import.meta.url).href;
  }
  buildBossMeshes(){
    const light=hex=>[...rgb(hex).slice(0,3),1],ring=(g,color,vertical=false,y=.1)=>{
      for(let i=0;i<48;i++){const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;
        const point=(t,scale)=>vertical?V(Math.cos(t)*1.5*scale,1.15+Math.sin(t)*1.35*scale,0):V(Math.cos(t)*1.48*scale,y,Math.sin(t)*2.65*scale);
        g.quad(point(a,.97),point(b,.97),point(b,1.03),point(a,1.03),light(color));
      }
    };
    const trail=new Geometry();
    for(const x of [-.65,.65])for(const [width,color] of [[.48,'#292415'],[.31,'#51472a'],[.17,'#b9a769'],[.065,'#fff9e5']]){
      trail.surface(V(x-width,.13,0),V(x+width,.13,0),V(x+width*.8,.13,-2.8),V(x-width*.8,.13,-2.8),-20,undefined,light(color),-20);
      trail.surface(V(x-width,.42,0),V(x+width,.42,0),V(x+width*.65,.30,-2.8),V(x-width*.65,.30,-2.8),-20,undefined,light(color),-20);
    }
    this.bossLightTrail=trail.upload(this.gl);
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
    if(boss.id==='shinji-campaign'&&boss.ray>0){
      const strength=Math.min(1,boss.ray/.25),segments=still?3:9;
      for(let i=0;i<segments;i++){
        const old=worldAt(this.track,Math.max(0,r.rivalS-1.8-i*2.4),r.rivalLateral);
        this.draw(this.bossLightTrail,transform(old.x,old.y+.035,old.z,old.heading+r.rivalYaw*.35),strength*(still ? .12 : .5)*(1-i/segments)**1.4);
      }
      if(!still){
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        for(let i=3;i>=1;i--){
          const old=worldAt(this.track,r.rivalS-i*1.1,r.rivalLateral);
          this.drawCar('rival-'+r.rival.id,transform(old.x,old.y+.04,old.z,old.heading+r.rivalYaw),{s:r.rivalS,steer:r.rivalSteer},strength*(.10-i*.022));
        }
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      }
    }
    if(boss.id==='takumi-project'){
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      if(boss.blur>.02&&!still){
        // Local afterimages of this rival only; the road, braking markers and HUD stay sharp.
        for(let i=4;i>=1;i--){const old=worldAt(this.track,r.rivalS-i*1.6,r.rivalLateral);this.drawCar('rival-'+r.rival.id,transform(old.x,old.y+.05,old.z,old.heading+r.rivalYaw),{s:r.rivalS,steer:r.rivalSteer},boss.blur*(.13-i*.022));}
        for(const side of [-1,1])this.drawCar('rival-'+r.rival.id,transform(q.x+Math.cos(angle)*side*.09,q.y+.04,q.z-Math.sin(angle)*side*.09,angle),{s:r.rivalS,steer:r.rivalSteer},boss.blur*.08);
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
    sky.surface(V(-2200,-600,-1400),V(2200,-600,-1400),V(2200,1500,-1400),V(-2200,1500,-1400),TEXTURES.sky_sunset,[[0,0],[1,0],[1,1],[0,1]],[1,1,1,0]);
    this.menuSky=sky.upload(gl);
    let seed=826;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let layer=0;layer<4;layer++){
      const z=-1000+layer*205,step=60,colors=['#9aa9ba','#718b9e','#496979','#294c55'],height=x=>70-layer*38+(70-layer*14)*Math.sin(x/500+layer*.9)+(16-layer*2)*Math.sin(x/170+layer*1.3)+5*Math.cos(x/90+layer);
      let a=V(-2800,height(-2800),z);
      for(let i=1;i<=95;i++){const x=-2800+i*step,b=V(x,height(x),z);hills.quad(V(a[0],-280,a[2]),V(b[0],-280,b[2]),b,a,colors[layer]);a=b;}
    }
    this.menuHills=hills.upload(gl);
    g.surface(V(-80,-.005,-45),V(80,-.005,-45),V(80,-.005,60),V(-80,-.005,60),TEXTURES.asphalt,[[0,0],[32,0],[32,21],[0,21]],[1.1,1.1,1.1,0]);
    g.surface(V(-80,-.01,-45),V(80,-.01,-45),V(120,-75,-110),V(-130,-75,-110),TEXTURES.rock_cliff,[[0,0],[12,0],[12,8],[0,8]],[.6,.7,.6,0]);
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
    for(const [x,z,h]of [[-27,-8,10],[-34,-12,13],[24,-16,14],[30,-18,17],[-42,-22,18],[39,-24,18]]){
      g.box(x,h*.36,z,.52,h*.72,.52,'#45494a');
      for(let i=0;i<4;i++)g.cone(x,h*(.18+i*.16),z,h*(.25-i*.045),h*.45,i%2?'#253d40':'#2b4245',9);
    }
    // A few lights on the distant mountain road, below the horizon.
    for(let i=0;i<35;i++){const x=-150+i*11,z=-155+Math.sin(i*.28)*16,y=-15+Math.sin(i*.19)*6;g.box(x,y,z,.24,.20,.24,[.94,.79,.55,1]);}
    this.menuGround=g.upload(gl);this.menuLightPools=lights.upload(gl);
  }
  renderMenu(mode,w,h){
    const gl=this.gl,u=this.uniforms,mobile=w/h<.85,garage=mode==='garage',workshop=mode==='workshop',exhibition=mode==='menu';
    const dealership=mode==='shop'&&this.shopSection==='dealer',collection=mode==='collection',showroom=dealership||collection,indoors=garage||workshop||showroom;
    if(exhibition&&!this.menuModel){this.menuModel=new MenuModel(gl);this.menuModel.load().then(()=>{this.boundBuffer=null;});}
    let garageModels;
    if(garage||workshop){
      this.garageModels??=new Map();
      const load=(name,scale,offset)=>{
        if(!this.garageModels.has(name)){
          const model=new MenuModel(gl,sceneryModel(5,name),scale,offset);
          this.garageModels.set(name,model);
          model.load().then(()=>{this.boundBuffer=null;});
        }
        return this.garageModels.get(name);
      };
      const room=load(workshop?'garage_room_tuning':'garage_room_day',1.8);
      const shared=GARAGE_FIXTURES.map(([name,scale,offset])=>load(name,scale,offset));
      const equipment=workshop?WORKSHOP_FIXTURES.map(([name,scale,offset])=>load(name,scale,offset)):[];
      if(room.status==='ready')garageModels=[room,...shared,...equipment];
    }
    const drift=this.reducedMotion?.matches?0:Math.sin(this.time*.08)*.24;
    const zoom=collection?this.collectionZoom||1:1;
    const eye=garageModels?(mobile?[3.7,2.8,8.1]:[6.4+drift,2.8,7.5-drift]):showroom?(mobile?[10.8,3.3,14]:[7.5,2.6,9.4]).map(value=>value/zoom):mobile?(workshop?[8.5,3.4,12.3]:exhibition?[8.5,3.5,15]:[9.5,3.8,13.8]):exhibition?[8.5+drift,2.9,11.7-drift]:[8.4+drift,2.65,10.8-drift];
    const target=garageModels?[0,1.15,0]:showroom?[0,.65,0]:mobile?(workshop?[0,.4,.3]:exhibition?[.4,1.6,1]:[-.2,1.8,.3]):exhibition?[-2,.85,1.35]:[workshop?2.5:garage?0:-3.1,.95,1.35];
    this.eye=eye;this.target=target;
    const view=lookAt(eye,target),projection=perspective((garageModels?(mobile?64:47):(mobile?49:38))*Math.PI/180,w/h,.15,4000);
    gl.uniformMatrix4fv(u.uView,false,view);gl.uniformMatrix4fv(u.uProjection,false,projection);
    gl.uniform1f(u.uWet,0);gl.uniform3fv(u.uFog,[.39,.48,.58]);gl.uniform3fv(u.uEye,eye);gl.uniform1f(u.uDay,.9);gl.uniform1f(u.uTunnel,0);gl.uniform4fv(u['uStreetLights[0]'],new Float32Array(12));gl.uniform1f(u.uFogStart,240);gl.uniform1f(u.uFogEnd,1800);gl.uniform1f(u.uFogFromCar,0);
    gl.uniform3fv(u.uCar,[0,0,0]);gl.uniform2fv(u.uForward,[0,1]);gl.uniform1f(u.uHeadlights,1);gl.uniform1f(u.uRivalLights,0);
    gl.uniform4fv(u['uNetCars[0]'],new Float32Array(12));gl.uniform2fv(u['uNetForward[0]'],new Float32Array(6));gl.uniform1f(u.uLampState,1);gl.uniform1f(u.uBrake,0);
    if(indoors){
      if(garageModels){
        for(const model of garageModels){
          const stats=model.draw(view,projection,eye);
          this.stats.drawCalls+=stats.drawCalls;
          this.stats.vertices+=stats.vertices;
        }
        gl.useProgram(this.program);
        this.boundBuffer=null;
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.activeTexture(gl.TEXTURE0);
      }else{
        const key=showroom?'dealerRoom':'garageRoom';
        this[key]??=this.buildCarRoom(showroom);
        this.draw(this[key]);
      }
      const angle=collection?this.collectionAngle||0:dealership?.23:0;
      const floor=garageModels ? .446 : 0;
      this.draw(this.shadow,transform(0,floor,0,angle),.4);
      this.drawCar(this.car.id,transform(0,floor+.035,0,angle),{headlights:false});
      return;
    }
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.uniform1f(u.uBackdrop,2);this.draw(this.menuSky);this.draw(this.moon,transform(-900,180,-1000,.73,1.65),.025);this.draw(this.moon,transform(-900,180,-1000,.73,1.25),.055);this.draw(this.moon,transform(-900,180,-1000,.73,.85));gl.uniform1f(u.uBackdrop,0);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
    this.draw(this.menuHills);this.draw(this.menuGround);
    if(exhibition){for(const [size,alpha]of [[1.1,.06],[.97,.1],[.84,.14]])this.draw(this.shadow,transform(0,0,0,0,size),alpha);}else this.draw(this.shadow,transform(0,0,0),.4);
    if(exhibition&&this.menuModel.status==='ready'){const stats=this.menuModel.draw(view,projection,eye);this.stats.drawCalls+=stats.drawCalls;this.stats.vertices+=stats.vertices;this.showcaseActive=true;gl.useProgram(this.program);this.boundBuffer=null;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.activeTexture(gl.TEXTURE0);}
    else if(exhibition){this.menuFallback??=meshCar(gl,CARS[0].color,CARS[0].id);this.boundBuffer=null;this.draw(this.menuFallback,transform(0,.035,0));}
    if(exhibition){
      this.draw(this.shadow,transform(3.15,0,2.7,.18),.4);
      this.drawCar(this.car.id,transform(3.15,.035,2.7,.18),{headlights:true});
    }else this.drawCar(this.car.id,transform(0,.035,0),{headlights:true});
    gl.depthMask(false);this.draw(this.menuLightPools,identity(),.12);gl.depthMask(true);
  }
  buildCarRoom(dealership){
    const g=new Geometry();
    g.box(0,-.12,0,50,.24,46,dealership?'#454c57':'#41464d');
    g.box(0,4,-11,50,8,.32,dealership?'#abb4c4':'#606975');
    g.box(-15,4,0,.30,8,36,'#717987');
    g.box(0,8,0,50,.3,46,'#353c47');
    for(let x=-12;x<=15;x+=5){
      g.box(x,3,-10.73,.25,6,.35,'#242a32');
      g.box(x,5.2,-10.72,.10,3.0,.10,[.76,.83,.98,1]);
      g.box(x,7.77,-1,2.3,.07,.18,[.8,.87,1,1]);
    }
    if(dealership){
      for(const side of [-1,1])g.box(side*3.85,.012,0,.045,.02,10,'#81909f');
      g.box(0,.012,-5,7.7,.018,.045,'#81909f');
      g.box(0,1.35,-10.69,36,.075,.08,'#496180');
    }else{
      g.box(-4,.96,-9.6,6.5,.20,1.15,'#bcb8ad');
      for(const x of [-7,-1])g.box(x,.47,-9.6,.22,.94,1.1,'#252c32');
      g.box(-4,2.25,-10.75,5.1,1.8,.13,'#424951');
      for(let i=0;i<13;i++){
        const x=-6.2+i*.36,y=1.83+(i%3)*.23;
        g.box(x,y,-10.64,.07,.53,.065,'#d0d1ce');
        g.box(x,y+.26,-10.61,.17,.10,.085,i%3?'#9ea7ac':'#d08348');
      }
      g.box(2,.65,-9.8,2.8,1.3,.95,'#a23e31');
      for(let y=.25;y<1.25;y+=.23)g.box(2,y,-9.29,2.55,.03,.07,'#d1c8bd');
      for(const x of [7,8.7])for(const z of [-9.1,-7.95])g.cylinderX(x,.56,z,.54,.38,'#202429',12);
      for(const x of [-4.2,4.2])g.box(x,.012,.5,.09,.02,8.4,'#b29150');
    }
    this.boundBuffer=null;
    return g.upload(this.gl);
  }
  setCar(car) {this.car=car;this.meshLooks??={};const key=car.id,look=appearanceKey(car);if(!this.cars[key]||this.meshLooks[key]!==look){if(this.cars[key])this.gl.deleteBuffer?.(this.cars[key].buffer);this.cars[key]=meshCar(this.gl,car.color,car.id,car.build);this.meshLooks[key]=look;}}
  drawCar(key,model,pose={},alpha=1){const mesh=this.cars[key];if(!mesh)return;const assets=this.vehicleModels;if(assets&&ORIGINAL_CARS.has(mesh.vehicle.id)){const status=assets.statusFor(mesh.vehicle.id);if(status==='idle')assets.load(mesh.vehicle.id).then(()=>{this.boundBuffer=null;});if(status==='ready'){assets.draw(this,key,mesh.vehicle,model,pose,alpha);return;}}this.draw(mesh,model,alpha);}
  setNetworkPlayers(players){
    this.meshLooks??={};const keep=new Set();for(const p of players){const base=CARS.find(c=>c.id===p.car);if(!base)continue;const car=applyBuild(base,p.build),key='network-'+(p.id||car.id),look=appearanceKey(car);keep.add(key);
      if(!this.cars[key]||this.meshLooks[key]!==look){if(this.cars[key])this.gl.deleteBuffer?.(this.cars[key].buffer);this.cars[key]=meshCar(this.gl,car.color,car.id,car.build);this.meshLooks[key]=look;}
    }
    for(const key of this.networkKeys||[])if(!keep.has(key)&&!CARS.some(c=>key==='network-'+c.id)){this.gl.deleteBuffer?.(this.cars[key]?.buffer);this.vehicleModels?.forget(key);delete this.cars[key];delete this.meshLooks[key];}this.networkKeys=keep;
  }
  setRival(rival){this.rival=rival;const key='rival-'+rival.id;if(!this.cars[key])this.cars[key]=meshCar(this.gl,rival.color,rival.car);}
  setTrack(track) {
    this.track=track;const gl=this.gl;
    this.resetTireMarks();
    if(this.puddleMesh)gl.deleteBuffer(this.puddleMesh.buffer);
    this.puddleMesh=null;
    if(this.scene)gl.deleteBuffer(this.scene.buffer);if(this.backdrop)gl.deleteBuffer(this.backdrop.buffer);
    const g=new Geometry(),roadIndex=createRoadIndex(track);this.sceneryBounds=[];let seed=track.seed*11231;
    const spans=[];let spanStart=6,spanKind='road',sector=0,baseY=0;
    const layer=kind=>{const end=g.data.length/14;if(end>spanStart)spans.push({first:spanStart,count:end-spanStart,kind:spanKind,sector,baseY});spanStart=end;spanKind=kind;};
    const endChunk=()=>{layer(spanKind);sector++;};
    const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const point=(p,l,y=0)=>V(p.x+Math.cos(p.heading)*l,p.y+y+roadBankHeight(track,p.curve,l),p.z-Math.sin(p.heading)*l);
    const strip=(a,b,l1,l2,y,color)=>g.quad(point(a,l1,y),point(b,l1,y),point(b,l2,y),point(a,l2,y),color);
    const ground=createTerrainField(track,roadIndex);
    const water=['atami','tsubaki','odawara','manazuru','ashinoko'].includes(track.id);
    const minY=Math.min(...track.points.map(p=>p.y))-(water?12:35);
    const minX=Math.min(...track.points.map(p=>p.x))-1500,maxX=Math.max(...track.points.map(p=>p.x))+1500,minZ=Math.min(...track.points.map(p=>p.z))-1500,maxZ=Math.max(...track.points.map(p=>p.z))+1500;
    if(water)g.surface(V(minX,minY,minZ),V(minX,minY,maxZ),V(maxX,minY,maxZ),V(maxX,minY,minZ),TEXTURES.water,[[0,0],[0,40],[40,40],[40,0]]);else g.quad(V(minX,minY,minZ),V(minX,minY,maxZ),V(maxX,minY,maxZ),V(maxX,minY,minZ),'#22372d');
    ground.build(g,(id,y)=>{layer('terrain');sector=-id-1;baseY=y;},TEXTURES.grass);
    layer('road');sector=0;baseY=0;
    const environment=this.environment=createEnvironment(track,g,roadIndex,this.sceneryBounds,{layer,ground});
    for(let i=0;i<(track.renderSegments??track.points.length-1);i++) {
      const a=track.points[i],b=track.points[i+1];layer('road');baseY=a.y;
      for(const side of [-1,1]){strip(a,b,side*5.3,side*6.05,-.015,'#747972');g.quad(point(a,side*6.05,-.015),point(b,side*6.05,-.015),point(b,side*6.05,-.48),point(a,side*6.05,-.48),'#5f655f');}
      if(i%Math.max(1,Math.round(48/track.step))===0){const m=COMPLEMENT_MODELS.drainage_grille,c=Math.cos(a.heading),s=Math.sin(a.heading);for(const side of [-1,1]){const p=point(a,side*5.76,-.01);for(let k=0;k<m.data.length;k+=14){const d=m.data;g.data.push(p[0]+d[k]*c+d[k+2]*s,p[1]+d[k+1],p[2]-d[k]*s+d[k+2]*c,d[k+3]*c+d[k+5]*s,d[k+4],-d[k+3]*s+d[k+5]*c,...d.slice(k+6,k+14));}}}
      // Narrow vertical embankments cannot stretch over another hairpin.
      for(const side of [-1,1])g.quad(point(a,side*5.58,-.12),point(b,side*5.58,-.12),point(b,side*5.58,-4),point(a,side*5.58,-4),track.theme==='autumn'?'#5a5142':'#35453c');
      g.surface(point(a,-5.3),point(b,-5.3),point(b,5.3),point(a,5.3),TEXTURES.asphalt,[[0,a.s/5],[0,b.s/5],[2.65,b.s/5],[2.65,a.s/5]],[1.15,1.15,1.15,0]);
      strip(a,b,-5.55,-5.3,.015,'#737771');strip(a,b,5.3,5.55,.015,'#737771');
      strip(a,b,-4.9,-4.78,.025,'#d0d2bb');strip(a,b,4.78,4.9,.025,'#d0d2bb');
      if(Math.floor(a.s/8)%3!==0){strip(a,b,-.11,-.03,.03,'#cb9c4d');strip(a,b,.03,.11,.03,'#cb9c4d');}
      for(const side of [-1,1]) {
        strip(a,b,side*5.65,side*5.68,.75,'#9aaba8');strip(a,b,side*5.65,side*5.68,.97,'#aeb7b0');
        g.quad(point(a,side*5.68,.75),point(b,side*5.68,.75),point(b,side*5.68,.97),point(a,side*5.68,.97),'#a6b0a8');
        if(i%Math.max(1,Math.round(32/track.step))===0){const p=point(a,side*5.68,.45);g.box(...p,.09,.9,.10,'#808c87');const q=point(a,side*5.62,.99);g.box(...q,.09,.10,.18,side<0?[.95,.18,.08,.12]:[.9,.88,.6,.12]);}
      }
      environment.step(i,a,b);
      layer('road');
      if(i===Math.round(32/track.step)){for(const side of [-1,1]){const p=point(a,side*6.5,2.8);g.box(...p,.2,5.6,.2,'#747e83');}g.surface(point(a,-6.5,5.1),point(a,6.5,5.1),point(a,6.5,6.5),point(a,-6.5,6.5),TEXTURES.billboard_generic);}
      if(i===(track.renderSegments?track.renderSegments-1:Math.floor(track.length/track.step)))for(let k=0;k<12;k++)strip(a,b,-5.2+k*.87,-5.2+(k+1)*.87,.04,k%2?'#d1d2bd':'#171f22');
      if((i+1)%Math.max(1,Math.round(96/track.step))===0)endChunk();
    }
    this.spectatorSpots=this.findSpectatorSpots(track,ground,roadIndex,environment);
    for(const spot of environment.landmarks){
      const radius=spot.rotor?18:spot.radius;
      spot.min=[spot.x-radius,spot.y-1,spot.z-radius];
      spot.max=[spot.x+radius,spot.y+spot.height+(spot.rotor?16:0),spot.z+radius];
      spot.matrix=transform(spot.x,spot.y,spot.z,spot.angle);
      for(const [axis,scale] of spot.scale.entries())for(let row=0;row<3;row++)spot.matrix[axis*4+row]*=scale;
    }
    endChunk();const chunks=packScene(g.data,spans);this.scene=g.upload(gl);this.scene.chunks=chunks;
    const bg=new Geometry();
    bg.box(0,100,0,2000,2000,2000,'#ffffff',[-30,-30]);
    for(let layer=0;layer<2;layer++)for(let i=0;i<12;i++){const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2,r=1000-layer*150,y=-100-layer*30,p=(angle,height)=>V(Math.sin(angle)*r,height,Math.cos(angle)*r);bg.surface(p(a,y),p(b,y),p(b,y+260-layer*20),p(a,y+260-layer*20),TEXTURES[layer?'mountains_mid':'mountains_far'],[[i%3/3,0],[(i%3+1)/3,0],[(i%3+1)/3,1],[i%3/3,1]],[.8,.88,.89,0]);}
    const horizon=(name,x,y,z,sx,sy,sz)=>{const model=PART2_MODELS[name];for(let i=0;i<model.data.length;i+=14){const d=model.data;bg.data.push(x+d[i]*sx,y+d[i+1]*sy,z+d[i+2]*sz,...d.slice(i+3,i+14));}};
    horizon('bg_hills_ring_low',0,65,0,2.4,2.5,2.4);
    horizon('bg_ridge_low',-650,80,800,3,3,2);
    if(['tsubaki','odawara','ashinoko','manazuru','atami'].includes(track.id))horizon('bg_mountain_fuji',650,-180,-1050,2,1.4,2);
    this.backdrop=bg.upload(gl);
    this.resetCamera=true;
  }
  findSpectatorSpots(track,ground,roadIndex,environment){
    const spots=[];
    const sections=[28,track.length-30,track.length*.32,track.length*.67];
    for(const [section,target] of sections.entries()){
      let spot;
      const offsets=[0,-12,12,-24,24,-42,42,-64,64,-92,92,-120,120];
      if(section>=2)offsets.push(-160,160,-220,220);
      for(const offset of offsets){
        const s=clamp(target+offset,10,track.length-10);
        if(environment.tunnels.some(t=>s>t.start-12&&s<t.end+12))continue;
        const preferred=section%2?1:-1;
        search: for(const reach of section<2?[5.7,2.35]:[2.35])for(const distance of [8.7,10.5,12.3])for(const side of [preferred,-preferred]){
          const p=worldAt(track,s,side*distance),angle=p.heading-side*Math.PI/2;
          const cos=Math.cos(angle),sin=Math.sin(angle);
          if(environment.props.some(prop=>{
            if(!prop.solid||Math.abs(prop.y-p.y)>3.5)return false;
            const dx=prop.x-p.x,dz=prop.z-p.z;
            if(Math.abs(dx)>reach+2.5+prop.radius||Math.abs(dz)>reach+2.5+prop.radius)return false;
            const across=Math.max(0,Math.abs(dx*cos-dz*sin)-reach);
            const depth=Math.max(0,Math.abs(dx*sin+dz*cos+.35)-1.75);
            return across*across+depth*depth<(prop.radius+.4)**2;
          }))continue;
          const corners=[[0,0],[-reach,-2.1],[-reach,1.4],[reach,-2.1],[reach,1.4]];
          const heights=corners.map(([a,b])=>{
            const x=p.x+a*cos+b*sin,z=p.z-a*sin+b*cos;
            if(roadIndex.distance(x,z,15)<6.2)return NaN;
            return ground.groundAt(x,z)??ground.heightAt(x,z);
          });
          if(heights.some(y=>!Number.isFinite(y)||Math.abs(y-p.y)>3.1||y<=(ground.waterHeight??-Infinity)+.1))continue;
          const [center,backLeft,frontLeft,backRight,frontRight]=heights;
          const along=(backRight+frontRight-backLeft-frontLeft)/(4*reach);
          const across=(frontLeft+frontRight-backLeft-backRight)/7;
          if(Math.hypot(along,across)>.5||corners.some(([x,z],i)=>Math.abs(heights[i]-center-x*along-z*across)>.35))continue;
          if(spots.some(other=>Math.hypot(other.x-p.x,other.z-p.z)<14))continue;
          const y=center-.10,model=transform(p.x,y,p.z,angle);
          model[1]=along;model[9]=across;
          spot={...p,y,model,min:[p.x-reach-2,Math.min(...heights)-.3,p.z-reach-2],max:[p.x+reach+2,Math.max(...heights)+3,p.z+reach+2],section,roomForRainRow:reach>3};
          break search;
        }
        if(spot)break;
      }
      if(spot)spots.push(spot);
    }
    return spots;
  }
  spectatorMesh(name){
    this.spectatorMeshes??=new Map();
    if(!this.spectatorMeshes.has(name)){
      const entry={};
      this.spectatorMeshes.set(name,entry);
      const url=sceneryModel(4,name);
      fetch(url).then(response=>{
        if(!response.ok)throw Error('No se pudo cargar el público');
        return response.arrayBuffer();
      }).then(buffer=>{
        const model=parseMenuModel(buffer,{assetUrl:url,worldScale:1});
        const geometry=new Geometry();
        for(const batch of model.batches){
          const material=model.materials[batch.material]?.pbrMetallicRoughness;
          const color=(material?.baseColorFactor||[1,1,1]).slice(0,3).map(v=>v**.65);
          for(let i=0;i<batch.data.length;i+=8){
            geometry.data.push(...batch.data.subarray(i,i+6),...color,0,0,0,-1,-1);
          }
        }
        entry.mesh=geometry.upload(this.gl);
        this.boundBuffer=null;
      }).catch(error=>{entry.error=error.message;});
    }
    return this.spectatorMeshes.get(name).mesh;
  }
  drawSpectators(view,projection,eye,far,wet){
    if(!this.spectatorSpots?.length)return;
    const planes=this.culling===false||!this.scene.chunks?viewPlanes(view,projection,this.planes):this.planes;
    for(const spot of this.spectatorSpots||[]){
      if(!chunkVisible(spot,planes,eye,Math.min(far,115)))continue;
      const name=wet&&spot.roomForRainRow?'crowd_rain_row':spot.section%2?'crowd_fans_group_a':'crowd_fans_group_b';
      this.draw(this.spectatorMesh(name),spot.model);
    }
  }
  drawRouteLandmarks(view,projection,eye,weather){
    const spots=this.environment.landmarks;
    if(!spots.length)return;
    const gl=this.gl,planes=this.culling===false?viewPlanes(view,projection,this.planes):this.planes;
    this.routeModels??=new Map();
    let changedProgram=false;
    const draw=(file,matrix,portal=false)=>{
      if(!this.routeModels.has(file)){
        const model=new MenuModel(gl,landmarkUrl(file),1,undefined,{preserveHeight:true,omitGround:portal});
        this.routeModels.set(file,model);
        model.load().then(()=>{this.boundBuffer=null;});
      }
      const model=this.routeModels.get(file);
      if(model.status!=='ready')return;
      const stats=model.draw(view,projection,eye,matrix,weather);
      this.stats.drawCalls+=stats.drawCalls;
      this.stats.vertices+=stats.vertices;
      changedProgram=true;
    };
    for(const spot of spots){
      if(!chunkVisible(spot,planes,weather.origin,Math.min(weather.far,spot.height>10?330:180)))continue;
      draw(spot.file,spot.matrix,spot.portal);
      if(spot.rotor){
        const {x,y,z,angle}=spot;
        const rotor=transform(x+Math.sin(angle)*2.5,y+30.6,z+Math.cos(angle)*2.5,angle);
        const phase=this.reducedMotion?.matches?0:this.time*.54,cos=Math.cos(phase),sin=Math.sin(phase);
        const rx=rotor[0],rz=rotor[2];
        rotor[0]=rx*cos;rotor[1]=sin;rotor[2]=rz*cos;
        rotor[4]=-rx*sin;rotor[5]=cos;rotor[6]=-rz*sin;
        draw(TURBINE_ROTOR,rotor);
      }
    }
    if(changedProgram){
      gl.useProgram(this.program);
      this.boundBuffer=null;
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.activeTexture(gl.TEXTURE0);
    }
  }
  drawPuddles(eye,far){
    if(!this.puddleAssetRequest){
      this.puddleAssetRequest=Promise.all(['a','b','c'].map(async suffix=>{
        const assetUrl=sceneryModel(4,'puddle_'+suffix);
        const response=await fetch(assetUrl);
        if(!response.ok)throw Error('No se pudo cargar el charco');
        return parseMenuModel(await response.arrayBuffer(),{assetUrl,worldScale:1});
      })).then(shapes=>{this.puddleShapes=shapes;}).catch(error=>{this.puddleAssetError=error.message;});
    }
    if(!this.puddleShapes||!this.roadEffectsLoaded)return;
    if(!this.puddleMesh)this.buildPuddleMesh();
    const {chunks}=this.puddleMesh,gl=this.gl;
    gl.depthMask(false);
    for(const chunk of chunks){
      if(chunkVisible(chunk,this.planes,eye,Math.min(far,120))){
        this.draw(this.puddleMesh,IDENTITY,1,chunk.first,chunk.count);
      }
    }
    gl.depthMask(true);
  }
  buildPuddleMesh(){
    const {track,environment}=this,geometry=new Geometry(),chunks=[];
    // Widely spaced pools follow road level and collect along the low shoulder.
    for(let s=49,index=0;s<track.length-25;s+=87+(index*31)%68,index++){
      if(environment.tunnels.some(t=>s>t.start-9&&s<t.end+9))continue;
      const [here,before,after]=[s,s-4,s+4].map(at=>sample(track,at));
      if(Math.abs(here.curve)>.023||Math.abs(after.y-before.y)>1.7)continue;
      const shape=this.puddleShapes[index%3],side=Math.abs(here.curve)>.005?Math.sign(here.curve):(index%2?1:-1);
      const lateral=side*(3.65+(index%3)*.10);
      const center=visualRoadPose(track,s,lateral),first=geometry.data.length/14;
      const grade=(after.y-before.y)/8,bank=roadBankHeight(track,here.curve,lateral)/lateral;
      const dx=Math.sin(center.heading),dz=Math.cos(center.heading);
      const normal=norm([-grade*dx-bank*dz,1,-grade*dz+bank*dx]);
      const width=Math.max(-shape.sourceBounds.min[0],shape.sourceBounds.max[0]);
      for(const {data} of shape.batches)for(let i=0;i<data.length;i+=8){
        const x=data[i],z=data[i+2],edge=Math.hypot(x,z)<.001?1:0;
        const p=visualRoadPose(track,s+z*(1.12+index%3*.15),lateral+x*(1.18/width));
        geometry.data.push(p.x,p.y+.027,p.z,...normal,1,1,1,edge,0,0,-31,-31);
      }
      chunks.push({min:[center.x-5,center.y-1,center.z-5],max:[center.x+5,center.y+1,center.z+5],first,count:geometry.data.length/14-first});
    }
    this.puddleMesh=geometry.upload(this.gl);
    this.puddleMesh.chunks=chunks;
    this.boundBuffer=null;
  }
  loadRoadEffects(){
    if(this.roadEffectsImage)return;
    const gl=this.gl,img=this.roadEffectsImage=new Image();
    img.onload=()=>{
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D,this.roadEffects);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      gl.activeTexture(gl.TEXTURE0);
      this.roadEffectsLoaded=true;
    };
    img.src=new URL('../assets/environment/road-effects.png',import.meta.url).href;
  }
  resetTireMarks(){
    this.skidIndex=0;
    this.skidCount=0;
    this.previousTires?.clear();
  }
  updateTireMarks(race){
    if(race.countdown>0){this.resetTireMarks();return;}
    this.previousTires??=new Map();
    this.recordTireMarks('player',race,race.wet);
    if(race.rival&&race.mode!=='time'&&race.eventKind!=='trial'&&race.eventKind!=='grid'){
      this.recordTireMarks('rival',{
        s:race.rivalS,lateral:race.rivalLateral,speed:race.rivalSpeed,
        drift:race.rivalDrift,slipAngle:race.rivalSlip,braking:race.rivalBraking,car:race.opponent?.car
      },race.wet,race.s);
    }
    for(const other of race.netOpponents||[])this.recordTireMarks(other.id,other,race.wet,race.s);
  }
  recordTireMarks(id,race,wet,near=race.s){
    const slipping=Math.abs(race.slipAngle||0)>.16||race.drift>.22;
    if(!(race.speed>=9)||Math.abs(race.s-near)>75||Math.abs(race.lateral)>4.15||!(race.braking||race.handbrakeDown||slipping)){
      this.previousTires.delete(id);
      return;
    }
    const current={s:race.s-1.2,lateral:race.lateral,resetId:race.resetId};
    const previous=this.previousTires.get(id);
    if(!previous||previous.resetId!==current.resetId||current.s<previous.s||current.s-previous.s>7||Math.abs(current.lateral-previous.lateral)>2){
      this.previousTires.set(id,current);
      return;
    }
    if(current.s-previous.s<.65)return;
    this.previousTires.set(id,current);
    const gl=this.gl,geometry=new Geometry();
    const at=(pose,lateral)=>{
      const p=visualRoadPose(this.track,pose.s,pose.lateral+lateral);
      return V(p.x,p.y+.018,p.z);
    };
    const strength=wet?.7:slipping||race.handbrakeDown?.8:.59;
    for(const side of [-1,1]){
      const wheel=side*(race.car?.width||1.75)*.42,half=wet?.18:.14;
      geometry.surface(at(previous,wheel-half),at(previous,wheel+half),at(current,wheel+half),at(current,wheel-half),
        -32,[[0,.2],[1,.2],[1,.8],[0,.8]],[0,0,0,strength]);
    }
    if(!this.skidMesh){
      this.skidMesh={buffer:gl.createBuffer(),count:0};
      gl.bindBuffer(gl.ARRAY_BUFFER,this.skidMesh.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,SKID_SEGMENTS*SKID_BYTES,gl.DYNAMIC_DRAW);
    }else gl.bindBuffer(gl.ARRAY_BUFFER,this.skidMesh.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER,this.skidIndex*SKID_BYTES,new Float32Array(geometry.data));
    this.boundBuffer=null;
    this.skidIndex=(this.skidIndex+1)%SKID_SEGMENTS;
    this.skidCount=Math.min(this.skidCount+1,SKID_SEGMENTS);
    this.skidMesh.count=this.skidCount*SKID_VERTICES;
  }
  draw(mesh,model=IDENTITY,alpha=1,first=0,count=mesh?.count) {if(!mesh)return;const gl=this.gl,u=this.uniforms;if(this.boundBuffer!==mesh.buffer){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);const a=this.attrs;gl.enableVertexAttribArray(a.aPos);gl.vertexAttribPointer(a.aPos,3,gl.FLOAT,false,56,0);gl.enableVertexAttribArray(a.aNormal);gl.vertexAttribPointer(a.aNormal,3,gl.FLOAT,false,56,12);gl.enableVertexAttribArray(a.aColor);gl.vertexAttribPointer(a.aColor,4,gl.FLOAT,false,56,24);gl.enableVertexAttribArray(a.aSurface);gl.vertexAttribPointer(a.aSurface,4,gl.FLOAT,false,56,40);this.boundBuffer=mesh.buffer;}gl.uniformMatrix4fv(u.uModel,false,model);gl.uniform1f(u.uAlpha,alpha);gl.drawArrays(gl.TRIANGLES,first,count);if(this.stats){this.stats.drawCalls++;this.stats.vertices+=count;}}
  drawScene(view,projection,origin,far){
    if(this.culling===false||!this.scene.chunks){this.draw(this.scene);return;}
    const planes=viewPlanes(view,projection,this.planes);this.draw(this.scene,IDENTITY,1,0,6);
    let range=null;
    const flush=()=>{if(range){this.gl.uniform1f(this.uniforms.uTerrain,range.kind==='terrain'?1:0);if(range.kind==='terrain'){this.gl.enable(this.gl.CULL_FACE);this.gl.cullFace(this.gl.BACK);}this.draw(this.scene,IDENTITY,range.alpha,range.first,range.count);if(range.kind==='terrain')this.gl.disable(this.gl.CULL_FACE);}range=null;this.gl.uniform1f(this.uniforms.uTerrain,0);};
    for(const chunk of this.scene.chunks){
      const limit=Math.min(far,chunk.distance??Infinity),distance=boundsDistance(chunk,origin);
      if(!chunkVisible(chunk,planes,origin,limit))continue;
      const alpha=chunkOpacity(chunk,origin,distance);
      if(alpha<=0)continue;
      if(range&&range.first+range.count===chunk.first&&range.alpha===alpha&&range.kind===chunk.kind)range.count+=chunk.count;
      else{flush();range={first:chunk.first,count:chunk.count,alpha,kind:chunk.kind};}this.stats.chunks++;
    }flush();
    this.stats.totalChunks+=this.scene.chunks.length;
  }
  drawWorld(race,racing,p,angle,eye,target,aspect,fov,day,sky,hidePlayer=false,up){
    const gl=this.gl,u=this.uniforms,rival=racing&&race.mode!=='time'&&race.eventKind!=='trial'&&race.eventKind!=='grid'?visualRoadPose(this.track,race.rivalS,race.rivalLateral):null;
    const others=racing?(race.netOpponents||[]).slice(0,3).map(o=>({...o,world:visualRoadPose(this.track,o.s,o.lateral)})):[],netCars=new Float32Array(12),netForward=new Float32Array(6);
    const slopeAt=s=>{const lo=this.track.closed?s-6:Math.max(0,s-6),hi=this.track.closed?s+6:Math.min(this.track.length,s+6);return (sample(this.track,hi).y-sample(this.track,lo).y)/Math.max(1,hi-lo);};
    const slopes=this.headlightSlopes??=new Float32Array(3);slopes.fill(0);
    gl.uniform1f(u.uCarSlope,slopeAt(race?.s||0));gl.uniform1f(u.uRivalSlope,rival?slopeAt(race.rivalS):0);
    others.forEach((o,i)=>{slopes[i]=slopeAt(o.s);const q=o.world,a=q.heading+o.yaw;netCars.set([q.x,q.y,q.z,o.headlights?1:0],i*4);netForward.set([Math.sin(a),Math.cos(a)],i*2);});
    gl.uniform3fv(u.uNetSlopes,slopes);gl.uniform4fv(u['uNetCars[0]'],netCars);gl.uniform2fv(u['uNetForward[0]'],netForward);
    const view=lookAt(eye,target,up),projection=perspective(fov*Math.PI/180,aspect,.15,2200);
    gl.uniformMatrix4fv(u.uView,false,view);gl.uniformMatrix4fv(u.uProjection,false,projection);
    gl.uniform3fv(u.uFog,sky);gl.uniform3fv(u.uEye,eye);gl.uniform3fv(u.uCar,[p.x,p.y,p.z]);gl.uniform2fv(u.uForward,[Math.sin(angle),Math.cos(angle)]);
    const visibility=raceVisibility(race,day);
    this.streetLightData??=new Float32Array(12);
    if(this.lightingEnvironment!==this.environment||this.time-(this.lightingAt??-1)>.15){this.lightingEnvironment=this.environment;this.lightingAt=this.time;this.streetLightData.fill(0);const nearest=[];for(const lamp of this.environment?.lights||[]){const distance=(lamp.x-p.x)**2+(lamp.z-p.z)**2;if(distance>22500)continue;nearest.push({lamp,distance});nearest.sort((a,b)=>a.distance-b.distance);if(nearest.length>3)nearest.pop();}nearest.forEach(({lamp},i)=>this.streetLightData.set([lamp.x,lamp.y,lamp.z,lamp.power],i*4));}
    gl.uniform4fv(u['uStreetLights[0]'],this.streetLightData);
    const lapS=this.track.closed?race?.s%this.track.length:race?.s,tunnel=this.environment?.tunnels.find(z=>lapS>=z.start&&lapS<=z.end);
    gl.uniform1f(u.uTunnel,tunnel?clamp(Math.min(lapS-tunnel.start,tunnel.end-lapS)/14,0,1):0);
    gl.uniform1f(u.uWet,racing&&race?.wet?1:0);gl.uniform1f(u.uWeatherTime,this.time%2048);gl.uniform1f(u.uDay,day?1:!racing?.55:0);gl.uniform1f(u.uFogStart,visibility.near);gl.uniform1f(u.uFogEnd,visibility.far);gl.uniform1f(u.uFogFromCar,visibility.fromCar?1:0);
    gl.uniform1f(u.uHeadlights,!racing||race.headlights?1:0);gl.uniform1f(u.uRivalLights,rival?1:0);
    const ra=rival?rival.heading+race.rivalYaw:0;gl.uniform3fv(u.uRivalCar,rival?[rival.x,rival.y,rival.z]:[0,0,0]);gl.uniform2fv(u.uRivalForward,[Math.sin(ra),Math.cos(ra)]);
    gl.uniform1f(u.uLampState,1);gl.uniform1f(u.uBrake,0);
    gl.depthMask(false);gl.disable(gl.DEPTH_TEST);
    this.selectCourseSky(courseSky(this.track.id,day,racing&&race?.wet));
    gl.uniform1f(u.uCourseSkyReady,this.courseSkyLoaded?1:0);
    gl.uniform1f(u.uBackdrop,1);this.draw(this.backdrop,transform(eye[0],eye[1]-100,eye[2]));gl.uniform1f(u.uBackdrop,0);
    gl.depthMask(true);gl.enable(gl.DEPTH_TEST);this.drawScene(view,projection,visibility.fromCar?[p.x,p.y,p.z]:eye,visibility.far+2);
    const car=[p.x,p.y,p.z];
    this.drawRouteLandmarks(view,projection,eye,{fog:sky,origin:visibility.fromCar?car:eye,car,
      forward:[Math.sin(angle),Math.cos(angle)],near:visibility.near,far:visibility.far,day:day?(race?.wet?.78:.95):0,lamps:race?.headlights?1:0});
    this.drawSpectators(view,projection,eye,visibility.far,racing&&race?.wet);
    if(racing&&race?.wet)this.drawPuddles(eye,visibility.far);
    if(racing&&this.skidCount&&this.roadEffectsLoaded){
      gl.depthMask(false);this.draw(this.skidMesh);gl.depthMask(true);
    }
    if(!hidePlayer){this.draw(this.shadow,transform(p.x,p.y,p.z,angle),.45);gl.uniform1f(u.uLampState,!racing||race.headlights?1:0);gl.uniform1f(u.uBrake,race?.braking?1:0);this.drawCar(this.car.id,transform(p.x,p.y+.04,p.z,angle),{s:race?.s||0,steer:race?.steer,headlights:!racing||race.headlights});if(race?.focus?.remaining>0){gl.depthMask(false);this.draw(this.focusAuras[race.focus.type]||this.focusAuras.balance,transform(p.x,p.y+.08,p.z,angle),.19);gl.depthMask(true);}}
    gl.uniform1f(u.uLampState,1);gl.uniform1f(u.uBrake,race?.rivalBraking?1:0);
    if(rival){this.draw(this.shadow,transform(rival.x,rival.y,rival.z,ra),.4);this.drawCar('rival-'+race.rival.id,transform(rival.x,rival.y+.04,rival.z,ra),{s:race.rivalS,steer:race.rivalSteer});this.drawBoss(race,rival,ra);}
    for(const o of others){const q=o.world,a=q.heading+o.yaw;gl.uniform1f(u.uLampState,o.headlights?1:0);gl.uniform1f(u.uBrake,o.braking?1:0);this.draw(this.shadow,transform(q.x,q.y,q.z,a),.4);this.drawCar(this.cars['network-'+o.id]?'network-'+o.id:'network-'+o.carId,transform(q.x,q.y+.04,q.z,a),{s:o.s,steer:o.steer,headlights:o.headlights});if(o.focus?.remaining>0){gl.depthMask(false);this.draw(this.focusAuras[o.focus.type]||this.focusAuras.balance,transform(q.x,q.y+.08,q.z,a),.19);gl.depthMask(true);}}
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
  renderMirror(race,p,angle,day,sky,w,h,compose=true){
    if(!this.mirrorFbo)this.initMirror();if(!this.mirrorReady)return;
    const gl=this.gl,mw=this.mirrorWidth,mh=this.mirrorHeight;
    if(this.time-(this.mirrorTime??-1)>=1/(this.quality<=1||this.resolutionScale<.85?16:24)){
    this.mirrorTime=this.time;const pose=rearCameraPose(this.track,race);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.mirrorFbo);gl.viewport(0,0,mw,mh);gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    this.drawWorld(race,true,p,angle,pose.eye,pose.target,mw/mh,23,day,sky,true);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);this.stats.mirrorPasses++;
    }
    if(!compose)return;
    // Compose directly from the GPU texture. The cockpit canvas clears just this
    // opening, keeping its frame above the image without any readPixels stalls.
    const cw=this.canvas.clientWidth,ch=this.canvas.clientHeight,layout=mirrorLayout(cw,ch),s=layout.scale;
    gl.useProgram(this.mirrorProgram);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.bindBuffer(gl.ARRAY_BUFFER,this.mirrorQuad);gl.enableVertexAttribArray(this.mirrorPosition);gl.vertexAttribPointer(this.mirrorPosition,2,gl.FLOAT,false,8,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.mirrorTexture);gl.uniform1i(this.mirrorSampler,0);gl.uniform4f(this.mirrorRect,-1+2*layout.x*s/cw,1-2*(layout.y+layout.height)*s/ch,2*layout.width*s/cw,2*layout.height*s/ch);gl.drawArrays(gl.TRIANGLES,0,6);this.stats.drawCalls++;this.stats.vertices+=6;gl.bindTexture(gl.TEXTURE_2D,null);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);this.boundBuffer=null;
  }
  render(race,mode,dt,options={}) {
    if(!this.track||!this.car)return;
    this.time+=dt;const gl=this.gl,u=this.uniforms,canvas=this.canvas;
    this.showcaseActive=false;this.stats={drawCalls:0,vertices:0,chunks:0,totalChunks:0,mirrorPasses:0};
    const dpr=Math.min(window.devicePixelRatio||1,this.quality)*this.resolutionScale,w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
    Object.assign(this.stats,{width:w,height:h,scale:this.resolutionScale});
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
    const replay=mode==='replay',racing=replay||mode==='race'||mode==='paused'||mode==='results',shot=options.replayCamera||options.introCamera;
    this.cabinActive=false;if(shot||!racing||this.cameraMode!==3)document.body.classList.remove('cabin-3d');
    const day=options.day?1:0,sky=raceVisibility(racing?race:null,day).color;
    gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.uniform1i(u.uAtlas,1);gl.uniform1f(u.uAtlasReady,this.atlasLoaded?1:0);gl.activeTexture(gl.TEXTURE0);
    if(!racing&&mode!=='title'){this.renderMenu(mode,w,h);return;}
    if(racing)this.loadRoadEffects();
    if(mode==='race')this.updateTireMarks(race);
    gl.uniform1f(u.uRoadEffectsReady,this.roadEffectsLoaded?1:0);
    const s=racing?race.s:340+(this.time*32)%Math.max(100,this.track.length-750),lat=racing?race.lateral:-1.7,p=visualRoadPose(this.track,s,lat),angle=p.heading+(racing?race.yaw:Math.sin(this.time*.5)*.025);
    let eye,target,driverPose,driverUp,cabinFov;
    if(shot){
      this.eye=shot.eye;this.target=shot.target;this.resetCamera=!!options.introCamera;
    }else if(racing) {
      const look=worldAt(this.track,s+18,lat*.5),back=8.5+race.speed*.035;
      if(this.cameraMode===3){const profile=cabinProfile(race.car.id);driverPose=this.driverCamera.update(race,mode==='race'?dt:0,{motion:options.cabinMotion,stableHorizon:options.stableHorizon,shake:options.shake,reducedMotion:this.reducedMotion?.matches,active:mode==='race',reset:this.resetCamera});
        const dx=-(profile.seat+driverPose.x),dz=-(.12+driverPose.z),ca=Math.cos(angle),sa=Math.sin(angle),aim=sample(this.track,s+20);eye=[p.x+ca*dx+sa*dz,p.y+profile.height+driverPose.y+Math.sin(this.time*67)*driverPose.kick,p.z-sa*dx+ca*dz];
        target=[eye[0]+Math.sin(angle+driverPose.yaw)*32,eye[1]+(aim.y-p.y)*1.6+driverPose.pitch*32,eye[2]+Math.cos(angle+driverPose.yaw)*32];driverUp=[-ca*Math.sin(driverPose.roll),Math.cos(driverPose.roll),sa*Math.sin(driverPose.roll)];cabinFov=clamp(Number(options.cabinFov)||65,55,80)+clamp(race.speed/65,0,1)*1.5;const aspect=w/h;if(aspect<1)cabinFov=Math.min(100,Math.atan(Math.tan(cabinFov*Math.PI/360)/Math.max(.65,aspect))*360/Math.PI);
      }
      else if(this.cameraMode===1){eye=[p.x+Math.sin(angle)*.6,p.y+1.1,p.z+Math.cos(angle)*.6];target=[look.x,look.y+1,look.z];}
      else if(this.cameraMode===2){eye=[p.x-Math.sin(p.heading)*5,p.y+3,p.z-Math.cos(p.heading)*5];target=[look.x,look.y+.4,look.z];}
      else {eye=[p.x-Math.sin(p.heading)*back,p.y+3.35+race.speed*.012,p.z-Math.cos(p.heading)*back];target=[look.x,look.y+.55,look.z];}
      const smoothing=1-Math.exp(-dt*([1,3].includes(this.cameraMode)?35:12));
      if(this.resetCamera||this.cameraMode===3){this.eye=eye;this.target=target;this.resetCamera=false;}else{this.eye=this.eye.map((v,i)=>mix(v,eye[i],smoothing));this.target=this.target.map((v,i)=>mix(v,target[i],smoothing));}
    } else {
      const look=worldAt(this.track,s+16,0),a=p.heading;
      eye=[p.x-Math.sin(a)*11+Math.cos(a)*4.5,p.y+3.0,p.z-Math.cos(a)*11-Math.sin(a)*4.5];
      target=[look.x,look.y+1.1,look.z];this.eye=eye;this.target=target;
    }
    const shake=!replay&&racing&&this.cameraMode!==3&&options.shake!==false?race.collision*.12:0;
    const actualEye=this.eye.map((v,i)=>v+(i<2?Math.sin(this.time*95+i)*shake:0));
    const demo=mode==='title'?{s,speed:32,mode:'time',headlights:true,netOpponents:[{carId:'rx7',s:s+18,lateral:1.4,yaw:0,headlights:true},{carId:'r32',s:s+38,lateral:-1.5,yaw:0,headlights:true}]}:null;
    this.drawWorld(demo||race,racing||!!demo,p,angle,actualEye,this.target,w/h,shot?.fov||(racing?(cabinFov||58+race.speed*.18):49),mode==='title'?true:day,mode==='title'?[.12,.17,.24]:sky,!shot&&racing&&[1,3].includes(this.cameraMode),driverUp);
    if(racing&&(mode==='race'||replay)){
      const emit=(q,a,wet,rate=wet?22:50,thin=false)=>{for(const side of [-1,1])if(this.particles.length<48&&Math.random()<1-Math.exp(-dt*rate))this.particles.push({x:q.x+Math.cos(a)*side*.8-Math.sin(a)*1.4,y:q.y+.25,z:q.z-Math.sin(a)*side*.8-Math.cos(a)*1.4,life:thin?.6:1,size:thin?.1+Math.random()*.08:.18+Math.random()*.16,wet,thin});};
      if(race.speed>12&&(race.wet||race.drift>.3))emit(p,angle,race.wet);
      const opponents=race.netOpponents||(race.mode!=='time'&&race.eventKind!=='trial'?[{s:race.rivalS,lateral:race.rivalLateral,yaw:race.rivalYaw,speed:race.rivalSpeed,drift:race.rivalDrift,slipAngle:race.rivalSlip}]:[]);
      for(const o of opponents)if(Math.abs(o.s-race.s)<60&&o.speed>15&&(race.wet||o.drift>.3&&Math.abs(o.slipAngle||0)>.1)){
        const q=worldAt(this.track,o.s,o.lateral);emit(q,q.heading+o.yaw,race.wet,race.wet?22:14,!race.wet);
      }
    }
    gl.depthMask(false);this.particles=this.particles.filter(v=>v.life>0);for(const v of this.particles){v.life-=dt*(v.wet?2.8:.85);v.y+=dt*(v.wet?.13:.35);v.size+=dt*(v.wet?1.4:v.thin?.32:.65);this.draw(v.wet?this.spray:this.smoke,transform(v.x,v.y,v.z,v.life,v.size),v.life*(v.wet?.10:.13));}gl.depthMask(true);
    if(!shot&&racing&&this.cameraMode===3){const use3D=this.cabin.status!=='error';this.renderMirror(race,p,angle,day,sky,w,h,!use3D);if(use3D)this.cabinActive=this.cabin.draw(this,race,driverPose,{day,fov:cabinFov,hands:options.cabinHands,song:options.song,reducedMotion:this.reducedMotion?.matches},this.mirrorTexture);if(use3D&&!this.cabinActive)this.renderMirror(race,p,angle,day,sky,w,h);document.body.classList.toggle('cabin-3d',this.cabinActive);}
  }
}
