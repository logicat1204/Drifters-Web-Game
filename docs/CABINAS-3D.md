# Cabinas 3D y cámara de piloto

4 de noviembre de 2026.

## Implementación

La vista Interior 3D sustituye la superposición de salpicadero 2D por geometría WebGL con volumen: salpicadero, cuadro, consola, puertas visibles, pilares, techo cuando corresponde, suelo, volante, palanca y retrovisor. Se conserva la cabina anterior como alternativa si falla la inicialización del nuevo renderizador.

Los 25 coches tienen una configuración explícita en `js/cabin-geometry.mjs`: dimensiones, altura y lado del conductor, profundidad, familia del salpicadero, tipo de instrumentos, volante, materiales y ventilación. Las variantes AE86 y Amemiya incorporan diferencias de acabado. Los deportivos europeos configurados con volante a la izquierda usan una disposición diferente de los japoneses con volante a la derecha. Son interpretaciones originales estilizadas; no son escaneos ni reproducciones certificadas de los interiores de fábrica.

El prototipo AE86 se extendió al catálogo tras revisar las primeras capturas. Las familias comparten herramientas de construcción y piezas menores; el cuadro y la disposición no dependen del perfil físico Skiller/Grip/Complete ni del antiguo campo `mesh`.

## Cámara y animación

Corrección de visibilidad del 4 de noviembre: se bajó y compactó el cuadro dentro del salpicadero, con una visera más corta. Volante y manos se desplazaron juntos hacia abajo; las agujas siguen alineadas con los relojes. La prueba de proyección utiliza los vértices reales de las caras de los instrumentos para mantenerlos en la zona inferior con los 25 coches, distintos campos de visión y cabeceo al frenar. Se verificó también una horquilla de Akina en `screenshots/cabins/09-visibilidad-horquilla.png`.

`js/driver-camera.mjs` calcula exclusivamente presentación. El punto de vista sigue la pose interpolada del coche sin añadir un segundo retraso de seguimiento mundial. El movimiento local suavizado responde a aceleración, frenada, dirección, deslizamiento y cambios de marcha, con límites pequeños. Los impactos producen un desplazamiento breve. La ayuda de mirada durante derrapes está limitada; no modifica la dirección del coche.

El volante responde continuamente a la dirección. Las manos con guantes recorren un arco limitado sobre el aro para evitar cruzarse ante el cuadro en giros amplios; el brazo del lado de la consola acompaña cambios y freno de mano. Son animaciones procedurales simplificadas, sin un esqueleto humano completo ni simulación de dedos. Pueden desactivarse.

La física a 120 Hz, controles, tiempos, repeticiones y validación del servidor no reciben ningún dato de esta cámara. Los movimientos se reinician al cambiar de carrera, cámara o reposicionar. La pausa congela las animaciones del piloto. El horizonte estable y la intensidad cero permiten reducir el movimiento; la preferencia del sistema de reducir movimiento también se respeta. El giro del volante sigue siendo visible.

## Instrumentos, audio y clima

- Cuadros analógicos con agujas geométricas continuas; versiones digitales y combinadas según el modelo. Velocidad, RPM, marcha, faros y aviso de cambio se obtienen del estado de carrera.
- Los indicadores auxiliares de combustible, temperatura, aceite y boost son decorativos: el juego no simula consumos o averías nuevos.
- El estéreo muestra la canción de la carrera, incluida la seleccionada para el nivel de campaña.
- La música mantiene sus controles. El viento crece con velocidad y rebufo; un sonido corto acompaña el cambio de marcha, usando el volumen de motor/efectos.
- La iluminación diferencia día y noche. Superconcentración tiñe suavemente el interior según la especialidad y una curva limpia añade un reflejo tenue. Las recompensas son audiovisuales, sin potencia adicional.
- El retrovisor usa la cámara trasera real existente, con composición directa de su textura GPU en una superficie 3D. Conserva su actualización limitada a 16/24 Hz.
- En mojado aparecen gotas sobre la zona del parabrisas y limpiaparabrisas animados. No se añade otra capa de lluvia sobre el habitáculo.

## Opciones

En Opciones, debajo del selector de cámara:

1. **Interior · movimiento del piloto**: 0–100.
2. **Interior · campo de visión**: 55–80 grados de referencia vertical. En pantallas verticales se adapta el encuadre para conservar volante y carretera.
3. **Interior · manos con guantes**.
4. **Interior · horizonte estable**.

Las preferencias se guardan localmente. La opción anterior Vibración y estelas también permite desactivar el movimiento de cabeza. El HUD conserva cronómetro, posición, navegación y especialidad; la velocidad principal se consulta en el cuadro.

## Presupuesto gráfico

`js/cabin-view.js` realiza una pasada local con profundidad propia, después del mundo. Solo se crea al usar la vista interior. La caché conserva como máximo cuatro cabinas y libera los buffers de las expulsadas. Al cambiar a otra vista no se dibuja el interior.

La instrumentación utiliza un atlas de 1024 × 512 generado mediante Canvas, sin imágenes descargadas. Solo se actualiza cuando cambian sus valores visibles, con un máximo de 20 Hz; las agujas geométricas y el volante se dibujan con cada frame. Las formas usan colores, texturas pequeñas, biseles y sombreado ligero. No hay lectura de píxeles desde la GPU, nuevas cámaras para espejos laterales ni posprocesado de pantalla completa. Los espejos laterales no se han añadido en esta entrega.

## Pruebas

- `npm test`: incluye cobertura de los 25 perfiles, geometría finita, normales, presupuesto, límites de movimiento a distintas frecuencias, preferencias de comodidad, cambios, freno de mano, reinicios e invariancia de la física.
- `npm run test:cockpit`: dibuja los 25 coches con el renderizador de producción; verifica caché y errores GL, captura día/noche, lluvia, especialidad y móvil; mide 1080p y cuatro coches; prueba la conducción real, frenada, reposicionamiento y opciones de la interfaz con una cuenta temporal.
- `npm run check`: sintaxis.

Capturas en `screenshots/cabins/`; mediciones locales en `data/cabin-performance.json`. Los FPS son mediciones del equipo de prueba, no una garantía para todos los dispositivos. El contador F8 del juego permite comprobar el propio equipo.

Validación realizada: 199 pruebas automáticas aprobadas, sintaxis aprobada y conducción real con aceleración, giro, frenada, reposicionamiento y opciones de comodidad verificada en Edge. La prueba de rendimiento existente también pasó: 20 comparaciones de visibilidad y retrovisor con rival real en horizontal, vertical y resolución reducida, sin lecturas GPU en producción. Las primeras mediciones a 1920 × 1080 con Intel UHD integrada rondaron 59–60 FPS, y aproximadamente 59 FPS con tres oponentes, lluvia y especialidad activa. La carga adicional inicial del AE86 es de unos 5.200 triángulos y diez llamadas de dibujo con manos; ocultarlas reduce cuatro llamadas. No se ha cambiado el motor gráfico.

En la última medición de escena a 1080p se obtuvieron 59,34 FPS y P95 de 16,9 ms; el caso de tres oponentes, lluvia y especialidad dio 60,01 FPS después de cargar sus modelos y un segundo de calentamiento. Se usan poses deterministas para comparar el coste de dibujo. La carga inicial se separa de esa medición estable: una corrida anterior que la incluyó bajó a 55,39 FPS. La prueba adicional de conducción con el contador real dio unos 60 FPS a 1100 × 730. Estos resultados no representan todas las situaciones posibles de carrera.
