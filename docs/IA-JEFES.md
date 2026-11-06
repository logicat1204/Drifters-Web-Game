# Diseño técnico: dificultad, estilos y jefes

Actualizado el 4 de noviembre de 2026. Física de jefes introducida en `v7`; versión actual `v8` con [rebufo y contactos](REBUFO-CONTACTOS.md).

## Dificultad por piloto

Se elimina el selector global Fácil/Normal/Difícil. Odawara usa ahora Nozomi y Kakeru Yashio en nivel 3 (Difícil), y Jackson en nivel 4 (Profesional). Se mantienen sus estilos y orden. Cada rival conserva su nivel de campaña: 1 Fácil, 2 Medio, 3 Difícil, 4 Profesional o 5 Leyenda. Los duelos individuales también tienen un nivel fijo. Los valores antiguos guardados en el navegador o enviados como `difficulty` se ignoran; no modifican la simulación ni la validación del servidor.

| Nivel | Aprovechamiento del agarre | Objetivo de punta | Respuesta de trayectoria | Deslizamiento Skiller |
| --- | --- | --- | --- | --- |
| 1 | 63% | 85% | 3,2 | 0,09 rad |
| 2 | 69% | 90% | 3,5 | 0,13 rad |
| 3 | 75% | 94% | 3,8 | 0,17 rad |
| 4 | 81% | 98% | 4,1 | 0,21 rad |
| 5 | 87% | 100% | 4,4 | 0,25 rad |

Estos son objetivos del controlador, no velocidades garantizadas. Resistencia, frenadas, curvas, lluvia y contactos siguen afectando al auto. El ritmo general aumenta mediante mejor anticipación y aprovechamiento del agarre, sin mover al rival artificialmente para cumplir un tiempo. Kanata tiene la única reacción especial de potencia al ser adelantado.

## Preparaciones y estilos

| Estilo | Punta máxima | Aceleración base | Agarre | Multiplicador de freno | Anticipación |
| --- | --- | --- | --- | --- | --- |
| Grip | 76 m/s | 19,0 | 1,00 | 1,30 | 260 m |
| Complete | 70 m/s | 17,1 | 1,16 | 1,16 | 225 m |
| Skiller | 64 m/s | 15,4 | 1,32 | 1,08 | 200 m |

Los valores son preparaciones arcade exclusivas de rivales, no fichas reales ni mejoras concedidas a los vehículos del jugador.

El controlador examina el trazado cada 8 m y calcula una envolvente de frenado usando `sqrt(vCurva² + 2 × deceleración × distancia)`. Grip usa un margen de curva del 84% y una planificación conservadora de frenado de 10,5 m/s²: suelta antes, frena más y recupera velocidad con más potencia. Complete usa 94% y 13,5 m/s². Skiller usa 99% y 15 m/s², mantiene más velocidad en las curvas y tiene menor punta.

Skiller provoca un deslizamiento firmado que crece y desaparece progresivamente. Su carrocería gira respecto a la dirección real del movimiento; el control de guiñada y la menor pérdida por derrape escalan con el nivel. La aceleración lateral conserva su límite físico: no se ajusta directamente la posición lateral ni se copia la orientación de la carretera. El efecto de aerodeslizador proviene del ángulo real de derrape y del control del eje trasero.

Takumi Project D conserva Skiller en Tsubaki Line. En la final de Manazuru, Daigo Sawatari y Kanata usan Complete para aprovechar las rectas: 70 m/s de punta y aceleración base 17,1, con buena capacidad de curva. Sawatari conserva nivel 4 y Kanata nivel 5. Se actualizan catálogo y guía; el trazado compartido por los cuatro rivales finales permanece igual. El duelo independiente de Kanata en Atami conserva su preparación Skiller.

## Firmas de los cinco jefes

Los rivales comparten ahora una maniobra de adelantamiento lateral, con frenado de seguimiento y regreso a la trazada tras despejar al jugador. Su diseño y pruebas se detallan en [ADELANTAMIENTOS-IA.md](ADELANTAMIENTOS-IA.md).

| Jefe | Condición | Efecto |
| --- | --- | --- |
| Shinji | Completar una curva limpia de al menos 18 m; se admite un cambio de signo en curvas enlazadas | Rayo blanco azulado durante 0,85 s |
| Takumi D | Curva >0,003 rad/m, velocidad >65% del límite de curva y deslizamiento real >0,12 rad | Estelas locales del auto, con entrada y salida suaves |
| Takumi D | Pasa de estar al menos 4 m detrás del jugador a 4 m delante | Alas celestes durante 1,7 s |
| Keisuke D | Curva limpia sostenida >0,65 s, variación de velocidad <2,5 m/s², subviraje <0,3 | Aura azul/dorada durante 2,1 s; rearme 3,8 s |
| Michael Beckenbauer | Siempre | Halo blanco/dorado, corona de luz y destellos orbitales |
| Kanata | El jugador lo adelanta de forma confirmada | Aura carmesí de persecución y contraataque temporal |

