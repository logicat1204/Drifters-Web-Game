# 2026-10-31 — Fluidez y monitor de FPS

## Solicitud

Retomar la evaluación del motor y el monitoreo de FPS para intentar llevar la jugabilidad a 60 FPS.

## Trabajo realizado

1. Referencia reproducible de cinco escenarios antes de modificar el motor.
2. Contador compacto/detallado/oculto en Opciones y F8; intervalos reales, P95, coste de CPU, resolución, escala y trabajo gráfico.
3. Resolución 3D automática para buscar 60 FPS, con límites e histéresis. Se conserva el máximo elegido y la nitidez de la interfaz.
4. Dibujo de sectores visibles, descarte conservador por cámara y niebla, sombreado simplificado donde el resultado es invisible y reutilización de atributos.
5. Retrovisor por textura GPU, eliminando lecturas de píxeles del juego y manteniendo el reflejo real.
6. Límite de humo y emisión según tiempo para controlar el coste visual.
7. Comparación de píxeles en diez cursos, conducción real y comprobaciones de escritorio/móvil; resultados en `docs/RENDIMIENTO-60FPS.md`.

Se mantiene WebGL. Física a 120 Hz, dificultad, IA, lluvia, niebla de Ashinoko, cuentas y protocolo online conservan su comportamiento. Se comparó el renderizado por software y se comprobó la GPU nativa; el contador permite verificar cada equipo sin prometer un mínimo universal de FPS.

## Validación final

168 pruebas unitarias y de integración aprobadas, comprobación de sintaxis, prueba de niebla y flujo visual en software y GPU nativa. En la RTX 4050 disponible se confirmó el bucle completo a 60,00 FPS, 1920 × 1080, vista interior nocturna, tras diez segundos de conducción y sin bajar resolución. Media 16,67 ms, P95 16,8 ms y CPU 1,71 ms en la ventana final de 180 imágenes. Se conserva el alcance concreto de esta prueba; no garantiza todas las máquinas ni todos los escenarios.
