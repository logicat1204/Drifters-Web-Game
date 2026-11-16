# Rutas — Parte 4: elementos individuales de montañas y touge (45 assets)

Piezas sueltas y reutilizables, agrupadas por categoría (no por ruta). Mismo formato que las partes anteriores: GLB + PNG, origen en la base, +Y arriba, frente +Z, 1 unidad = 1 m. Cada carpeta lleva su `textures/`.

Notas:
- `mountain_*` son telones de fondo grandes (100–400 m); ponlos lejos del circuito.
- `cloud_bank_sprites`, `mist_valley_layers`, `onsen_hot_spring` (vapor) y `waterfall_pool` usan transparencia (BLEND): renderízalos después de lo opaco.
- Los carteles tienen texto en japonés + inglés; los kilómetros (`kilometer_post`) llevan "14" como ejemplo.

| Carpeta | Archivo | Contenido |
|---|---|---|
| `mountains/` | `cloud_bank_sprites.glb` | Banco de 4 nubes (sprites) |
| `mountains/` | `mist_valley_layers.glb` | Capas de niebla de valle |
| `mountains/` | `mountain_caldera_lake.glb` | Caldera con lago (estilo Haruna/Akagi) |
| `mountains/` | `mountain_jagged_peaks.glb` | Picos rocosos dentados (estilo Myogi), 110 m |
| `mountains/` | `mountain_volcano_cone.glb` | Volcán cónico con nieve (estilo Fuji), 380 m |
| `nature/` | `bamboo_grove_clump.glb` | Bambú (take), 16 cañas |
| `nature/` | `fallen_log_and_stump.glb` | Tronco caído con musgo y tocón |
| `nature/` | `hydrangea_bush.glb` | Hortensias (ajisai) |
| `nature/` | `jizo_statue_trio.glb` | Estatuas Jizo con baberos rojos |
| `nature/` | `matsu_pine_tree.glb` | Pino japonés (matsu) retorcido |
| `nature/` | `moss_rock_large.glb` | Roca grande con musgo |
| `nature/` | `onsen_hot_spring.glb` | Onsen de roca con vapor y cerca de madera |
| `nature/` | `rice_terrace_tanada.glb` | Arrozales en terraza (3 niveles) |
| `nature/` | `sakura_cherry_tree.glb` | Cerezo en flor |
| `nature/` | `stream_stepping_stones.glb` | Arroyo con piedras de paso |
| `nature/` | `sugi_cedar_tall.glb` | Cedro japonés (sugi) alto, 22 m |
| `nature/` | `sugi_grove_cluster.glb` | Grupo de 7 cedros |
| `nature/` | `susuki_pampas_grass.glb` | Pasto susuki (otoño) |
| `nature/` | `waterfall_pool.glb` | Cascada con poza |
| `structures/` | `hokora_roadside_shrine.glb` | Santuario de camino (hokora) con torii |
| `structures/` | `kominka_farmhouse.glb` | Casa rural tradicional con tejado de paja |
| `structures/` | `michi_no_eki_kiosk.glb` | Quiosco de parada de carretera (道の駅) |
| `structures/` | `pagoda_three_tier.glb` | Pagoda de tres pisos |
| `structures/` | `ryokan_inn_lodge.glb` | Posada japonesa (ryokan) de dos pisos con faroles |
| `structures/` | `shrine_honden_small.glb` | Santuario pequeño (honden) sobre base de piedra |
| `structures/` | `stone_stairs_shortcut.glb` | Escalera de piedra con pasamanos de madera |
| `structures/` | `wooden_footbridge.glb` | Puente peatonal de madera |
| `touge/` | `concrete_utility_pole.glb` | Poste de concreto con transformador |
| `touge/` | `culvert_box_concrete.glb` | Alcantarilla de concreto |
| `touge/` | `delineator_post_set.glb` | 4 postes delineadores con reflectores |
| `touge/` | `guardrail_end_terminal.glb` | Terminal de guardarraíl |
| `touge/` | `guardrail_module_4m.glb` | Módulo de guardarraíl de 4 m |
| `touge/` | `japan_post_box.glb` | Buzón de correos rojo |
| `touge/` | `kilometer_post.glb` | Mojón de kilometraje |
| `touge/` | `retaining_wall_panel_5m.glb` | Muro de contención de concreto 5 m |
| `touge/` | `sign_chain_required.glb` | Cartel de cadenas obligatorias |
| `touge/` | `sign_ice_warning.glb` | Aviso de hielo 凍結注意 |
| `touge/` | `sign_road_closed.glb` | Cartel de camino cerrado 通行止め |
| `touge/` | `sign_sharp_curve.glb` | Aviso de curva cerrada 急カーブ |
| `touge/` | `sign_slippery.glb` | Aviso de calzada resbaladiza |
| `touge/` | `sign_speed_30.glb` | Límite 30 km/h |
| `touge/` | `sign_speed_40.glb` | Límite 40 km/h |
| `touge/` | `slope_grid_frame_panel.glb` | Panel de talud con marco de concreto (法面) |
| `touge/` | `tire_wall_barrier.glb` | Muro de neumáticos rojo/blanco |
| `touge/` | `vending_machine_trio_canopy.glb` | 3 máquinas expendedoras bajo techo |

Visor: `npx serve .` y abrir `index.html` (three desde unpkg, requiere internet).
