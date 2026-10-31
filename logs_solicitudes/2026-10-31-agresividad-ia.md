# Solicitud: rivales que disputen el adelantamiento

Fecha: 2026-10-31.

El usuario observó que las IAs cedían constantemente ante bloqueos y aceptó la propuesta de compromiso de trazada, prioridad cuando ya están en paralelo, mayor presión desde atrás, contramaniobras y agresividad según nivel, con Kanata en carmesí como caso más decidido.

Se implementa un objetivo de línea estable durante un intervalo mínimo; se elimina la retirada automática de 22 m. La distancia de presión y la anticipación dependen del nivel. Cuando el rival alcanza la puerta del jugador mantiene línea y aceleración; los cierres tardíos conservan sus contactos físicos normales. Un cierre previo puede provocar frenado y una nueva apertura por el costado opuesto. La IA usa la posición del jugador al inicio del paso físico.

La potencia, agarre, preparaciones, sistema de contactos y duración del carmesí conservan sus reglas. No se garantiza que la IA gane una disputa ni se desactivan colisiones.

Validación y parámetros actualizados en `docs/ADELANTAMIENTOS-IA.md`; pruebas nuevas en `tests/ai-aggression.test.mjs` y comprobación visual de un cierre tardío con contacto en `tests/ai-passing-preview.mjs`.
