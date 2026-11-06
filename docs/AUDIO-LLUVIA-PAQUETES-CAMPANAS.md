# Audio, lluvia, paquetes y campañas

Implementación: 4 de noviembre de 2026. Conserva los dos rigs `portrait-v2-male` / `portrait-v2-female`, el inventario, las compras y las carreras existentes.

## Audio de conducción

`js/driving-audio.js` mezcla grabaciones de domasx2 y qubodup, con créditos completos en `assets/audio/CREDITS.md` y una página de créditos accesible desde Música. Las muestras se distribuyen localmente, sin descargas externas durante el juego. CC0 y CC BY 3.0 respectivamente; conservar la atribución de qubodup al distribuir.

Cuatro perfiles de mezcla: cuatro cilindros, rotativo, seis cilindros y exóticos. Son interpretaciones arcade por familia, no grabaciones auténticas de cada modelo. Revoluciones y acelerador controlan bandas y tono; soltar el acelerador amortigua el motor; los cambios conservan su golpe mecánico. La vista interior filtra y amortigua el sonido. Frenada, derrape, viento y lluvia usan ruido filtrado original con entradas/salidas suaves. Teclado, táctil y mando alimentan los mismos controles.

Motor, neumáticos/frenada, lluvia/ambiente y música disponen de volúmenes independientes. Como máximo hay un motor propio y tres rivales con panorama y atenuación por distancia. Se comparten cuatro buffers decodificados y un buffer de ruido; no se crean fuentes nuevas en cada fotograma. Pausa, salida y pestaña oculta silencian la conducción. Si el banco no carga, queda un motor de síntesis de respaldo.

`assets/audio/engines/bank.json` enumera las cuatro muestras: ralentí, medias, altas y cuerpo. Sustituir por WAV/OGG compatibles de régimen constante, con permisos de uso y créditos. El mezclador normaliza con margen y une suavemente los extremos de cada bucle. Los parámetros de timbre y familias están en `js/driving-audio.js`. Diagnóstico de solo lectura: `window.touge.audio`.

## Mojado

El material de asfalto responde al estado real `race.wet`: oscurecimiento, máscara irregular de charcos y reflejos aproximados del cielo, faros y luces traseras. La carrocería gana brillo moderado. No se aplican reflejos a árboles, salpicadero o cielo; no se cambia la física ni la niebla de Ashinoko. Son reflejos analíticos, no espejos completos de edificios o vehículos.

Spray bajo las ruedas del jugador y rivales cercanos, limitado a 48 partículas compartidas con el humo. Se conservan gotas, limpiaparabrisas y espejo interior. No se introduce SSR, lectura de píxeles por frame ni otro render completo del mundo. El coste del retrovisor permanece limitado por sus ajustes actuales. El mapa de campaña detiene el render 3D de fondo mientras lo cubre.

## Agregar cosméticos

Los nombres v3/v4 son **colecciones**, no cambios de anatomía del avatar. Hay dos paquetes iniciales con diez artículos nuevos separados por base:

```text
assets/shop/packs/
  v3-night-grid/
    pack.json
    male/outfit/night-grid/item.json
    male/outfit/night-grid/color.png
    male/outfit/night-grid/lines.png
    female/outfit/night-grid/...
  v4-paddock/
    pack.json
    female/makeup/rose-night/item.json
    female/makeup/rose-night/image.png
```

`pack.json`:

```json
{"schemaVersion":1,"name":"Mi colección v5","items":["female/outfit/rally-new/item.json"]}
```

`item.json`:

```json
{
 "id":"female.outfit.rally-new",
 "base":"female",
 "slot":"outfit",
 "rig":"portrait-v2-female",
 "name":"Piloto de rally",
 "price":450,
 "rarity":"rare",
 "availableForSale":true,
 "layers":{"color":"color.png","lines":"lines.png"},
 "preview":"preview.png"
}
```

