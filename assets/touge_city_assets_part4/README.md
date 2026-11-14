# Parte 4 — Race Angels + Wet Night City

46 modelos GLB, 47 texturas, `wet-night.js` (Three.js r150+), `index.html` demo.

## Uso rápido
```js
import {setupWetNight,tuneWetMaterials,createPlanarReflection} from './wet-night.js';
const wn=setupWetNight(renderer,scene,camera,{base:'./'}); // cielo night_rain, niebla, PMREM, bloom, lluvia
// en el loop: wn.update(dt,t); wn.render();   (usa composer)
tuneWetMaterials(gltf.scene);                    // refuerza envMap y emisivos
scene.add(createPlanarReflection(5,12));         // reflexión real en charcos grandes
wn.addRipples(x,z,w,d,60);                       // rizos animados
```
Requiere importmap para `three` y `three/addons/`. Ver `index.html`.

## Contenido
- **Race Angels** (`angel_*`): azafatas estilizadas adultas, diseños originales, 4 equipos de color, poses: stand, hip, cheer, wave, board (carteles numerados), flag (bandera a cuadros), umbrella, photo. Carteles genéricos "RACE ANGELS" / "MF RACE" (marca ficticia).
- **Fans/staff**: `fan_girl_*`, `fan_boy_cheer`, `staff_mechanic`.
- **Multitudes** `crowd_*`: filas y grupos (angels, fans, lluvia, noche, staff) en un solo mesh cada una (1 draw call por material).
- **Ciudad mojada**: `road_city_wet_segment`, `city_intersection_wet`, `crosswalk_wet_plane`, `asphalt_wet_tile_20m`, `building_*_wet_night` (fachadas con emissive), `neon_sign_*`, `chochin_*`, `vending_machine_lit`, `streetlight_cone`, `traffic_light_red_lit`, `puddle_a/b/c`, `rain_curtain_cylinder`.
- **Texturas**: roads/asfalto con `*_mr.png` (G=roughness, B=metal), `puddle_mask`, decals de reflejo de neón, `rain_streaks`, `ripple_atlas` (4 fotogramas), `splash_atlas`, `glow_sprite`, `light_cone`.
- **Cielo**: `textures/sky/sky_nightrain_*` (6 caras + equirect).

Los GLB referencian `../textures/`. flag_checker.png incluida.
