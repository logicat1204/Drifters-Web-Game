# Cuentas, datos y despliegue

## Entorno

Usar **Node.js 24 LTS**. El servidor utiliza `node:sqlite` y `DatabaseSync`, sin módulos nativos de SQLite que haya que compilar. Node puede mostrar el aviso de SQLite experimental de esa versión; no impide ejecutar el juego.

La base se crea automáticamente al primer arranque. La prioridad de rutas es `DB_PATH`, después `DATA_DIR/touge.sqlite`, y por defecto `data/touge.sqlite`. `server/migrations/001-accounts.sql` crea el esquema inicial; `002-avatar-rigs.sql` actualiza a `PRAGMA user_version=2`. La segunda migración convierte los avatares anteriores y concede los catálogos separados de hombre y mujer dentro de una transacción, conservando cuentas, fotos y récords. Se usan claves foráneas, WAL y consultas parametrizadas. Una base con versión posterior se rechaza sin modificarla. Las siguientes versiones deben introducir migraciones ordenadas antes de modificar tablas existentes.

Git conserva el código, las fuentes SVG, PNG, catálogo y configuración. Se excluyen `data/`, `.env`, `*.sqlite`, WAL/SHM y copias `.db`. No incorporar una base real al repositorio: contiene identidades, hashes de contraseña, sesiones, fotos y partidas. Un clon nuevo empieza sin usuarios.

## Cuentas y sesiones

- Usuarios únicos de 3–24 letras ASCII y números. La unicidad no distingue mayúsculas: `TakumiFX24` y `takumifx24` son el mismo identificador. El nombre visible se guarda por separado y puede cambiar sin alterar el usuario.
- Contraseñas de al menos ocho caracteres, derivadas con scrypt, sal aleatoria por cuenta y comparación constante del hash. Nunca se devuelven hashes, sales o contraseñas al navegador.
- Cookie de sesión aleatoria HttpOnly y SameSite=Lax, con caducidad de treinta días. Solo se almacena un hash del token en SQLite. Con `PUBLIC_URL` HTTPS se marca también Secure. Cerrar sesión invalida el token y desconecta las partidas de ese piloto.
- Las operaciones que escriben datos validan origen y el token CSRF de la sesión. Registro, login, disponibilidad, subidas y guardado de partidas tienen límites de frecuencia. WebSocket valida origen, sesión y perfil completo antes de admitir una conexión.
- Al primer registro es obligatorio confirmar nombre y elegir foto o avatar. Se pueden usar los siete coches desde el principio. La cuenta guarda coche predeterminado y etapa de Arcade; las opciones de cámara/audio siguen siendo preferencias del dispositivo.

Las fotos se reducen en el navegador a 512 × 640, y el servidor admite PNG, JPEG y WebP de hasta 500 KB y 2048 × 2048, con validación de cabeceras y dimensiones. No se admite SVG subido por el usuario. Los retratos son visibles en el juego a quienes vean al piloto en una sala o clasificación. El avatar por piezas y el modo foto se conservan por separado.

## Puntuaciones y récords

`runs` relaciona cada resultado con el ID inmutable del usuario, curso, coche, modalidad, transmisión, hora, asfalto y versión de física. Los puntos se acumulan como estadísticas de conducción, sin convertirlos aún en moneda. Los mejores tiempos y la clasificación usan consultas sobre resultados completados, con una sola mejor marca por piloto. Las partidas abandonadas no entran como tiempos de meta.

En individual, `/api/runs/start` emite un intento ligado al usuario y la configuración. El cliente registra controles compactados a 120 Hz, incluyendo marchas, faros, concentración y recuperación. `/api/runs/finish` reproduce el descenso con la simulación del servidor, limita tamaño/duración, verifica que termine y contrasta su duración con el reloj. Deriva tiempo y puntos de la simulación: no acepta el tiempo declarado por el cliente. Los envíos repetidos de un resultado son idempotentes. La pausa no añade ticks de juego y el tiempo real de la pausa no invalida un descenso. Reiniciar el servidor invalida los intentos individuales todavía sin guardar; los resultados confirmados ya están en SQLite.

