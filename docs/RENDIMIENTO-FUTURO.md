# Evaluación original: 60 FPS y contador de rendimiento

30 de octubre de 2026. **Propuesta histórica.** La primera implementación se completó el 31 de octubre: monitor, calidad automática, sectores visibles y retrovisor GPU. La documentación vigente y las mediciones están en [RENDIMIENTO-60FPS.md](RENDIMIENTO-60FPS.md). Se conserva abajo la evaluación original.

## Viabilidad

Es viable añadir un contador de FPS al motor actual y estudiar una optimización hacia 60 FPS. No es necesario cambiar el motor para medirlo. Garantizar un mínimo universal de 60 FPS requeriría definir dispositivos, resolución y calidad objetivo y medir en esos equipos; una prueba con navegador sin interfaz y renderizado por software no representa la GPU del usuario.

El presupuesto para 60 FPS es de aproximadamente **16,67 ms por imagen**. Los FPS de dibujo son independientes de la física fija a 120 pasos/s y del envío de snapshots online a 20 Hz. Alterar la frecuencia de la física para subir FPS afectaría conducción y validación de replays; el trabajo debería centrarse primero en renderizado y asignaciones.

## Inspección del motor actual

El juego usa WebGL propio, geometría estática en buffers, Canvas 2D para cabina/efectos y `requestAnimationFrame` para el bucle. El HUD ya actualiza a 20 Hz. La calidad limita la resolución relativa, y el retrovisor tiene framebuffer propio, con una frecuencia de 16/24 actualizaciones por segundo.

Hay oportunidades visibles en el código, pendientes de medición:

1. La escena estática de un curso se dibuja como una malla grande. Dividirla en sectores permitiría omitir geometría detrás de la cámara y fuera de distancia útil, conservando los márgenes que evitan montañas sobre la pista.
2. El retrovisor vuelve a dibujar el mundo y lee píxeles con `readPixels` para copiarlos a Canvas 2D. Conviene medir el coste de esa lectura y estudiar componer directamente la textura del retrovisor en GPU.
3. Cada partícula de humo se dibuja por separado. Agruparlas reduciría llamadas de dibujo y cambios de estado.
4. Matrices, listas y objetos temporales se crean durante el dibujo y la predicción online. Reutilizar memoria puede reducir pausas de recolección, si el perfilador confirma que son significativas.
5. Las capas transparentes, auras y resolución alta pueden aumentar el coste por píxel. Una escala de resolución adaptativa y niveles de partículas/retrovisor serían opciones, después de medir.

Las nuevas piezas del taller se hornean en la malla del coche cuando cambia su apariencia, no en cada imagen. Las vistas previas liberan el buffer sustituido y las mallas online se identifican por participante. Esto evita crecimiento innecesario al probar pinturas, sin constituir una reescritura del motor.

## Contador propuesto

Una futura opción **Mostrar rendimiento** podría calcular FPS a partir de intervalos de `requestAnimationFrame` usando `performance.now`, con una ventana móvil y texto actualizado unas cuatro veces por segundo. Debería ignorar pestañas ocultas y reiniciar el promedio al volver al juego.

Además de FPS convendría mostrar tiempo de imagen, promedio y percentil 95, resolución efectiva, vértices y llamadas de dibujo. Así se podrían distinguir caídas puntuales de un rendimiento sostenidamente bajo. No debería modificar el reloj de carrera, la física, controles ni resultados.

## Orden recomendado para una futura tarea

1. Definir equipos y escenarios: persecución/interior, noche/día, lluvia, cinco efectos de jefes y cuatro jugadores con piezas.
2. Medir CPU/GPU, coste del retrovisor, memoria, llamadas y tiempo de imagen; fijar una referencia reproducible.
3. Probar sectores visibles, retrovisor por textura, agrupación de partículas y reutilización de matrices, una mejora a la vez.
4. Comparar imagen y fluidez con las pruebas de conducción/replay y sin retirar señales útiles de curvas o faros.
5. Evaluar migración de renderizador únicamente si esas mediciones muestran una limitación que no resulta razonable corregir aquí. Mantener la simulación, catálogo, cuentas y protocolo separados del nuevo renderizador permitiría un cambio gradual.

Al redactar esta propuesta todavía no se había elegido una biblioteca sustituta ni implementado un contador. La primera fase posterior conserva WebGL y añade medición y optimizaciones, sin prometer un mínimo universal de FPS.
