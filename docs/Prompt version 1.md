PREPARAR PARA VERSION DE LANZAMIENTO 1.0


Bueno ya he jugado al juego y tengo algunos ajustes para hacer, para nuestro lanzamiento V1.
Primero
Detalles interfaz, en la pantalla incial al abrir el juego que solo se muestre el nombre del juego y el "pulsa cualquier boton"
Para evitar que un usuario cree cuentas masivamente, podriamos hacerlo por login por correo (no hara falta hacer verificacion digamos, solo que exista ese correo y sea valido) y luego su nombre de usuario y contraseña?

Luego en la licencia quitar el coche predeterminado, la eleccion del coche inicial, programa que ocurra solo al momento de crearse una cuenta por primera vez, la eleccion de super concentracion se mantiene pero cambia su estilo a superconcentracion seleccionada: "nombre" al lado un boton "Seleccionar super concentracion" que abre un modal y muestra las opciones con sus caracteristicas.
Ese boton para ir a la tienda igual quitar.
Luego para el cambio de aspecto de la tarjeta mantener la opcion de Crear avatar o usar foto Pero en los selectores para Ropa usar un boton Cambiar ropa que lleva a un modal donde se puede ver la ropa seleccionada actual y el color a un lado, al pulsar en cambiar ropa se abre como un visualizador de ropas donde podremos ver las ropas que poseemos y seleccionarlas.
Implementar esta logica de visualizacion y de personalizacion mejorada para los que veas convenientes, pues agregaremos masivamente cosmeticos, bases, etc a futuro.

Ajustes en interfaz principal
El cuadro de la licencia de piloto que sea mas grande y llamativa, tambien agrega un formato para que en la licencia al personalizar podamos, debajo haya un boton tipo carrusel para cambiar el fondo del avatar en la licencia, y en assets dejar una carpeta donde con un formato de numeracion 001 por ejemplo y con un documento que indique las dimensiones del fondo validas, los reconozca y pueda agregar fondos.

En el fondo principal, donde esta el AE86, este nuestro coche y al lado este el modelo 3D que esta ahi.

Luego las monedas que posee el jugador no sean el boton para ir a la tienda sino solo un mostrador DINERO y las monedas ahi.

Luego la tienda estara debajo del boton GARAGE.

Mejora botones principales
Actualmente el boton jugar es el unico que tiene como un > ahi, agrega logos representativos para cada uno de los botones como esta ahorita el jugar, el jugar puede ser una bandera de carrera.

Mejora del menu opciones.
Que no sea un simple modal, sino como en un juego de verdad un menu completo&#x20;
Separa configuraciones de&#x20;
Graficos->Resolucion, boton activar/descativar calidad automatica, monitor de fps, boton activar pantalla completa automatica(se coloca pantalla completa al iniciar sesion en la cuetna)
Controles->Hacer rediseño y cambia segun si estamos en pc/telefonos, para pc seleccion de transmision y remapeo de controles generales y tambien para moviles del mismo modo, adicionalmente si en caso se detectase un mando, se activa un boton configurar mando y activar/desactivar mando, si se activa en movil, se desactivan los botones tactiles.
Gameplay y visual->Camara, Interior - movimiento del piloto, interior, campo de vision, interior manos con guantes, interior horizonte estable.
Sonido->Los ajustes de sonido que estan ya ahi, la vibracion y estelas de velocidad, la banda sonora
Ademas el cambio de hora del dia y asfalto quedan relegadas unicamente para seleccionarse en las time attack antes de iniciar una partida y tambien en la creacion y configuracion de una sala online.

