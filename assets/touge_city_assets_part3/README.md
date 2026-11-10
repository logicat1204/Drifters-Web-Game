# Touge & Japan City — Parte 3 (cielos, público estático, ciudad modular, carrera)
Misma convención que las partes 1 y 2: metros, Y arriba, GLB con texturas externas en `../textures/`. Esta carpeta ya incluye copias de las texturas de las partes 1-2 que usan sus modelos.

## Skyboxes (textures/sky/) — 4 climas: day, sunset, night, rain
Cada clima: 6 caras JPG de 1024 px (px, nx, py, ny, pz, nz) + 1 equirectangular de 2048x1024. Comprobados en Three.js r160 (la cubemap y la equirect coinciden).
```js
const t = new THREE.CubeTextureLoader().setPath('textures/sky/')
  .load(['px','nx','py','ny','pz','nz'].map(f => `sky_day_${f}.jpg`));
t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
// o equirect: tex.mapping = THREE.EquirectangularReflectionMapping; scene.background = tex;
```
Incluyen montañas lejanas, nubes y (según clima) sol, estrellas y resplandor de ciudad. `scene.environment` con la equirect sirve para reflejos.

## Público estático (low poly, sin animación)
person_stand_a/b, person_cheer, person_photo, person_flag, person_umbrella, person_marshal, person_sit · crowd_row_10m_a/b (fila de 16, 10 m), crowd_row_rain (paraguas), crowd_group_small_a/b, crowd_group_photographers · stands_small_with_crowd / stands_small_empty · event_tent
Cada multitud es una sola malla (pocos draw calls); repítelas con `clone()` o `InstancedMesh`.

## Carrera
race_start_gate, race_finish_gate, checkpoint_arch, scoreboard_tower, barrier_fence_banner, tire_stack, traffic_cone, cone_row, flag_pole_checkered

## Ciudad modular
city_intersection_4way, city_t_junction, city_crosswalk, road_city_corner_90, sidewalk_segment, footbridge, konbini, ramen_shop, building_tower(+_night), building_apartment_narrow(+_night), street_sign_blue, wire_span_20m, car_parked_white/red/blue/silver, fire_hydrant, mailbox_japan, planter

Abre `index.html` con `npx serve .` (botones para cambiar de cielo). Contenido original generado proceduralmente (gen/).
