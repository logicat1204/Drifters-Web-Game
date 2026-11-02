# Modelos originales de carrera — catálogo

Actualización posterior al AE86: esta carpeta contiene 23 kits GLB originales para los 25 coches del juego. El resto se construye con `scripts/build-car-catalog.py` y `catalog-specs.json`. Cada identificador dispone de fuente Blender, GLB y manifiesto; las tres variantes AE86 comparten kit. El proceso completo, referencias, límites de detalle y pruebas se documenta en `docs/MODELOS-CATALOGO.md`.

`npm run assets:vehicles -- --catalog` reconstruye solamente los 22 nuevos; `-- --ae86` reconstruye únicamente el AE86. Las dimensiones de cada kit y sus pivotes están incluidas en el GLB. Las proporciones no verificadas para el mismo acabado/año son estimaciones visuales y no una ficha técnica del vehículo.

## Prototipo AE86

Geometría y UV creadas desde cero con `scripts/build-ae86.py`. No utiliza mallas, UV ni texturas del AE86 de Ddiaz Design mostrado en el menú.

- `ae86-source.blend`: fuente editable en Blender 5.1.
- `ae86.glb`: exportación para el juego; incluye piezas móviles, dos carrocerías y dos niveles de detalle.
- `ae86-build.json`: inventario reproducible de piezas, pivotes y triángulos de la exportación.

Referencia dimensional y visual: [Toyota — Sprinter Trueno de quinta generación](https://www.toyota-global.com/company/history_of_toyota/75years/vehicle_lineage/car/id60009032/). Carrocería de referencia 4.205 × 1.625 × 1.335 m y batalla de 2.400 m. Los espejos, escape y accesorios sobresalen de esa envolvente. Interpretación estilizada, no escaneo del vehículo.

Coordenadas del juego/GLB: metros; X lateral, Y arriba, Z hacia el frente. Los pivotes de ruedas y faros están expresados en estas coordenadas. El script convierte esas coordenadas a Blender al construir la fuente.

Reconstrucción desde la raíz del proyecto: `npm run assets:vehicles`. Puede indicarse otra instalación mediante `BLENDER_EXECUTABLE`. Requiere Blender 5.1 o compatible. El script usa una fuente del sistema para convertir la rotulación en contornos; el archivo de fuente no se distribuye. La fuente japonesa predeterminada en Windows es MS Gothic; en otros sistemas debe adaptarse su ruta para conservar los glifos.

Los colores, acabados y piezas se asignan por instancia al dibujar. El GLB contiene materiales y UV originales; esta primera versión no necesita descargar mapas de textura adicionales. Los faros, ruedas, carrocería coupé, portón, cristales y accesorios se mantienen separados.
