# Dificultad de Odawara y Fireball de Kanata

Solicitud: subir Nozomi y Kakeru Yashio a Difícil, Jackson a Profesional, y reforzar el contraataque del jefe final Kanata con unos cinco segundos de preparación después de ser adelantado. Conservar el apagado normal al recuperar la posición.

## Cambios

- Nozomi: nivel 3, Skiller. Kakeru Yashio: nivel 3, Grip. Jackson: nivel 4, Complete. Se conserva el orden de los tres duelos y se actualiza también la lista fuente de pilotos.
- Un adelantamiento confirmado inicia cinco segundos de preparación. Durante ese intervalo no hay aura, potencia adicional ni actitud de tráfico carmesí.
- Al terminar se activa Fireball carmesí: aceleración ×2,50, velocidad máxima ×1,38, agarre ×1,16 y frenada ×1,35. La física y las maniobras laterales siguen determinando el movimiento; no se adelanta su posición directamente.
- Se conserva el impulso de siete segundos y el apagado un segundo continuo después de recuperar la delantera. La misma recuperación cancela una preparación pendiente. Un nuevo ciclo de posición recuperada y adelantamiento exige otros cinco segundos completos; los ataques activos no se acumulan.

## Validación

203 pruebas aprobadas. Se comprueba el umbral de cinco segundos, la ausencia de aura/potencia anticipada, el apagado, la cancelación y el rearme, los nuevos niveles, adelantamientos junto a muros, replays idénticos en el servidor y una recuperación en Manazuru frente a un R32 con mejoras máximas sin contactos ni impactos. La estrategia de adelantamiento tardío demuestra que el jefe sigue siendo superable; un ataque temprano de referencia ahora pierde y el servidor guarda correctamente esa derrota sin premio.

Verificación visual en Edge de preparación, Fireball activo y posición recuperada, junto con los niveles publicados por la API de campaña. Se guardó una copia consistente de SQLite antes de iniciar el servidor local actualizado; el esquema y los datos de usuario no se modifican por este ajuste.