Rediseño completo de campaña
Primero lo siento, pero aun me parece incorrecta e inadaptada la IA al encarar curvas de los rivales de campaña, son demasiado lentos aun, el usuario debe tener un desafio mayor, pierden mucho tiempo al encarar curvas, no la toman segun su estilo o si la toman, pero igual las toman mal o no pueden recuperar luego, no lo se al menos a mi no me parecio un desafio el pasarme el juego, que sea mas desafiante y que se sienta que al usuario le costo ganar que idee estrategias como usar las superconcentraciones en momentos adecuados y tal, eso quiero lograr.
Luego se me hizo muy largo haber dividido en Temporada seca y Temporada lluviosa, esta vez antes de entrar al modo ocurriran cosas que haran mas genial el estilo del mapa, lo mejoraremos.
Al entrar a campaña se abre un menu donde podemos elegir entre Mundo Initial D y Mundo MF Ghost donde el boton podremos colocar una imagen en cada uno y seran botones que llevaran a un mini mapa cada uno correspondiente a su etapa (dejare en assets referencias para construir estos minimapas en la carpeta campaing_miniworld) donde en Initial D estara por regiones tal como esta ahora y el cambio de temporadas solo sera para este mundo.

Luego en Mundo MF Ghost podremos colocare tambien en campaing_miniworld.

Ademas agregaremos cambios en los cada etapa (cada etapa sera cuando cambiemos de region o de etapa) En initial d seran por regiones, en mf ghost por etapas.

EN initial D habra una contrarreloj al final de cada etapa con un requisito minimo se llamaran time trials.&#x20;

En MF Ghost habra una time trial al inicio de cada etapa.
En Initial D esta bien, combates 1vs1, pero en MF Ghost agregaremos carrera multiple, donde podran participar hasta cuatro competidores en cada carrera.

El NG+ ocurrira solo al vencer ambos mundos y no sera una pestaña adicional, sino habra un boton que sera Comenzar NG+ que reiniciara todo, pero reajustara la dificultad para esa vez, una vez completado el NG+ no habra mas, habra completado toda la campaña. Al presionar el boton comenzar NG+ que se desbloquea al derrotar a Kanata, saldra un modal que advierte al jugar que se reiniciaran las etapas, con dificultad aumentada y podra ganar mas monedas!

Al ingresar a alguno sera de la siguiente manera:
Tendremos por el mini world varios botones como esta ahora pero no jugaremos ahi directamente sino que al hacer click en alguno a la derecha se vera una imagen que colocaremos por carpetas y debajo estara su descripcion con un box limitado y debajo de ese box un boton de Viajar, al puslar ese boton viajar por primera vez muestra el prologo, y al finalizar el ultimo evento de ese mundo muestra el epilogo, ambos botones para volver a ver estaran dentro del submundo generado al puslar viajar.

El sub mundo mostrara otro menu donde estaran distribuidos los eventos como circulos con su logo representativo en el centro para una time trial, batalla o incluso habra uno de cofre que al desbloquear y hacer click permitira dar al jugador algun articulo o desbloquear alguna habilidad, agrega estos variados por el mapa, que den cosmeticos, musica y en lugar de que se den las superconcentraciones al derrotar a algun rival que se den al abrir estos cofres.

En mf ghost habran los mismos pero se agregara el boton de combate multiple.

Al hacer click en una time trial o combate 1vs1 o multiple, se abre otro menu donde se vera el rostro de los rivales, sus autos y tambien el selector de musica mas visible y que represente la musica bien, que sea con un boton de desplazamiento en lugar de una lista, el jugador podra elegir y armar su lista personalizada con las canciones que quiera tendra un maximo de 7 canciones para elegir en la lista personalizada, esto estaran ademas de la cancion por defecto que ya sabemos que es para cada enfrentamiento (en total en enfrentamientos podra elegir 8).

Agregar mas mapas y la modificacion de etapas.
Se agregaran mas mapas y etapas para hacer mas completo el juego, dejare los assets y sus imagenes de los trayectos y armar del mismo modo que se armo antes los dejare en assets/nuevas_etapas las imagenes referencia y se agregaran:
Para cada uno que se cree crea sus carpetas de assets de foto, comics, musica, recompensa_cofre, como ya estan los otros.
{etapa: {eventos: {}}}

Cambio en tienda
Al entrar a la tienda que haya dos botones centrales:
Concecionaria y Miscelanea donde en concecionaria estaran repartidos los autos y en miscelanea los demas.

