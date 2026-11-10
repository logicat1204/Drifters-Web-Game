# Temporadas de campaña y NG+

## Recorrido completo

1. **Temporada seca:** los 24 duelos originales, con su dificultad por rival. Una revancha en esta etapa ya no fuerza lluvia. Se conserva la lluvia y niebla propia de Ashinoko para respetar su ambientación original.
2. **Temporada lluviosa:** se desbloquea al completar los 24 duelos anteriores. Vuelves a recorrer las nueve regiones, ahora con lluvia, escenas propias y progreso independiente.
3. **NG+ · Defiende el trono:** se desbloquea al completar los 24 duelos de lluvia. Conservas todo lo comprado y conseguido. Eres el campeón al que desafían los demás pilotos. Al superar sus 24 duelos el juego queda terminado; no se inicia otro ciclo.

Cada etapa se recorre en orden. Los duelos ya ganados siguen disponibles. Tras NG+ puedes repetirlos conservando su dificultad final, y también seleccionar las temporadas anteriores. Los botones de temporada sustituyen a «Tu nombre en el asfalto» una vez terminada la primera campaña. NG+ aparece cuando se desbloquea.

## Dificultad y premios

En NG+ los niveles inferiores suben como mínimo a Difícil, cada rival aumenta un nivel hasta el máximo Leyenda, y la IA mejora ligeramente su aprovechamiento del agarre y respuesta. La velocidad máxima y potencia de los coches no reciben un multiplicador nuevo. Se conservan las identidades Grip, Skiller y Complete y las habilidades de los jefes. Algunas carreras de NG+ son en lluvia, según un patrón fijo mostrado antes de competir; Ashinoko conserva sus condiciones propias.

Las recompensas mantienen la fórmula limitada por puntos de conducción. Temporada seca usa ×1, lluvia ×1,25 y NG+ ×1,6 sobre el premio correspondiente al nivel de esa etapa. Las repeticiones también aumentan de forma moderada con ese factor. Cada primera victoria se paga una sola vez por etapa; volver a enviar el mismo resultado no concede monedas de nuevo. Mejorar una puntuación puede conceder únicamente la diferencia de su bonificación, además del premio normal de repetición.

No se reinician coches, mejoras, monedas, ropa, música, marcas ni especialidades. La licencia conserva todo al cambiar de temporada. Los desbloqueos de superconcentración siguen ligados a las victorias originales.

## Escenas y recursos

La entrega incluye escenas de diálogo con los retratos existentes: regreso bajo la lluvia, defensa del título y desenlace definitivo. No son ilustraciones nuevas. Cada capítulo tiene prólogo y epílogo independientes por temporada, y cada duelo tiene introducción y victoria propias.

```text
campaign_files/<region>/<rival>/rain/
campaign_files/<region>/<rival>/ngplus/
campaign_files/<region>/_chapter/rain/
campaign_files/<region>/_chapter/ngplus/
  dialogue.json
  music/
  story_start/
  story_end/
  narrative_music_start/
  narrative_music_end/
  story_sounds_start/
  story_sounds_end/
```

`dialogue.json` contiene `start` y `end`, arrays de textos. Admite `{player}` para insertar el nombre del piloto. Si colocas imágenes en `story_start/` o `story_end/`, esas páginas sustituyen al diálogo de esa fase. Se conserva el orden natural y la animación del lector. Los sonidos `01.wav`, `02.ogg`, etc. pueden acompañar tanto páginas como diálogos. Los archivos de música del rival original siguen siendo la opción por defecto cuando la temporada no tiene música propia.

```sh
npm run assets:campaign-seasons
```

Este comando prepara las carpetas y los diálogos iniciales sin sobrescribir archivos ya existentes. Los recursos añadidos se descubren al cargar la campaña, igual que los recursos originales.

## Persistencia y validación

Los identificadores originales se conservan para la temporada seca. Las etapas nuevas usan `rain:<rival>` y `ngplus:<rival>`; la lectura de capítulos usa la misma convención. Esto permite aprovechar las tablas SQLite y los documentos MongoDB existentes sin borrar ni convertir progreso. El servidor valida los desbloqueos, condiciones e identidad del rival tanto al empezar como al guardar; el cliente no puede fabricar una etapa avanzada ni cambiar su clima enviando parámetros.

Se verifican la progresión de 72 duelos, pagos independientes e idempotentes, conservación de propiedad, repetición seca, validación de una carrera real de lluvia en el servidor y vueltas físicas de los 48 rivales de lluvia y NG+. La prueba de navegador comprueba las escenas, los botones, el inicio en lluvia, el final de NG+ y el diseño móvil.
