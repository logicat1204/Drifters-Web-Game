# Entornos de los mapas

31 de octubre de 2026. Decoración de los diez cursos, inspirada en las referencias proporcionadas y construida sobre el renderizador WebGL existente.

## Identidad y distribución

| Curso | Entorno |
| --- | --- |
| Akina | Cedros, bosque mixto, taludes, muros de piedra, miradores y pueblo al final. |
| Akagi | Pinar y bosque mixto, galería de montaña con iluminación y poblado de salida. |
| Irohazaka | Arbolado otoñal, paredes de contención, roca y señales de horquilla. |
| Usui | Bosque verde, puente ferroviario de arcos separado de la carretera y áreas de descanso. |
| Tsukuba | Huertos en filas, setos, bosque y casas con tejados inclinados. |
| Tsubaki Line | Bosque costero, laderas y vistas al mar en el tramo final. |
| Atami Ghost | Tramos urbanos con edificios, comercios y rótulos, transición a bosque, túnel y costa. |
| Odawara | Acceso y salida con pueblos; tramo central de montaña y túnel. |
| Ashinoko | Bosque de ribera, lago, embarcaderos, pequeños negocios y niebla densa en campaña. |
| Manazuru | Pueblo costero, pinar, vistas al agua y túnel. |

Los patrones se definen en `js/environment.mjs`. La semilla de cada curso produce siempre la misma colocación y variedad; no cambian con los FPS. Hay franjas de transición y densidades distintas, árboles de diferentes alturas y orientaciones, viviendas con tamaños variables y claros reservados para los puntos de interés. Son interpretaciones arcade; los elementos nuevos no alteran los trazados ni la física.

## Recursos y creación de assets

Se utiliza el contenido original de `assets/touge_city_assets`: texturas de asfalto, piedra, roca, tierra, hierba, vegetación, fachadas diurnas/nocturnas, cielo y montañas; modelos de árboles, edificios, señales, postes, farolas, torii, máquinas expendedoras y semáforos. El pack fuente se conserva.

`npm run assets:scenery` ejecuta `scripts/build-scenery-assets.mjs`:

1. Lee los modelos GLB y convierte posiciones, normales, UV y materiales al formato de vértices del juego. El resultado es `js/scenery-assets.mjs`.
2. Empaqueta las 34 texturas del pack y una textura propia de agua en `assets/environment/atlas.png`, de 2048 × 2048. Conserva transparencia, usa celdas de 256 px, contenido de 240 px y bordes de 8 px para filtrado.
3. La textura de agua se genera con un patrón vectorial de ondas original, de forma reproducible. No se usan servicios externos durante el juego.

Se añadieron geometrías propias para terrenos que siguen las curvas, drenajes y hombros, muros adaptados a la carretera, túneles curvos, casas con tejado, puente ferroviario, embarcaderos, bancos, estacionamientos y vehículos decorativos. Los GLB rectos de carretera y túnel no sustituyen el trazado: la geometría sigue sus puntos reales para no cortar curvas ni estrechar la pista.

No se añade Three.js ni un cargador GLTF al navegador. La compilación requiere Sharp; puede indicarse otra instalación con `SHARP_MODULE`. Los recursos generados se sirven como archivos estáticos normales.

## Seguridad del corredor

- Objetos sólidos y copas de árboles usan radios conservadores comprobados contra **todos** los segmentos del curso, ignorando alturas para proteger también horquillas inferiores.
- Taludes, hombros, agua y paredes usan huellas poligonales: se rechazan superficies que encierran, cruzan o rozan el corredor, y cuadriláteros plegados que podrían cruzarlo al triangularse.
- El terreno se divide lateralmente en franjas pequeñas; rechazar una franja no obliga a colocar una superficie enorme sobre otra curva.
- Los bordes exteriores aceptados se cierran hasta el suelo de fondo para evitar laderas que parezcan suspendidas. Esos cierres pasan la misma comprobación del corredor.
- Los claros de miradores, puente y embarcaderos se reservan antes de colocar vegetación. La distribución evita incrustar construcciones en árboles o entre sí.
- Los túneles conservan más de cinco metros de altura libre. Se aceptan solamente cuando no hay otro tramo próximo que pudiera quedar cubierto por su estructura. Los guardarraíles y el ancho de conducción se mantienen.
- La decoración es visual. No introduce obstáculos físicos nuevos ni cambia IA, agarre, recompensas o replays.

## Renderizado y rendimiento

Los props se hornean una vez al cambiar de mapa en el buffer estático y sus sectores visibles. No se agregan miles de llamadas de dibujo individuales. La vegetación distante usa planos cruzados con recorte de transparencia, combinada con árboles tridimensionales cercanos. Se mantiene el retrovisor por textura GPU y el ajuste automático de resolución.

Las fachadas alternan texturas de día y noche; las ventanas y rótulos se iluminan de noche. Hasta tres farolas cercanas aportan luz local, con selección limitada en frecuencia. Los túneles ajustan progresivamente la iluminación al entrar y salir. Los faros siguen siendo útiles fuera de las áreas iluminadas. La niebla de Ashinoko conserva su alcance de 8–60 m y oculta también los fondos nuevos.

El atlas usa filtrado de textura con gradientes cuando el navegador lo admite, evita que las uniones repetidas lean otras celdas y redondea los identificadores interpolados de material. Hay una alternativa de filtrado lineal para navegadores sin esas extensiones.

## Verificación

- `npm test`: geometría finita, materiales, variantes diurnas/nocturnas, huellas, corredor completo de los diez mapas, altura y aislamiento de túneles, y pruebas existentes de gameplay.
- `npm run test:environment`: trece vistas de referencia, guardadas en `screenshots/entorno-*.png`, con datos de geometría en `data/environment-preview.json`.
- Con `ENVIRONMENT_FPS=1`, esa prueba mide además 300 imágenes por escena a 1920 × 1080: bosque nocturno/interior, otoño, ciudad nocturna, túnel y Ashinoko con lluvia. Usa física y rival cercano; informa sobre las últimas 180 imágenes en `data/environment-fps.json`. Por defecto usa el controlador nativo; `RENDER_BACKEND=software` permite SwiftShader.
- `npm run test:performance`: juego completo, contador, cabina y veinte comparaciones de píxeles entre dibujo completo y sectores visibles. Se comprueba el retrovisor en escritorio, móvil y resolución reducida.
- `npm run test:ashinoko-fog`: alcance de niebla y coches cercanos/lejanos en las cuatro cámaras.

En la RTX 4050 disponible se mantuvieron aproximadamente 60 FPS a 1080p, a escala 100%, tanto en la conducción real con cabina como en los escenarios decorados medidos. Es el resultado concreto de este equipo y estas pruebas, no una garantía para todo hardware. Los resultados anteriores de optimización permanecen como referencia en `docs/RENDIMIENTO-60FPS.md`.
