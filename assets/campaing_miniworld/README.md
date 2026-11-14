# Mapas y portadas de campaña

Coloca los archivos en las carpetas `initial-d/` y `mf-ghost/` bajo esta carpeta. La pantalla de mundos busca `cover.webp` y la pantalla del atlas busca `map.webp`. También se admiten PNG, JPEG y GIF con los nombres base `cover` y `map`. Mantén una sola imagen por cada nombre base.

Las posiciones de los destinos se expresan en porcentajes en `js/campaign-worlds.mjs`. Prepara el mapa con relación de aspecto 5:3 y verifica los puntos en escritorio y móvil. El juego trae un atlas esquemático y reutiliza el arte de la campaña si faltan imágenes de mundo.

Para personalizar la portada de un destino, agrega una imagen a `campaign_files/<destino>/_chapter/cover/`. Se usa el primer archivo válido en orden natural. Los prólogos, epílogos y sus audios siguen en las carpetas actuales.

## Submapas y escenas

- El submapa regional tiene caminos y nodos interactivos. Para sustituir su terreno ilustrado, agrega un fondo PNG o WebP de **1000 × 440 px** en `campaign_files/<destino>/_chapter/event_map/`. Dibuja el terreno en el archivo. El juego superpone los caminos y los iconos según las coordenadas en `js/campaign-region-map.js`.
- Usa `campaign_files/_worlds/<mundo>/` para los prólogos y epílogos de mundo, y `campaign_files/<destino>/_chapter/` para los de destino. Se admiten `story_start/`, `story_end/`, `narrative_music_start/`, `narrative_music_end/`, `story_sounds_start/` y `story_sounds_end/`. Incluye las variantes `rain/` o `ngplus/` cuando corresponda.
- Las pruebas nuevas buscan música, cómics y audio en `campaign_files/<destino>/<id-del-evento>/` con la misma estructura de las batallas. Ejemplos de ID: `trial-akina`, `odawara-grid` y `manazuru-grid-1`. Dentro de `portraits/`, nombra el retrato con el ID del piloto, por ejemplo `yanagida.webp` o `ishigami.webp`. La lista musical personal se guarda por cuenta en el navegador y acepta siete canciones además de la pista predeterminada del evento.
- Los requisitos y los premios de los cofres están en `js/campaign-events.mjs`. Se reclaman una sola vez por cuenta. Los tres cofres de técnica conservan los desbloqueos de licencias que ya habían vencido a los rivales en la versión anterior.
- Ejecuta `npm run assets:story-files` para crear las carpetas de retratos, cómics, audio, mapas de eventos y cofres. Los archivos `reward_chest/reward.json` sirven para consultar el premio que se definió en el catálogo.
- Para regenerar los trazados de la fase 3 desde las hojas incluidas, ejecuta `node scripts/trace-course-references.mjs --expansion` seguido por `node scripts/assemble-course-paths.mjs --expansion`. Los trazados manuales revisados se guardan en `scripts/expansion-course-guides.mjs`.
