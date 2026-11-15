# Parte 5 — Garaje + marcas de neumático

51 modelos GLB, 31 texturas, `skidmarks.js`, demo `index.html` (necesita importmap de three, ver demo).

## Garaje / showroom
- Plataforma giratoria: `turntable_platform` (r=3.4, anillo cian emisivo, marcas de grados) y `turntable_platform_low`. Pon tu auto en (0,0.245,0) y rota `car.rotation.y += dt*0.4`.
- Cuartos completos 12x10x4.5 m con plataforma al centro: `garage_room_day`, `garage_room_night`, `garage_room_tuning` (+ `garage_neon_tuning_kit` con tubos neón cian/magenta).
- Modulares (8 m): `garage_floor_8m`, `garage_wall_8m`, `garage_wall_door_open/closed`, `garage_wall_window`, `garage_ceiling_lit_8m`, `garage_pillar`, `showroom_backdrop_panel`.
- Props: gato hidráulico, cajonera roja, caja de herramientas, banco con pegboard, elevador 2 postes, grúa de motor, compresor, cambiadora de llantas, estante de piezas, caja de partes, mini-nevera, extintor, lámpara de trabajo, cono, banquito, bidón, latas y bidón de combustible.
- Neumáticos: `tire_single_flat`, `tire_stack_4/6`, `tire_rack_3x4`, `wheel_rim_loose`.
- Decoración: `poster_frame_a/b/c`, `sign_garage_hanging` (emisivo).

## Marcas de neumático
- Decals estáticos `skid_dry_a/b`, `skid_wet`, `skid_dirt`, `skid_snow`, `skid_drift_curve`, `skid_burnout` (planos sobre y=0.012, BLEND; usa polygonOffset si hay z-fighting).
- Dinámico: `new SkidMarks(scene,{base:'./'})`; cada frame por rueda que derrapa `sk.add(id, posContacto, intensidad)`, al soltar `sk.endWheel(id)`; `sk.setSurface('wet')`; `sk.update(dt)`. Ring buffer de 3000 quads, un solo draw call, desvanecimiento opcional.
- Humo/polvo: `new DriftSmoke(scene)`, `sm.emit(pos, vel, n, size)`, `sm.update(dt)`. Usa `smoke_atlas.png` (4x4) y `spark_sprite.png`.

Los GLB referencian `../textures/`. Carteles y logos son ficticios.
