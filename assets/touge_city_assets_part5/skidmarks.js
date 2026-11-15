// skidmarks.js — marcas de neumático dinámicas + humo de derrape (Three.js >= r150, ES module)
import * as THREE from 'three';

/** Marcas dinámicas: una malla única (ring buffer). Una "rueda" = un id con su último punto. */
export class SkidMarks {
  constructor(scene, {base = './', maxQuads = 3000, width = 0.28, fadeTime = 25, surface = 'dry'} = {}) {
    this.max = maxQuads; this.width = width; this.fade = fadeTime; this.i = 0; this.count = 0; this.last = new Map(); this.t = 0;
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxQuads * 4 * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(maxQuads * 4 * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxQuads * 4 * 4), 4));
    g.setAttribute('born', new THREE.BufferAttribute(new Float32Array(maxQuads * 4), 1));
    const idx = new Uint32Array(maxQuads * 6); for (let q = 0; q < maxQuads; q++) idx.set([q*4, q*4+1, q*4+2, q*4, q*4+2, q*4+3], q * 6);
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
    this.tex = new THREE.TextureLoader().load(base + 'textures/decal_skid_strip.png'); this.tex.wrapT = THREE.RepeatWrapping; this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({map: this.tex, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; scene.add(this.mesh);
    this.setSurface(surface);
  }
  /** 'dry' | 'wet' | 'dirt' | 'snow' — cambia tinte y opacidad de las marcas nuevas. */
  setSurface(s) { this.tint = {dry: [.02,.02,.025,.9], wet: [.05,.06,.07,.5], dirt: [.22,.14,.08,.8], snow: [.55,.6,.68,.7]}[s] || [.02,.02,.025,.9]; }
  /** Llamar cada frame por rueda que derrapa. pos: Vector3 contacto; intensity 0..1; si no derrapa llamar endWheel(id). */
  add(id, pos, intensity = 1) {
    const prev = this.last.get(id); const p = pos.clone(); p.y += 0.015;
    if (!prev) { this.last.set(id, {p, d: new THREE.Vector3(), v: 0, i: intensity, has: false}); return; }
    const d = p.clone().sub(prev.p); const len = d.length(); if (len < 0.15) return; d.divideScalar(len);
    const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(this.width / 2);
    const pd = prev.has ? prev.d : d; const pside = new THREE.Vector3(-pd.z, 0, pd.x).multiplyScalar(this.width / 2);
    const A = prev.p.clone().sub(pside), B = prev.p.clone().add(pside), C = p.clone().add(side), D = p.clone().sub(side);
    const q = this.i, v0 = prev.v, v1 = prev.v + len / 1.2, P = this.geo.attributes.position, U = this.geo.attributes.uv, C4 = this.geo.attributes.color, Bn = this.geo.attributes.born;
    [A, B, C, D].forEach((v, k) => P.setXYZ(q*4+k, v.x, v.y, v.z));
    [[0,v0],[1,v0],[1,v1],[0,v1]].forEach((uv, k) => U.setXY(q*4+k, uv[0], uv[1]));
    const [r,g,b,a] = this.tint; [prev.i, prev.i, intensity, intensity].forEach((it, k) => { C4.setXYZW(q*4+k, r, g, b, a * it); Bn.setX(q*4+k, this.t); });
    P.needsUpdate = U.needsUpdate = C4.needsUpdate = Bn.needsUpdate = true;
    this.i = (this.i + 1) % this.max; this.count = Math.min(this.count + 1, this.max); this.geo.setDrawRange(0, this.count * 6);
    this.last.set(id, {p, d, v: v1, i: intensity, has: true});
  }
  endWheel(id) { this.last.delete(id); }
  /** Opcional: desvanece marcas viejas (llamar ~cada 0.25s, no cada frame). */
  update(dt) {
    this.t += dt; if (!this.fade) return; const C4 = this.geo.attributes.color, Bn = this.geo.attributes.born;
    for (let k = 0; k < this.count * 4; k++) { const age = this.t - Bn.getX(k); if (age > this.fade * .5) C4.setW(k, Math.min(C4.getW(k), Math.max(0, 1 - (age - this.fade * .5) / (this.fade * .5)) * this.tint[3])); }
    C4.needsUpdate = true;
  }
  clear() { this.count = 0; this.i = 0; this.last.clear(); this.geo.setDrawRange(0, 0); }
}

/** Humo/polvo de derrape con atlas smoke_atlas.png (4x4 fotogramas, GPU points). */
export class DriftSmoke {
  constructor(scene, {base = './', max = 400, color = 0xdddddd, life = 1.6} = {}) {
    this.max = max; this.life = life; this.i = 0; this.t = 0;
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute('vel', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute('born', new THREE.BufferAttribute(new Float32Array(max).fill(-999), 1));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(max), 1));
    const tex = new THREE.TextureLoader().load(base + 'textures/smoke_atlas.png'); tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {t: {value: 0}, map: {value: tex}, col: {value: new THREE.Color(color)}, life: {value: life}, px: {value: 600}},
      vertexShader: `uniform float t,life,px;attribute vec3 vel;attribute float born,size;varying float k;void main(){float a=t-born;k=a/life;vec3 p=position+vel*a+vec3(0.,a*.5,0.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(k<0.||k>1.)?0.:size*(1.+k*2.5)*px/-mv.z;}`,
      fragmentShader: `uniform sampler2D map;uniform vec3 col;varying float k;void main(){float f=floor(clamp(k,0.,.99)*16.);vec2 c=vec2(mod(f,4.),floor(f/4.));vec2 uv=(c+gl_PointCoord*.94+.03)/4.;vec4 s=texture2D(map,uv);gl_FragColor=vec4(col,s.a*(1.-k)*.8);}`});
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 3; scene.add(this.points);
  }
  /** Emite n partículas en pos con velocidad base vel (Vector3). */
  emit(pos, vel, n = 2, size = 1) {
    const P = this.geo.attributes.position, V = this.geo.attributes.vel, B = this.geo.attributes.born, S = this.geo.attributes.size;
    for (let k = 0; k < n; k++) { const i = this.i; this.i = (this.i + 1) % this.max;
      P.setXYZ(i, pos.x + (Math.random() - .5) * .3, pos.y + .1, pos.z + (Math.random() - .5) * .3); V.setXYZ(i, vel.x * .2 + (Math.random() - .5) * .8, .3 + Math.random() * .5, vel.z * .2 + (Math.random() - .5) * .8); B.setX(i, this.t); S.setX(i, size * (.6 + Math.random() * .6)); }
    P.needsUpdate = V.needsUpdate = B.needsUpdate = S.needsUpdate = true;
  }
  update(dt, viewportHeight = innerHeight) { this.t += dt; this.mat.uniforms.t.value = this.t; this.mat.uniforms.px.value = viewportHeight * 0.9; }
}
