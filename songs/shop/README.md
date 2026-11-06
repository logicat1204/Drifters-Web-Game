# Canciones de la tienda

Coloca aquí los archivos de audio que deban comprarse con monedas. Convención:

```text
nombrecancion_autor_precio.extensión
GasGasGas_Manuel_300.mp3
Night_Drive_Manuel_450.ogg
```

Los ejemplos aparecen como **GasGasGas - Manuel**, por 300 monedas, y **Night Drive - Manuel**, por 450. No incluyen los archivos de audio: debes colocarlos en esta carpeta.

Los dos últimos campos son el autor y el precio. Los guiones bajos del título se convierten en espacios. Para un autor compuesto, usa espacios: `Night_Drive_Dave Rodgers_450.mp3`. El precio debe ser un entero entre 1 y 1 000 000. Los nombres inválidos y los archivos que no sean de audio se ignoran. Se admiten MP3, OGG, WAV, M4A, AAC, FLAC, OPUS y WebM.

La tienda vuelve a explorar la carpeta al abrirse. También puedes organizar subcarpetas dentro de `shop/`; sus canciones entran en el mismo catálogo. No hace falta editar JSON ni código.

Las canciones compradas quedan asociadas a la licencia en SQLite y aparecen en los selectores de Time Attack y campaña. La compra se cobra una sola vez; el servidor utiliza el precio del archivo y comprueba la propiedad antes de transmitir el audio. Las canciones de aquí quedan fuera de la lista gratuita de `songs/`.

La identidad depende del título y del autor. Cambiar el precio o el formato conserva las compras; cambiar el título o el autor crea otro artículo. Evita duplicados con igual título y autor: se usa el primero por orden de carpeta y nombre. Si retiras un archivo, los usuarios conservan la compra, pero no podrán reproducirlo hasta que vuelva a estar disponible.

Las canciones gratuitas continúan en `songs/`, fuera de esta subcarpeta. En Render, añade los archivos al despliegue o a un almacenamiento persistente: copiar un archivo a tu proyecto local no lo publica por sí solo.
