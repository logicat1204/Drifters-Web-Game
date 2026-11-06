# Solicitud del 3 de noviembre de 2026

## Pedido del usuario

- Unificar las opciones de carrera del menú en Jugar, con icono play.
- Submenú con Campaña, Time Attack y Juego Online; iconos propios, descripción mediante modal animado al pasar el ratón o activar, botones entrar y cerrar.
- Descripciones: «Construye tu leyenda a través del mundo del automovilismo en Japón», «Practica y mejora tus tiempos» y «Enfrenta a rivales de todo el mundo.»
- Time Attack reutiliza la contrarreloj offline y la selección de música. Eliminar la opción Duelo especial de ese menú.
- Añadir ranking consultable por trayecto.
- Preparar recursos por campaña y rival con `music`, `story_start`, `narrative_music_start`, `story_end` y `narrative_music_end`.
- Admitir cómics de varias imágenes antes del duelo y después de la victoria, con animación al cambiar de página y música narrativa separada.
- Selector de música bajo Ver introducción; canción predeterminada por nivel y opción de cambiarla.
- Subcarpeta en songs para canciones de tienda, con nombre, autor y precio interpretados automáticamente; ejemplo `GasGasGas_Manuel_300`.

## Convenciones implementadas

Recursos: `campaign_files/<capítulo>/<rival>/`, con las cinco carpetas solicitadas para los 24 niveles y un índice de rutas. Tienda musical: `songs/shop/`. Orden natural de archivos; primera canción de cada carpeta como predeterminada. Las compras musicales se guardan por usuario en SQLite v5 y el servidor autoriza la reproducción.

Guía de uso y pruebas: [JUGAR-NARRATIVA-MUSICA.md](../docs/JUGAR-NARRATIVA-MUSICA.md).
