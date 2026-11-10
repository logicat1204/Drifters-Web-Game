# Suelo continuo y complementos procedurales

## Correcciones de las capturas

Las franjas de terreno independientes podían ser rechazadas por seguridad al acercarse a otra curva, pero la vegetación se colocaba igualmente. La decoración y su apoyo tampoco compartían la misma altura. El agua se dibujaba como franjas a la altura de cada segmento, produciendo bandas azules suspendidas. Ocultar niveles por altura no resolvía estas causas.

Ahora `js/terrain-field.mjs` crea una superficie común en coordenadas de mundo. Consulta los segmentos próximos y construye una cuadrícula de 16 m, con un faldón de unión junto a la carretera. Las alturas compartidas evitan que cada tramo forme una plataforma aislada. El borde exterior baja gradualmente al fondo común, sin paredes verticales de cientos de metros.

Las celdas que invaden la calzada se descartan. El borde próximo se resuelve con franjas adaptadas a la curva, y el guardrail tiene una base continua de hormigón. Los puntos de control, alturas, anchura física y manejo de las pistas se conservan.

La decoración consulta el triángulo de suelo que realmente se dibuja. Si no existe apoyo, no se coloca el objeto. Los modelos se ajustan por su cota inferior. Los postes y cables usan la altura apoyada; puentes y embarcaderos tienen reglas específicas. El agua tiene una única cota por mapa y los embarcaderos se sitúan en su ribera. Se evita colocar decoración terrestre bajo el agua.

Se retira el descarte por cota de la entrega anterior: un árbol ya no pierde su suelo por una regla de visibilidad independiente.

## Rendimiento y límites

- Construcción durante la carga del mapa; no se recalcula el suelo durante la carrera.
- Bloques espaciales y frustum culling; decoración lejana con desvanecimiento.
- Un buffer estático de escenario y el atlas existente, sin cargador GLB durante la carrera.
- Iluminación simplificada para el suelo: luz ambiental, sol, niebla y faros del jugador. La carretera conserva su iluminación completa. El terreno exterior no calcula todas las luces de rivales y farolas por píxel.
- Borde próximo preciso y franjas exteriores menos densas en curvas suaves.

El suelo completo requiere más geometría que una escena con huecos. Las mediciones se guardan en `data/render-benchmark-ground-after.json`: Edge nativo, 960 × 600, Intel UHD, 24 fotogramas sincronizados por escena. En la comprobación realizada las medianas fueron aproximadamente 4,8–8,8 ms y los percentiles 95 quedaron por debajo de 16,7 ms. Es una medición de ese equipo, no una garantía universal de FPS. La carga del mapa puede tardar más al construir el suelo y los índices de apoyo.

Las alturas entre carreteras siguen siendo una aproximación visual. No es una reconstrucción geográfica ni una simulación de puentes transitables a varios niveles. La exclusión del corredor sigue protegiendo todas las curvas.

## Análisis de los generadores recibidos

Los scripts Python de los packs crean primitivas, combinan transformaciones, calculan normales y exportan posiciones, normales, UV, índices y materiales a GLB. NumPy ayuda con vectores y matrices; Pillow dibuja texturas y cielos. Es un procedimiento reproducible y apropiado para recursos ligeros. Algunos scripts conservan rutas del entorno del autor; compilar los GLB ya incluidos evita depender de esas rutas.

Se han compilado del tercer pack: cono, neumáticos, coche rojo estacionado y fotógrafo. Conos, coche y fotógrafo se colocan en zonas de descanso o apartaderos donde hay apoyo y espacio; los neumáticos quedan disponibles en la biblioteca compilada. No se ha cargado toda la colección ni añadido multitudes animadas.

## Recursos complementarios originales

El generador nuevo usa Node.js, disponible en este proyecto. Aplica el mismo método geométrico sin necesitar instalar Python, NumPy o Pillow. Exporta GLB portátiles y las mallas compiladas que usa el juego.

| Recurso | Triángulos | Uso |
| --- | ---: | --- |
| `drainage_grille` | 28 | Rejilla de drenaje sobre el borde de hormigón, cada 48 m |
| `mile_stone` | 16 | Hito bajo con pintura y reflector, espaciado en el borde seguro |
| `fern_cluster` | 14 | Helechos geométricos sin transparencia para variar el sotobosque |

Archivos: `assets/touge_complements/models/`, manifiesto `assets/touge_complements/assets.json`, fuente `scripts/build-roadside-complements.mjs`. Son complementos originales, independientes de los modelos recibidos. Usan colores por vértice y no necesitan texturas adicionales.

```sh
npm run assets:roadside-complements
npm run assets:scenery-part3
```

## Verificación

Pruebas de continuidad del suelo, altura sobre triángulos realmente emitidos, apoyo bajo ambos guardrails, decoración apoyada en los diez mapas, GLB sin recursos externos y equivalencia entre sus datos y las mallas compiladas. Se revisaron escenas de día, noche, cabina, lluvia y niebla con WebGL sin errores. Los informes y capturas de esta revisión están en `data/ground-*.log` y `screenshots/entorno-*.png`.

Resultado final: **238 pruebas correctas, 0 fallos y 1 integración opcional de MongoDB omitida**. La comprobación de sintaxis también pasó.
