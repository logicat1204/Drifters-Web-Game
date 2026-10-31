# Touge & Japan City — pack de entornos para navegador (Three.js)
Unidades: metros · Y arriba · modelos GLB (glTF 2.0) de bajo polígono con UV y texturas externas en `../textures/`.

## textures/ (PNG, 34 archivos, 512 px salvo indicado)
- Suelo/carretera (tileables): asphalt, road_mountain (borde+línea central discontinua), road_city (2 carriles+doble amarilla), crosswalk, gravel, dirt, grass
- Paredes: concrete_wall (muro de piedra tipo ishigaki), rock_cliff, tunnel_wall, guardrail_metal
- Ciudad: facade_office / apartment / shop (+ versiones `_night` con ventanas encendidas), neon_signs (atlas 1024x512: RAMEN, BAR, HOTEL, GAME), billboard_generic, skyline_night (alpha, 1024x256)
- Señales: sign_chevron, sign_curve_warning, sign_speed_40, sign_speed_60 (alpha)
- Naturaleza (alpha): sprite_tree_cedar / autumn / pine / green (256x512, para billboards), mountains_far / mid / near (1024x256, repetibles en horizontal)
- Cielos 1024x512: sky_day, sky_sunset, sky_night

## models/ (GLB)
guardrail_segment (4 m), streetlight, utility_pole, tree_cedar, tree_autumn, sign_chevron, torii_gate, vending_machine, traffic_light, retaining_wall (10 m), cliff_face, tunnel_segment (10 m), building_office/apartment/shop (+_night), road_mountain_segment (7x20 m), road_city_segment (14x20 m).

## Uso rápido
```js
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
new GLTFLoader().load('models/guardrail_segment.glb', g => scene.add(g.scene));
// textura repetible: tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(20, 1);
```
Abre `index.html` con un servidor estático (`npx serve .`) para ver todos los modelos.
Todo es contenido original generado proceduralmente; sin marcas ni material con derechos.
