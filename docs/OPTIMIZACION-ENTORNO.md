# Optimización del entorno — 9 de noviembre de 2026

Actualización posterior: [suelo continuo y apoyo de assets](SUELO-Y-ASSETS-COMPLEMENTARIOS.md) sustituye las franjas aisladas y retira el descarte por altura descrito aquí. Se mantienen los lotes y el descarte espacial y por distancia. Las mediciones de este documento corresponden a la entrega anterior.

Se conservan las polilíneas, pendientes, anchura física, colisiones, IA y manejo v9. Esta entrega modifica únicamente el entorno y cómo se dibuja.

## Problema encontrado

El borde exterior del terreno bajaba hasta el mínimo global del mapa menos 75 m. Una ladera del principio de un descenso podía convertirse en una pared de cientos de metros. Además, cada bloque mezclaba carretera, suelo y vegetación: un objeto visible conservaba todo el bloque y sus grandes límites verticales. Reducir solamente la resolución no elimina ese trabajo geométrico.

## Solución aplicada

- Taludes exteriores de 22 m de profundidad local, en lugar de conectarlos al fondo global. El borde bajo el asfalto pasa de 38 a 4 m.
- Carretera y guardrail conservan su muestreo. El terreno exterior usa intervalos de aproximadamente 16 m y menos franjas transversales, con la misma comprobación de exclusión de otras curvas.
- Un solo buffer estático por escenario, reordenado en capas: carretera y estructuras, terreno, detalles y follaje. Cada capa tiene límites propios, bloques de aproximadamente 96 m y bandas de altura de 16 m.
- Descarte por frustum y distancia. Los detalles tienen un límite de 420 m y el follaje de 620 m, siempre acotados por la niebla existente. Se desvanecen durante los últimos 70 m de su alcance. Los rangos contiguos visibles se unen para limitar las llamadas a la GPU.
- Niveles superiores lejanos se atenúan según su cota de anclaje respecto de la cámara; así sus superficies inferiores no se mantienen como techos sobre el descenso actual. El tramo próximo permanece visible; los fondos cubren el horizonte. Esta es una aproximación visual por capas, no un sistema general de oclusión ni una simulación topográfica continua.
- Caras traseras del terreno descartadas, con orientación corregida para las dos laderas. La vegetación conserva sus dos caras.

Separar el descarte sin multiplicar innecesariamente las llamadas sigue el criterio de [agrupar llamadas de WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#batch_draw_calls). No se ha añadido otro motor ni un pase extra de reflexión u oclusión.

## Segundo pack

`scripts/build-scenery-part2.mjs` compila seis modelos originales de `assets/touge_city_assets_part2/` a `js/scenery-part2.mjs`: anillo de colinas bajo, cresta, Fuji, linterna de piedra y dos rocas. Los fondos se integran en la malla de horizonte existente, sin un cargador GLB ni texturas adicionales durante la carrera. Las rocas y linternas se colocan con comprobación del corredor de carretera y participan en el descarte de detalles.

Se seleccionan pocos modelos para que la decoración nueva no anule el ahorro. Los demás recursos permanecen disponibles para incorporaciones posteriores.

```sh
npm run assets:scenery-part2
```

## Verificación

Comparación en el mismo equipo: Edge nativo, Intel UHD, 960 × 600 y 24 fotogramas sincronizados por escena. Archivos: `data/render-benchmark-terrain-before.json` y `data/render-benchmark-terrain-after.json`. La cantidad enviada a GPU baja aproximadamente entre 13% y 31% en los cinco escenarios medidos. Las medianas fluctúan según carga y reloj de GPU; no representan una garantía de 60 FPS para todos los dispositivos.

Se revisaron 13 escenas de bosque, horquillas, ciudad, costa, lluvia, túnel y cabina sin errores de WebGL. La suite verifica además conservación de vértices al reordenar, límites de distancia, transiciones de visibilidad, seguridad del corredor, geometría finita y el juego completo. La integración opcional con una réplica MongoDB local sigue omitiéndose cuando no está configurada.

Resultado final: **235 pruebas correctas, 0 fallos y 1 integración opcional omitida**; comprobación de sintaxis y espacios correcta. En las cinco escenas las medianas anteriores fueron 4,5 / 5,0 / 5,5 / 5,6 / 11,3 ms y las nuevas 4,5 / 4,5 / 4,4 / 4,7 / 5,1 ms. No todos los percentiles 95 mejoraron en esta muestra corta: lluvia y Manazuru variaron ligeramente al alza. El ahorro geométrico es consistente; para evaluar tirones de un dispositivo concreto conviene una captura más larga. Comparación numérica completa: `data/terrain-comparison.json`.

Para comparar otra máquina:

```sh
node tests/render-benchmark.mjs nombre-de-medicion
```

El contador del juego sigue midiendo intervalos reales de presentación. Un promedio de FPS alto puede coexistir con tirones; conviene comparar también el percentil 95 y las llamadas y vértices dibujados.
