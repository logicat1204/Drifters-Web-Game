// Dedicated static exhibition asset. It never enters the race car registry.
export const EXHIBITION_URL=new URL('../assets/cars/1985_toyota_sprinter_trueno_ae86_project_d.glb',import.meta.url).href;
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b){const r=new Array(16).fill(0);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;}
function localMatrix(n){
 if(n.matrix)return n.matrix;
 const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,...t,1];
}
export function parseMenuModel(buffer){
 const view=new DataView(buffer);if(view.byteLength<28||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw Error('GLB de exhibición inválido');
 let json,bin;
 for(let p=12;p<buffer.byteLength;){const size=view.getUint32(p,true),type=view.getUint32(p+4,true);p+=8;if(p+size>buffer.byteLength)throw Error('GLB incompleto');if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,p,size)));if(type===0x004e4942)bin=new DataView(buffer,p,size);p+=size;}
 if(!json||!bin)throw Error('Falta geometría del GLB');
 const read=id=>{const a=json.accessors[id],b=json.bufferViews[a.bufferView],size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],method={5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a.componentType];if(a.sparse||!size||!components)throw Error('Accessor no compatible');const result=new Float64Array(a.count*components),start=(b.byteOffset||0)+(a.byteOffset||0),stride=b.byteStride||size*components;for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){let value=bin[method](start+i*stride+j*size,true);if(a.normalized&&a.componentType!==5126)value=a.componentType===5121?value/255:a.componentType===5123?value/65535:Math.max(-1,value/(a.componentType===5120?127:32767));result[i*components+j]=value;}return result;};
 const groups=new Map(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let triangles=0;
 const walk=(id,parent,ancestors=new Set())=>{
  if(ancestors.has(id))throw Error('Jerarquía circular');const n=json.nodes[id],m=multiply(parent,localMatrix(n)),next=new Set(ancestors);next.add(id);
  if(n.mesh!==undefined)for(const primitive of json.meshes[n.mesh].primitives){
   if((primitive.mode??4)!==4||primitive.extensions?.KHR_draco_mesh_compression)throw Error('Malla de exhibición no compatible');
   const p=read(primitive.attributes.POSITION),norm=primitive.attributes.NORMAL===undefined?null:read(primitive.attributes.NORMAL),uv=primitive.attributes.TEXCOORD_0===undefined?null:read(primitive.attributes.TEXCOORD_0),indices=primitive.indices===undefined?Array.from({length:p.length/3},(_,i)=>i):read(primitive.indices),key=primitive.material??-1;if(!groups.has(key))groups.set(key,[]);const data=groups.get(key);
   const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],nx=cross(b,c),ny=cross(c,a),nz=cross(a,b),det=a.reduce((n,v,i)=>n+v*nx[i],0)||1;
   for(const i of indices){if(i<0||i*3+2>=p.length)throw Error('Índice de malla inválido');const v=[p[i*3],p[i*3+1],p[i*3+2]],pos=[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]],n=norm?[norm[i*3],norm[i*3+1],norm[i*3+2]]:[0,1,0],normal=[0,1,2].map(j=>(nx[j]*n[0]+ny[j]*n[1]+nz[j]*n[2])/det),length=Math.hypot(...normal)||1;for(let j=0;j<3;j++){min[j]=Math.min(min[j],pos[j]);max[j]=Math.max(max[j],pos[j]);}data.push(...pos,...normal.map(v=>v/length),uv?.[i*2]||0,uv?.[i*2+1]||0);}
   triangles+=indices.length/3;
  }
  for(const child of n.children||[])walk(child,m,next);
 };
 for(const id of json.scenes[json.scene||0].nodes)walk(id,identity());
 const scale=4.25/(max[2]-min[2]),cx=(min[0]+max[0])/2,cz=(min[2]+max[2])/2;
 const batches=[];for(const [material,values]of groups){const data=new Float32Array(values),center=[0,0,0];for(let i=0;i<data.length;i+=8){data[i]=(data[i]-cx)*scale;data[i+1]=(data[i+1]-min[1])*scale+.005;data[i+2]=(data[i+2]-cz)*scale;for(let j=0;j<3;j++)center[j]+=data[i+j]/(data.length/8);}if(!data.every(Number.isFinite))throw Error('Coordenadas inválidas');batches.push({material,data,count:data.length/8,center});}
 const images=(json.images||[]).map(image=>{if(image.uri)throw Error('La exhibición necesita texturas integradas');const b=json.bufferViews[image.bufferView];return {mimeType:image.mimeType,bytes:new Uint8Array(buffer,bin.byteOffset+(b.byteOffset||0),b.byteLength)};});
 return {batches,images,textures:json.textures||[],materials:json.materials||[],triangles,sourceBounds:{min,max},scale,credit:json.asset.extras||{}};
}

