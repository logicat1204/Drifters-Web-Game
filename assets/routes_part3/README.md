# Rutas — Parte 3: tramos de carretera + props (32 assets)

Cada ruta tiene un **tramo de carretera** (`*_road_*`) con su forma y entorno característicos, más un **prop** nuevo. Mismo formato que las partes 1 y 2 (GLB + PNG, origen en la base, 1 unidad = 1 m).

## Cómo encadenar los tramos
Todos los tramos empiezan en el origen (0,0,0) mirando hacia **-Z**, con la carretera de 7 m de ancho (el de `turnpike` mide 10.5 m). Para unir dos tramos, coloca el siguiente en el punto final del anterior y gíralo según su ángulo final:
- `akina_road_hairpin`: termina girado 180° (sale hacia +Z).
- `akagi`: 70° · `enna`: 0° (S) · `happogahara`: 35° · `irohazaka`: 0° (doble horquilla) · `momiji`: 90° · `myogi`: 80° · `nagao`: 120° · `nanamagari`: 0° · `sadamine`: 0° · `tsubaki`: 90° · `tsuchisaka`: 0° (recto) · `tsukuba`: 0° · `turnpike`: 40° · `usui`: 100° · `yabitsu`: 65°.
Positivo = giro a la derecha. La textura de la calzada va incluida y se repite cada 8 m; las líneas de borde ya están pintadas.

| Carpeta | Archivo | Contenido |
|---|---|---|
| `akagi/` | `akagi_info_board.glb` | Panel de información con techo |
| `akagi/` | `akagi_road_lake_curve.glb` | Curva amplia con muro de piedra y guardarraíl |
| `akina/` | `akina_road_hairpin.glb` | Horquilla 180° con canaleta de concreto y guardarraíl |
| `akina/` | `akina_sign_hairpin5.glb` | Señal amarilla "ヘアピン 5連続" |
| `ennaskyline/` | `enna_flag_poles.glb` | 3 astas con banderas |
| `ennaskyline/` | `enna_road_s_curve.glb` | Curva en S con parapeto de piedra |
| `happogahara/` | `happogahara_road_snow.glb` | Tramo nevado con bancos de nieve y postes |
| `happogahara/` | `happogahara_snowman.glb` | Muñeco de nieve con bufanda |
| `irohazaka/` | `irohazaka_road_double_hairpin.glb` | Doble horquilla con muro de piedra y placa い |
| `irohazaka/` | `irohazaka_stone_marker.glb` | Mojón de piedra con い |
| `momiji/` | `momiji_bench_leaves.glb` | Banca de madera con hojas |
| `momiji/` | `momiji_road_maple_bend.glb` | Curva 90° con arces y hojas |
| `myogi/` | `myogi_boulder_pile.glb` | Montón de rocas |
| `myogi/` | `myogi_road_rock_cut.glb` | Corte en roca a un lado y guardarraíl al otro |
| `nagao/` | `nagao_mikan_stand.glb` | Puesto de mandarinas con sombrilla |
| `nagao/` | `nagao_road_stone_lane.glb` | Camino con muros de piedra a ambos lados |
| `nanamagari/` | `nanamagari_cone_barrier_set.glb` | Conos y barrera de obra |
| `nanamagari/` | `nanamagari_road_s_chain.glb` | 4 curvas encadenadas con guardarraíles y chevrones |
| `sadamine/` | `sadamine_road_ridge.glb` | Carretera de cresta con postes y aerogenerador |
| `sadamine/` | `sadamine_small_turbine.glb` | Aerogenerador pequeño estático (14 m) |
| `tsubaki/` | `tsubaki_camellia_tree.glb` | Camelia grande con flores |
| `tsubaki/` | `tsubaki_road_camellia_bend.glb` | Curva 90° con seto de camelias a ambos lados |
| `tsuchisaka/` | `tsuchisaka_road_concrete_cut.glb` | Corte de concreto de 4.5 m con drenajes |
| `tsuchisaka/` | `tsuchisaka_signal_light.glb` | Semáforo de túnel rojo/verde |
| `tsukuba/` | `tsukuba_road_blossom_s.glb` | Curva en S con guardarraíles y cerezos |
| `tsukuba/` | `tsukuba_souvenir_stall.glb` | Puesto de recuerdos con letrero |
| `turnpike/` | `turnpike_road_three_lane.glb` | Autopista de 3 carriles con barrera tipo Jersey |
| `turnpike/` | `turnpike_service_sign.glb` | Señal de área de servicio |
| `usui/` | `usui_gas_lamp.glb` | Farol de gas antiguo con base de piedra |
| `usui/` | `usui_road_brick_wall.glb` | Curva con muro de ladrillo y contrafuertes |
| `yabitsu/` | `yabitsu_log_pile.glb` | Pila de troncos |
| `yabitsu/` | `yabitsu_road_netted_slope.glb` | Tramo con valla antiderrumbe y guardarraíl |

Visor: `npx serve .` y abrir `index.html` (three desde unpkg, requiere internet).
