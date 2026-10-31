# Solicitud: Kanata intenta adelantar chocando por detrás

Fecha: 2026-10-31.

El usuario observó que Kanata no calculaba un adelantamiento lateral y golpeaba repetidamente al jugador al intentar recuperar la posición. Pidió corregirlo y revisar si afectaba al resto de IAs.

Se confirmó que el controlador era compartido y carecía de maniobra lateral. Se añade elección de costado, anticipación del movimiento del jugador, frenado de seguimiento, compromiso con una línea y regreso al centro después de despejar el vehículo. Un bloqueo permite ceder espacio y elegir otra apertura. Se mantiene el manejo físico y la habilidad carmesí existente.

Diseño y validación: `docs/ADELANTAMIENTOS-IA.md`.
