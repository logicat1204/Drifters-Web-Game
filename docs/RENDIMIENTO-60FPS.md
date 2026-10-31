# Rendimiento: objetivo 60 FPS

31 de octubre de 2026. Primera implementación y medición del motor existente.

## Implementación

- Monitor en Opciones, con modos oculto, compacto y detallado. **F8** alterna entre ellos. Las preferencias se conservan en este navegador.
- FPS reales por intervalos de `requestAnimationFrame`, tiempo medio de imagen, percentil 95, coste de CPU del bucle, resolución efectiva, escala, llamadas de dibujo y vértices enviados. Ventana de hasta 180 imágenes, texto actualizado cuatro veces por segundo. Se reinicia al cambiar de pantalla o volver de una pestaña oculta; no recorta los intervalos lentos para calcular FPS.
- Calidad automática activada por defecto, con objetivo de 60 FPS. La resolución elegida sigue siendo el máximo; se reduce solo la resolución 3D. Cabina, texto y HUD conservan su nitidez.
- Circuitos divididos en sectores de 24 segmentos dentro del mismo buffer. Se omiten los sectores fuera del volumen de cámara o alcance de niebla. Sus límites incluyen toda la geometría generada, árboles y cables. Se usa posición espacial, no distancia recorrida, para conservar horquillas próximas.
- Retrovisor compuesto directamente desde su textura en GPU sobre el lienzo principal. La cabina tiene una abertura transparente alineada mediante un cálculo compartido. Se eliminan `readPixels`, la inversión de filas y la copia a Canvas 2D del juego. Conserva cámara trasera real, inversión lateral y actualización a 16/24 Hz.
- El sombreado evita iluminación de fragmentos completamente ocultos por niebla y haces de faros durante el día. Se reutilizan los atributos al dibujar sectores del mismo buffer.
- Humo limitado a 48 partículas, con emisión según tiempo transcurrido, para que más FPS no aumenten indefinidamente el trabajo gráfico.

## Ajuste automático

Presupuesto objetivo: **16,67 ms por imagen**. Tras 2 s iniciales y al menos 30 muestras, necesita 1,5 s de lecturas por debajo de 55 FPS para bajar un paso de 5%. No cambia durante menús, cuenta atrás, pausa ni resultados. El suelo es 65% por dimensión, aproximadamente 42% de los píxeles del máximo configurado.

Para recuperar un paso necesita 8 s por encima de 58 FPS y coste de CPU menor de 13 ms. La histéresis evita cambios rápidos de nitidez. Desactivar la opción restaura inmediatamente la resolución máxima. Cambiar de pantalla o la resolución manual reinicia el ajuste.

La resolución no resuelve todos los límites de CPU; el suelo evita sacrificar imagen sin límite. No cambia agarre, IA, controles, reloj, replays, física a **120 Hz** ni protocolo online. No requiere migración de cuentas o base de datos.

## Medición antes y después

Edge sin interfaz, **SwiftShader por software**, 960 × 600, cinco imágenes de calentamiento y 24 medidas por escenario. Se fuerza la terminación y una lectura de un píxel **solo dentro del benchmark** para incluir ejecución gráfica. Son medianas del renderizado y capas visuales, no FPS jugables ni una prueba de la GPU del usuario.

| Escenario | Antes | Después | Menor tiempo | Vértices antes / después |
| --- | ---: | ---: | ---: | ---: |
| Akina nocturno | 60,9 ms | 38,7 ms | 36% | 197.847 / 25.965 |
| Interior nocturno | 81,3 ms | 56,2 ms | 31% | 241.699 / 26.981 |
| Ashinoko, lluvia y niebla | 53,4 ms | 25,1 ms | 53% | 211.449 / 12.687 |
| Manazuru, jefe y concentración | 62,5 ms | 37,0 ms | 41% | 270.335 / 50.369 |
| Escena online, cuatro autos | 50,3 ms | 37,1 ms | 26% | 167.232 / 35.292 |

Mediciones orientativas de una ejecución; procesos de fondo, compilación y partículas introducen variación. El trabajo geométrico se redujo aproximadamente 79–94%. Los sectores pueden aumentar llamadas de dibujo, pero evitan procesar gran parte del circuito invisible. La prueba de conducción confirma cero lecturas de GPU en el bucle real.

**No se garantiza un mínimo universal de 60 FPS.** El entorno por software permanece por debajo del presupuesto objetivo. El monitor permite comprobar equipos reales: comparar el mismo circuito, cámara, resolución y clima después del calentamiento. CPU mide JavaScript y envío de comandos, no tiempo de GPU ni latencia del servidor.

### Comprobación con aceleración gráfica

Se repitieron las pruebas sin forzar SwiftShader. Edge identificó **NVIDIA GeForce RTX 4050 Laptop GPU, ANGLE/Direct3D 11**. En los cinco escenarios a 960 × 600, las medianas de renderizado sincronizado fueron 1,0–2,6 ms y los percentiles 95 fueron 1,6–5,6 ms.

Además se ejecutó el juego completo a **1920 × 1080**, cabina de AE86, Akina nocturno, durante al menos diez segundos de conducción. La ventana final de 180 imágenes registró **60,00 FPS**, media **16,67 ms**, P95 **16,8 ms**, y coste de CPU **1,71 ms**. La escala fue 100%, con ajuste automático desactivado para esta medición. El resultado incluye simulación, HUD, sonido y cabina; es una comprobación acotada de este equipo y escenario, no de toda combinación posible.

Registro local: `data/performance-native-1080.log`; referencia gráfica: `data/render-benchmark-native.json`. La captura del contador está en `screenshots/rendimiento-monitor-interior.png`.

## Verificación y reproducción

- `npm test`: monitor, ajuste automático, límites conservadores de sectores y regresiones de física, IA, replays, cuentas y online.
- `npm run test:performance`: preferencias, F8, conducción real, contador; veinte comparaciones de píxeles entre escena completa y sectores visibles en los diez cursos. Diferencia máxima observada: 0,052% de píxeles con diferencia RGB mayor de 4. Retrovisor con un coche detrás a tamaño completo y 65%, en escritorio, móvil vertical y horizontal.
- `npm run test:ashinoko-fog`: aislamiento de la niebla en todas las cámaras.
- `npm run bench:render -- current`: resultados en `data/render-benchmark-current.json` y capturas `screenshots/rendimiento-current-*`. Admite otro nombre para comparar ejecuciones. Requiere Playwright y un navegador; `BROWSER_EXECUTABLE` permite indicar otro ejecutable.

Por defecto estas pruebas visuales fuerzan software para comparar entornos. Para usar el controlador disponible, definir `RENDER_BACKEND=native` y comprobar el campo GPU del resultado. `PERF_WIDTH` y `PERF_HEIGHT` permiten cambiar la resolución de conducción en `test:performance`; la comprobación de 1080p usó 1920 y 1080.

Las referencias originales están en `data/render-benchmark-before.json` y `data/render-benchmark-after.json` en desarrollo. `data/` no se versiona; esta tabla conserva los valores relevantes.

## Decisión sobre el motor

Se mantiene WebGL: la reducción medida no justifica todavía una migración completa. La simulación permanece separada del renderizador, permitiendo una sustitución gradual futura sin rehacer cuentas, campaña u online.

Los siguientes pasos dependerán de mediciones en equipos reales: caché de instrumentos si domina Canvas 2D, agrupación de humo si dominan llamadas de dibujo, temporizadores GPU asíncronos compatibles y otros niveles gráficos. Un motor externo por sí solo no garantiza 60 FPS; debe conservarse un presupuesto de geometría, píxeles y composición.
