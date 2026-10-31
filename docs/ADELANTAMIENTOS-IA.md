# Adelantamientos laterales de la IA

31 de octubre de 2026.

## Problema corregido

Los rivales compartían un controlador de velocidad y trazada, pero no una maniobra de adelantamiento. Al alcanzar al jugador en su línea, seguían intentando avanzar hacia el mismo punto. La resolución de contactos impedía atravesarlo, lo que dejaba al rival chocando repetidamente contra su parte trasera. El impulso de Kanata hacía especialmente visible este comportamiento.

La solución se aplica a los 24 rivales de campaña y a las IAs de los duelos/arcade mediante `js/rival-ai.mjs`. Después de la primera corrección, se ajusta para que los bloqueos no provoquen una retirada automática. No concede potencia, agarre ni desplazamientos nuevos. Los jugadores online conservan sus controles y el modelo de contactos compartido.

## Decisiones de conducción

1. **Detectar el alcance.** La IA anticipa al jugador entre 38 y 115 m según su velocidad y la diferencia de ritmo. También intenta salir de un seguimiento bloqueado si su velocidad objetivo supera la del jugador.
2. **Elegir un costado.** Evalúa espacio, desplazamiento necesario y próximo giro. Proyecta el movimiento lateral del jugador entre 0,16 y 0,45 s según agresividad, con extrapolación limitada a 1,1 m; no lee sus futuros controles.
3. **Comprometer la trazada.** Busca unos 2,5 m de separación lateral dentro de ±3,6 m, conservando su trazada habitual cuando ya es válida. Mantiene el objetivo entre 0,85 y 1,7 s aunque el jugador reaccione: no sigue cada movimiento del bloqueo hacia el guardarraíl. El objetivo se desplaza gradualmente entre 2 y 3 m/s; la carrocería se mueve a través de su física.
4. **Mantener presión.** El seguimiento usa la velocidad relativa de alcance. Puede aproximarse sin frenar porque el coche delantero esté cerca cuando ambos avanzan casi igual. Reduce velocidad ante una intersección frontal real o inminente. El objetivo de distancia nominal varía entre 8 y 5,1 m; un bloqueo prolongado puede reducirlo ligeramente, nunca por debajo de 5 m.
5. **Disputar el paralelo.** Cuando ya está a la altura de la puerta, conserva su línea y acelera. Un cierre tardío puede causar un roce normal. La prioridad de decisión termina si pierde por completo el solapamiento y vuelve a quedar detrás.
6. **Volver a la trazada.** Espera al menos 11 m de ventaja, considerando si el jugador viene cerrando, antes de regresar a su línea normal.

El control lateral incluye amortiguación. Al cambiar de línea en curva se reserva parte del agarre mediante el objetivo de velocidad; los niveles altos aprovechan más el agarre ya disponible. A baja velocidad se ajustan dirección y margen lateral para terminar de rodear un coche detenido. La IA percibe al jugador al comienzo del paso físico, igual que el tráfico usado para rebufo, evitando errores de distancia de un paso en seguimientos muy próximos.

## Agresividad por nivel

| Nivel | Distancia nominal entre centros | Compromiso mínimo | Ritmo máximo del objetivo lateral |
| --- | --- | --- | --- |
| 1 | 8 m | 0,85 s | 2 m/s |
| 2 | 7,4 m | 1 s | 2,2 m/s |
| 3 | 6,7 m | 1,15 s | 2,4 m/s |
| 4 | 6,1 m | 1,35 s | 2,6 m/s |
| 5 | 5,6 m | 1,55 s | 2,8 m/s |
| Kanata en carmesí | 5,1 m | 1,7 s | 3 m/s |

Estas cifras gobiernan decisiones y objetivos, no modifican directamente la velocidad lateral ni aseguran un adelantamiento. La frenada y los límites de adherencia siguen siendo físicos. El carmesí añade esta actitud a su impulso existente, sin aumentar sus multiplicadores de potencia.

## Bloqueos y límites

Un cierre anterior al paralelo puede obligar a frenar, pero ya no provoca una retirada de 22 m. Una vez cumplido el compromiso, el rival reevalúa la apertura cuando tiene espacio detrás del jugador. Puede inducir un bloqueo por un lado y cambiar al hueco opuesto: esta contramaniobra funciona como una finta y vuelve a fijar un compromiso mínimo.

Un cierre tardío, con los coches ya en paralelo, no borra la intención de ataque. La IA conserva el objetivo de línea y usa sus controles normales. La prioridad es del plan de conducción: no existe inmunidad, cambio especial de responsabilidad ni penalización artificial para el jugador. Los contactos compartidos siguen separando y reduciendo velocidad a los coches. La defensa puede ganar la disputa mediante la física; no se garantiza una victoria de la IA.

La defensa basada en luces/retrovisores se conserva, pero no interrumpe una maniobra ni intenta cubrir una línea cuando el jugador ya está al lado. El carmesí de Kanata conserva su activación por adelantamiento y su apagado un segundo después de recuperar la posición; únicamente cambia la forma física de buscar el paso.

La IA no evita necesariamente un choque provocado por un cambio repentino del jugador cuando ya no queda distancia física de reacción. No se añaden teletransportes, desplazamientos laterales instantáneos ni inmunidad a contactos.

## Validación

`tests/ai-passing.test.mjs` comprueba:

- Los 24 rivales frente a un coche más lento en una recta y en sus cursos reales.
- Kanata en carmesí, jugador centrado o cerca de cualquiera de los guardarraíles.
- Alcance cercano, recuperación después de un contacto y paso junto a un coche detenido detectado con suficiente anticipación.
- Compromiso con un costado, espacio al pasar en paralelo y regreso después de despejar al jugador.
- Un bloqueo lateral en movimiento y adelantamientos de los tres estilos en curvas.
- Un replay completo, validado por el servidor, con adelantamiento del jugador, regreso al centro y contraataque lateral de Kanata, sin contactos en ese recorrido.

`tests/ai-aggression.test.mjs` añade compromiso ante una reacción del jugador, mantenimiento de línea y aceleración en paralelo, presión gradual por nivel, frenado frontal de emergencia, contramaniobras ante bloqueos repetidos y una disputa física con contacto. Comprueba que el rival sigue atacando y conserva su trazada durante cada disputa.

`npm run test:ai-passing-visual` usa simulación y renderizador de producción para capturar salida lateral, paso en paralelo, recuperación de posición y un cierre tardío con roce real. No guarda carreras ni añade endpoints de trucos.

No cambia el esquema SQLite ni la preparación de los coches. Se conservan cuentas, monedas, mejoras y récords.
