import {buildCabin,cabinProfile} from './cabin-geometry.mjs';
import {vehicleMultiply as mul} from './vehicle-model.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export const cabinTranslation=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const rx=a=>{const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];},ry=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];},rz=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];};
export function cabinViewMatrix(p,m){const eye=[p.seat+m.x,p.height+m.y,.12+m.z],rotation=mul(mul(rz(-m.roll),rx(-m.pitch)),ry(-m.yaw));return mul(rotation,cabinTranslation(-eye[0],-eye[1],-eye[2]));}
function projection(fov,aspect){const f=1/Math.tan(fov*Math.PI/360),near=.035,far=5;return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];}
export function cabinMirrorBounds(p,m,fov,width,height){const matrix=mul(projection(fov,width/height),cabinViewMatrix(p,m)),points=[];for(const x of [-.161,.161])for(const y of [1.246,1.334]){const v=[x,y+(p.yOffset||0),-.902,1],q=[0,1,2,3].map(i=>v.reduce((s,n,k)=>s+n*matrix[k*4+i],0));points.push([(q[0]/q[3]*.5+.5)*width,(.5-q[1]/q[3]*.5)*height]);}const x=clamp(Math.min(...points.map(p=>p[0])),0,width),y=clamp(Math.min(...points.map(p=>p[1])),0,height);return {x,y,width:clamp(Math.max(...points.map(p=>p[0])),0,width)-x,height:clamp(Math.max(...points.map(p=>p[1])),0,height)-y,scale:1};}
const color=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const scaleX=x=>[x,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const focusColors={balance:'#ab8bff',drift:'#9deaff',time:'#f5cf66'};
export class CabinView {
 constructor(gl){this.gl=gl;this.status='idle';this.cache=new Map();this.draws=0;this.triangles=0;}
 init(){
  const gl=this.gl,compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const vs=compile(gl.VERTEX_SHADER,`attribute vec3 aPos,aNormal;attribute vec4 aColor,aSurface;uniform mat4 uModel,uView,uProjection;varying vec3 vNormal,vPosition;varying vec4 vColor,vSurface;void main(){vec4 p=uModel*vec4(aPos,1.);vPosition=p.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;vSurface=aSurface;gl_Position=uProjection*uView*p;}`);
  const fs=compile(gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D uTexture,uRear;uniform float uDay,uFocus,uPulse;uniform vec3 uFocusColor;varying vec3 vNormal,vPosition;varying vec4 vColor,vSurface;void main(){
   if(vSurface.z>1.5){gl_FragColor=vec4(texture2D(uRear,vec2(1.-vSurface.x,1.-vSurface.y)).rgb,1.);return;}
   vec3 n=normalize(vNormal),base=vColor.rgb;float grain=fract(sin(dot(floor(vPosition.xy*1800.),vec2(12.98,78.23)))*43758.54);
   float sun=max(0.,dot(n,normalize(vec3(-.4,1.,.6)))),ambient=mix(.20,.70,uDay),light=ambient+sun*mix(.10,.40,uDay);base*=.97+grain*.05;
   if(vSurface.z>.5){base=texture2D(uTexture,vSurface.xy).rgb;light=mix(light,1.,.84);}else light+=max(0.,n.z)*.08;
   vec3 result=base*mix(light,1.,vColor.a);float sheen=pow(max(0.,dot(n,normalize(vec3(.3,.5,1.)))),28.);result+=vec3(.11,.14,.18)*sheen*mix(.15,.6,uDay)*(1.-vColor.a);
   result+=uFocusColor*(uFocus*.10+uPulse*.045)*max(.15,n.z)*(1.-vColor.a);gl_FragColor=vec4(result,1.);
  }`);
  this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  this.attrs={};for(const name of ['aPos','aNormal','aColor','aSurface'])this.attrs[name]=gl.getAttribLocation(this.program,name);this.u={};for(const name of ['uModel','uView','uProjection','uTexture','uRear','uDay','uFocus','uPulse','uFocusColor'])this.u[name]=gl.getUniformLocation(this.program,name);
  this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=512;this.ctx=this.canvas.getContext('2d');this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1024,512,0,gl.RGBA,gl.UNSIGNED_BYTE,null);for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);this.status='ready';
 }
 asset(id){let a=this.cache.get(id);if(a){this.cache.delete(id);this.cache.set(id,a);return a;}const model=buildCabin(cabinProfile(id));a={profile:model.profile,parts:{}};for(const [name,data]of Object.entries(model)){if(name==='profile')continue;const buffer=this.gl.createBuffer();this.gl.bindBuffer(this.gl.ARRAY_BUFFER,buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,data,this.gl.STATIC_DRAW);a.parts[name]={buffer,count:data.length/14};}this.cache.set(id,a);if(this.cache.size>4){const [key,old]=this.cache.entries().next().value;for(const part of Object.values(old.parts))this.gl.deleteBuffer(part.buffer);this.cache.delete(key);}return a;}
 paint(r,p,song,time){
  const c=this.ctx;c.clearRect(0,0,1024,512);c.fillStyle='#080d12';c.fillRect(0,0,1024,512);const label=(s,x,y,size=18,col=p.accent,align='center')=>{c.font=`${size}px Consolas,monospace`;c.fillStyle=col;c.textAlign=align;c.fillText(s,x,y);};
  const digital=['digital','virtual'].includes(p.instruments),five=p.instruments==='five',center=['center','race'].includes(p.instruments),rpmMax=Math.max(8,Math.ceil((r.car?.maxRpm||9000)/1000)),dials=five?5:digital?0:3;
  for(let j=0;j<dials;j++){const x=five?115+j*195:center?[190,512,830][j]:[245,650,887][j],rad=five?82:center?(j===1?111:78):j===2?49:105,y=129;
   c.fillStyle='#0d141b';c.beginPath();c.arc(x,y,rad,0,7);c.fill();c.strokeStyle='#57626b';c.lineWidth=3;c.stroke();
   const isRpm=five?j===2:center?j===1:j===0,max=isRpm?rpmMax: j===2&&!five?4:12;
   for(let i=0;i<=max*4;i++){const a=(-220+i/(max*4)*260)*Math.PI/180,major=i%4===0;c.strokeStyle=isRpm&&i/(max*4)>.83?'#ef7456':p.accent;c.lineWidth=major?3:1;c.beginPath();c.moveTo(x+Math.cos(a)*rad*(major?.77:.88),y+Math.sin(a)*rad*(major?.77:.88));c.lineTo(x+Math.cos(a)*rad*.95,y+Math.sin(a)*rad*.95);c.stroke();if(major&&(isRpm||max!==12||i%8===0))label(String(i/4*(isRpm?1:20)),x+Math.cos(a)*rad*.60,y+Math.sin(a)*rad*.60+5,rad*.19);}
   label(isRpm?'×1000 r/min':j===2&&!five?'TEMP':'km/h',x,y+rad*.43,rad*.12);
  }
  if(digital){label(String(Math.round(r.speed*3.6)),610,181,103);label('km/h',837,181,25);for(let i=0;i<48;i++){c.fillStyle=i<r.rpm/200?(i>40?'#ef7656':p.accent):'#202a32';c.fillRect(68+i*18,38,12,35);}for(let i=0;i<=9;i++)label(String(i),80+i*94,96,20);label(p.id==='s2000'?'VTEC / HONDA':r.car.brand,210,169,23);}
  if(p.instruments==='virtual'||p.id==='alfa4c'){
   c.fillStyle='#080e15';c.fillRect(0,0,1024,255);const centers=p.id==='r8'?[240,785]:[290],radius=105;
   for(const [j,x]of centers.entries()){c.strokeStyle='#80909f';c.lineWidth=4;c.beginPath();c.arc(x,125,radius,0,7);c.stroke();for(let i=0;i<=9;i++){const a=(-220+i/9*260)*Math.PI/180;label(String(j===1?i*30:i),x+Math.cos(a)*80,132+Math.sin(a)*80,18);}
    const value=j===1?r.speed*3.6/270:r.rpm/9000,angle=(-220+value*260)*Math.PI/180;c.strokeStyle='#ed795b';c.lineWidth=4;c.beginPath();c.moveTo(x,125);c.lineTo(x+Math.cos(angle)*74,125+Math.sin(angle)*74);c.stroke();
   }label(String(Math.round(r.speed*3.6)),p.id==='r8'?510:730,155,p.id==='r8'?68:93);label('km/h',p.id==='r8'?510:730,189,19);label(r.car.brand,510,40,18);
  }
  label(String(r.gear),center?512:505,221,29,'#f2ebe0');label((r.manual?'MT':'AT')+'  '+(r.headlights?'LIGHTS ON':'LIGHTS OFF'),815,236,16,'#9aaab5');label('FUEL  ▰▰▰▰   TEMP  ▰▰',244,239,14,'#95a4ad');
  if(r.rpm>7400){c.fillStyle='#a63829';c.fillRect(453,3,118,23);label('SHIFT',512,21,18,'#fff2cd');}
  // Atlas lower half: the stereo/HVAC face and small model-specific badges.
  this.consoleCanvas??=document.createElement('canvas');const panel=this.consoleCanvas;if(panel.width!==256||panel.height!==310){panel.width=256;panel.height=310;}const k=panel.getContext('2d'),gradient=k.createLinearGradient(0,0,256,310);gradient.addColorStop(0,'#222b33');gradient.addColorStop(1,'#10181f');k.fillStyle=gradient;k.fillRect(0,0,256,310);
  const small=(s,x,y,size=11,col=p.accent)=>{k.fillStyle=col;k.font=`${size}px Consolas,monospace`;k.textAlign='center';k.fillText(s,x,y);};k.fillStyle='#071017';k.fillRect(10,15,236,65);small(String(song||'MIDNIGHT TRANSMISSION').slice(0,25),128,38,10);small('STEREO · '+r.car.code,128,62,10,'#94a4ae');
  for(let i=0;i<6;i++){k.fillStyle='#323b44';k.fillRect(13+i*39,89,33,13);small(String(i+1),29+i*39,99,7,'#ccd5d8');}
  for(let i=0;i<3;i++){const x=48+i*80;k.beginPath();k.arc(x,166,26,0,7);k.fillStyle='#0c1218';k.fill();k.lineWidth=2;k.strokeStyle='#707b83';k.stroke();k.fillStyle=p.accent;k.fillRect(x-2,143,4,10);small(['TEMP','FAN','VENT'][i],x,211,10,'#abb9c1');}small('COOL                  HOT',128,245,9,'#b8c9d1');k.fillStyle='#a34636';k.fillRect(117,265,23,20);small('△',129,280,12,'#f6d1c4');c.drawImage(panel,0,256,512,256);
  label(r.car.name.slice(0,28),768,301,22,'#c7ced0');label(p.family==='classic'?'TRUENO':r.car.brand,691,403,35,'#d9dedd');
  label('MULTI FUNCTION DISPLAY',768,468,13,'#a0c4ce');label('BOOST  ▰▰▰▰   OIL  92°C',768,493,15,'#8fbdc7');
  const gl=this.gl;gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);this.paintedAt=time;this.paintedCar=p.id;
 }
 draw(renderer,r,m,options,mirror){
  try{if(this.status==='idle')this.init();if(this.status!=='ready')return false;const gl=this.gl,{profile:p,parts}=this.asset(r.car.id),u=this.u,view=cabinViewMatrix(p,m),aspect=renderer.canvas.clientWidth/renderer.canvas.clientHeight;
   const paintKey=[p.id,r.gear,Math.round(r.speed*3.6),Math.floor(r.rpm/120),r.headlights,options.song].join(':');if(this.paintedCar!==p.id||paintKey!==this.paintKey&&renderer.time-(this.paintedAt??-1)>1/20){this.paint(r,p,options.song,renderer.time);this.paintKey=paintKey;}
   gl.useProgram(this.program);gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.uniformMatrix4fv(u.uView,false,view);gl.uniformMatrix4fv(u.uProjection,false,projection(options.fov,aspect));
   gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(u.uTexture,2);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,mirror);gl.uniform1i(u.uRear,3);gl.uniform1f(u.uDay,options.day?1:0);
   const focus=r.focus?.remaining>0?1:0,pulse=options.reducedMotion?0:Math.max(0,(r.skill?.intensity||0)-.5)*.8;gl.uniform1f(u.uFocus,focus);gl.uniform1f(u.uPulse,pulse);gl.uniform3fv(u.uFocusColor,color(focusColors[r.focus?.type]||'#afd7ee'));
   this.frameDraws=0;this.frameVertices=0;const draw=(part,matrix=identity())=>{const a=parts[part];gl.bindBuffer(gl.ARRAY_BUFFER,a.buffer);for(const [name,size,offset]of [['aPos',3,0],['aNormal',3,12],['aColor',4,24],['aSurface',4,40]]){const location=this.attrs[name];if(location<0)continue;gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,56,offset);}gl.uniformMatrix4fv(u.uModel,false,matrix);gl.drawArrays(gl.TRIANGLES,0,a.count);renderer.stats.drawCalls++;renderer.stats.vertices+=a.count;this.frameDraws++;this.frameVertices+=a.count;};
   draw('body');
   // Negative world steering turns right. In cabin coordinates, a negative Z rotation is clockwise.
   const wheelAngle=m.steer*1.45,wheel=mul(mul(cabinTranslation(p.seat,.74+p.yOffset,-.60),rx(-.18)),rz(wheelAngle));draw('wheel',wheel);
   const shift=Math.sin(m.shift*Math.PI),gearX=(r.gear%2?-.02:.02),gearZ=r.gear%2?-.035:.035;draw('lever',mul(cabinTranslation(gearX,.52+p.yOffset,-.35+gearZ),rx(shift*.12)));
   if(options.hands!==false){const handAngle=wheelAngle,handRig=wheel;for(const side of [-1,1]){const v=[side*p.wheelRadius*.94,.028,.025],pt=[handRig[0]*v[0]+handRig[4]*v[1]+handRig[8]*v[2]+handRig[12],handRig[1]*v[0]+handRig[5]*v[1]+handRig[9]*v[2]+handRig[13],handRig[2]*v[0]+handRig[6]*v[1]+handRig[10]*v[2]+handRig[14]],moving=side===-Math.sign(p.seat)?Math.max(shift,m.handbrake||0):0;
     const target=r.handbrakeDown?[0,.58+p.yOffset,.10]:[gearX,.65+p.yOffset,-.35+gearZ];for(let i=0;i<3;i++)pt[i]+=(target[i]-pt[i])*moving;
     draw('arm',mul(cabinTranslation(...pt),scaleX(side)));draw('hand',mul(mul(cabinTranslation(...pt),rz(handAngle*(1-moving))),scaleX(side)));
   }}
   draw('mirror',cabinTranslation(0,1.29+p.yOffset,-.91));this.mirrorBounds=cabinMirrorBounds(p,m,options.fov,renderer.canvas.clientWidth,renderer.canvas.clientHeight);
   if(!['digital','virtual'].includes(p.instruments)){const center=['center','race'].includes(p.instruments),five=p.instruments==='five',positions=five?[[0,.804],[.099,.804]]:center?[[0,.804],[-.170,.804]]:[[-.141,.804],[.073,.804]];for(let i=0;i<2;i++){const value=i===0?r.rpm/9000:r.speed*3.6/240,a=(220-clamp(value,0,1)*260)*Math.PI/180;draw('needle',mul(cabinTranslation(p.seat+positions[i][0],positions[i][1]+p.yOffset,-p.depth+.243),rz(a-Math.PI/2)));}}
   if(r.wet){const a=Math.sin(renderer.time*3.8)*.88;for(const x of [-.30,.30])draw('wiper',mul(cabinTranslation(x,.80+p.yOffset,-1.23),mul(rx(-.37),rz(a))));}
   gl.activeTexture(gl.TEXTURE0);gl.useProgram(renderer.program);renderer.boundBuffer=null;this.draws++;this.car=p.id;this.triangles=this.frameVertices/3;return true;
  }catch(error){this.status='error';this.error=error.message;this.gl.useProgram(renderer.program);renderer.boundBuffer=null;return false;}
 }
}