Al entrar a la concecionaria nos lleva a un menu o apartado donde en el centro podremos ver bien el auto y debajo de ese auto estara un selector por epoca. Los initial D estaran desbloqueados desde el principio y los MFG desde que llegamos a desbloquear el mundo MF Ghost, en el centro estara el auto y debajo al seleccionar una epoca podremos ver en una lista desplazable y con botones tipo carrusel los autos disponibles (esta lista estara debajo para poder ver arriba los autos bien y en la derecha sus stats base y en la izquierda y su nombre y una descricpion del auto)

Los assets de miscelanea sera una imagen de fondo de una tienda de cosas generales y ahi podremos comprar cosas, aunque los articulos se muestran segun el genero que hemos elegido en la licencia.

Replantear economia, considera las capaciadades de los autos y ajusta los precios en funcion del calculo que se gane en la campaña y en el online.

reajustar recompensas
Agregar a las recompensas de monedas en campañas, time attack y online unos bonificadores muy ligeros que motiven al usuario y multiplican muy muy poquito, bonifican, la ganancia de monedas en funcion del puntaje de conduccion que ya tenemos, para que motive al jugar a conducir mejor, cada choque le baja la puntuacion.

Esos botones de arriba del todo quitarlos, solo deja un back para volver atras y otro de un menu para volver al menu principal.

El garage
El garage esta bien como esta ahora pero en lugar de ser ahi nomas en la montaña, crearas unos assets de un cuarto de un garage donde habran diferentes herramientas, etc de un garage y en el centro nuestro auto, debajo los autos que poseemos y lo mantienes como esta pero el boton mejorar debajo del auto en el centro y lo haces mas llamativo con un logo tambien, el boton ELEGIR MAQUINA se queda donde esta.


Remover texto innecesario en gameplay

Al jugar, la pantalla puede verse un tanto sobrecargada.
Al iniciar una batalla antes de la cuenta regresiva se toma una panoramica que muestra a los autos y los participantes de la carrera, tipo Dron.

Se agrega un boton de ajuste del tamaño del minimapa en su apartado que le corresponde.

Remover esos avisos de Airpin / Broke, tambien de al golpear un guardrail, solo colocar un sonido que no moleste, algo ligero como un golpe a algo.

Remueve la barra de superconcentracion y el indicador del boton para usar, que sea simplemente un aura o borde de color que rodea a nuestro marco de avatar, cuando se llena se ve como si estaria lleno o completo nuestro marco y al activarse nuestro marco se rodea de un aura animado del color de nuestra superconcentracion seleccionada. Esto debe funcionar en todos los modos de juego.

Quita esos botones de centrar y apagar encender faros, de pausa, de cambio de camara, en pc deben quedar implicitos segun su configuracion que hizo y en telefonos se deben poder agregar si el usuario quiere en su mapeo, la camara la elige desde
configuraciones

El unico que me gusto fue el de apex mastery pero quita el busca el vertice por dejarlo vacio y los rangos de calificacion quita fujiwara zone por apex flow, apex algo o algo que denote que la curva fue magistral o algo asi, el  indicar de drift dejarlo como esta.

El marco de avatar del jugador propio colocar acomodado a la esquina superior izquierda, de los rivales a la derecha, el indicador de lugar o posicion me parece bien donde esta.

El indicador de toma de curva debajo del avatar propio.
Em marco de avatar sera igual, pero el nombre del individuo que este encima de su imagen, debajo de su imagen su auto, asegurate que entren bien y no este muy alargado ni nada.


Cambio en la interfaz tras terminar una carrera

Ahora mismo esta muy simple y no tiene integridad completamente.
Al terminar una carrera que no se pueda hacer otra cosa hasta que se haya registrado los datos si es que hiciera falta, luego recien que se activen los botones&#x20;
REINTENTAR DESCENSO se cambia solo por REINTENTAR


