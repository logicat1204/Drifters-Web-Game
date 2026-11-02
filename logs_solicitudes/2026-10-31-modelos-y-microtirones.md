# 2026-10-31 — Propuestas de autos y microtirones

## Solicitud

Proponer mejoras de los autos para acercarlos al anime o a modelos 3D como las tres referencias adjuntas; explicar si hace falta aportar imágenes de todos los coches y la viabilidad de reconstruirlos. Antes de rehacer modelos, revisar los pequeños saltos de movimiento observados en tercera persona.

## Resultado

- Detectado dibujo directo del estado físico a 120 Hz sin interpolación temporal.
- Añadida presentación interpolada del jugador, rival y cámara, compartida con cabina y retrovisor.
- Suavizado exclusivamente visual de pequeñas correcciones online, extrapolación remota breve y recuperación instantánea cuando corresponde.
- Se conserva la simulación, dificultad, física, contactos, cronómetros, replays y autoridad del servidor.
- Propuesta de tres acabados, recomendando un prototipo AE86 semirrealista estilizado, con piezas separadas, materiales y versiones simplificadas. No se han rehecho modelos en esta solicitud.
- Explicado el uso de referencias por coche, las limitaciones de una sola imagen y la alternativa de partir de archivos 3D.

Documentación y fuentes en `docs/MOVIMIENTO-Y-MODELOS.md`. Pruebas de frecuencias, intervalos irregulares, invariancia física y flujo real de navegador a 1080p. Los adjuntos se usaron como referencia visual.

Validación: 179 pruebas completas aprobadas, siete pruebas específicas de presentación y comprobación de sintaxis. El flujo real registró 60,00 FPS, media de 16,67 ms y P95 de 16,9 ms a 1080p en la RTX 4050, con escala 100%. Incluyó la pose interpolada, cambio a tercera persona y recuperación con Z. La suavización visual también limita el lateral para que una corrección de red no dibuje el auto fuera del guardarraíl.
