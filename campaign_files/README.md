# Recursos de campaña

**Campaña completa:** cada carpeta admite también `_chapter/story_start/`, `_chapter/story_end/`, `_chapter/narrative_music_start/` y `_chapter/narrative_music_end/`. Son el prólogo y epílogo de toda la campaña; las carpetas de rivales continúan independientes. Se incluyen páginas iniciales reemplazables. Consulta [la guía de capítulos](../docs/AUDIO-LLUVIA-PAQUETES-CAMPANAS.md).

Cada rival tiene su propia carpeta: `campaign_files/<capítulo>/<rival>/`. Los identificadores y nombres de los 24 rivales están en [index.json](index.json).

Ejemplo para Kenji:

```text
campaign_files/akina/kenji/
├── music/                  # Música durante la carrera
├── story_start/            # Páginas del prólogo
├── story_sounds_start/     # Un sonido por página del prólogo
├── narrative_music_start/  # Música del prólogo
├── story_end/              # Páginas después de ganar
├── story_sounds_end/       # Un sonido por página del desenlace
└── narrative_music_end/    # Música del desenlace
```

## Cómics

Coloca las páginas directamente en `story_start/` o `story_end/`, por ejemplo `001.webp`, `002.webp`, `003.webp`. Se admite PNG, JPEG, WebP y GIF. La ordenación es natural: 2 va antes de 10. Recomendamos números con tres cifras y una sola extensión por página para evitar ambigüedades.

El lector permite avanzar, retroceder y ampliar las imágenes. Las flechas del teclado cambian de página y Escape vuelve al menú o a los resultados. Las transiciones respetan la preferencia de reducir movimiento. La última página del prólogo inicia la carrera; la del desenlace vuelve a los resultados. Una página que no se pueda cargar permite continuar.

`story_end/` se muestra únicamente después de una victoria completada y verificada por el servidor, también al repetir un duelo ganado. Una derrota no muestra el desenlace. Sin imágenes finales se pasa directamente a los resultados. Sin imágenes iniciales se usan los cómics anteriores de `assets/campaign-media.json`, si existen; de lo contrario, la carrera comienza directamente.

Las introducciones existentes ya se copiaron a `story_start/001.*`. Para sustituir una introducción, reemplaza esa página o elimina la copia antes de añadir las nuevas. No dejes la página anterior junto con una nueva si no quieres que ambas aparezcan.

## Sonidos por página

Coloca los sonidos en `story_sounds_start/` o `story_sounds_end/`. Usa el mismo nombre que la imagen, cambiando la extensión. Por ejemplo, `story_start/001.webp` usa `story_sounds_start/001.mp3`. También puedes usar un número y una descripción, como `002_motor.wav`, para la imagen `002.webp`. Las páginas con nombre descriptivo pueden usar el mismo nombre o su posición numérica en el cómic.

Cada página admite un archivo de audio. Si hay varios candidatos, se prioriza el nombre exacto y después el primer archivo por orden natural con su número. Las páginas sin archivo permanecen en silencio, sin desplazar los sonidos de las páginas siguientes.

El sonido empieza al cargar la imagen, se reproduce una vez y se corta al cambiar de página o cerrar el lector. Volver a una página reproduce su sonido de nuevo. La música narrativa sigue sonando de fondo. El volumen de estos sonidos usa el ajuste de motor y efectos y respeta el silencio general.

Las carpetas `_chapter/story_sounds_start/` y `_chapter/story_sounds_end/` funcionan igual para el prólogo y epílogo de una campaña completa. Tras añadir archivos, vuelve a abrir Campaña para actualizar el catálogo.

## Música

Audio admitido: MP3, OGG, WAV, M4A, AAC, FLAC, OPUS y WebM. La reproducción de cada formato depende del navegador; MP3 u OGG son opciones prácticas.

- La primera canción, ordenada por nombre, de `music/` es la banda sonora predeterminada del duelo. Puedes añadir más: aparecerán en su selector.
- La primera canción de `narrative_music_start/` acompaña todo el prólogo; la de `narrative_music_end/` acompaña el desenlace.
- La música narrativa se detiene al cerrar el lector. Al empezar la carrera se reproduce la canción elegida para el duelo.
- Una carpeta narrativa vacía produce lectura sin música. Sin banda sonora de carrera se usa el sintetizador integrado.

El selector bajo **Ver introducción** permite conservar la música predeterminada, elegir otra del nivel, una canción de `songs/`, una comprada o un archivo importado desde el navegador. La elección se recuerda por nivel y usuario en ese navegador. Los archivos importados temporalmente deben seleccionarse de nuevo tras recargar.

El servidor vuelve a leer las carpetas al abrir Campaña. Después de añadir recursos, sal y vuelve a entrar a Campaña para actualizar la lista. En Render hay que incluir los archivos en el despliegue o almacenarlos en un disco persistente; los archivos locales de tu ordenador no se suben automáticamente.

`npm run assets:story-files` prepara las siete carpetas de cada rival y las seis de cada capítulo, y copia las introducciones anteriores sin sobrescribir archivos existentes. Está pensado para preparar el proyecto. No hace falta ejecutarlo cada vez que añades una página o canción.
