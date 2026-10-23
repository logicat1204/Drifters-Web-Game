# TOUGE / AFTER HOURS

Juego 3D de carreras de montaña para navegador inspirado en el ambiente y la conducción arcade de Initial D. Los modelos, circuitos y la música sintetizada se han creado para este proyecto. Los trazados son interpretaciones originales, no reproducciones exactas de los circuitos del arcade.

## Jugar

1. Con **Node.js 24 LTS** instalado, abre **JUGAR.bat**. También puedes ejecutar `npm start` en esta carpeta.
2. Entra en **http://127.0.0.1:4173**. Mantén la ventana del servidor abierta mientras juegas.
3. Crea un usuario o inicia sesión. La primera vez confirma tu nombre visible y elige foto o personaliza un avatar.
4. Elige coche en **GARAJE**, circuito y modo de carrera. En **AJUSTES** puedes cambiar cámara, transmisión, nivel del rival, asfalto, hora y resolución.

El servidor usa la biblioteca WebSocket `ws` y SQLite incluido en Node.js. Ejecuta `npm ci --omit=dev` la primera vez si falta `node_modules/`; JUGAR.bat instala `ws` automáticamente. Después puedes jugar contra este servidor local sin conexión a Internet: el servidor sigue siendo necesario para las cuentas, música y guardado de récords. Necesita un navegador con WebGL y aceleración gráfica. Para detener el servidor pulsa Ctrl+C en su ventana. Si el puerto está ocupado, usa `$env:PORT=4174; npm start` desde PowerShell y abre el puerto indicado.

## Tu licencia de piloto

El usuario puede tener entre 3 y 24 letras y números, por ejemplo `TakumiFX24` o `Alvaroo`. El registro comprueba si está libre; las mayúsculas no crean otra cuenta con el mismo nombre. La contraseña debe tener al menos ocho caracteres. No se necesita correo electrónico. El nombre visible del piloto se puede editar por separado.

En tu licencia, accesible mediante el retrato de la cabecera, puedes elegir **foto** o **avatar**. Hay dos bases con rostro y silueta propios y catálogos independientes de hombre y mujer: cada una tiene cuatro cabellos, tres tipos de ojos y labios, tres prendas y tres accesorios, además de seis tonos de piel y colores. Las piezas solo se equipan en su base; las cuentas anteriores se adaptan automáticamente conservando colores y el tipo de ropa. La combinación del avatar se conserva aunque uses una foto. Los siete coches están disponibles desde el principio; el coche elegido en Garaje se guarda como predeterminado del usuario.

La pestaña **RÉCORDS** de la licencia muestra tus puntos de conducción, estadísticas, marcas personales y al mejor piloto de cada curso. La clasificación permite elegir curso, coche, individual/online, asfalto, hora y transmisión. Los resultados están ligados al usuario en SQLite. Las carreras individuales se verifican reproduciendo los controles en el servidor; las online usan su simulación autoritativa. Las marcas locales anteriores no se atribuyen a una cuenta nueva.

La base se crea en `data/touge.sqlite`, o en la ruta indicada por `DATA_DIR` / `DB_PATH`, y está excluida de Git. Los puntos aún no son moneda para compras. El catálogo y el inventario por usuario dejan preparada la futura tienda de cosméticos.

Detalles de almacenamiento, sesiones, copias y Render: [docs/ACCOUNTS-DEPLOY.md](docs/ACCOUNTS-DEPLOY.md). Plantilla, capas PNG/SVG y guía para nuevos cosméticos: [docs/AVATAR-ASSETS.md](docs/AVATAR-ASSETS.md).

## Multijugador online

La pestaña **02 ONLINE**, junto a **01 CORRER**, tiene salas públicas y privadas de **2 a 4 jugadores**, con tres opciones:

