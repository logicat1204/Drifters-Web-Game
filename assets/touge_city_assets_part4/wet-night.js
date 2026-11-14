// wet-night.js — helper para ambiente nocturno lluvioso (Three.js >= r150, ES module)
import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

/** Configura renderer, cielo, niebla, entorno PMREM y bloom.
 *  base: ruta a la carpeta con textures/ (p.ej. './'). Devuelve {render,update,composer}. */
export function setupWetNight(renderer, scene, camera, {base='./', bloom=0.45, fog=0.010, rainOn=true}={}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.TextureLoader().load(base + 'textures/sky/sky_nightrain_equirect.jpg', t => {
    t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t; const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(t).texture; pm.dispose();
  });
  scene.fog = new THREE.FogExp2(0x101826, fog);
  const hemi = new THREE.HemisphereLight(0x7f94c8, 0x252b38, 1.1); scene.add(hemi);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bp = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), bloom, 0.4, 1.0); composer.addPass(bp);
  composer.addPass(new OutputPass());
  const rain = rainOn ? createRain(base) : null; if (rain) scene.add(rain.object);
  const ripples = [];
  return {
    composer, bloomPass: bp, rain,
    addRipples(x, z, w, d, n = 40) { const r = createRipples(base, w, d, n); r.object.position.set(x, 0.03, z); scene.add(r.object); ripples.push(r); return r; },
    resize(w, h) { renderer.setSize(w, h); composer.setSize(w, h); },
    update(dt, t) { if (rain) rain.update(dt, camera.position); ripples.forEach(r => r.update(t)); },
    render() { composer.render(); }
  };
}

/** Lluvia: segmentos GPU que caen alrededor de la cámara. */
export function createRain(base = './', {count = 6000, area = 40, height = 25, speed = 28, wind = 3, color = 0xaec6e8, opacity = 0.35} = {}) {
  const pos = new Float32Array(count * 6), seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { const x = (Math.random() - .5) * area, z = (Math.random() - .5) * area, y = Math.random() * height;
    pos.set([x, y, z, x, y + 0.7, z], i * 6); seed[i * 2] = seed[i * 2 + 1] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { t: {value: 0}, cam: {value: new THREE.Vector3()}, area: {value: area}, h: {value: height}, spd: {value: speed}, wind: {value: wind}, col: {value: new THREE.Color(color)}, op: {value: opacity} },
    vertexShader: `uniform float t,area,h,spd,wind;uniform vec3 cam;attribute float seed;varying float a;void main(){vec3 p=position;p.y=mod(p.y-t*spd*(.8+seed*.4),h);p.x+=wind*(t*.0)+ (p.y)*wind*.02;vec3 w=p;w.xz=mod(w.xz-cam.xz+area*.5,area)-area*.5+cam.xz;a=smoothstep(0.,2.,p.y)*smoothstep(h,h-4.,p.y);gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
    fragmentShader: `uniform vec3 col;uniform float op;varying float a;void main(){gl_FragColor=vec4(col,op*a);}` });
  const o = new THREE.LineSegments(g, mat); o.frustumCulled = false;
  return { object: o, update(dt, camPos) { mat.uniforms.t.value += dt; mat.uniforms.cam.value.copy(camPos); } };
}

/** Rizos animados sobre el suelo (ripple_atlas.png, atlas horizontal de 4 fotogramas). */
export function createRipples(base, w, d, n = 40) {
  const tex = new THREE.TextureLoader().load(base + 'textures/ripple_atlas.png'); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(.25, 1);
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .8, fog: true });
  const im = new THREE.InstancedMesh(geo, mat, n), ph = [], m4 = new THREE.Matrix4(), sc = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) { ph.push({ x: (Math.random() - .5) * w, z: (Math.random() - .5) * d, s: .5 + Math.random() * .7 }); p.set(ph[i].x, 0, ph[i].z); sc.set(ph[i].s, 1, ph[i].s); m4.compose(p, q, sc); im.setMatrixAt(i, m4); }
  return { object: im, update(t) { tex.offset.set((Math.floor(t * 6) % 4) * .25, 0); } };
}

/** Reflexión planar real (Reflector) para un charco/tramo: pásale un mesh plano. */
export function createPlanarReflection(w, d, {color = 0x889abb, textureWidth = 1024, textureHeight = 1024, y = 0.02} = {}) {
  const r = new Reflector(new THREE.PlaneGeometry(w, d), { color, textureWidth, textureHeight, clipBias: .003 });
  r.rotation.x = -Math.PI / 2; r.position.y = y; return r;
}

/** Recorre un GLB y refuerza materiales mojados: envMap + emissive para neones/fachadas. */
export function tuneWetMaterials(root, {envIntensity = 1.0, emissive = 0.8} = {}) {
  root.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
    if (m.isMeshStandardMaterial) { m.envMapIntensity = envIntensity; if (m.emissiveMap) m.emissiveIntensity = emissive; if (m.metalness > .9) m.roughness = Math.max(m.roughness, .03); } }); });
}
