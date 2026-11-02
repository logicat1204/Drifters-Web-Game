# Renovación del catálogo de vehículos

31 de octubre de 2026. Continuación del prototipo AE86 aprobado: los **25 identificadores de coches del juego** disponen ahora de modelos originales. Las tres variantes AE86 conservan el trabajo anterior; esta entrega incorpora las otras **22 carrocerías y preparaciones**. Son interpretaciones estilizadas, con cabina exterior sencilla y materiales del juego, no modelos CAD ni reproducciones fotorealistas.

## Cobertura

| Grupo | Modelos y rasgos diferenciadores |
| --- | --- |
| Mazda | RX-7 FD con superficies redondeadas y faros escamoteables; Project D / RE Amemiya con frontal fijo, respiraderos y alerón de pista. |
| Skyline | R32 y R34 con volúmenes, batalla, frontal, llantas y alerones propios; ambos conservan cuatro pilotos redondos traseros. |
| Plataforma Silvia | S13 de dos tonos, S14 Zenki, 180SX con faros escamoteables y SilEighty con frontal Silvia y parte posterior liftback. |
| Toyota clásicos | MR2 SW20 con panel targa, entradas laterales y cubierta de motor; Supra JZA80 con frontal de tres proyectores por lado y alerón elevado. |
| Honda / Mitsubishi | S2000 AP1 abierto con arcos tras los asientos; Lancer Evo III sedán de cuatro puertas, entradas de aire, antinieblas y alerón alto. |
| MF Ghost | Alfa 4C con llantas de cinco orificios; Exige, 911 GT3 RS, R8, Civic Type R, Ferrari 488, GR Supra, Alpine A110S, Cayman y GT86 con perfiles, ópticas, tomas y traseras propios. |

En total hay **23 archivos GLB originales** para 25 identificadores: las tres variantes AE86 comparten el mismo kit. Cada archivo nuevo contiene sus propios LOD, mallas y datos de montaje. Ya no se decide la carrocería moderna a partir de la familia física del coche: un Civic no dibuja una Silvia ni un 911 una Supra.

## Construcción y referencias

El generador `scripts/build-car-catalog.py` construye superficies originales en Blender. `assets/cars/original/catalog-specs.json` define dimensiones visuales, batalla, neumáticos, ventanas, ópticas, alerones y detalles por modelo. Los pasos de rueda tienen aberturas reales; los faros móviles conservan sus bisagras; el techo y los marcos curvos se generan como superficies continuas. La cabina de los modelos nuevos incorpora asientos y salpicadero sencillos, visibles a través del cristal. La vista de conductor existente se conserva.

Se generan UV de superficie propias y rótulos geométricos. Esta fase usa colores y materiales, sin importar texturas de los fabricantes ni reutilizar el modelo descargado del menú. Las proporciones se contrastan con imágenes y fichas; cuando no se dispone de una ficha del mismo acabado/año, las medidas de construcción son aproximadas. No deben usarse como ficha técnica real ni como parámetros de la simulación.

Referencias oficiales consultadas:

- [Mazda: tercera generación RX-7](https://www2.mazda.com/en/100th/cars/detail_025_rx7.html) y [recambios clásicos y documentación FD](https://www.mazda.co.jp/owner_support/classicmazda/rx-7/parts/).
- [Nissan: GT-R R32](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/skyline_gt-r_1989.html), [Silvia S13](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/silvia_qs.html) y [colección Silvia](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/silvia_gazelle.html). El R34 se toma de la galería de modelos de calle; no se aplica la anchura del coche JGTC a la versión de calle.
- [Toyota: MR2 SW20](https://www.toyota-global.com/company/history_of_toyota/75years/vehicle_lineage/car/id60000728/index.html), [Supra JZA80](https://www.toyota-global.com/company/history_of_toyota/75years/vehicle_lineage/car/id60006850/index.html), [86](https://global.toyota/en/detail/173965) y [GR Supra](https://global.toyota/en/newsroom/toyota/28110994.html).
- [Honda: S2000 AP1](https://www.honda.co.jp/factbook/auto/s2000/199904/050.html) y [Civic Type R 2017](https://hondanews.eu/eu/lv/cars/media/pressreleases/108909/2017-honda-civic-type-r1).
- [Mitsubishi: Lancer Evolution en WRC](https://www.mitsubishi-motors.com/en/brand/motorsports/wrc/), [Alfa Romeo: guía 4C](https://alfaromeo-tools.fcaab.com.au/vehicles/4C-Buyers-Guide.pdf), [Lotus: Exige](https://www.lotuscars.com/en-GB/lotus-story/road-cars/exige), [Porsche: GT3 RS 2015](https://newsroom.porsche.com/en/products/porsche-911-gt3-rs-race-car-circuit-racetrack-everyday-driving-2015-10051.html), [Porsche: familia 718](https://newsroom.porsche.com/en/products/718.html) y [Alpine: A110S 2019](https://media.alpinecars.com/alpine-unveils-new-alpine-a110s/?lang=fra).

La consulta de Ferrari y de parte del archivo Audi estuvo limitada por protección del sitio o acceso automatizado; esos detalles permanecen como aproximaciones visuales. No se afirma haber extraído medidas o fotografías de páginas cuyo contenido no fue accesible.

## Montaje y rendimiento

`js/vehicle-catalog.mjs` relaciona el identificador exacto de coche con su GLB. El importador lee del propio archivo el ancho de vía, centro y radio de rueda, posición de ambos ejes y ángulo de faros. La batalla y las ruedas ya no heredan las medidas del AE86.

Los coches se cargan bajo demanda. Cada carrocería comparte sus búferes entre jugadores y conserva apariencia y animación por instancia. La caché mantiene como máximo ocho cuerpos cargados, incluido el kit AE86; libera los búferes de los menos usados y puede volver a cargarlos. Un fallo en un archivo conserva el modelo de respaldo para ese coche. La descarga de un rival ocurre durante la presentación/cuenta atrás, sin descargar el catálogo completo al entrar.

Las 22 exportaciones nuevas suman aproximadamente 17,9 MB, pero se solicitan por separado. Cada una pesa aproximadamente 0,68–0,98 MB. El detalle de serie dibujado por coche oscila entre **14.357 y 22.885 triángulos cerca**, y entre **3.553 y 4.232 lejos**, incluyendo las cuatro ruedas y su alerón de serie. El 4C tiene el mayor coste cercano debido a sus llantas geométricas. Los LOD conservan la histéresis del prototipo: cambio a distancia sobre 78 m y regreso al cercano por debajo de 62 m.

Pintura, capó oscuro, llantas, franjas, Apex Line y alerón GT siguen disponibles. El alerón GT sustituye al de serie para evitar dos alerones superpuestos. Las ruedas giran con el avance interpolado y el eje delantero responde a la dirección. H controla las luces y abre/cierra los faros de los coches que los tienen escamoteables. Las ruedas del coche de la introducción también reciben su avance animado.

No se modifican física, perfiles, dificultad, economía, coches poseídos, mejoras guardadas ni mensajes de red. El modelo de Ddiaz Design continúa exclusivamente en el menú principal, con su crédito y condiciones existentes.

## Reproducción y pruebas

- `npm run assets:vehicles`: reconstruye AE86 y el resto del catálogo.
- `npm run assets:vehicles -- --catalog`: reconstruye solamente los 22 nuevos.
- `npm run assets:vehicles -- --ae86`: reconstruye solamente el prototipo anterior.
- `BLENDER_EXECUTABLE`: ruta alternativa de Blender 5.1 o compatible.
- `npm run test:vehicle-catalog`: capturas frontal y trasera de todos los coches, accesorios, faros cerrados, carrera con cuatro modelos diferentes y flujo real del FD.

Cada coche entrega fuente `-source.blend`, GLB y manifiesto `-build.json`. Son kits de piezas de producción, que el juego monta y anima. Los exports GLB se sustituyen completos; las sustituciones esperan brevemente si un lector o indexador de Windows mantiene el archivo abierto.

Las pruebas de geometría cubren todos los identificadores, normales, límites de tamaño, presupuestos de LOD, batalla, diferencias de carrocería y posición de ruedas. También cubren caché compartida, eliminación de búferes, recarga y sustitución de alerones. Las capturas se guardan en `screenshots/catalogo/`.

Validación: **189 pruebas aprobadas**, sintaxis correcta y prueba GPU de los 25 coches sin errores WebGL. Carrera con FD, R34, Ferrari 488 y Civic simultáneos a 1920 × 1080 y resolución completa: aproximadamente **59–60 FPS** en este equipo. La prueba general de conducción obtuvo unos 60 FPS, P95 16,8 ms; pasaron 20 comparaciones de visibilidad y seis configuraciones del retrovisor, sin lecturas de GPU en su composición. No garantiza el mismo resultado en otros equipos.

El flujo real del FD también pasa: cuenta temporal, selección persistente, garaje, carrera, H para cerrar y abrir faros, cámara interior y regreso a la exhibición del menú. La comprobación final de los tres conjuntos escamoteables confirmó nuevamente unos 60 FPS con cuatro carrocerías diferentes y P95 de 16,8 ms. Se mantiene una galería general de clásicos y modernos, además de una selección de seis vehículos en `screenshots/catalogo/seleccion-renovada.png`.