Agregar sistema de cartas de coleccion, en el menu principal tendremos un boton mas, COLECCIONABLES, donde podremos visualizar tanto nuestros autos que poseemos con un visualizador 3D rotativo y podremos hacer zoom y tal, otros articulos que seran cartas que tendran el siguiente formato programable un marco definido por rareza comun (gris comun), raro(azul), especial(morado) y legendario(dorado), tendran un titulo, una imagen en el centro y una descripcion de la carta. Estos tocaran en cofres aleatorios con una probabilidad de aparicion segun rareza en la tienda, agrega un boton para comprar un cofre de carta, al abrirlo nos tocan varias cartas, el formato para agregar cartas sera: en la carpeta assets/cards/ un archivo cambiabe de nombre que permitira reconocer un formato por ejemplo 01:title, tier(common, rare, special, legendary),description) la descripcion sera scrollable para que se mantenga la proporcion de una tarjeta, se podra vincular con la licencia para que el usuario la pueda ver al hacer click como carta favorita y al ver los perfiles de otros usuarios se puedan ver su carta favorita al hacer click en su licencia de piloto, solo eso podran ver y su nombre y sus records.

Replanteamiento y reestructuracion online
Primero la forma en la que funciona el online, ahora mismo me parece que el que hostea una partida es el servidor, pero es injugable, de nigun modo, necesitamos construir un puente que permita que algun jugador sea el anfitrion y los demas se conecten a el, se elige al que tiene mejor conexion general como anfitrion y de ese modo reduciria el lag, tiene que ser jugable, tenemos que reconstruir esto, ademas en una publica tambien que se elija como anfitrion al que mejor conexion general tenga antes de iniciar una partida, si quieres agregar un tiempo de espera o pantallas de carga para permitir regular y configurar todo antes de iniciar una carrera estara bien y antes de inciiar una carrera al igual que en campaña una camara panoramica y los nombres de los participantes y el trayecto, tiempo, condicinoes.
Para el online lo reconstruiremos, para al hacer click y entrar se abren dos opciones ranked y publica.
En ranked se podra hacer carreras aleatorias con matchmaking, donde el que tenga mejor conexion sera tomado como el anfitrion. Al ganar se gana una buena cantidad de monedas y se sube en el ranking, al finalizar una temporada (30 dias) segun el ranking los usuarios que terminen en el 30% del ranking reciben llaves doradas para comprar articulos especiales en la tienda(solo comesticos, solo se pueden comprar con estas llaves y no deben dar ventaja especial, solo exclusividad), luego los que queden en el otro 50% del medio reciben una buena cantidad de monedas decente como 3000 y el otro 20% del final recibe una cantidad de 1000 monedas nomas, ahora un buen auto debe costar un buen precio como 5000 o 9000 o 15000, precios que motiven a jugar y conseguir monedas vamos. Ya que reajustaste la economia antes.

Al hacer click en Partidas publicas se mantiene la forma pero otros subbotones de entrar a una partida, crear partida
Al entrar a partida tendremos una lista de las partidas publicas disponibles para poder entrar, las ya iniciadas desaparecen hasta que se regrese a la sala, ahi mismo para ingresar a una sala privada arriba del todo un boton grande que diga ingresar a sala privada, donde se abre un modal para insertar el codigo y un boton para unirse, el otro subboton anterior de crear partida lleva a otro menu donde podemos elegir Circuito, hora, asfalto como esta ahora pero mas especializado, bueno se mantiene como esta pero con esa arquitectura o forma de entrar.

Ah y por ultimo en el menu principal un boton con un logo que represente pantalla completa, al hacer click coloca el juego en pantalla completa.

Tambien se me olvidaba el flujo al ingresar por primera vez
Luego de crear un avatar o colocarse una foto, que el juego de un mensaje de bienvenida, donde le da la bienvenida, donde recomienda al jugador realizar ajustes iniciales en opciones y le&#x20;
sugiere que a medida que se va avanzando con el juego puede ir mejorando su vehiculo o comprar alguno mas rapido.
Esto es todo el reajuste para la version oficial 1.0 que lanzaremos, luego con tokens renovados se hara que al ingresar por primera vez se elija un idioma ya sea español o ingles y en base a eso se cambie todo, pero sera iun proceso complejo eso se hara MUUUUCHO Despues, no contara para esta fase de version 1.0 pero conviene tenerlo en cuenta.


Estos seran los ajustes para la primera version documentalo en algun documento para tenerlo bien respaldado y organizalo por fases, estructuralo bien para cambiar bien y lograr sacar esta version 1.0.