1. **SALAS PÚBLICAS** muestra las partidas públicas abiertas y con plazas disponibles; pulsa **UNIRME**. Se actualiza cada cinco segundos y con **ACTUALIZAR**.
2. **SALA PRIVADA** permite pegar un enlace o código de ocho caracteres y pulsar **INGRESAR**.
3. **CREAR SALA** permite elegir circuito, hora y asfalto y marcar si será pública. Sin marcar, será privada y no aparecerá en el listado. El anfitrión puede **COPIAR** su invitación. Los pilotos entran con el nombre, retrato y coche predeterminado de su cuenta; para cambiarlo usa Garaje antes de marcar listo.
4. Todos, incluido el anfitrión, pulsan **ESTOY LISTO**. Solo el anfitrión puede pulsar **INICIAR CARRERA**. El botón se habilita con al menos dos jugadores y todos listos.
5. Al iniciar, la sala queda cerrada, incluso durante los tres segundos de cuenta atrás: nadie más puede entrar ni cambiar de coche. Después de los resultados el anfitrión puede **ABRIR REVANCHA**, que vuelve al lobby y exige confirmar listo de nuevo.

Los coches usan la física del juego y transmisión automática. El proceso Node.js calcula la carrera a 120 pasos por segundo: posiciones, contactos, faros, puntuación, salida y orden de meta. Los navegadores envían controles mediante WebSocket, reciben estados a 20 Hz y suavizan los coches remotos; el jugador local tiene predicción y corrección con el servidor. Cada jugador conserva su cámara y su música. El retrovisor y los faros muestran a los otros jugadores, y el HUD muestra posiciones y latencia.

El menú de Escape **no pausa a los demás**; tu coche frena mientras está abierto. Al perder foco o dejar de llegar controles, el servidor también frena el coche. Salir durante la carrera cuenta como DNF. Si el anfitrión se va, el primer jugador conectado hereda el rol y la carrera sigue. Tras la primera llegada hay 45 segundos para terminar; los restantes quedan DNF. Las salas vacías se eliminan y los lobbies caducan después de 30 minutos sin actividad. No hay reconexión automática a una carrera comenzada.

### Enlaces y acceso desde otros equipos

El servidor escucha en **0.0.0.0:4173**. Dentro de la misma red, usa la IP local del ordenador que ejecuta el servidor; el enlace intenta usar esa dirección si abres el juego en localhost. **127.0.0.1 solo sirve en el mismo ordenador**. El servidor debe seguir ejecutándose y el sistema debe permitir conexiones entrantes al puerto configurado. No se han modificado reglas del firewall ni del router.

Para jugar **por Internet**, este mismo servidor debe ejecutarse en un equipo o alojamiento accesible desde fuera de tu red. El enlace local no crea por sí solo una dirección pública. Usa un dominio HTTPS con un proxy que transmita también WebSocket en **/online**, y define PUBLIC_URL con ese dominio, por ejemplo desde PowerShell:

```powershell
$env:PORT='4173'
$env:PUBLIC_URL='https://tu-dominio.example'
npm start
```

Al abrirlo por HTTPS, el cliente usa **wss://** automáticamente y el botón Copiar genera invitaciones con PUBLIC_URL. En HTTP local se usa **ws://**. Si no hay permiso para el portapapeles, Copiar selecciona el enlace e indica pulsar Ctrl+C. Los invitados necesitan llegar al mismo servidor: compartir solo un código entre servidores distintos no conecta sus salas. Las salas viven en memoria; reiniciar el servidor las cierra.

