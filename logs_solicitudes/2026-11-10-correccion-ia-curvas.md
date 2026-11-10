# Solicitud · 10 de noviembre de 2026

El jugador observa que los rivales no toman correctamente las curvas tras los cambios de gameplay y solicita revisar su adaptación.

Se reproduce la conducción de los 72 rivales de las tres temporadas. Se corrigen la anticipación del volante, el cambio de sentido del derrape Skiller y la oscilación del acelerador/freno. La planificación de Fireball considera su frenada activa. Se mantienen los estilos, niveles y física del jugador.

Implementación: `js/rival-ai.mjs`. Diagnóstico repetible: `scripts/audit-rival-corners.mjs`. Pruebas de trazada: `tests/ai-cornering.test.mjs`. Diseño y resultados: `docs/IA-CURVAS-V9.md`.

Validación: 72 carreras sin impactos contra guardrails; 243 pruebas aprobadas, una integración opcional de MongoDB omitida; comprobación de sintaxis correcta.
