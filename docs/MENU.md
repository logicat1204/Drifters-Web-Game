# Entrada y menú principal

La entrada se inspira en `assets/Main Menu inspirations/start_game.jpg`: título centrado, composición despejada y una invitación a pulsar cualquier botón. El fondo es una secuencia 3D con tres coches recorriendo el curso. Una tecla normal, un clic/toque o un botón del mando permite continuar. Ese primer gesto no activa a la vez una opción del menú.

El menú principal toma la disposición de `854px-Main_Menu_U6.jpg`: título arriba a la izquierda, navegación vertical y el escenario visible detrás. La interfaz usa blanco y negro con pequeños indicadores azules. Las imágenes se usan como referencias de composición; el fondo está renderizado por el juego.

## Opciones

- **Jugar**: abre tres tarjetas: Campaña (24 duelos en nueve capítulos), Time Attack (contrarreloj, música y ranking por trayecto) y Juego Online (salas públicas, privadas y creación). Cada tarjeta presenta un diálogo animado con descripción, entrada y cierre. Se retiró Duelo especial del menú de contrarreloj.
- **Garaje**: selección, preparación y personalización de los coches de la licencia.
- **Opciones**: conserva transmisión, cámara, asfalto, hora, calidad, audio y pantalla completa. Incluye acceso a la banda sonora. La dificultad de campaña depende del rival.
- **Perfil**: abre la personalización de licencia y los récords personales.
- **Salir**: confirma la vuelta al título, abandona la sala si la hay y detiene la música. Conserva la sesión y los datos del usuario. El navegador no necesita cerrar su pestaña.

**Cambiar auto**, junto al nombre de la máquina, abre el garaje existente. El coche del mirador corresponde al coche predeterminado del perfil y se actualiza al elegirlo en el garaje o al cambiarlo desde la licencia.

Los controles del menú son ratón/táctil, flechas arriba/abajo y Enter, o cruceta y botón A del mando. Escape cierra opciones o vuelve de una pantalla secundaria. El menú adapta su composición a móvil vertical y horizontal; el movimiento sutil de cámara respeta `prefers-reduced-motion`.

## Sesión e invitaciones

La pantalla de título aparece también si ya hay una sesión guardada. Tras continuar, se solicita el acceso si falta una cuenta o la primera licencia si todavía está incompleta. Las invitaciones `/?room=CODIGO` se conservan mientras se ve el título o se inicia sesión, y después abren la pestaña privada con el código preparado.

## Escena y verificación

`Renderer.buildMenuScene()` crea un mirador independiente de la carretera de competición: aparcamiento, marcas de asfalto, barrera, cuatro capas de montañas, árboles, luna y farolas cálidas. La escena de presentación no cambia la física ni añade obstáculos a los cursos. `renderMenu()` muestra la misma malla del coche que se utiliza en el juego. El título anima tres coches sobre el curso actual; no altera carreras ni récords.

`npm run test:menu` comprueba título, las cinco opciones principales y los tres modos bajo Jugar, navegación de teclado y mando, perfil, coche persistente, salida, invitaciones y vistas de 1440 × 900, 390 × 844 y 844 × 390. Usa un servidor efímero y cuentas en memoria y guarda capturas en `screenshots/menu-*.png`. `npm run test:ui` verifica además el recorrido completo por alta de usuario, personalización, salas de cuatro pilotos y salida individual. Ambos aceptan `PLAYWRIGHT_MODULE` y `BROWSER_EXECUTABLE`.


## Actualización: campaña, colección y especialidades

El sistema actual incluye 24 duelos, tres especialidades desbloqueables, monedas verificadas y tienda. El esquema SQLite actual es v5, con inventario de música, y el avatar v2 admite maquillaje opcional. Hay 111 capas por piezas en dos rigs, y los artículos de tienda solo se equipan al poseerlos. Consulta [Campaña, tienda y superconcentración](CAMPANIA-TIENDA-FOCUS.md) y [Jugar, narrativa y música](JUGAR-NARRATIVA-MUSICA.md) para las reglas, recursos y migraciones.