Implementación WebSocket con [ws](https://github.com/websockets/ws), con límite de mensajes y tamaño, comprobación de origen, latidos y cierre de conexiones lentas. Los clientes no pueden enviar posiciones ni asignarse resultados; iniciar, configurar y abrir revancha se valida también en el servidor.

## Tu música

Coloca tus archivos en **songs/**, incluidas subcarpetas. Abre **MÚSICA**, elige la canción y comienza la carrera. El servidor vuelve a leer la carpeta automáticamente; el menú actualiza la lista cada ocho segundos y al abrir el selector. El botón **ACTUALIZAR** la vuelve a leer al instante. No hace falta reiniciar.

Formatos reconocidos: MP3, OGG, WAV, M4A, AAC, FLAC, OPUS y WEBM. La reproducción de cada códec depende del navegador. Los nombres con espacios, acentos y caracteres japoneses son compatibles. También puedes usar **AGREGAR ARCHIVOS**; esos archivos solo duran la sesión y no se copian a `songs/`. No se sube tu música a Internet.

Incluye **Midnight Transmission**, una composición eurobeat original sintetizada en tiempo real, y la opción de escuchar solo el motor. Puedes preescuchar canciones antes de correr, ajustar el volumen y silenciar con M. El audio comienza después de una interacción para respetar la política del navegador.

## Controles

| Acción | Teclado | Mando estándar |
| --- | --- | --- |
| Acelerar | W / ↑ | RT |
| Frenar | S / ↓ | LT |
| Girar | A-D / ←-→ | Stick izquierdo |
| Iniciar derrape | Espacio | A |
| Subir / bajar marcha en MT | E / Q | RB / LB |
| Cámara | C | Y |
| Encender / apagar faros | H | X |
| Superconcentración | X / botón en pantalla | B |
| Centrar coche a 0 km/h | Z / botón en pantalla o pausa | R3 |
| Pausa | Escape | Start |
| Reiniciar carrera | R | Botón en pausa |
| Silenciar música | M | Botón musical en pantalla |

En pantallas táctiles aparecen botones de conducción. El juego pausa al perder el foco o cambiar de pestaña.

Frena antes de entrar a las curvas cerradas. La fuerza lateral disponible es limitada: a mayor velocidad necesitas más espacio para girar y puedes abrirte hacia el guardarraíl. Suelta el freno cerca del vértice y recupera el acelerador al salir. Un toque de freno de mano permite rotar la zaga en horquillas; suéltalo y contravolantea. Mantenerlo pulsado pierde mucha velocidad. Las curvas abiertas pueden tomarse con agarre y sin derrapar. Los guardarraíles y los contactos con el rival reducen la velocidad. Los puntos de control agregan 14 segundos. El asfalto mojado reduce el agarre.

## Recuperación y Superconcentración

Al tocar un guardarraíl se pierde velocidad y se elimina la dirección que empuja el coche hacia el muro. Puedes seguir avanzando y girar hacia dentro para salir del contacto. Rozar la barrera mantiene una penalización de velocidad, que continúa brevemente después del golpe; una trazada con frenadas sigue siendo más rápida que apoyarse en los muros.

Pulsa **Z**, **CENTRAR · 0 KM/H**, el botón de pausa o **R3** en el mando para volver al centro de la pista, alineado con la carretera y a **0 km/h**. Conservas el avance, los controles de paso y el reloj: no ganas metros ni tiempo. Hay una breve inmovilización de 0,45 segundos y un intervalo de dos segundos entre usos. Se rompe el combo de curva y se cancela cualquier concentración activa. Durante la cuenta atrás y después de terminar no se puede reposicionar.

La barra de **SUPERCONCENTRACIÓN** se carga con curvas rápidas y limpias, según la velocidad, el agarre, la trazada y el deslizamiento reales. Las rectas, ir muy despacio, entrar pasado o golpear no generan carga. Con un mínimo de **30%**, pulsa **X**, **ACTIVAR** o **B** en el mando. Consume toda la carga y dura proporcionalmente entre **1,5 y 5 segundos**: 60% da tres segundos y 100% da cinco. Aumenta el agarre un **22%**, la aceleración un **10%** y la velocidad máxima un **6%**. El aura cambia a cian y la barra muestra el tiempo restante. Sigue siendo necesario preparar la entrada a las curvas.

No se recarga mientras está activa y hay tres segundos de recuperación al terminar. Un golpe o reposicionar cancela el efecto sin devolver la carga utilizada; la carga que aún no activaste se conserva al reposicionar. Ambas funciones están disponibles también online: el servidor valida los usos y calcula su efecto, sin aceptar posiciones, carga ni duración enviadas por los clientes. La recuperación centrada no produce un choque inmediato entre coches mientras dura su breve inmovilización.

Esta versión usa una nueva tabla local de mejores tiempos por el cambio de física y la nueva habilidad; las marcas de versiones anteriores se conservan en su almacenamiento anterior.

## Incluido

- Siete coches con modelos, cabinas y comportamiento propios: AE86, FD3S, BNR32, MR2 SW20, S2000 AP1, Silvia S13 y Supra JZA80. Todos se pueden usar en individual y online.
- Siete cursos con sectores dibujados individualmente: Akina, Akagi, Irohazaka, Usui, Tsukuba Fruits Line, Tsubaki Line y Atami Ghost.
- **Duelo especial**: elige cualquier mapa para desafiar a su rival. **Arcade**: siete encuentros consecutivos; al ganar aparece **SIGUIENTE**, y el progreso se guarda al avanzar. **Contrarreloj**: conducción libre de rival para mejorar tu tiempo.
- Cuatro cámaras: persecución, capó, cercana e interior. Pulsa **C** o usa el botón **CÁMARA** para alternarlas; también puedes elegir la cámara interior directamente en Ajustes.
- Cabinas estilizadas basadas en los interiores originales de cada coche. El AE86 tiene salpicadero angular, iluminación verde y volante de tres radios; el FD3S tiene salpicadero curvo, salidas redondas y tacómetro central; el BNR32 tiene cuadro rectangular y tres relojes auxiliares en la consola. El volante gira con la dirección y el contravolante; agujas y palanca responden a la conducción. Se han omitido las manos para conservar la visibilidad.
- Los nuevos interiores incluyen instrumentación angular y volante MR2 en el SW20, velocidad digital y tacómetro de barras naranja en el S2000, relojes analógicos y volante Silvia en el S13, y consola curva con tres relojes y volante Toyota en el Supra. Comparten componentes de dibujo y conservan el retrovisor 3D y los controles reactivos.
- Faros, niebla, humo, guardarraíles, vegetación, edificios en Atami, colores otoñales en Irohazaka y referencias al puente de Usui y huertos de Tsukuba.
- HUD con tiempo, posición, ventaja en metros, navegación, tacómetro y combo de derrape.
- Resultados, puntuaciones y mejores tiempos guardados en SQLite por usuario, circuito, coche, transmisión, hora, asfalto y modalidad; récord del curso con el nombre y retrato del mejor piloto.

## Garaje: siete coches, tres perfiles

| Perfil | Coches | Ventaja y compromiso |
| --- | --- | --- |
| Ágil | AE86, MR2 SW20, S2000 AP1 | Mayor agarre para curvas y horquillas; menos aceleración y punta. El MR2 prioriza el agarre, el S2000 ofrece algo más de punta y el AE86 queda entre ambos. |
| Equilibrado | RX-7 FD3S, Silvia S13 | Agarre, aceleración y punta intermedios. El Silvia gana un poco de agarre y el FD3S acelera algo más y tiene más punta. |
| Potencia | Skyline GT-R BNR32, Supra JZA80 | Mayor aceleración y punta; necesitan frenar antes. El Supra tiene más empuje y el GT-R conserva un poco más de agarre. |

Las barras del garaje muestran **aceleración, curvas y velocidad punta**, con puntuaciones calculadas desde los parámetros de la simulación. El perfil y su compromiso se indican junto a las especificaciones. Los CV y el peso son referencias del modelo; los parámetros de conducción se ajustan para el balance arcade y no pretenden reproducir prestaciones de serie. En pantallas estrechas, desliza la lista de coches para ver los siete; se conserva el desplazamiento al elegir. La selección individual se guarda localmente. El selector online ofrece los mismos siete coches y el servidor usa los mismos parámetros.

El balance de los tres originales también sigue estos perfiles: el AE86 tiene más agarre que el FD3S, y el BNR32 cambia agarre por aceleración y punta. Los rivales especiales conservan sus ajustes y ritmo calibrado por mapa. Este balance inaugura la tabla de mejores tiempos **v5** para comparar marcas con la misma física.

| Curso | Rival | Máquina |
| --- | --- | --- |
| Akina | Takumi Fujiwara | Sprinter Trueno AE86 |
| Akagi | Keisuke Takahashi | RX-7 FD3S |
| Irohazaka | Kai Kogashiwa | MR2 SW20 |
| Usui | Mako y Sayuki | SilEighty RPS13 |
| Tsukuba Fruits Line | God Hand / Toshiya Joshima | S2000 AP1 |
| Tsubaki Line | Shinji Inui | Trueno AE86 de dos puertas |
| Atami Ghost | Kanata Katagiri | Toyota 86 GT ZN6 |

Los rivales conducen con el mismo modelo físico de agarre, giro, aceleración y frenado que el jugador. Anticipan la curva, frenan antes de entrar, maniobran sobre una trazada y recuperan velocidad al salir; las luces de freno muestran sus frenadas. La lluvia también les reduce el agarre. Los tres niveles modifican su margen de seguridad y su ataque en rectas. Su ritmo base se calibra por recorrido, sin acelerar para alcanzar al jugador ni avanzar por un reloj prefijado. El nivel normal deja algo más de margen para recuperarse de errores pequeños.

## Curvas, retrovisor y conducción nocturna

Una curva rápida y limpia intensifica progresivamente **CLEAN LINE → APEX FLOW → FUJIWARA ZONE**. El sistema compara la velocidad con el agarre y la curvatura reales; también considera la posición en la pista y el deslizamiento. Una entrada pasada de velocidad, ir muy despacio, golpear o avanzar en recta no da el mismo premio. El aura azul/violeta y las líneas de velocidad quedan en los bordes para conservar la lectura del vértice. Al salir se muestra una valoración, los puntos y la cadena de curvas. Los impactos rompen la cadena. La puntuación es visual: no concede un aumento artificial de potencia. Los sonidos de recompensa usan el volumen de efectos/motor y funcionan también con canciones de songs/.

La opción **Vibración y estelas de velocidad** desactiva también las estelas; se respeta la preferencia del sistema de reducir movimiento. La barra, las valoraciones y los puntos siguen disponibles.

El retrovisor interior muestra otra cámara 3D orientada hacia atrás desde el coche: carretera, pendiente y posición real del rival, con inversión horizontal como en un espejo. Se actualiza a 24 Hz, o a 16 Hz con la calidad baja, para limitar el coste de una segunda vista.

Los faros arrancan encendidos en cada carrera. Pulsa **H**, el botón **FAROS** en pantalla o **X** en el mando para alternarlos. De noche, la luz sigue la orientación del coche y alumbra el asfalto y el entorno próximo. Sin faros quedan referencias tenues del guardarraíl: memorizar la trazada resulta necesario. Los faros del rival también iluminan su entorno. De día el trazado conserva su visibilidad normal.

**Blind attack:** de noche, acercarte con los faros apagados evita que el rival use tus luces como referencia para cubrir tu línea. Un acercamiento sostenido y un adelantamiento limpio a oscuras otorgan una recompensa especial. Los golpes, volver a encender los faros o perder contacto con el rival cancelan la preparación. No reduce el agarre del rival ni te da velocidad extra.

## Actualización de conducción y geometría

La aceleración en recta conserva su respuesta arcade. La orientación del coche y la dirección de su velocidad se calculan por separado de la carretera: el coche ya no sigue automáticamente sus curvas. La dirección está limitada por un presupuesto de fuerza lateral; acelerar a fondo reduce ese margen y el asfalto mojado lo reduce aún más. El exceso de velocidad produce subviraje, apertura de la trayectoria y sonido de neumáticos. El HUD avisa con **UNDERSTEER / TOO FAST**.

El derrape se inicia con transferencia de carga al frenar girando o con el freno de mano. Girar por sí solo ya no activa automáticamente la ayuda de derrape. Un toque libera la zaga y aumenta la rotación de la carrocería; mantener el freno de mano sacrifica velocidad y agarre. Los mejores tiempos usan una nueva tabla local de esta versión de la física; las marcas antiguas se conservan en el almacenamiento anterior.

Las montañas del horizonte se dibujan como fondo sin escribir profundidad. Se eliminaron las laderas de 100 metros que podían cruzar otra curva. Cada colina, árbol, edificio y referencia de paisaje comprueba su huella contra todos los segmentos del recorrido; se mantiene libre un corredor alrededor de la carretera, incluidas horquillas cercanas.

## Referencias y alcance visual

Los trazados y cabinas son aproximaciones arcade originales construidas para este motor: sectores reconocibles, proporciones y rasgos de los coches, con geometría simplificada. Atami es una etapa especial de una vuelta de 13,7 km. Las cabinas se dibujan sobre la vista 3D y tienen instrumental reactivo.

- [Cursos oficiales de Arcade Stage 8 / SEGA](https://initiald.sega.com/sp_touge.html): longitudes y categorías de los seis cursos de Initial D.
- [Personajes de Gunma / SEGA](https://initiald.sega.jp/inid8/sp_chara_gunma.html), [Ibaraki / SEGA](https://initiald.sega.jp/inid8/sp_chara_ibaraki.html), [Kanagawa / SEGA](https://initiald.sega.jp/inid8/sp_chara_kanagawa.html): rivales, equipos y especialidades.
- [Kanata y el Toyota 86 / MF Ghost oficial](https://mfg-anime.com/en/news/detail.php?id=1099514), [Atami Ghost / MF Ghost Wiki](https://mfghost.fandom.com/wiki/Atami_Ghost): referencia para el encuentro especial.
- [Sprinter Trueno / Toyota](https://www.toyota.co.jp/jpn/company/history/75years/vehicle_lineage/car/id60009032/index.html), [RX-7 / Mazda](https://www.mazdausa.com/discover/rx-7-heaven), [Nissan Heritage](https://www.nissan-global.com/EN/HERITAGE/): historia y rasgos de los coches.
- Referencias fotográficas de cabina: [AE86](https://www.sbtjapan.com/used-cars/DXJ5442), [FD3S](https://www.carsensor.net/contents/market/category_1491/_68530.html), [R32](https://www.gqjapan.jp/cars/gallery/20210811-nissan-r32-skyline). No se han incorporado fotografías externas al juego.
- Referencias de los nuevos modelos: [MR2 SW20 / Toyota](https://www.toyota-global.com/company/history_of_toyota/75years/vehicle_lineage/car/id60000728/index.html), [S2000 / Honda](https://www.honda.co.jp/factbook/auto/s2000/199904/005.html), [Silvia K’s S13 / Nissan Heritage](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/silvia_ks.html), [Supra RZ / Toyota](https://global.toyota/en/detail/7868203). Carrocerías e interiores son aproximaciones geométricas originales.

## Verificación

`npm run check` comprueba la sintaxis de todos los módulos. `npm test` verifica la simulación y el servidor: carrera completa, dirección, frenado, transmisión, colisiones, música, audio por rangos y rutas protegidas. También comprueba los siete rivales, la independencia de su ritmo base, sus frenadas y giros físicos, finales de duelo, comparación con vueltas competitivas, corredor libre de obstáculos y ausencia de cruces entre segmentos lejanos. Las pruebas de conducción verifican que el coche mantenga su orientación mundial sin seguir automáticamente el trazado, que entrar pasado de velocidad cause subviraje, que una entrada frenada sea limpia, que el toque de freno de mano rote el coche y que mantenerlo pierda velocidad. En los siete cursos una vuelta con frenadas planificadas supera a la estrategia de acelerar siempre, incluso usando dirección correctiva. Además se verifican las intensidades de curva, cadenas limpias, ausencia de ventajas físicas por efectos/faros, adelantamientos a oscuras y orientación de la cámara del retrovisor. La suite online agrega cuatro clientes WebSocket reales, límite de cupos, permisos del anfitrión, estados listo, cierre de admisión, controles falsificados, contactos, desconexiones, carreras completas y revancha. Ejecuta `npm ci` antes de las pruebas en una copia nueva.

Para inspeccionar los componentes visuales de forma repetible, abre http://127.0.0.1:4173/tests/visual.html: usa una curva obtenida mediante la simulación real, con controles de pausa, día/noche, faros y efectos, y un rival colocado detrás para comprobar el espejo.

Las pruebas de recuperación comprueban ambos muros con los siete coches a distintas velocidades, salida del contacto, penalización y conservación de avance/reloj al centrar. Las de concentración verifican carga mediante conducción real, límites, duración proporcional, consumo, mejoras físicas, cancelación por golpes y reposicionamiento, así como validación de ambas acciones en el servidor y corrección de posición en el cliente. El visor visual incluye botones para activar la concentración y centrar a 0 km/h.

Las pruebas de garaje verifican siete geometrías distintas y sus variantes online, giro real a igual velocidad, aceleración y punta entre los tres perfiles, y vueltas limpias de los siete coches en los siete cursos y en Irohazaka mojado. Se comprueba la admisión y la física de cada coche en el servidor; la prueba con cuatro WebSockets reales usa Supra, MR2, S2000 y Silvia.

Estructura: `js/sim.mjs` contiene la simulación; `js/courses.mjs`, cursos y rivales; `js/scenery.mjs`, el corredor espacial; `js/renderer.js`, el motor WebGL; `js/cockpit.js`, las siete cabinas; `js/skill.mjs` y `js/effects.js`, valoración y efectos de curva; `js/focus.mjs`, carga y duración de Superconcentración; `js/game.js`, interfaz, audio y controles; `server.mjs`, el servidor HTTP y la exploración de canciones; `server/online.mjs`, las salas y simulación autoritativa; `js/online.js`, conexión, lobby e interpolación de jugadores.
