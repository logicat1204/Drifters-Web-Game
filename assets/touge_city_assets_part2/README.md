# Touge & Japan City — Parte 2 (montaña + fondos low poly)
Misma convención que la parte 1: metros, Y arriba, GLB con texturas externas en `../textures/` (copia ambas carpetas juntas con las de la parte 1 si quieres un solo proyecto; los nombres no chocan).

## textures/ (30 PNG)
- Carretera: road_touge_orange (línea central naranja de no adelantar), road_touge_wet, gutter_concrete (cuneta en U), curb_concrete, slope_lattice (talud con retícula de hormigón), wall_mossy, roof_tile, plaster_wall, wood_planks
- Calcomanías (alpha): decal_30, decal_diamond, decal_arrow, decal_stopline, decal_tyre_marks, decal_leaves, decal_cracks, decal_manhole
- Señales: sign_falling_rocks, sign_slippery, sign_km_post, curve_mirror
- Sprites (alpha): bamboo, maple_red, ginkgo, sakura, susuki, fern, hydrangea; fog_gradient (plano de niebla); lowpoly_palette (16x4)

## models/ (52 GLB)
- Carretera: road_curve_90, road_curve_45_wide, road_hairpin_180, road_touge_wet_segment, road_shoulder_gutter, bridge_segment, tunnel_portal, 8 road_decal_* (planos a y=0.02; usa polygonOffset si hay z-fighting)
- Borde: curb_segment, jersey_barrier, reflector_post, curve_mirror, sign_falling_rocks, sign_slippery, km_post, slope_lattice_panel, mossy_wall_segment, rockfall_fence, wooden_fence, bus_stop_sign, power_pylon
- Entorno japonés: house_japanese_a/b, storage_shed, stone_lantern, roadside_shrine
- Vegetación y rocas: tree_maple, tree_pine, bamboo_cluster, bush_flowers, boulder_a/b/c
- Fondos low poly para bordes de mapa (bg_*): mountain_cone_a/b, mountain_fuji, ridge_long, ridge_low, hills_ring, hills_ring_low (anillos centrados en el origen, radio 300-620), forest_strip(_dense) (40 m, repetible), city_ring, clouds, sea_plane

Curvas: arrancan en el origen mirando -Z y giran a la derecha (espejalas con scale.x = -1 para girar a la izquierda).
Uso: `new GLTFLoader().load('models/road_hairpin_180.glb', g => scene.add(g.scene))`. Abre `index.html` con `npx serve .`.
Contenido original generado proceduralmente (scripts en gen/).
