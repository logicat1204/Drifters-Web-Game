# Corrección de curvas de la IA · 10 de noviembre de 2026

El controlador de rivales calculaba el giro con la curvatura bajo el auto, sin compensar el tiempo de respuesta del volante y la carrocería. En las horquillas y cambios de dirección llegaba tarde, sobrecorregía y abría demasiado la salida. Skiller cambiaba el sentido de su derrape después del cambio de curva, luchando contra el volante. El control binario de velocidad alternaba freno y acelerador continuamente alrededor del objetivo.

## Cambios

- Anticipación del giro de 0,18 s de recorrido; 0,08 s durante adelantamientos para conservar la respuesta de cambio de carril. El controlador sigue corrigiendo su posición física actual y respeta los límites de dirección y agarre.
- Preparación del derrape Skiller con la curva de los próximos 0,12 s. Permite invertir el deslizamiento a tiempo al enlazar curvas, conservando su magnitud y progresión por nivel.
- Estado persistente de acelerador/freno y una zona de rodaje sin acelerar. La separación entre los umbrales de entrada y salida evita el cambio de pedal en cada paso de física.
- La planificación de frenada utiliza también el multiplicador de freno realmente activo durante Fireball. Sus cinco segundos de preparación, siete de impulso y apagado un segundo después de recuperar la posición se conservan.
- El cálculo de alineación al frenar usa el mismo umbral de 16 m/s que la simulación.

Se conservan niveles, objetivos de velocidad, preparación de cada rival y diferencias entre Grip, Complete y Skiller. No se cambia la física del jugador, el trazado, las condiciones de temporada, el algoritmo de adelantamiento ni la respuesta al blind attack. No se eleva la velocidad mediante teletransportes o correcciones directas de posición. Los rankings de Time Attack siguen usando la misma física v9.

## Verificación

Se condujeron los 24 rivales de cada una de las tres temporadas, a 120 Hz, con sus condiciones reales y el jugador detenido para aislar la trazada. Los 72 terminaron sin impactos con el guardrail.

| Medida de las 72 carreras | Antes | Después |
| --- | ---: | ---: |
| Mayor desviación respecto a su línea en curvas | 4,19 m | 1,44 m |
| Promedio del percentil 95 de desviación | 1,02 m | 0,49 m |
| Cambios de estado del freno | 316.277 | 59.693 |

Estas cifras describen carreras sin tráfico; no prometen ausencia de contactos cuando el jugador bloquea o invade la trazada. Las pruebas adicionales comprueban adelantamientos físicos, presión agresiva, Fireball, que las carreras sigan siendo ganables y reproducción idéntica en el servidor. La prueba de replay del contraataque mide los impactos iniciados durante el contraataque después de que el jugador se establece delante; los posibles roces de su ataque inicial también forman parte del replay verificado.

Resultado: `npm test` con 244 pruebas, 243 aprobadas y una integración opcional de MongoDB omitida. `npm run check` correcto. No se usó la base de datos real.

Para repetir la medición:

```sh
node scripts/audit-rival-corners.mjs
node --test tests/ai-cornering.test.mjs
```

El auditor escribe `data/rival-corners-audit.json`, sin leer ni modificar perfiles. Reiniciar el servidor y recargar el navegador permite que ambos utilicen el mismo controlador actualizado.
