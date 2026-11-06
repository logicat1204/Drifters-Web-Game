# Recursos de campaña

**Campaña completa:** cada carpeta admite también `_chapter/story_start/`, `_chapter/story_end/`, `_chapter/narrative_music_start/` y `_chapter/narrative_music_end/`. Son el prólogo y epílogo de toda la campaña; las carpetas de rivales continúan independientes. Se incluyen páginas iniciales reemplazables. Consulta [la guía de capítulos](../docs/AUDIO-LLUVIA-PAQUETES-CAMPANAS.md).

Cada rival tiene su propia carpeta: `campaign_files/<capítulo>/<rival>/`. Los identificadores y nombres de los 24 rivales están en [index.json](index.json).

Ejemplo para Kenji:

```text
campaign_files/akina/kenji/
├── music/                  # Música durante la carrera
├── story_start/            # Páginas del prólogo
├── narrative_music_start/  # Música del prólogo
├── story_end/              # Páginas después de ganar
└── narrative_music_end/    # Música del desenlace
```

## Cómics

Coloca las páginas directamente en `story_start/` o `story_end/`, por ejemplo `001.webp`, `002.webp`, `003.webp`. Se admite PNG, JPEG, WebP y GIF. La ordenación es natural: 2 va antes de 10. Recomendamos números con tres cifras y una sola extensión por página para evitar ambigüedades.

El lector permite avanzar, retroceder y ampliar las imágenes. Las flechas del teclado cambian de página y Escape vuelve al menú o a los resultados. Las transiciones respetan la preferencia de reducir movimiento. La última página del prólogo inicia la carrera; la del desenlace vuelve a los resultados. Una página que no se pueda cargar permite continuar.

`story_end/` se muestra únicamente después de una victoria completada y verificada por el servidor, también al repetir un duelo ganado. Una derrota no muestra el desenlace. Sin imágenes finales se pasa directamente a los resultados. Sin imágenes iniciales se usan los cómics anteriores de `assets/campaign-media.json`, si existen; de lo contrario, la carrera comienza directamente.

Las introducciones existentes ya se copiaron a `story_start/001.*`. Para sustituir una introducción, reemplaza esa página o elimina la copia antes de añadir las nuevas. No dejes la página anterior junto con una nueva si no quieres que ambas aparezcan.

## Música

Audio admitido: MP3, OGG, WAV, M4A, AAC, FLAC, OPUS y WebM. La reproducción de cada formato depende del navegador; MP3 u OGG son opciones prácticas.

- La primera canción, ordenada por nombre, de `music/` es la banda sonora predeterminada del duelo. Puedes añadir más: aparecerán en su selector.
- La primera canción de `narrative_music_start/` acompaña todo el prólogo; la de `narrative_music_end/` acompaña el desenlace.
- La música narrativa se detiene al cerrar el lector. Al empezar la carrera se reproduce la canción elegida para el duelo.
- Una carpeta narrativa vacía produce lectura sin música. Sin banda sonora de carrera se usa el sintetizador integrado.

El selector bajo **Ver introducción** permite conservar la música predeterminada, elegir otra del nivel, una canción de `songs/`, una comprada o un archivo importado desde el navegador. La elección se recuerda por nivel y usuario en ese navegador. Los archivos importados temporalmente deben seleccionarse de nuevo tras recargar.

El servidor vuelve a leer las carpetas al abrir Campaña. Después de añadir recursos, sal y vuelve a entrar a Campaña para actualizar la lista. En Render hay que incluir los archivos en el despliegue o almacenarlos en un disco persistente; los archivos locales de tu ordenador no se suben automáticamente.

`npm run assets:story-files` prepara las cinco carpetas de cada rival y copia las introducciones anteriores sin sobrescribir archivos existentes. Está pensado para preparar el proyecto; no hace falta ejecutarlo cada vez que añades una página o canción.
