# Primer modelo propio de carrera: familia AE86

31 de octubre de 2026. Primera etapa del plan de modelos semirrealistas estilizados: prototipo integrado y verificable, antes de extender el acabado a otras familias.

## Alcance

Se sustituyen visualmente **AE86**, **AE86 Project D / carbon** y **AE86 de dos puertas** por geometría original. Los demás coches conservan sus modelos actuales. El GLB descargado de Ddiaz Design permanece dedicado a la exhibición del menú principal y no interviene en esta construcción.

La nueva malla tiene perfil de carrocería propio, aletas con pasos de rueda abiertos, marcos de ventanilla, techo curvado, capó separado, parachoques panda, parrilla, faros escamoteables, pilotos traseros por segmentos, espejos, escape y rotulación. Se distinguen el portón de tres puertas y la trasera de dos puertas. Las ruedas incorporan perfil de neumático, llanta de ocho radios con volumen, disco y tornillería. Bajo los cristales hay una cabina sencilla con asientos y salpicadero; no se pretende todavía un interior detallado a escala de primera persona. La vista de conductor existente sigue funcionando.

Referencia: [Toyota, Sprinter Trueno de quinta generación](https://www.toyota-global.com/company/history_of_toyota/75years/vehicle_lineage/car/id60009032/). Se usan las dimensiones de referencia de fábrica para definir el volumen base y la batalla; es una interpretación estilizada que requiere revisión visual, no una reproducción automática exacta.

## Construcción y assets

`scripts/build-ae86.py` construye el modelo en Blender desde coordenadas y superficies originales. No abre el modelo importado ni utiliza sus materiales. Genera UV propias y contornos de texto a partir de una fuente instalada en el equipo. Guarda fuente editable, GLB y manifiesto en `assets/cars/original/`.

Reconstrucción: `npm run assets:vehicles`; `BLENDER_EXECUTABLE` permite elegir la instalación. El GLB usa metros, +Y arriba y +Z delante. Cada objeto identifica su pieza funcional y su LOD en los extras de glTF. Las piezas móviles conservan el origen de giro.

`js/vehicle-model.mjs` importa solamente este contrato de modelos originales, conserva pivotes y agrupa cada pieza en un búfer. Los datos de posición, normal, color, UV y tipo de material se cargan una sola vez y se comparten entre jugadores. Cada instancia mantiene pintura, accesorios, apertura de faros y LOD propios. Los arrays de geometría se liberan después de cargarlos a la GPU. La carga falla de forma controlada y permite seguir utilizando el modelo anterior si el asset no se puede descargar.

## Integración

- Ruedas: giro basado en el avance interpolado del vehículo; dirección solamente en el eje delantero. No se modifica la física para animarlas.
- Faros: tecla de luces existente; apertura/cierre visual suave. Una segunda pasada para el retrovisor no adelanta dos veces la animación.
- Materiales: respuesta específica de pintura y metal; vidrio translúcido y reflejo estilizado del cielo. Se mantienen iluminación nocturna, faros, frenada y niebla del circuito. Se redondea el identificador de material interpolado para evitar parpadeo entre fragmentos.
- Garaje: pintura, capó oscuro, llantas doradas/negras, franjas, Apex Line y alerón GT. El Project D usa el capó oscuro por defecto.
- Las gráficas Apex sustituyen la rotulación lateral de tofu; las matrículas y emblemas se conservan. En el LOD distante se omite el texto pequeño.
- Campaña y online: el rival o cada jugador usa su variante y su apariencia. La geometría se comparte; el aspecto y la animación no se mezclan entre jugadores.
- Efectos de jefes: las estelas de Takumi también utilizan su nueva carrocería.
- Rendimiento: LOD cercano y distante con histéresis, pasando al distante a más de 78 m y recuperando el cercano por debajo de 62 m. La distancia es visual; no afecta a la simulación.

No se cambian estadísticas, perfiles, compras, economía, colisiones, replays ni sincronización online. La presentación continúa usando la interpolación que ya corregía los pequeños tirones.

## Verificación

Pruebas específicas en `tests/vehicle-model.test.mjs`: geometría finita, normales unitarias, variantes, presupuestos de triángulos, pivotes, dirección, apertura, instancias independientes y errores de importación. Se comprueba también el SHA-256 del modelo descargado para confirmar su independencia.

`npm run test:vehicle-models` genera capturas frontal, trasera, Project D, coupé, personalización y faros apagados, comprueba el estado WebGL y mide cuatro coches simultáneos. Las pruebas de rendimiento generales cubren conducción real, interpolación, cambios de cámara, retrovisor y niebla. Los FPS son mediciones locales, no una garantía para otros equipos.

Exportación final: GLB de 1.387.196 bytes; el AE86 de tres puertas de serie dibuja 18.986 triángulos cerca y 5.454 en el LOD distante, contando cuatro ruedas. Cada LOD comparte 14 búferes de piezas entre instancias. La fuente Blender organiza las piezas como un kit de producción (incluidas ambas variantes y ambos LOD); el juego selecciona y monta la carrocería y las cuatro ruedas.

Verificación final: **186 pruebas aprobadas**, sintaxis correcta, flujo de menús correcto y prueba real de garaje → carrera → H para abrir/cerrar faros → cámara interior → menú. Prueba de cuatro coches a 1920 × 1080, GPU nativa y resolución al 100 %: aproximadamente **60 FPS**, 64 llamadas de dibujo y 310.320 vértices por imagen. Resultados locales en `data/original-vehicle-browser.log`; capturas en `screenshots/ae86-propio-*.png`.

La prueba general de conducción a 1080p también mantuvo unos 60 FPS y P95 de 16,8 ms. Pasaron 20 comparaciones de visibilidad y seis configuraciones del retrovisor, sin errores WebGL ni lecturas de GPU en su composición. Resultado en `data/original-vehicle-performance.log`.

## Continuación del catálogo

El siguiente prototipo previsto era el RX-7 FD, seguido de Skyline, Silvia, MR2 y los modelos modernos. **Actualización posterior:** tras aprobar el usuario el AE86, se construyen e integran los otros 22 coches y preparaciones; ver `MODELOS-CATALOGO.md`. Esta página conserva el detalle de la primera etapa.
