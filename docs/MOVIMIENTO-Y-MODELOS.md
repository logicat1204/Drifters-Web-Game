# Movimiento fluido y propuesta de modelos de autos

31 de octubre de 2026. La corrección de presentación está implementada. La propuesta de modelos que sigue fue el plan inicial. Actualización posterior: la primera familia AE86 propia ya está integrada; ver `MODELOS-CARRERA-AE86.md`. El resto del catálogo conserva sus modelos anteriores.

## Causa encontrada y corrección

La simulación funciona a 120 Hz. El bucle dibujaba el último estado completo, ignorando la fracción de tiempo restante. En frecuencias como 75, 144 o 240 Hz esto produce posiciones repetidas o avances desiguales; en tercera persona la cámara suavizada y la carrocería discreta hacían más visible la diferencia.

`js/presentation.mjs` conserva el estado anterior de cada paso y calcula una pose visual usando `acumulador / (1/120)`. Jugador, rival de campaña, cámara, faros, cabina y retrovisor reciben la misma pose. Se interpolan avance, lateral, orientación, velocidad y volante. El retraso deliberado de esta presentación es un paso físico: unos 8,33 ms. La física, colisiones, cronómetros, entradas grabadas y validación del servidor siguen leyendo el estado real.

Las correcciones online pequeñas se compensan con un desplazamiento exclusivamente visual que decae en unos instantes. Se mantienen límites estrictos: las recuperaciones, finales, impactos importantes y correcciones grandes se muestran de inmediato. Los remotos conservan su búfer de 100 ms; pueden completar hasta 75 ms de un pequeño retraso de paquete y después se detienen. Los cambios de `resetId` no interpolan a través de la pista.

Se limpia el historial al cambiar de carrera, pausar, volver de una pestaña oculta o reposicionar. La cámara conserva su seguimiento actual y recibe coordenadas interpoladas, en lugar de aumentar su inercia para disimular el problema.

Verificación: siete pruebas nuevas de diferentes frecuencias e intervalos irregulares, invariancia de conducción, ángulos, reseteos y correcciones online. El flujo de navegador comprueba que la pose dibujada está interpolada, cambia a tercera persona y verifica Z. En la prueba local a 1920 × 1080 con la RTX 4050: aproximadamente 60 FPS, media 16,67 ms, P95 16,9 ms, sin bajar resolución. Resultado en `data/presentation-browser.log`.

Este ajuste aborda el escalonado de poses y correcciones pequeñas. Una imagen que tarda demasiado en dibujarse o una corrección grande de red sigue necesitando tratamiento propio; no se inventa un resultado físico para ocultarla.

Base técnica: [Glenn Fiedler, Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/).

## Propuesta de modelos

Las referencias permiten elegir un acabado anime/arcade o semirrealista. En el código actual varios coches se construyen con familias geométricas compartidas. La mejora principal debe ser una malla propia por carrocería: proporciones, silueta, pasos de rueda, cristales, paragolpes, faros y trasera, antes de aumentar detalles pequeños.

| Alternativa | Resultado | Coste relativo |
| --- | --- | --- |
| Arcade/anime | Silueta precisa, superficies limpias, texturas de detalle y sombreado estilizado. Cercano a la imagen 1. | Menor; buena base para toda la colección. |
| Semirrealista estilizado | Carrocería definida, bordes y normales correctos, ruedas detalladas, cristales, faros y materiales diferenciados. Cercano a imágenes 2–3. | Recomendado; requiere mejorar también los materiales del renderizador. |
| Realismo avanzado | Interior detallado, materiales físicos y reflejos más complejos. | Mayor trabajo y coste gráfico; conviene evaluar después del prototipo. |

Presupuesto inicial propuesto, pendiente de medir: 10.000–20.000 triángulos para el coche cercano, versión simplificada de 2.000–5.000 para distancia y texturas de hasta 2K compartidas por variante cuando proceda. Es un objetivo de producción, no un requisito del formato ni garantía de FPS.

### Flujo recomendado

1. Prototipo del AE86 con las proporciones correctas. Validarlo en garaje, cámara trasera y carrera antes de producir otros modelos.
2. Separar carrocería, ruedas con pivotes correctos, cristales, luces y faros escamoteables. Mantener puntos de montaje para las piezas del garaje.
3. Crear UV, pintura, detalles de carrocería, oclusión horneada y materiales controlados. Evitar geometría innecesaria para textos o ranuras pequeñas.
4. Exportar un archivo GLB y ampliar la importación para conservar jerarquía, piezas móviles y materiales. El compilador actual de props hornea una malla estática; los coches necesitan una ruta específica.
5. Añadir giro y dirección de ruedas, apertura de faros, movimiento visual de carrocería y variantes de pintura. Mantener físicas y estadísticas separadas de la malla.
6. Medir el caso de cuatro coches y las vistas interior/exterior a 1080p antes de extenderlo al catálogo completo.

El renderizador actual tiene iluminación sencilla y materiales de color/textura; importar una malla detallada por sí solo no reproduce todos los reflejos de las referencias. Para el acabado recomendado habría que añadir una respuesta de pintura, cristal y metal, conservando un presupuesto de efectos controlado.

Blender puede exportar mallas, materiales, texturas y animación a glTF/GLB: [manual de glTF](https://docs.blender.org/manual/en/5.3/addons/scene_gltf2.html). El formato contempla jerarquías y transformaciones de piezas: [especificación de Khronos](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

### Referencias necesarias

No es necesario reunir todos los autos de una vez. Las imágenes proporcionadas sirven para definir el acabado. Para reconstruir cada carrocería con fidelidad ayudan vistas frontal, lateral, trasera y tres cuartos, del mismo modelo y versión, además del chasis, año y preparación deseada. Las ruedas, alerón, faros e interior necesitan referencias adicionales si deben coincidir exactamente.

Una sola vista permite una aproximación, pero las partes ocultas y sus medidas deben inferirse. Tener el archivo 3D original (`.blend`, `.glb`, `.fbx` u otro convertible) permite trabajar desde geometría real. Generar imágenes de referencia y construir una malla jugable son pasos distintos. La reconstrucción desde fotos requiere revisión de geometría, UV y materiales; no se promete una copia exacta automática.
