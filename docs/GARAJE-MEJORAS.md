# Garaje, mejoras y personalización

Solicitud del 30 de octubre de 2026.

## Acceso y funcionamiento

El menú principal incorpora **Garaje** debajo de **Juego offline**. En el garaje aparece **MEJORAR** sobre **ELEGIR MÁQUINA**. El taller muestra el auto real estacionado, las monedas, su preparación y las pestañas Rendimiento / Estética. Solo se preparan coches propios.

La preparación se guarda por usuario y por auto, no se transfiere al cambiar de máquina. No se modifica la dificultad, el nivel, la conducción ni las preparaciones de los rivales.

## Rendimiento

Cada sistema se compra secuencialmente del nivel 0 al 3, con monedas de campaña. Los porcentajes son acumulados respecto al auto original, no respecto al nivel anterior.

| Sistema | Tier 1 | Tier 2 | Tier 3 | Precios por nivel |
| --- | --- | --- | --- | --- |
| Motor | +4% aceleración, +2% punta | +8%, +4% | +12%, +6% | 220 / 480 / 850 |
| Chasis y neumáticos | +4% agarre | +8% | +12% | 200 / 440 / 780 |
| Frenos | +6% frenada | +12% | +18% | 160 / 340 / 600 |

Maxear un auto cuesta **4.070 monedas**. Los primeros niveles de los tres sistemas cuestan 580, accesibles con las primeras victorias. No hay mejoras infinitas ni multiplicaciones de un nivel sobre otro. El máximo de punta sigue siendo menor en los autos ágiles que en los de potencia, y los ágiles conservan su ventaja de agarre con preparaciones equivalentes. La concentración y el rebufo conservan sus reglas y límites, aplicados a la preparación adquirida.

La mejora añade margen para competir, pero no elimina la necesidad de frenar, trazar y adelantar. Tier 0 conserva exactamente la física anterior. La versión de manejo continúa en `v8` porque no se altera la física base ni la IA; los récords guardan su preparación por separado.

## Estética

- Pintura libre: 140 monedas por auto, una sola compra. Desbloquea el selector de color y la paleta; los repintados posteriores son gratis. La vista previa no se aplica a las carreras hasta guardar.
- Franjas Racing: 180. Doble franja en techo y capó.
- Apex Line: 220. Gráfica lateral blanca y azul.
- Capó oscuro: 200. Acabado visual inspirado en carbono.
- Alerón GT: 320. Pieza elevada de pista.
- Llantas doradas / negras: 160 cada acabado.

Las piezas se equipan al comprar; volver a equiparlas o retirarlas es gratis. Restaurar la estética de serie mantiene el inventario y las mejoras de rendimiento. Las piezas no afectan al agarre, peso, resistencia ni potencia.

Todas las variantes son geometría original del motor WebGL, construida sobre las dimensiones del modelo existente, sin servicios externos ni archivos de imagen nuevos. Cada coche mantiene sus superficies, techo y ruedas; las franjas y el capó se adaptan a su perfil. Sustituir una vista previa libera el buffer anterior. Online usa una malla por participante, permitiendo dos coches del mismo modelo con colores y piezas diferentes.

## Datos y autoridad

`js/tuning.mjs` comparte catálogo, límites, validación y aplicación determinista. `js/workshop.js` maneja la interfaz. La migración SQLite `004-vehicle-garage.sql` crea:

- `vehicle_builds`: niveles y apariencia por usuario/auto, vinculados a coches propios.
- `owned_vehicle_parts`: piezas desbloqueadas por usuario/auto.
- `runs.vehicle_build` y `runs.build_key`: preparación capturada en cada carrera.

Las compras se realizan en transacciones con saldo condicionado, registro contable y protección contra peticiones duplicadas. Enviar de nuevo el mismo nivel comprado no cobra otra vez; no se pueden saltar niveles ni superar Tier 3. La personalización valida colores, propiedad y piezas antes de guardar.

El servidor fija la preparación al iniciar una carrera o al abrir la salida online. Los valores de mejora enviados por el cliente se ignoran. Cambiar el garaje durante una carrera ya iniciada no cambia ese intento. Los replays reproducen la preparación capturada, incluso si el usuario compró otro nivel después.

Los récords muestran `DE SERIE` o `M1-C2-F3` (motor/chasis/frenos). Las mejores marcas personales se agrupan también por preparación; el ranking general muestra la mejor vuelta del piloto junto a la preparación usada. Pintura y piezas no separan categorías de rendimiento.

Endpoints autenticados y protegidos por CSRF: `GET /api/garage`, `POST /api/garage/upgrade`, `/api/garage/buy` y `/api/garage/customize`.

## Validación

Pruebas de límites, física de serie, efecto real de cada sistema, independencia de la estética, transacciones y rollback, propiedad por coche/usuario, migración desde v3, persistencia, replay completo con mejoras y preparación online. Se comprueban las mallas de los 25 coches, variantes del mismo modelo y liberación de buffers.

`npm run test:workshop` recorre compras reales, maxea un auto, cambia pintura y piezas, recarga la sesión, comprueba móvil y abre una sala real con otro piloto del mismo modelo y otra preparación. Usa una base de datos temporal.

La evaluación futura de FPS y motor se documenta por separado en `RENDIMIENTO-FUTURO.md`; no activa contador ni cambia el motor.
