# Plan de lanzamiento 1.0 · Touge After Hours

Actualizado el 13 de noviembre de 2026. Alcance de la 1.0 organizado a partir de la solicitud de lanzamiento y su ampliación de trayectos. La selección de idioma español o inglés queda para una actualización posterior.

El pedido de lanzamiento se conserva íntegro en [Prompt version 1](Prompt%20version%201.md). Este plan incorpora las aclaraciones posteriores.

| Fase | Entrega | Dependencia principal |
| --- | --- | --- |
| 0 | Preparación de datos, partidas y prueba de conexión | Versión actual del juego |
| 1 | Inicio, cuentas, licencia, menú y Opciones | Migración de cuentas definida |
| 2 | Dos mundos, eventos, recursos y NG+ | Modelo de progreso y formatos de recursos definidos |
| 3 | Trayectos, IA, carrera y resultados | Modelo de eventos y formato de carrera de la fase 2 |
| 4 | Concesionaria, Miscelánea, garaje, coleccionables y economía | Catálogo e inventario compartidos, recompensas verificadas |
| 5 | Partidas públicas y privadas, Ranked y temporadas | Prueba de conexión, formato de carrera y economía |
| 6 | Validación integral y candidato de lanzamiento | Fases anteriores completadas |

## Fase 0 · Datos y pruebas de viabilidad

