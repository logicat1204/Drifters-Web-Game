# Editor de mapas

Ejecuta `npm run editor` y abre [el editor local](http://127.0.0.1:4175). Funciona aparte del servidor del juego. El catálogo contiene los objetos de los paquetes de rutas y los modelos GLB de las cinco partes de Touge City.

1. Elige un trayecto. El minimapa y el deslizador mueven la cámara por el recorrido.
2. Añade un modelo del catálogo o selecciona uno que ya esté colocado. Arrastra su punto en el minimapa o modifica las coordenadas y la escala en el panel. Elige **Eje de giro rápido** para usar los botones de ±5°, ±15° y ±90°, o introduce un ángulo exacto.
3. Guarda el trayecto. El archivo queda en `assets/track-layouts/<trayecto>.json` y define la distribución de decoración extra de ese mapa.

Para verlo en el juego, activa **Escenario extra en pista** en Gráficos y usa **Detalle del entorno → Alto**. Recarga el juego después de guardar una distribución. Los cambios se publican junto con el JSON correspondiente.

## Modelos propios

Copia tus archivos `.glb` a `assets/editor-models/` y elige **Modelos propios** en el catálogo. Los archivos aparecen automáticamente mientras el editor está abierto. Si un modelo usa texturas externas, colócalas dentro de esa carpeta y conserva sus rutas relativas. Incluye los modelos y las texturas al publicar un mapa que los use.

## Rellenar un hueco

1. Abre **Terreno** y mueve la cámara al sector. **Mostrar huecos del sector** marca los puntos sin suelo encontrados en el muestreo.
2. Pulsa **Dibujar relleno** y marca el contorno con clics en la vista 3D o el minimapa ampliado. Pulsa **Aplicar relleno**.
3. Ajusta **Altura del relleno** si hace falta y guarda el trayecto. El relleno se une suavemente al terreno y se recorta para respetar la calzada. Se aplica en el juego con cualquier ajuste de detalle.
