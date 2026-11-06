# Jugar, narrativa y música — 3 de noviembre de 2026

## Navegación

El menú principal concentra las entradas de carrera en **Jugar**. Su submenú presenta Campaña, Time Attack y Juego Online. Con ratón, detenerse sobre una tarjeta abre su descripción; con teclado, mando o pantalla táctil, se activa la tarjeta. El diálogo animado ofrece entrar o cerrar. Cerrar una descripción no la vuelve a abrir inmediatamente si el cursor sigue en la misma tarjeta.

Time Attack conserva la elección de recorrido, condiciones, coche y música del antiguo juego offline. Se retiró de la interfaz la elección Duelo especial. Los formatos antiguos permanecen en la simulación y en los registros históricos para conservar compatibilidad con las partidas y pruebas existentes.

## Ranking por trayecto

**Ver ranking** abre el top 50 del recorrido seleccionado. Usa únicamente llegadas completas de Time Attack verificadas por el servidor; muestra la mejor marca por piloto, la máquina, su preparación y la marca personal del usuario conectado. Se separan día/noche, seco/mojado y AT/MT de acuerdo con la configuración de la prueba; el diálogo permite filtrar también por coche.

`GET /api/rankings?track=akina&night=1&wet=0&manual=0&car=` requiere sesión. No acepta marcas enviadas directamente: lee los registros que ya utiliza la validación de carreras. Los tiempos de campaña, duelos y carreras incompletas quedan excluidos.

## Recursos y canciones

Consulta [campaign_files/README.md](../campaign_files/README.md) para preparar los cinco tipos de recursos por nivel, y [songs/shop/README.md](../songs/shop/README.md) para el catálogo de canciones comprables. [campaign_files/index.json](../campaign_files/index.json) relaciona las rutas con cada rival.

El prólogo y el desenlace usan un mismo lector con páginas ordenadas, botones anterior/continuar, zoom y animación de entrada. La música narrativa se reproduce por escena y se detiene al salir. El desenlace se abre al confirmar una victoria en `/api/runs/finish`; no depende únicamente del resultado del cliente.

Los recursos se descubren en el servidor al consultar `/api/campaign`, `/api/shop` y `/api/songs`. La selección de canción por nivel se guarda localmente bajo `touge-campaign-songs:<userId>`; la propiedad de canciones se guarda en SQLite y sigue al usuario entre dispositivos.

## Datos y despliegue

La migración `005-music.sql` actualiza SQLite a versión **5**, añade `owned_music` y conserva cuentas, inventario, monedas, preparaciones y marcas. Las compras se realizan en una transacción junto con el descuento y el movimiento del monedero. Una compra repetida no descuenta otra vez.

`POST /api/shop/buy` recibe `{kind:"music",id:"song-…"}`; el precio se obtiene del catálogo del servidor. El audio comprado se sirve por `/api/music/<id>` con sesión, propiedad, soporte de rangos y caché privada. La ruta estática `songs/shop/` está bloqueada, incluso para propietarios. La API nunca devuelve rutas absolutas del servidor.

Mantén el disco persistente y la configuración de base de datos de Render descritos en [ACCOUNTS-DEPLOY.md](ACCOUNTS-DEPLOY.md). Se recomienda respaldar SQLite antes del despliegue. Las carpetas de recursos deben estar incluidas en el despliegue o conservarse en un disco persistente; el descubrimiento automático no equivale a subir archivos desde el navegador.

## Validación

- `npm test`: pruebas de simulación, servidor, migraciones, permisos, compras y clasificación.
- `npm run check`: sintaxis de los módulos.
- `npm run test:menu`: navegación con ratón, teclado y mando; adaptación móvil.
- `npm run test:play-story`: tres modos, diálogos, ranking vacío, prólogo y desenlace de varias páginas, separación de audio, compra y transmisión de música, persistencia del selector y móvil.

Las pruebas de navegador usan una base de datos en memoria y archivos de prueba que se retiran al finalizar. No alteran las licencias del servidor habitual.

Validación realizada: 194 pruebas automáticas aprobadas; sintaxis aprobada; flujos de menú, campaña, garaje/online y narrativa/música aprobados en Edge con renderizado nativo. Se comprobaron el ranking vacío y con marcas, filtrado por coche, reproducción por rangos, precio obtenido del catálogo, propiedad de canciones, lector móvil y controles de mando. El servidor local fue actualizado a v5 después de una copia consistente de SQLite, conservando las cuatro cuentas y las 71 carreras existentes.