En online, el proceso ya es autoritativo: guarda la llegada de cada piloto inmediatamente, incluso si luego se desconecta, y registra el cierre o retirada del resto. Individual y online tienen clasificaciones separadas por sus distintas salidas; también se separan seco/mojado, noche/amanecer y AT/MT. Se puede filtrar por coche o consultar todos. Las marcas antiguas del almacenamiento local anónimo no se atribuyen automáticamente a ninguna cuenta.

La reproducción valida resultados físicamente posibles; no es una protección contra automatización de controles. No hay importación de marcas externas ni endpoint que permita asignar saldo o puntos directamente.

## Salas públicas y privadas

La API de listado solo devuelve salas públicas abiertas y con menos de cuatro jugadores. No muestra privadas, carreras iniciadas ni salas llenas. Entrar valida de nuevo cupo y estado, aunque el listado mostrado haya quedado desactualizado. Los enlaces conservan el formato `/?room=CODIGO`.

El nombre, retrato y coche se toman del perfil autenticado del servidor; no se aceptan identidades ni coches falsificados en el mensaje de entrada. Un mismo piloto no puede ocupar varias salas o varios puestos a la vez. El coche queda fijado al salir; antes de marcar listo puede cambiarse desde Garaje, que guarda la preferencia y actualiza la sala. Solo el anfitrión configura, inicia y abre revancha. Las salas siguen viviendo en memoria y se cierran al reiniciar el servidor.

## Render

SQLite funciona en un servicio Node de Render de **una instancia**, con un disco persistente. El sistema de archivos normal de Render es efímero: una base guardada fuera del disco se pierde al reiniciar o desplegar. Los discos persistentes corresponden a servicios de pago; el plan gratuito sin disco no conserva esta base. Para un despliegue gratuito sin disco o varias instancias, migrar la capa `Store` a una base externa, por ejemplo Postgres.

Se incluye `render.yaml` como Blueprint de referencia:

- Node 24, `npm ci --omit=dev --ignore-scripts`, `npm start`.
- Una instancia de servicio y disco de 1 GB montado en `/var/data`.
- `DATA_DIR=/var/data`, `NODE_ENV=production`.
- Establecer `PUBLIC_URL=https://<dominio-real>` al crear el servicio. Debe ser el origen completo sin rutas. Activa cookies Secure y las invitaciones con el dominio público.
- El puerto usa `PORT` de Render. La comprobación de salud es `/api/health`. El dominio HTTPS permite WebSocket WSS en `/online`.

El Blueprint especifica un servicio con coste y no despliega por sí solo. El mismo servidor debe atender HTTP y WebSocket. No ejecutar réplicas independientes contra copias diferentes del archivo: ni las sesiones ni las salas se compartirían.

## Copias de seguridad

Copiar un archivo SQLite mientras está abierto en WAL puede omitir transacciones recientes. Usar la API de copia de SQLite (`Store.backup()` / `node:sqlite.backup`) o detener el servidor antes de copiar la base y conservar su estado completo. Guardar copias fuera del disco de la instancia. Las instantáneas de infraestructura no sustituyen una copia consistente de la base. No guardar las copias en Git.

## Pruebas

`npm test` utiliza bases temporales o en memoria: no escribe usuarios de prueba en la base del juego. Comprueba contraseñas, sesiones, unicidad concurrente, persistencia, permisos, fotos, catálogos separados de avatares, rechazo de piezas incompatibles y migración v1 → v2, replays, separación de récords y salas autenticadas. `npm run check` comprueba la sintaxis.

Para la prueba de navegador: `npm ci`, `npx playwright install chromium` y `npm run test:ui`. Alternativamente definir `BROWSER_EXECUTABLE` con un Chromium/Edge existente. `PLAYWRIGHT_MODULE` permite emplear un paquete proporcionado por el entorno. La prueba levanta un servidor efímero con SQLite en memoria y crea cuentas desechables; deja capturas en `screenshots/` y cierra sus conexiones al terminar.

## Fuentes oficiales

- [Node.js 24: SQLite](https://nodejs.org/download/release/v24.14.0/docs/api/sqlite.html).
- [Render: discos persistentes](https://render.com/docs/disks).
- [Render: WebSockets](https://render.com/docs/websocket).
