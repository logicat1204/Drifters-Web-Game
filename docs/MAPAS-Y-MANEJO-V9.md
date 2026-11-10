# Mapas y manejo v9 — 9 de noviembre de 2026

Los nueve cursos de la campaña usan recorridos reconstruidos a partir de las láminas facilitadas. Atami Ghost conserva su generación anterior. La física común sí se actualiza para todos los coches y modos, incluidos online y repeticiones verificadas.

| Curso | Distancia | Formato |
| --- | ---: | --- |
| Akina | 7.552 m | Trayecto |
| Akagi | 5.804 m | Trayecto |
| Irohazaka | 5.116 m | Trayecto |
| Usui | 3.972 m | Una vuelta |
| Tsukuba | 6.808 m | Trayecto |
| Tsubaki Line | 7.312 m | Trayecto |
| Odawara | 4.420 m | Una vuelta |
| Lake Ashinoko GT | 8.433 m | Una vuelta |
| Manazuru | 3.574 m | Una vuelta |

Ashinoko usa la escala acordada con el usuario: 25.300 / 3, redondeada a 8.433 m para una vuelta. No se presenta esa interpretación como una medición geográfica. Su lámina contiene texto sobre la silueta: las conexiones tapadas se han estimado. Las otras ocho láminas permiten extraer la carretera blanca y reconstruir las horquillas, los enlazados y las rectas.

La suma de los sectores impresos de Akina es 7.282 m, aunque su total indica 7.552 m. Se conserva el total y se asignan los 270 m de diferencia al último sector: 1.680 / 1.692 / 1.884 / 2.296 m. El sentido de Akina sigue la numeración de sectores de la lámina, desde el extremo inferior. Los demás trayectos abiertos parten del extremo superior o del sector 1 indicado. Los circuitos son de una vuelta.

## Cómo se conducen los estilos

- **Grip:** mayor capacidad de adherencia sin preparar un derrape, aceleración fuerte y mayor punta. Conviene frenar antes del vértice, girar con precisión y abrir gas a la salida.
- **Skiller:** respuesta rápida y menor punta. Una entrada preparada con frenada y giro, o un toque breve de freno de mano seguido de liberación, permite conservar impulso en una curva limpia. Hay que controlar el deslizamiento y la trazada.
- **Balance:** respuesta y potencia intermedias; puede aprovechar ambos tipos de entrada con una bonificación de derrape menor.

La velocidad de curva depende de `sqrt(agarre disponible / curvatura)`. El agarre incluye coche, perfil, lluvia, preparación y concentración. La bonificación técnica exige velocidad, curva real, deslizamiento controlado, trayectoria alineada y espacio respecto del guardrail. Desaparece con impactos, roce del muro, exceso de derrape o freno de mano mantenido. No da aceleración gratuita en rectas. Mantener el freno de mano penaliza bastante más que un toque.

La IA usa la misma integración física. Prevé curvas cada cuatro metros, frena para entrar y acelera cuando recupera espacio. Los Skiller deslizan la carrocería con control; los Grip preparan la frenada con mayor anticipación. Un deslizamiento que se abre demasiado provoca una corrección física mediante dirección y reducción de velocidad, sin recolocar el coche. Se mantienen los cinco niveles y la lógica de adelantamientos y Fireball.

El objetivo es que cambie la ventaja por sector, con diferencias de vuelta moderadas; no se igualan artificialmente los tiempos ni se impone que cada estilo gane el mismo número de mapas. `npm run bench:balance` compara tres pilotos de nivel 3 con parámetros de estilo sobre los mismos recorridos y guarda tiempos, frenada, derrape y contactos. Es una referencia automática, no una garantía de igualdad para todos los jugadores, mejoras y trazadas.

## Geometría y rendimiento