export class MenuModel {
 constructor(gl){this.gl=gl;this.status='idle';this.active=false;this.draws=0;this.maxAttribs=gl.getParameter(gl.MAX_VERTEX_ATTRIBS);}
 load(){
  if(this.promise)return this.promise;this.status='loading';
  this.promise=this.loadAsset().then(()=>{this.status='ready';return true;}).catch(error=>{this.status='error';this.error=error.message;return false;});return this.promise;
 }
 async loadAsset(){
  const response=await fetch(EXHIBITION_URL);if(!response.ok)throw Error('No se pudo cargar la exhibición');const model=parseMenuModel(await response.arrayBuffer()),gl=this.gl;this.model=model;
  const bitmaps=await Promise.all(model.images.map(async image=>{const blob=new Blob([image.bytes],{type:image.mimeType});return createImageBitmap(blob,{premultiplyAlpha:'none',colorSpaceConversion:'none'});}));
  this.textures=bitmaps.map(image=>{const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);let source=image;if(Math.max(image.width,image.height)>2048){const canvas=document.createElement('canvas'),ratio=2048/Math.max(image.width,image.height);canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);source=canvas;}gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_2D);image.close();return texture;});
  this.batches=model.batches.map(batch=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,batch.data,gl.STATIC_DRAW);return {...batch,buffer,data:null};});
  model.batches=[];model.images=[];
  this.compile();
 }
 compile(){
  const gl=this.gl,derivatives=!!gl.getExtension('OES_standard_derivatives');
  const vertex='attribute vec3 aPosition,aNormal;attribute vec2 aUv;uniform mat4 uView,uProjection;varying vec3 vPosition,vNormal;varying vec2 vUv;void main(){vPosition=aPosition;vNormal=aNormal;vUv=aUv;gl_Position=uProjection*uView*vec4(aPosition,1.);}';
  const fragment=`${derivatives?'#extension GL_OES_standard_derivatives : enable':''}
   precision highp float;varying vec3 vPosition,vNormal;varying vec2 vUv;
   uniform vec3 uEye,uEmission;uniform vec4 uColor;uniform float uMetallic,uRoughness,uTransmission,uClearcoat,uSpecular,uHasBase,uHasNormal,uHasMr,uHasEmission;
   uniform sampler2D uBase,uNormal,uMr,uEmissive;
   void main(){vec4 texel=uHasBase>.5?texture2D(uBase,vUv):vec4(1.);vec4 base=vec4(pow(texel.rgb,vec3(2.2))*uColor.rgb,texel.a*uColor.a);vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
   ${derivatives?'if(uHasNormal>.5){vec3 q1=dFdx(vPosition),q2=dFdy(vPosition);vec2 st1=dFdx(vUv),st2=dFdy(vUv);vec3 tangent=q1*st2.y-q2*st1.y,bitangent=-q1*st2.x+q2*st1.x;float inv=inversesqrt(max(dot(tangent,tangent),dot(bitangent,bitangent))+.000001);vec3 map=texture2D(uNormal,vUv).xyz*2.-1.;n=normalize(mat3(tangent*inv,bitangent*inv,n)*map);}':''}
   vec2 mr=uHasMr>.5?texture2D(uMr,vUv).bg:vec2(1.);float metallic=clamp(uMetallic*mr.x,0.,1.),roughness=clamp(uRoughness*mr.y,.24,1.);
   vec3 v=normalize(uEye-vPosition),sun=normalize(vec3(-.55,.8,.55)),halfway=normalize(v+sun),reflection=reflect(-v,n);float ndv=max(.01,dot(n,v)),ndl=max(0.,dot(n,sun));
   vec3 sky=mix(vec3(.50,.45,.40),vec3(.27,.43,.64),clamp(reflection.y*.5+.5,0.,1.)),ambient=mix(vec3(.20,.21,.22),vec3(.43,.49,.59),n.y*.5+.5),f0=mix(vec3(.04*uSpecular),base.rgb,metallic),fresnel=f0+(1.-f0)*pow(1.-ndv,5.);
   float highlight=pow(max(0.,dot(n,halfway)),mix(90.,8.,roughness)),fill=max(0.,dot(n,normalize(vec3(.8,.35,.5))));vec3 color=base.rgb*(ambient*.8+vec3(1.,.91,.79)*ndl*.95+vec3(.66,.79,1.)*fill*.7)*(1.-metallic*.65)+sky*fresnel*(1.-roughness*.55)+vec3(1.,.94,.85)*highlight*(.3+metallic)*.35;
   color+=sky*uClearcoat*(.025+pow(1.-ndv,5.)*.3);float alpha=base.a;
   if(uTransmission>.01){color=mix(base.rgb*.4,sky*(.3+fresnel),.8);alpha=clamp(alpha,.12,.55);}
   vec3 emission=uHasEmission>.5?pow(texture2D(uEmissive,vUv).rgb,vec3(2.2)):vec3(1.);color+=emission*uEmission*.12;
   color*=1.25;color=color/(color+vec3(.65));gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(1./2.2)),alpha);}`;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  this.program=gl.createProgram();const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.deleteShader(vs);gl.deleteShader(fs);
  this.attrs={};for(const name of ['aPosition','aNormal','aUv'])this.attrs[name]=gl.getAttribLocation(this.program,name);
  this.uniforms={};for(const name of ['uView','uProjection','uEye','uEmission','uColor','uMetallic','uRoughness','uTransmission','uClearcoat','uSpecular','uHasBase','uHasNormal','uHasMr','uHasEmission','uBase','uNormal','uMr','uEmissive'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
 }
 draw(view,projection,eye){
  if(this.status!=='ready')return {drawCalls:0,vertices:0};const gl=this.gl,u=this.uniforms,a=this.attrs;gl.useProgram(this.program);for(let i=0;i<this.maxAttribs;i++)gl.disableVertexAttribArray(i);
  gl.uniformMatrix4fv(u.uView,false,view);gl.uniformMatrix4fv(u.uProjection,false,projection);gl.uniform3fv(u.uEye,eye);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  const transparent=batch=>this.model.materials[batch.material]?.alphaMode==='BLEND',distance=batch=>batch.center.reduce((n,v,i)=>n+(v-eye[i])**2,0),ordered=[...this.batches.filter(b=>!transparent(b)),...this.batches.filter(transparent).sort((a,b)=>distance(b)-distance(a))];let vertices=0;
  for(const batch of ordered){const material=this.model.materials[batch.material]||{},p=material.pbrMetallicRoughness||{},ext=material.extensions||{};gl.depthMask(!transparent(batch));
   gl.bindBuffer(gl.ARRAY_BUFFER,batch.buffer);for(const [name,size,offset]of [['aPosition',3,0],['aNormal',3,12],['aUv',2,24]]){gl.enableVertexAttribArray(a[name]);gl.vertexAttribPointer(a[name],size,gl.FLOAT,false,32,offset);}
   gl.uniform4fv(u.uColor,p.baseColorFactor||[1,1,1,1]);gl.uniform1f(u.uMetallic,p.metallicFactor??1);gl.uniform1f(u.uRoughness,p.roughnessFactor??1);gl.uniform1f(u.uTransmission,ext.KHR_materials_transmission?.transmissionFactor||0);gl.uniform1f(u.uClearcoat,ext.KHR_materials_clearcoat?.clearcoatFactor||0);gl.uniform1f(u.uSpecular,ext.KHR_materials_specular?.specularFactor??1);gl.uniform3fv(u.uEmission,(material.emissiveFactor||[0,0,0]).map(v=>v*Math.min(2,ext.KHR_materials_emissive_strength?.emissiveStrength??1)));
   for(const [slot,sampler,flag,info]of [[0,'uBase','uHasBase',p.baseColorTexture],[1,'uNormal','uHasNormal',material.normalTexture],[2,'uMr','uHasMr',p.metallicRoughnessTexture],[3,'uEmissive','uHasEmission',material.emissiveTexture]]){const texture=info?this.textures[this.model.textures[info.index].source]:null;gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,texture||this.textures[0]);gl.uniform1i(u[sampler],slot);gl.uniform1f(u[flag],texture?1:0);}
   gl.drawArrays(gl.TRIANGLES,0,batch.count);vertices+=batch.count;
  }
  gl.depthMask(true);gl.activeTexture(gl.TEXTURE0);this.draws++;return {drawCalls:ordered.length,vertices};
 }
}