- Partir de la campaña, la licencia, los modelos y las mejoras existentes. Definir identificadores estables para mundo, región o etapa, evento, vuelta, intento, recompensa y ciclo de campaña. Preparar una migración de progreso en una copia de datos y comprobarla tanto en SQLite como en MongoDB Atlas. Las victorias de eventos que se conserven se identifican por su clave anterior. Los eventos nuevos quedan pendientes y el historial, la licencia, los coches, sus mejoras y las compras se conservan.
- El servidor actual ya ejecuta la física y arbitra cada carrera por WebSocket. El anfitrión de la sala administra la configuración y la salida. La primera intervención reduce el envío de estados de posición obsoletos y dibuja los rivales según el tiempo de la simulación para suavizar entregas irregulares.
- Comparar esa base con una conexión directa por WebRTC usando dos a cuatro jugadores de distintas redes. Medir RTT mediano y p95, fluctuación, pérdida, pausas visuales y frecuencia de uso de relé TURN. Probar también un servidor dedicado en la región más cercana a los jugadores. Si se usa anfitrión jugador, medir cada enlace entre pares al preparar la salida, incluidas salas públicas, y elegir al que obtenga el menor RTT p95 con su peor enlace. Si hace falta relé o los enlaces son inestables, elegir la ruta que salga mejor en las pruebas. [WebRTC](https://www.w3.org/TR/webrtc/) · [Transporte e ICE](https://www.rfc-editor.org/rfc/rfc8835) · [Regiones de Render](https://render.com/docs/regions)
- Mantener en servidor la validación de resultados, premios y clasificación en Ranked. Evaluar el anfitrión jugador primero en salas casuales. Cubrir salida del anfitrión, reconexión, resultados repetidos y carreras de hasta cuatro participantes. El formato compartido debe representar también a los rivales de IA de MF Ghost.

### Avance de la fase 0

- Se verificó una sala WebSocket local con cuatro clientes. Los cuatro condujeron, publicaron sus posiciones y recibieron el reposicionamiento confirmado por el servidor. En simulación, los rivales conservaron una velocidad visual uniforme con paquetes de posición recibidos en ráfagas.
- Un canal WebRTC directo entre dos pares de Edge en el mismo equipo devolvió 60 de 60 mensajes sin retransmisiones configuradas. Esta prueba comprueba que el canal abre y transmite. Queda pendiente medir carreras con la misma carga entre redes distintas, incluidas Wi-Fi y red móvil, con rutas directas y con TURN.
- La sala tiene un «Diagnóstico de conexión» voluntario. Los pilotos lo ejecutan al mismo tiempo antes de arrancar. Compara el RTT mediano y p95 y las respuestas recibidas de Render por WebSocket y de cada piloto por un canal WebRTC directo. Sirve para medir redes reales tras desplegar. Si una conexión directa falla, la carrera sigue disponible mediante Render. Este diagnóstico usa STUN y deja para la prueba de transporte de carrera la evaluación de TURN, la carga real y la migración del anfitrión.
- Dos mediciones de Render frente al enlace con Rose favorecieron la conexión directa. En la segunda, Render obtuvo 116 ms de mediana y 119 ms de p95, y el enlace directo 64 ms y 75 ms, con 30/30 respuestas en ambos. Las salas intentan WebRTC automáticamente. Si todos los navegadores lo admiten, el servidor elige al anfitrión con el mejor p95 en su enlace más lento. Si no hay un candidato, la carrera arranca por servidor. Si se pierde el enlace durante la carrera, vuelve a la sala. Los resultados de carrera directa se muestran al terminar y no generan registros ni premios persistentes.
- La prueba local en Edge confirmó la elección de anfitrión, la aceleración del invitado, el reposicionamiento por el canal fiable y la vuelta a la sala al cerrar el navegador anfitrión. Se aisló el dibujo de cuadros para medir el transporte. Falta probar la versión publicada con el renderizado habitual, dos a cuatro jugadores y redes distintas.
- La prueba en el despliegue confirmó el cambio de jugabilidad y se decidió conservar WebRTC para las carreras online, incluidas Ranked. Después de iniciar, una pantalla común muestra el trazado, las condiciones y el estado de carga por piloto. La cuenta regresiva espera la confirmación de todos. Una desconexión, una cancelación confirmada o el plazo agotado devuelven a los pilotos a la sala sin registrar la carrera.
- SQLite y MongoDB representan el progreso actual con claves de victoria como `takumi-initial`, `rain:takumi-initial` y `ngplus:takumi-initial`. Guardan por separado las lecturas de prólogos y epílogos. La migración necesita una correspondencia explícita entre las claves existentes y los nuevos eventos. Los duelos que se sustituyen por carreras múltiples requieren una regla antes de acreditar progreso. El historial, los premios ya cobrados y las técnicas obtenidas se deben preservar en ambos motores.

## Fase 1 · Inicio, licencia y Opciones

- La pantalla de título muestra el nombre y «Pulsa cualquier botón». El registro pide correo, nombre de usuario y contraseña. El acceso usa correo y contraseña. Una cuenta anterior puede acceder con su usuario y vincular un correo único con su contraseña actual. SQLite y MongoDB aplican la unicidad. Se comprueba el formato del correo y se mantienen los límites de altas e intentos. La existencia del buzón y su titularidad quedan sin verificar.
- Implementado el flujo de primera licencia con una sola elección de coche inicial, avatar o foto y bienvenida tras guardar. La bienvenida permite ir a Opciones y presenta las mejoras o la compra de otro coche como parte de la progresión. El coche de uso habitual se elige desde el garaje. La licencia habitual prescinde del selector de coche y del acceso a la tienda.
- La licencia muestra la superconcentración seleccionada y permite consultar sus características y requisitos. Los modales de ropa, cabello, ojos, labios, accesorios y maquillaje muestran la selección actual, ofrecen colores donde corresponda y solo dejan equipar artículos del inventario compatibles con la base.
- La licencia principal gana tamaño y el editor incorpora un carrusel de fondos para foto y avatar. El perfil guarda el identificador. Los fondos se cargan de `assets/license-backgrounds/`, como PNG o WebP de **512 × 512 px** numerados, según el README de la carpeta.
- El menú muestra el coche del jugador junto al AE86 3D de exhibición, un indicador de dinero, Tienda debajo de Garaje, iconos para las acciones y pantalla completa. La cabecera común usa «Volver» y «Menú principal».
- Opciones ya es una pantalla con cuatro categorías. **Gráficos** incluye resolución, calidad automática, monitor FPS y solicitud de pantalla completa al acceder. Cuando el navegador pide una acción del usuario, se puede activar manualmente. **Controles** incluye transmisión, remapeo de teclado en PC, diseño táctil en móvil y configuración del mando al detectarlo. En móvil, conectar y activar el mando oculta los controles táctiles y desactivarlo los recupera. **Gameplay y visual** incluye cámara, movimiento y campo de visión del interior, manos con guantes, horizonte estable y tamaño del minimapa. **Sonido** incluye volúmenes, banda sonora, vibración y estelas. La hora y el asfalto se eligen en Time Attack o al configurar una sala online.

## Fase 2 · Mundos, progresión y recursos de campaña

Los destinos tienen un submapa navegable después de «Viajar». Cada uno conecta sus eventos en orden, con un desvío hacia el cofre donde corresponde. Cada destino de Initial D cierra con una Time Trial. Las tres etapas de MF Ghost abren con una clasificación y usan las parrillas del inventario de esta fase. Asfalto mojado y niebla se mantienen en todo Ashinoko.

- Entrada a campaña con dos botones ilustrados, **Mundo Initial D** y **Mundo MF Ghost**. Cada mundo tiene su propio minimapa. Initial D mantiene regiones y es el único con selector de temporada. MF Ghost se organiza por etapas con clima definido por evento. La imagen, descripción acotada y botón «Viajar» aparecen en el panel lateral al elegir un destino. La fuente indicada para los minimapas es `assets/campaing_miniworld/`.
- «Viajar» abre el submundo. En la primera visita se muestra el prólogo del destino y, al terminar el último evento del mundo, se muestra su epílogo. Los accesos para volver a verlos quedan en el submundo correspondiente. Los eventos se muestran como nodos circulares con iconos de contrarreloj, duelo, carrera múltiple o cofre.
- Initial D conserva duelos 1 contra 1 y cierra cada región con una **Time Trial** y una marca mínima de clasificación. Cada etapa de MF Ghost comienza con su **Time Trial** y admite carreras múltiples además de duelos. Los umbrales de clasificación se calibran en la fase 3.
- Repartir cofres desbloqueables por el mapa. Otorgan cosméticos, música o superconcentraciones. Las técnicas pasan a obtenerse al abrir sus cofres. La migración conserva las que ya posee cada licencia y registra la apertura de forma que un premio se cobre una sola vez.
- Antes de cada carrera, mostrar participantes, retratos, coches y selector musical por carrusel. La lista personalizada admite hasta siete canciones disponibles para el jugador. La canción del evento sigue siendo la opción por defecto, para un máximo de ocho opciones.
- **Comenzar NG+** se habilita al completar ambos mundos y vencer a Kanata en el evento final. El modal anticipa el nuevo ciclo de etapas, la dificultad aumentada y las mayores recompensas. El ciclo de NG+ conserva el equipamiento de la cuenta y el requisito de coche de competición al máximo de la versión actual. Al completarlo se marca el final de campaña. La temporada lluviosa de Initial D es una revancha opcional, disponible al terminar su campaña inicial.
- La estructura de recursos por etapa y evento continúa en `campaign_files/`. Cada etapa nueva tendrá portada y descripción. Cada evento tendrá sus recursos de retrato, cómics y música, y cada cofre su referencia de recompensa. Mantener compatibles las carpetas actuales de prólogo, epílogo, música narrativa y sonidos de página.

### Mundo Initial D · Inventario de trayectos

Akina, Akagi, Irohazaka, Usui, Tsukuba y Tsubaki Line conservan sus trayectos. Los diez siguientes se integran en el atlas con dos duelos y una Time Trial por destino. La tabla conserva el orden relativo de la solicitud. Keisuke en Enna conduce con estilo Balance.

| Trayecto nuevo | Duelo 1 | Duelo 2 | Carpeta de referencia bajo `Intiial D/` |
| --- | --- | --- | --- |
| Myogi | Shingo · Balance · Honda Civic SiR-II (EG6) | Takeshi Nakazato · Grip · Nissan Skyline GT-R V-Spec II (BNR32) | `Myogi/` |
| Momiji Line | Toru · Skiller · Eunos Roadster (NA6CE) | Atsuro Kawai · Grip · Nissan Skyline 25GT Turbo (ER34) | `Momiji Line/` |
| Nanamagari | Ikeda Ryuji · Balance · Nissan Fairlady Z Version S (Z33) | Hiroya Okuyama · Balance · Nissan Silvia Spec-R (S15) | `Nanamagari/` |
| Nagao | Hideo Minagawa · Balance · Toyota Supra RZ (JZA80) | Kai Kogashiwa · Balance · Toyota MR-S S-Edition (ZZW30) | `Nagao/` |
| Happogahara | Ninomiya Daiki · Skiller · Honda Civic Type R (EK9) | Smiley Sakai · Grip · Honda Integra Type R (DC2) | `Hapogahara/` |
| Sadamine | Nobuhiko Akiyama · Grip · Toyota Altezza RS200 Z Edition (SXE10) | Iwase Kyōko · Balance · Mazda ɛ̃fini RX-7 Type R (FD3S) | `Sadamine/` |
| Hakone Turnpike | Rin Hojo · Grip · Nissan Skyline GT-R V-Spec II (BNR32) | Ryosuke Takahashi · Balance · Mazda RX-7 FC3S preparado | `Turnpike/` |
| Enna Skyline | Tomoyuki Tachi · Balance · Todo School Spoon Civic Type R Demo Car (EK9) | Keisuke Takahashi · mitad del arco Project D · Mazda RX-7 (FD3S), estilo por confirmar | `Enna_Skyline_TodoSchool/` |
| Tsuchisaka | Aikawa · Grip · Mitsubishi Lancer Evolution V GSR (CP9A) | Ichijo · Balance · Mitsubishi Lancer Evolution VI GSR Tommi Makinen Edition (CP9A) | `Tsuchisaka/` |
| Yabitsu | Kobayakawa · Grip · Mitsubishi Lancer Evolution VII GSR (CT9A) | Satoshi Omiya · Skiller · Mazda Roadster RS (NB8C) | `Yabitsu/` |

Las referencias recibidas están en `assets/Assets nuevos y campañas y trayectos nuevos/Intiial D/`. Los nombres de carpeta de la tabla reflejan el disco. Myogi va después de Akina y antes de Akagi según el orden solicitado. Momiji Line y los demás trayectos nuevos siguen después de Tsubaki Line. La asignación final de regiones, cofre y Time Trial se hará al montar el minimapa.

### Mundo MF Ghost · Secuencia de eventos

Los tres trayectos base ya existen. La ampliación cambia la secuencia de eventos y añade salidas múltiples y vueltas por evento.

| Etapa | Orden de eventos |
| --- | --- |
| Odawara Pikes Peak | 1. Time Trial. 2. Carrera múltiple contra Nozomi y Kakeru, dos vueltas. 3. Duelo 1 contra 1 con Jackson Taylor. |
| Lake Ashinoko GT | Lluvia y niebla durante toda la etapa. 1. Time Trial. 2. Carrera múltiple contra Jackson Taylor, Yanagida e Ishigami, dos vueltas. 3. Evento especial con Akaba en duelo 1 contra 1. |
| Peninsula Manazuru | 1. Time Trial. 2. Carrera múltiple contra Ohtani, Sakamoto y Maezono. 3. Carrera múltiple contra Moroboshi, Ishigami y Akaba. 4. Carrera final múltiple contra Sawatari, Beckenbauer y Kanata. 5. Evento final especial de Kanata, conservando el duelo existente. |

- Yanagida conserva su carrera de Ashinoko. La segunda carrera múltiple de Manazuru queda en cuatro coches contando al jugador.
- Manazuru usa una vuelta por evento. Los coches de los invitados son BMW M6 F13 en Ashinoko, Porsche 911 GT3 y Mercedes-AMG GT R. [BMW M6 en MF Ghost](https://initiald.bestcarweb.jp/mf-ghost/3846?prd=2) · [Porsche 911 GT3](https://initiald.bestcarweb.jp/mf-ghost/2915) · [Mercedes-AMG GT R](https://initiald.bestcarweb.jp/mf-ghost/3794?prd=2)

## Fase 3 · Trayectos, desafío y presentación de carrera

Los diez nuevos trazados están en el atlas, Time Attack y online. Se conservan las longitudes de las hojas con escala. Enna usa una estimación de 5,51 km con sectores aproximados. El desnivel y el peralte visual de los diez cursos son estimaciones de juego. Se añadieron 19 variantes externas con dos LOD y perfiles de cabina. Los rivales con retrato suministrado o ya existente lo reutilizan, y los demás muestran iniciales en carrera y la imagen del trayecto en la ficha. El ritmo se calibró con conducción de referencia en seco, lluvia y NG+. El ajuste final de marcas queda sujeto a pruebas humanas.

- Construir cada trayecto nuevo desde sus mapas y fotos, con el método de trazado usado para los circuitos actuales. Verificar punto de salida, sentido, ancho, horquillas, desnivel, peralte visual, cruce de caminos y continuidad. Añadir paisaje y señalización a partir de las referencias disponibles. Preparar coches nuevos o variantes que exige el inventario de rivales y reutilizar los vehículos existentes que ya correspondan.
- Ajustar el desafío por rival y curso, en particular velocidad de paso por curva, pérdida de tiempo al frenar y recuperación al salir. Mantener Grip, Balance y Skiller distinguibles. Probar vueltas comparables con distintos coches, uso temprano y tardío de superconcentración, salida de la trazada ideal y tráfico. El objetivo es que un buen tiempo y el momento de usar la técnica importen para ganar, con dificultad escalonada por rival y ciclo.
- Antes de la cuenta regresiva, panorámica tipo dron con participantes, coches, trayecto, hora y condiciones. En carrera, avatar propio arriba a la izquierda, rivales arriba a la derecha, nombre encima del retrato, coche debajo y posición en su lugar actual. El indicador de curva aparece debajo del avatar propio. La superconcentración carga el borde del avatar y al activarse lo rodea un aura animada del color seleccionado, en todos los modos.
- Quitar avisos de horquilla, frenada y golpe de guardrail. El golpe conserva un sonido breve y suave. Mantener Drift y Apex Mastery, ocultar su texto cuando no hay actividad y cambiar «Fujiwara Zone» a «Apex Flow». Retirar los botones de centrar, faros, pausa y cámara del HUD general. En PC siguen disponibles según el remapeo, y en móvil pueden añadirse en el editor táctil. La vista de cámara se selecciona en Opciones.
- Rediseñar resultados y renombrar «Reintentar descenso» a «Reintentar». Mientras la carrera requiera guardado, mostrar su estado y bloquear las acciones que cambien de pantalla o arranquen otra carrera. Si falla el guardado, ofrecer reintento del mismo resultado. Desbloquear las acciones normales tras confirmar el registro.

## Fase 4 · Tienda, garaje, economía y coleccionables

- Tienda con dos accesos centrales, **Concesionaria** y **Miscelánea**. En Concesionaria, auto 3D al centro, nombre y descripción a la izquierda, estadísticas base a la derecha y carrusel inferior con selector de época. Los coches Initial D se venden desde el principio y los de MF Ghost se habilitan al acceder a ese mundo. Miscelánea tiene ambientación propia y muestra cosméticos compatibles con la base elegida en la licencia.
- Garaje en interior con herramientas y coche al centro. Conservar carrusel de coches propios y «Elegir máquina». Hacer visible «Mejorar» con icono debajo del coche y conservar el flujo de compra y aplicación de mejoras.
- Ajustar precios por prestaciones y por ingresos reales en campaña, Time Attack y online. Usar **5.000, 9.000 y 15.000** monedas como referencias para coches deseables, sujetas a comprobar cuánto tarda en financiarse cada salto de preparación. Añadir un bono pequeño de monedas por puntuación de conducción en esos tres modos y reducir la puntuación con los choques. Validar premios y compras en servidor, incluidos reintentos del resultado, carreras muy cortas y progreso hacia la preparación de NG+.
- Añadir **Coleccionables** al menú principal. Visor 3D con rotación y zoom para coches propios y galería de cartas con título, imagen, descripción desplazable y marcos común gris, raro azul, especial morado y legendario dorado. En `assets/cards/`, formato propuesto `001.json` más su imagen, con campos `id`, `title`, `tier`, `description` e `image`. Conservar la numeración y admitir los valores `common`, `rare`, `special`, `legendary`. Documentar el formato al implementar el cargador.
- Cofre de cartas en tienda con varias cartas por apertura y probabilidades por rareza. El servidor valida el pago y guarda el contenido que salió para que un reintento no descuente ni entregue dos veces. Cantidad por cofre, precio, probabilidades y tratamiento de duplicados quedan para el balance. Se puede equipar una carta favorita en la licencia. La vista pública de un piloto expone nombre, récords y la carta favorita al pulsar su licencia. Los artículos de llaves doradas son cosméticos exclusivos.

## Fase 5 · Online y Ranked

- Entrada con **Ranked** y **Partidas públicas**. En públicas, separar «Entrar a una partida» de «Crear partida». El listado oculta carreras iniciadas hasta que la sala vuelve a estar disponible y ofrece un botón superior «Ingresar a sala privada» con modal de código. Crear sala reúne circuito, hora, asfalto, visibilidad y preparación de participantes.
- Usar el mismo transporte WebRTC de carrera en públicas, privadas y Ranked. Elegir al anfitrión automáticamente al preparar la salida. En Ranked, reproducir en el servidor los controles ordenados por paso de simulación, conservar evidencia de cada piloto y acreditar puestos y premios solo tras verificar la carrera. Antes de abrir Ranked, comprobar divergencias y resultados manipulados, y que una conexión inviable permita reintentar el emparejamiento. Mostrar la panorámica de campaña antes de la salida y repetir las pruebas con dos a cuatro participantes, redes mixtas y pérdida del anfitrión.
- Ranked empareja a jugadores para carreras aleatorias verificadas, concede monedas y actualiza la clasificación. Temporadas de **30 días**. Al cierre, el **30 % superior** recibe llaves doradas, el **50 % intermedio** recibe **3.000 monedas** y el **20 % restante** recibe **1.000 monedas**. Definir cantidad de llaves, elegibilidad, desempates y redondeo de tramos antes de abrir temporada. El cierre y la entrega se prueban con fechas simuladas, reintentos y reinicios del servidor.

## Fase 6 · Criterios de lanzamiento

- Completar el flujo desde alta y bienvenida hasta una carrera guardada, y probar perfiles anteriores en SQLite y Atlas. Verificar licencia, fondos, prendas, carta favorita, moneda y propiedad después de cerrar y volver a abrir sesión.
- Recorrer los dos mundos con sus prólogos, Time Trials, duelos, múltiples, cofres y epílogos. Comprobar que el inicio y cierre de NG+ funcionen una vez, y que el equipo requerido siga siendo alcanzable con la nueva economía.
- Validar teclado, móvil táctil y mando, ventanas pequeñas, visor 3D, HUD y panorámica con más de dos coches. Medir estabilidad de cuadros en los circuitos nuevos y tiempo de carga de los catálogos.
- Comprobar sala pública, invitación privada, matchmaking, selección de anfitrión, resultados y recompensas de temporada con varias conexiones. Guardar evidencias de las pruebas, verificar copia y restauración de datos, y preparar el candidato 1.0 en un entorno de prueba antes de publicar.
