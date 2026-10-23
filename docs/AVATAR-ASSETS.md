# Avatares y futuros cosméticos

## Dos plantillas independientes

El arte es original, dibujado mediante curvas SVG y exportado a PNG transparente. La fuente reproducible es `scripts/build-avatar-assets.mjs`. No necesita servicios de generación de imágenes.

La versión actual es **2**. Hay dos rigs: **portrait-v2-male** y **portrait-v2-female**. Cada uno tiene sus propios archivos, catálogo e identificadores de inventario. Solo se comparten las paletas de colores y el tamaño del lienzo, **512 × 640 px**. Las piezas de una base no se equipan en la otra.

- Hombre: mandíbula más ancha, cuello grueso, hombros amplios y ropa de corte recto. Cabellos corto, en puntas, flequillo recto y largo; ojos serenos/intensos/abiertos; gafas rectangulares, pendiente y gorra.
- Mujer: rostro ovalado y barbilla afinada, cuello estrecho, hombros inclinados y ropa con una silueta propia. Media melena, largo en capas, cola alta y ondulado; ojos almendrados/intensos/abiertos; gafas redondeadas, aros y diadema. Camiseta, cazadora y chompa están redibujadas para esta base.

Se generan **58 capas PNG y sus 58 fuentes SVG**, en `assets/avatars/v2/layers/{male,female}/` y `sources/{male,female}/`. `base-male.png` y `base-female.png` son retratos completos de muestra. Cada base editable tiene `base-skin.png` y `base-lines.png`. Los archivos v1 se conservan como material histórico; el editor y los retratos usan exclusivamente v2.

Los anclajes se documentan en `catalog.json`:

| Rig | Cara | Cuello | Hombros |
| --- | --- | --- | --- |
| Hombre | 256,224 | 256,365 | 140,392 / 372,392 |
| Mujer | 256,220 | 256,373 | 176,394 / 336,394 |

Todas las piezas mantienen el lienzo completo y el origen `(0,0)`: no recortar al contenido ni aplicar márgenes automáticos.

## Catálogo y composición

`js/avatar.mjs` define `AVATAR_CATALOGS` por base, `avatarOptions(base)`, `defaultAvatar(base)`, `validateAvatar()` y `avatarLayers()`. El editor actualiza los selectores al cambiar de base; durante la edición recuerda la combinación de cada una. La licencia guarda la base activa. Las piezas de ambos catálogos iniciales están disponibles para todas las cuentas.

Orden de composición:

1. Cabello trasero, teñido con `hairColor`.
2. Piel de la base, teñida con `skin`, seguida de sus contornos.
3. Prenda, teñida con `outfitColor`, seguida de sus contornos y detalles.
4. Ojos y labios propios de la base.
5. Cabello delantero teñido, seguido de sus contornos.
6. Accesorio.

Las máscaras de color contienen alfa, sin contornos; la tinta va en una capa independiente para conservarse al cambiar el color. El servidor incrusta PNG conocidos en un SVG y aplica el tinte a su alfa. No se admiten rutas, colores arbitrarios ni fragmentos SVG enviados por el usuario. El editor, las salas y los récords usan la misma composición del servidor.

Ejemplo guardado:

```json
{
  "version": 2,
  "base": "female",
  "skin": "#a66e4f",
  "hair": "ponytail",
  "hairColor": "#242730",
  "eyes": "soft",
  "mouth": "defined",
  "outfit": "hoodie",
  "outfitColor": "#344750",
  "accessory": "glasses"
}
```

Aunque algunas claves locales coincidan (por ejemplo `jacket`), los artículos son distintos: `male.outfit.jacket` y `female.outfit.jacket`, con rigs y archivos propios. Cada artículo declara una única base en `bases`. El servidor comprueba tanto su validez para la base como su propiedad en el inventario.

`GET /api/avatar/catalog` devuelve versión, opciones y valores iniciales separados en `male`/`female`, además de los artículos. `GET /api/avatar/preview?base=female` aplica los valores iniciales femeninos; una combinación incompatible devuelve 400.

## Migración de cuentas anteriores

La migración SQLite **002-avatar-rigs.sql**, coordinada por `Store`, actualiza los avatares v1 y concede los dos catálogos iniciales dentro de una transacción. Conserva colores, tipo de ropa, base, nombre, coche, fotos, sesiones y récords. Incrementa la versión del retrato para invalidar la caché. Se ejecuta una sola vez al pasar a `user_version=2`.

Equivalencias de las piezas que cambian:

| Base | v1 | v2 |
| --- | --- | --- |
| Mujer | Cabello corto / puntas | Media melena / cola alta |
| Mujer | Ojos calm / sharp / round | almond / defined / soft |
| Mujer | Labios neutral / full | natural / defined |
| Mujer | Gorra | Diadema |
| Hombre | Media melena (bob) | Flequillo recto (swept) |
| Hombre | Pendientes | Pendiente metálico (stud) |

Los demás IDs locales mantienen su equivalente en la base elegida. Los antiguos artículos de inventario no se eliminan, pero no se usan para equipar piezas v2. La foto y la combinación de avatar siguen guardadas por separado.

## Regeneración y futuras piezas

Con Node.js 24 y las dependencias de desarrollo:

```sh
npm ci
npm run assets:avatars
node scripts/preview-avatar-assets.mjs
npm test
npm run test:ui
```

Sharp solo se usa al exportar; producción sirve los PNG ya generados. Se admite `SHARP_MODULE` para resolver una instalación externa de Sharp. El script de vistas previas usa la composición real del servidor y exporta la comparación de bases y los ocho peinados a `screenshots/avatar-bases-v2.png` y `avatar-catalogos-v2.png`. La prueba de interfaz admite `PLAYWRIGHT_MODULE` y `BROWSER_EXECUTABLE`.

Para añadir una pieza:

1. Elegir su base y dibujar sobre **su** plantilla y anclajes. Si se desea una versión para cada base, crear dos dibujos y dos artículos independientes.
2. Añadir una clave estable al catálogo correspondiente en `AVATAR_CATALOGS` y las fuentes en el generador. No reciclar IDs publicados.
3. El cabello requiere `hair-<id>-back/front/lines`; la ropa, `outfit-<id>-color/lines`; los accesorios, `accessory-<id>`. Todos quedan dentro de la carpeta de su base.
4. Exportar y revisar cada pieza con todos los tonos y las demás piezas de **su base**, tanto en tamaño grande como en los retratos pequeños. Cambiar los anclajes requiere otra versión y migración.
5. Añadir una migración de inventario si el artículo gratuito también debe concederse a cuentas existentes. Marcar `starter` solo concede el artículo durante registros nuevos.

Si se generan futuras ilustraciones con IA, usar como guía la plantilla específica, misma pose y luz plana; ajustar contornos y anclajes antes de exportar. Una ilustración completa no sustituye una pieza intercambiable.

## Preparación para la tienda

SQLite mantiene `cosmetics(id,slot,rig)` e `inventory(user_id,item_id,acquired_at)`. Los IDs incluyen la base: `female.hair.ponytail`, `male.accessory.cap`. Una futura compra debe descontar saldo y conceder el artículo en una misma transacción. Una compra de una base no debe desbloquear automáticamente la versión de la otra.

Los puntos de conducción actuales son estadísticas verificadas, **no saldo gastable**. No hay compras ni artículos de pago en esta versión. Las fotos no forman parte del catálogo y no se guardan en Git.
