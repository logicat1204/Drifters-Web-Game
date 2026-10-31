# Rebufo y contactos entre vehículos

Implementado el 30 de octubre de 2026. Física `v8`.

## Uso en el juego

El rebufo es automático. Sigue a otro coche a unos 8–35 metros, alineado con su estela. Una barra azul bajo la posición muestra su intensidad. Al acercarte, sal por un costado y aprovecha la velocidad ganada para adelantar. Permanecer en la misma línea termina en contacto: no permite atravesar al rival.

Funciona en campaña, duelos, arcade y online. Jugadores y rivales tienen las mismas reglas de rebufo. Un time attack en solitario no genera estelas. No requiere una tecla ni gasta superconcentración.

## Parámetros

| Parámetro | Valor |
| --- | --- |
| Distancia entre centros | 5–48 m; máxima eficacia entre 8–20 m |
| Desplazamiento lateral máximo respecto a la estela | 1,65 m |
| Velocidad mínima de ambos coches | 20 m/s (72 km/h) |
| Ganancia por velocidad | Progresiva hasta 35 m/s |
| Diferencia máxima de dirección de movimiento | 0,32 rad; eficacia decreciente |
| Reducción máxima de resistencia aerodinámica | 65% |
| Margen máximo de velocidad punta | +5% |
| Construcción / disipación exponencial | 2,2 / 1,6 por segundo |

La comprobación combina progreso en el curso con posición, dirección de movimiento, altura y anchura en el mundo. No se obtiene rebufo del coche que viene en otra rama de una horquilla, de uno parado, de uno al lado, de un coche terminado o durante recuperación. Con varios coches delante se toma la mejor estela; no se suman bonificaciones.

La intensidad reduce el término de resistencia `.00048 × velocidad²`. No añade un motor ficticio ni agarre extra. La aceleración efectiva mejora porque se pierde menos fuerza por resistencia, y el límite de punta aumenta gradualmente hasta el 5%. Con concentración o el contraataque de Kanata, ese margen se aplica sobre su límite activo: sigue estando acotado.

Al abandonar la estela, la fuerza desaparece progresivamente. La velocidad ya ganada puede conservarse durante la breve disipación, sin aumentar por encima de la velocidad previa ni del límite del 5%; el límite de coasting desciende al menos 0,25 m/s por segundo y la resistencia sigue actuando. Una colisión o reposicionar el coche cancela el rebufo inmediatamente. Hay que seguir frenando para las curvas.

## Contactos justos

Se sustituye la penalización unilateral de campaña por un único modelo compartido con online. Se comprueba una longitud de 4,2 m y un ancho de 1,78 m.

- Alcance por detrás: se conserva el orden anterior al contacto, se separa al perseguidor y se limita su velocidad a la del coche delantero. La pérdida del perseguidor crece con la velocidad de alcance; el coche delantero pierde como máximo el 2,5%.
- Rozamiento lateral: separación de ambos coches dentro del corredor transitable y pérdida moderada del 4% por impacto nuevo. Se puede salir hacia el espacio libre.
- La separación se aplica continuamente. El tiempo de espera de 0,65 s limita las penalizaciones repetidas y no habilita atravesar coches.
- La recuperación mantiene su protección temporal. Los contactos cancelan concentración y rebufo en ambos coches.
- Un contacto que devuelva detrás de meta a un coche recién cruzado se resuelve antes de decidir el ganador.

La corrección del alcance nunca impulsa artificialmente hacia delante al coche golpeado. Se comprueba también el orden previo al paso físico para evitar que un cierre rápido invierta los coches.

## Cliente y servidor

`js/traffic.mjs` contiene las reglas. La campaña usa las posiciones de ambos coches al comienzo del paso de simulación. El servidor online toma una instantánea común de los hasta cuatro participantes antes de calcular cada uno, evitando que el orden de actualización conceda más rebufo.

Los snapshots incluyen `draft` y `contactCooldown`. El cliente predice rebufo y contactos a partir de tráfico autoritativo proyectado al tiempo local, sin alterar los snapshots. Esta predicción usa el tráfico actual y es independiente de la interpolación visual de coches remotos. Una corrección de impacto se aplica directamente para evitar el efecto visual de atravesar al rival.

El cliente envía únicamente controles; no puede declarar intensidad de rebufo, potencia, posiciones ni resultados. Las campañas se validan reproduciendo el mismo código de física en el servidor. Los récords anteriores permanecen guardados y se separan de los nuevos por `HANDLING_VERSION=v8`; no hay migración de esquema SQLite.

## Validación

Las pruebas cubren construcción y salida de estela, posición y dirección, cancelaciones, límites de velocidad, combinación con concentración, adelantamiento físico limpio entre dos coches iguales, simetría de contactos, prevención de atravesamientos, límites laterales, cuatro jugadores, orden de cálculo y protección ante valores falsificados. También se conserva la suite de campaña y reproducción de carreras contra Kanata.

`npm run test:traffic-ui` abre dos navegadores con cuentas y base de datos temporales, crea una sala real por WebSocket y verifica el estado de rebufo recibido, su indicador y el diseño en cámara interior y móvil. Capturas en `screenshots/rebufo-*.png`.
