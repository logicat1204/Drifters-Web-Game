# Migrar a MongoDB Atlas

## Empezar de cero en Render

1. Publica el código actualizado en el repositorio que usa Render.
2. En Atlas, agrega a **Network Access** los rangos de **Connect → Outbound** del servicio de Render. [IPs salientes de Render](https://render.com/docs/outbound-ip-addresses).
3. En **Render → Environment**, configura `DB_BACKEND=mongodb`, `MONGODB_DB=gamedb` y `MONGODB_URI` con el valor completo del `.env` local. Pega la URI sin las comillas exteriores.
4. Elige **Save, rebuild, and deploy**. El servidor prepara una base vacía automáticamente. Después abre el juego y crea tu cuenta. [Variables de entorno en Render](https://render.com/docs/configure-environment-variables).

El usuario de Atlas debe tener permiso `readWrite` para esa base. Esta opción empieza con cuentas nuevas. Para usarla también desde tu PC, cambia `DB_BACKEND=mongodb` en su `.env` y reinicia el servidor.

## Preparar la conexión

1. En Atlas, abre **Connect → Drivers** y elige **Node.js**. Crea un usuario de base de datos con permiso `readWrite` sobre una base nueva dedicada al juego y añade tu IP a la lista de acceso de Atlas. [Conexión desde el controlador Node.js](https://www.mongodb.com/docs/drivers/node/current/connect/connection-targets/).
2. En el `.env` de la raíz, pega la URI completa de Atlas en `MONGODB_URI`, entre comillas dobles. Sustituye los marcadores de credenciales. Si el usuario o la contraseña contienen caracteres reservados como `@`, `#` o `%`, aplica codificación URL a esos componentes. El `.env` está excluido de Git. Puedes recrearlo con `.env.example`. [Configuración de la URI](https://www.mongodb.com/docs/drivers/node/current/connect/connection-troubleshooting/).
3. Define `MONGODB_DB` con el nombre de esa base, por ejemplo `touge_after_hours`. Conserva `DB_BACKEND=sqlite` durante la preparación.

## Importar y activar

Desde la raíz del proyecto con Node.js 24 y las dependencias instaladas, verifica la conexión y el contenido de la SQLite por separado.

```powershell
npm run db:migrate -- --check
npm run db:migrate -- --dry-run
```

El segundo comando solo lee la SQLite y muestra conteos. Toma la ruta de `DB_PATH`, `DATA_DIR` o `data/touge.sqlite`. Para usar una copia explícita, añade `--source "ruta/a/touge.sqlite"` a los comandos `--dry-run` y `--apply`. La copia debe tener el esquema v6 o v7.

Si `--check` falla, el mensaje distingue la resolución DNS, la autenticación, los permisos y la conexión TLS. Para una falla DNS con `mongodb+srv://`, desactiva **SRV Connection String** en el diálogo de Atlas y copia la URI estándar completa que genera. Para un problema de conexión desde tu PC, revisa **Network Access** y agrega tu IP pública actual. [Diagnóstico de conexiones a Atlas](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).

Detén las carreras y demás escrituras en SQLite antes de la importación final. Conserva una copia de respaldo. Si el juego desplegado en Render es el que tiene las cuentas de tus jugadores, usa su base de `/var/data/touge.sqlite` como origen. Puedes ejecutar la importación desde el Shell de Render con el código actualizado y las variables de Atlas configuradas, o usar una copia consistente generada con la API de respaldo de SQLite. Evita copiar solo el archivo `.sqlite` mientras el servidor está escribiendo en su WAL. [Discos persistentes de Render](https://render.com/docs/disks).

```powershell
npm run db:migrate -- --apply
```

El importador conserva IDs, contraseñas con su hash y salt, sesiones vigentes, perfiles y retratos, coches, mejoras, inventario, música, progreso, monedas, historial de movimientos y récords. Lee SQLite sin modificarla y usa una transacción para importar a Atlas. Rechaza destinos con datos del juego o una importación previa.

Después de importar, cambia `DB_BACKEND=mongodb` y reinicia el servidor. El arranque comprueba que la importación esté registrada. Comprueba que puedes entrar con una cuenta existente y ver su garaje y récords. Para entornos local y de producción independientes, usa bases distintas en Atlas.

## Activar en Render

1. En Atlas, agrega a **Network Access** los rangos que aparecen en **Connect → Outbound** de tu servicio de Render. [IPs salientes de Render](https://render.com/docs/outbound-ip-addresses).
2. En **Environment** del servicio, configura `MONGODB_URI` con la URI estándar completa que empieza por `mongodb://`, sin las comillas del archivo `.env`. Configura `MONGODB_DB` con la base que quieres compartir y `DB_BACKEND=sqlite`. En un servicio existente se agregan desde el panel. El Blueprint declara la URI como secreto para servicios nuevos. Despliega el código actualizado. [Variables y secretos de Render](https://render.com/docs/configure-environment-variables) · [Referencia del Blueprint](https://render.com/docs/blueprint-spec#setting-environment-variables).
3. Abre **Shell** en ese servicio y ejecuta los comandos siguientes durante una ventana sin escrituras. Usa como origen la SQLite de Render si contiene los datos de producción. [Acceso a Shell en Render](https://render.com/docs/ssh).

```sh
npm run db:migrate -- --check
npm run db:migrate -- --dry-run --source /var/data/touge.sqlite
npm run db:migrate -- --apply --source /var/data/touge.sqlite
```

4. En Render, cambia `DB_BACKEND=mongodb` y vuelve a desplegar. Para que tu juego local lea y escriba en la misma base, cambia también su `DB_BACKEND` a `mongodb` y reinícialo. Ambos servidores deben tener el mismo `MONGODB_DB`. Importa la SQLite una sola vez.

El disco de Render conserva la SQLite de respaldo. Después del cambio, las escrituras nuevas quedan en Atlas. Volver a `DB_BACKEND=sqlite` abre la copia previa al cambio.
