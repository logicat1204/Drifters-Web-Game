# Rutas — Parte 1 (un asset característico por ruta)

Estilo low poly, formato GLB + PNG como las partes anteriores. Origen en la base, +Y arriba, frente hacia +Z, 1 unidad = 1 m. Cada carpeta tiene su asset y su `textures/`.

| Carpeta | Ruta | Archivo | Contenido |
|---|---|---|---|
| `akagi/` | Monte Akagi | `akagi_shrine_bridge.glb` | Puente rojo arqueado estilo santuario |
| `akina/` | Monte Haruna | `akina_gutter_drain.glb` | Canaleta de concreto con rejillas (la clásica "gutter run") |
| `ennaskyline/` | Enna Skyline | `enna_viewpoint_deck.glb` | Mirador de piedra con binoculares y cartel |
| `happogahara/` | Happogahara | `happogahara_chairlift.glb` | Pilones de telesilla con sillas y cable |
| `irohazaka/` | Irohazaka | `irohazaka_hairpin_signs.glb` | Placas い・ろ・は de las 48 horquillas con guardarraíl |
| `momiji/` | Momiji Line | `momiji_maple_grove.glb` | Arboleda de arces rojos con hojas caídas |
| `myogi/` | Monte Myogi | `myogi_crag_cluster.glb` | Agujas rocosas con torii de piedra |
| `nagao/` | Paso Nagao | `nagao_citrus_terrace.glb` | Terraza de mandarinas con muro de piedra |
| `nanamagari/` | Nanamagari | `nanamagari_chevron_run.glb` | Chevrones de curva en S y señal "7 curvas" |
| `sadamine/` | Sadamine | `sadamine_turbine_rotor.glb` | Aerogenerador (torre + rotor separado para animar) |
| `sadamine/` | Sadamine | `sadamine_turbine_tower.glb` | Aerogenerador (torre + rotor separado para animar) |
| `tsubaki/` | Tsubaki Line | `tsubaki_camellia_hedge.glb` | Seto de camelias con letrero y farol de piedra |
| `tsuchisaka/` | Tsuchisaka | `tsuchisaka_tunnel_portal.glb` | Portal de túnel de concreto |
| `tsukuba/` | Monte Tsukuba | `tsukuba_ropeway_gondola.glb` | Cabina de teleférico y pilones |
| `turnpike/` | Turnpike (Hakone) | `turnpike_toll_plaza.glb` | Peaje con cabinas, barreras y cartel |
| `usui/` | Paso Usui | `usui_megane_bridge.glb` | Puente de ladrillo de 4 arcos (Megane-bashi) |
| `yabitsu/` | Paso Yabitsu | `yabitsu_rockfall_fence.glb` | Valla antiderrumbe con malla y señal |

## Ver los assets
Ejecuta `npx serve .` en esta carpeta y abre `index.html` (selector de assets, órbita con el ratón; carga three desde unpkg, requiere internet).

Notas: los carteles usan nombres de ruta genéricos y textos propios. Los modelos son escenografía original inspirada en los lugares reales, no copias de material oficial. El rotor de `sadamine` va separado: colócalo en (0,30.6,2.5) de la torre y gíralo en Z.