`js/authored-courses.mjs` contiene las ocho polilíneas extraídas; `js/ashinoko-course.mjs` contiene la silueta estimada del lago. `js/track-geometry.mjs` suaviza con Catmull-Rom centrípeto y remuestrea por distancia a unos 4 m. Los puntos incluyen posición, altura, orientación y curvatura; el mismo resultado alimenta simulación, carretera, IA, minimapa, cámaras y repetición.

Las imágenes no contienen cotas, peraltes ni radios físicos verificables. Los perfiles de altura son estimaciones regionales con pendientes acotadas al 18%. En circuitos cierran tanto la altura como la orientación; en trayectos se usa un descenso continuo con cambios de pendiente. En Irohazaka se ensanchan localmente los retornos de horquillas cuyos extremos dibujados serían demasiado pequeños para el ancho de carretera. Se conserva el total de metros. No se afirma una reproducción topográfica exacta de Japón.

Los circuitos dibujan una sola vuelta. Sus muestras adicionales posteriores a meta se reservan para anticipación y cámaras, sin duplicar carretera o decoración. La separación de árboles, señales y postes se mide por metros, manteniendo la densidad anterior; los grupos de recorte siguen abarcando aproximadamente 192 m. Se conserva la exclusión de objetos y terreno sobre otras horquillas.

## Récords y persistencia

`HANDLING_VERSION=v9` separa los tiempos nuevos de los anteriores en rankings y récords personales. Se conservan las partidas antiguas, las estadísticas históricas, monedas, compras, victorias y desbloqueos. El mejor tiempo de un duelo antiguo queda pendiente hasta disputarlo en esta versión. Volver a ganar conserva únicamente las recompensas normales de repetición: no concede de nuevo el primer premio.

SQLite migra automáticamente al esquema **v7**, añadiendo la versión al progreso de campaña. MongoDB guarda ese dato en cada avance de campaña; no necesita una migración destructiva. El importador admite SQLite v6 y v7. Las sesiones online incluyen también la duración del freno de mano para que la predicción aplique la misma penalización que el servidor.

## Fuentes y reproducción

Las nueve imágenes entregadas se conservan en `assets/course-references/`. Para rehacer las ocho trazas desde esos archivos:

```sh
npm run assets:course-paths
npm run preview:courses
npm run bench:balance
```

El primer comando extrae la banda blanca, une huecos tapados por marcadores y simplifica el ruido del raster. La revisión visual sigue siendo necesaria si se sustituye una lámina: textos, bifurcaciones ilustradas y marcadores pueden requerir guías específicas. Los diagnósticos intermedios se guardan en `data/course-references/`; el juego solo carga las polilíneas compiladas. La vista general se guarda en `screenshots/course-remake-overview.png`.

## Validación de esta entrega

- `npm test`: 232 pruebas correctas, 0 fallos; 1 integración opcional con una réplica MongoDB local omitida. Incluye cuentas, importación, récords, las 24 IAs, campaña ganable, mejoras, recuperación, rebufo y WebSocket real de cuatro jugadores.
- `npm run check`: sintaxis correcta.
- `npm run bench:balance`: los tres estilos de nivel 3 completan los nueve recorridos con 0 impactos. La diferencia entre la vuelta más rápida y más lenta queda entre 1,7% y 2,8% por curso en este controlador de referencia. Informe: `data/course-balance-v9.json`.
- Revisión de entorno en Edge/WebGL: 13 escenas sin errores de WebGL, con carretera y decoración finitas y recorte por sectores. Informe: `data/environment-preview.json`.
- Benchmark sincronizado, Edge nativo, 960 × 600, 24 muestras por escena: medianas de 3,7 a 9,3 ms y percentiles 95 de 7,6 a 12 ms en las cinco escenas probadas, incluidas cabina, niebla con lluvia y cuatro coches online. Es una medición de este equipo y carga, no una tasa universal para otros dispositivos. Informe: `data/render-benchmark-course-v9.json`.
- Flujo de navegador de repetición: carrera física completa, resultados, cámaras, pausa, desplazamiento temporal y vista móvil sin alterar el resultado guardado.