Las firmas de Shinji, Takumi, Keisuke y Michael son visuales: no conceden potencia adicional. Su dificultad viene del nivel y del estilo.

Las mallas se construyen en WebGL sin descargar recursos externos. La luz usa composición aditiva, profundidad real y destellos contenidos alrededor del coche. El blur de Takumi conserva nítidos la carretera y el HUD. Los efectos usan el reloj de carrera y se detienen al pausar; respetan movimiento reducido y también aparecen en la vista trasera del conductor.

## Contraataque de Kanata

El detector registra el orden confirmado de los coches, con una banda de ±4 m para evitar activaciones por contacto o por oscilaciones de sus morros. Empezar delante o reposicionar un coche no cuenta como adelantamiento.

1. Un adelantamiento válido inicia la preparación de Fireball. Empezar delante no activa la habilidad. Durante la preparación no hay aura, potencia adicional ni la conducta de tráfico carmesí.
2. Preparación de 5 s de simulación desde el adelantamiento confirmado. Al terminar, se activan a la vez aura, contraataque y aviso Fireball.
3. Impulso de 7 s: aceleración ×2,50, punta ×1,38, agarre ×1,16 y frenada ×1,35. La punta teórica de su preparación Complete pasa de 70 a 96,6 m/s mientras dura el impulso. Sigue frenando y eligiendo un lado para adelantar.
4. Cuando Kanata recupera la posición, empieza una gracia de 1 s continuo. Al cumplirse, se apagan aura, impulso y preparación de impulso pendientes; vuelve a la conducción normal. Si el jugador se pone delante durante esa gracia, el contador se reinicia. Incluso una ventaja sostenida menor de 4 m puede completar la recuperación.
5. Los impulsos no se suman ni se renuevan durante una persecución existente. Tras recuperar la posición y apagarse, otro adelantamiento confirmado inicia de nuevo cinco segundos completos de preparación. El contador interno cooldown se conserva como estado temporal y no elimina esa nueva ventana. Si Kanata recupera la posición durante la preparación, la misma gracia de un segundo cancela el ataque pendiente. Si termina la carrera delante, el modo se cierra para evitar un aura congelada en resultados.

El impulso actúa en aceleración, límites y decisiones de conducción. No cambia directamente el progreso ni garantiza que Kanata recupere la posición. El jugador puede reservar concentración, salir con más velocidad y adelantar cerca de meta para reducir su ventana de respuesta.

Si ambos coches cruzan en el mismo paso de 1/120 s, se compara la fracción recorrida hasta la meta; gana quien la cruza primero. Un empate exacto no otorga la victoria al jugador.

## Autoridad, persistencia y comprobaciones

`js/rival-ai.mjs` contiene el controlador; `js/bosses.mjs`, las transiciones de habilidades; `js/sim.mjs`, su integración física; `js/renderer.js`, su representación. El servidor fija rival, nivel, estilo y equipo de campaña. No acepta habilidades, boosts ni parámetros de IA enviados por el cliente. La misma simulación determinista valida los replays y las recompensas.

No cambia el esquema SQLite. Los récords anteriores se conservan y las nuevas marcas se agrupan con `HANDLING_VERSION=v8` para evitar mezclar físicas distintas.

La suite verifica los 24 recorridos de IA sin impactos, una victoria posible por nivel con vehículos iniciales y concentración desbloqueada, diferencias medibles entre estilos, cinco niveles crecientes, activaciones por curva/adelantamiento, duración, límites y apagado de Kanata un segundo después de recuperar posición, protección del servidor y orden de llegada. Contra Fireball, el conductor de referencia reserva la concentración y el adelantamiento para los últimos 320 m; el replay de un ataque temprano verifica ahora también una derrota sin recompensa. El conductor de referencia aprovecha hasta el 90% del agarre y elige trazada y especialización; demuestra que las carreras son superables, no una estimación de dificultad para jugadores humanos. La percepción final requiere probar con teclado o mando y ajustar a partir de partidas reales.

`npm run test:boss-visual` genera cinco capturas con el renderizador de producción y comprueba también cámaras alternativas y movimiento reducido. `npm run test:menu` comprueba la ausencia del selector y la compatibilidad con ajustes antiguos.
