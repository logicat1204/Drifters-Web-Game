# Conducción global de la IA · 10 de noviembre de 2026

La primera corrección de anticipación mejoró la trazada, pero mantuvo un control binario de pedales. Una revisión con carreras completas confirmó que Kenji todavía pulsaba el freno 618 veces durante Akina, con una duración media de 0,059 s. El problema afectaba al controlador compartido de todos los cursos, no solamente a Akina. Se sustituye ese regulador por presión progresiva y se diferencian las técnicas de los tres estilos.

## Pedales y trazada

Los rivales usan acelerador y freno de 0 a 1. La simulación aplica esa fracción a la fuerza real de cada pedal. El regulador combina el cambio de la velocidad prevista en el trazado con la diferencia respecto a la velocidad actual y compensa resistencia y deslizamiento. Una demanda con signo transita suavemente de freno a acelerador sin aplicar ambos a la vez. Una caída del límite futuro no ordena seguir frenando cuando el auto ya está suficientemente por debajo de ese límite.

El frenado de emergencia por alcance no espera al suavizado. Las luces se corresponden con presión física, con umbrales de 7,5% al encender y 3,5% al apagar. No se ocultan pulsaciones digitales mediante una simple animación de las luces.

El volante mantiene 0,18 s de anticipación y 0,08 s en maniobras. Se prepara el derrape con la curva de los próximos 0,12 s. La trazada coloca el auto hacia el exterior al preparar la entrada y hacia el interior cerca del vértice, con amplitudes distintas por estilo. Cuando necesita recuperar una línea que está perdiendo, reserva agarre reduciendo velocidad; nunca desplaza lateralmente el auto por código.

## Diferencias físicas y visuales

| Estilo | Entrada y giro | Salida |
| --- | --- | --- |
| Grip | Frena con anticipación; gira estable sin iniciar artificialmente un derrape por frenar. | Mayor aceleración y punta de su preparación. |
| Complete / Balance | Frenada intermedia y una pequeña rotación controlada; respuesta de carrocería intermedia. | Buen equilibrio entre la velocidad de curva y la aceleración. |
| Skiller | Preparación del derrape, contravolante y mayor conservación de velocidad en curvas. | Menor punta; enlaza curvas técnicas manteniendo el deslizamiento. |

En la comparación con el mismo modelo base y nivel 3 en Akina, las preparaciones por estilo producen aproximadamente 3,9°, 6,2° y 11,3° de ángulo medio entre carrocería y movimiento en curvas técnicas. Se comprueba la separación física de los tres estilos, además de la diferencia de velocidades y puntos de frenada.

Los rivales también generan humo tenue en seco cuando su derrape real y ángulo de deslizamiento lo justifican. Las partículas se limitan a rivales cercanos y conservan el presupuesto compartido de 48. En lluvia siguen usando agua pulverizada. No se dibuja una estela de derrape ficticia al conducir con adherencia.

En Akina, Kenji e Iketani son Grip y Takumi es Skiller. El primer rival Complete de la historia aparece posteriormente; no se cambia la lista de estilos de los personajes para fabricar variedad en el primer capítulo.

## Reglas conservadas

Se mantienen los niveles, las condiciones de las tres temporadas, las pistas, la conducción y controles del jugador, las reglas de adelantamiento y el blind attack. La presión analógica de esta revisión es exclusiva de la IA. El juego online y los récords de Time Attack conservan la física del jugador v9.

Fireball mantiene sus cinco segundos de preparación, siete de impulso y apagado un segundo después de recuperar la posición. Su planificación considera su frenada activa. Un adelantamiento nuevo cerca de meta puede ganar dentro de la nueva ventana de preparación, aunque antes haya habido otros contraataques. La verificación del servidor guarda el resultado físico real y paga monedas solamente si corresponde a ese resultado; no impone una derrota predeterminada.

## Verificación

Se condujeron los 24 rivales de cada una de las tres temporadas, a 120 Hz y con sus condiciones reales. Los 72 terminaron sin impactos contra el guardrail. En esta medición sin tráfico, el mayor error respecto a la trazada móvil fue de 1,83 m y el promedio de los percentiles 95 fue de 0,41 m. Las pruebas adicionales comprueban adelantamientos en las carreteras reales, bloqueos, Fireball, carreras ganables y reproducción idéntica en el servidor.

| Rival de Akina | Pulsaciones antes | Frenadas progresivas después | Duración media antes / después |
| --- | ---: | ---: | ---: |
| Kenji | 618 | 102 | 0,059 s / 1,01 s |
| Iketani | 606 | 98 | 0,059 s / 1,02 s |
| Takumi inicial | 468 | 85 | 0,083 s / 0,78 s |

Son mediciones de carreras completas sin tráfico, no una promesa de ausencia de contactos al bloquear o invadir la trazada de otro coche. La prueba de pedales mide también la presión aplicada a la física, y limita las pulsaciones breves. La comprobación en navegador usa el WebGL de producción y verifica los tres estilos, humo real de Skiller, ausencia de humo inventado en Grip y el límite de partículas.

Resultado final: 246 pruebas, 245 aprobadas, ningún fallo y una integración opcional de MongoDB omitida. Comprobación de sintaxis y prueba visual de navegador correctas.

Para repetir las comprobaciones:

```sh
node scripts/audit-rival-corners.mjs
node --test tests/ai-cornering.test.mjs
node tests/ai-driving-preview.mjs
npm test
npm run check
```

El auditor escribe `data/rival-corners-audit.json` con tiempos, error de trazada, frenadas y ángulos. La prueba visual escribe capturas en `screenshots/ai-driving/`. Las pruebas usan bases temporales y no modifican los perfiles reales. No hace falta migrar la base de datos. Reiniciar el servidor y recargar el navegador permite que ambos utilicen el controlador actualizado.