- Capas PNG con alfa, **512 × 640**, 8 bits, sin entrelazar; máximo 2,5 MB por archivo. Se valida también el flujo comprimido y sus dimensiones. El SVG sirve para editar fuentes, pero el juego equipa PNG.
- Ropa: `color` (máscara teñible) + `lines` (costuras, sombras, detalles). Cabello: `back` + `color` (frente teñible) + `lines`. Ojos, labios, accesorios y maquillaje: `image` a color. `preview` es opcional, PNG/WebP; la tienda utiliza además la composición real sobre el avatar.
- Slots: `hair`, `eyes`, `mouth`, `outfit`, `accessory`, `makeup`. Rarezas: `common`, `rare`, `legendary`.
- ID permanente: `<male|female>.<slot>.<clave>`, clave de 2–64 letras minúsculas, números o guiones. Nunca reutilizar un ID para una pieza distinta. Precio entero entre 1 y 1.000.000. El cliente no decide el precio.
- Cada artículo pertenece a **una sola base**. La ropa, cabellos y rasgos de hombre y mujer tienen sus propios archivos y puntos de encaje. Conservar las dimensiones y alinear sobre la base actual: consultar `docs/AVATAR-ASSETS.md` y los paquetes de ejemplo.
- Rechaza rutas externas, IDs duplicados, rigs incompatibles, capas faltantes y paquetes incompletos. El rechazo es por paquete entero. El registro inicial imprime avisos en la consola del servidor.
- El servidor descubre paquetes al arrancar y al abrir tienda/catálogo o comprar. Añadir una carpeta y volver a abrir la tienda basta; en Render hay que incluirla en el despliegue.
- Cambiar nombre, precio o carpeta conserva propiedad por ID. `availableForSale:false` retira de venta y permite seguir equipando lo comprado. **Conservar archivos y metadatos** de piezas retiradas. Si se borra un paquete, las licencias conservan sus IDs y usan un retrato de respaldo hasta restaurarlo; el editor permite elegir una pieza disponible.
- `npm run assets:shop-packs` reconstruye los dos paquetes de ejemplo desde arte vectorial original. No modifica las bases. Los `.svg` quedan junto a sus PNG; no usar este generador para sobrescribir paquetes editados a mano.

Un tipo completamente nuevo de cosmético requiere definir su slot, orden de composición e interfaz. Agregar más ropa, maquillaje, ojos, labios, cabello o accesorios a los slots actuales solo requiere archivos.

## Cómics de campaña y mapa

```text
campaign_files/<campaña>/_chapter/
  story_start/001.png, 002.webp, ...
  narrative_music_start/01 intro.mp3
  story_end/001.png, 002.webp, ...
  narrative_music_end/01 final.ogg
```

Se conservan las carpetas independientes de cada rival: `campaign_files/<campaña>/<rival>/...`. `_chapter` aporta el contexto de la campaña completa. Las páginas admiten PNG/JPEG/WebP/GIF y se ordenan naturalmente (`2` antes de `10`); se reproduce el primer archivo de música válido de cada fase. El audio se detiene al cerrar o continuar. Sin música, el lector funciona igual.

Hay nueve prólogos y nueve epílogos iniciales, con narración original y los retratos existentes del proyecto. Son páginas iniciales reemplazables: puedes borrar `001.png` y colocar tus cómics. No se añadió música narrativa comercial por defecto. `npm run assets:chapter-stories` prepara carpetas y páginas solo si faltan; conserva las imágenes existentes. `--refresh-generated` es una opción explícita para regenerar las páginas iniciales y **sobrescribe `001.png`**: no usar sobre cómics propios.

El prólogo aparece en la primera entrada a una campaña desbloqueada. Después solo al pedirlo con PRÓLOGO. El epílogo aparece tras ganar **todos** los duelos de esa campaña, después del desenlace del último duelo si existe. PRÓLOGO y EPÍLOGO permiten releerlos. Cerrar antes de continuar la última página no marca la lectura. Una derrota no desbloquea el epílogo.

SQLite migra a versión **6**, agregando `chapter_story_seen` por usuario/campaña/fase sin borrar datos. `POST /api/campaign/story` exige sesión, mismo origen, CSRF y progreso elegible; no da monedas. La lectura se conserva entre dispositivos. Terminar una escena no inicia un duelo salvo que se hubiera abierto desde el botón de desafío.

El atlas es una representación esquemática de las regiones, no un mapa geográfico exacto. `assets/campaign-map/map.json` controla posiciones y etiquetas por ID. El orden y los bloqueos los sigue definiendo `js/campaign.mjs`. El mapa permite elegir región, ver su recorrido de rivales y ficha, consultar música/recompensa y saltar al siguiente desafío. Ratón, táctil, teclado y mando: cruceta para elegir, A para confirmar, B para volver; en cómics A/derecha continúa, izquierda retrocede. Movimiento reducido respeta el ajuste del sistema.

## Verificación

Suite de lógica, seguridad, propiedad, migraciones y física: `npm test`. Sintaxis: `npm run check`. Prueba integrada: `npm run test:atlas-audio`. Regresión: `npm run test:progression`, `npm run test:play-story`, `npm run test:cockpit`.

En Edge nativo con Intel UHD, prueba de 1920 × 1080 a escala 1: ~59,7 FPS interior y ~60 FPS con cuatro autos y lluvia. Es una medida local de esa escena y hardware, no garantía en todos los dispositivos. El monitor existente y la resolución adaptativa siguen disponibles.
