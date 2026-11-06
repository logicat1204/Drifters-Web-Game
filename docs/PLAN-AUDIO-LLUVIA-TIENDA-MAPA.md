# Plan: audio, lluvia, tienda ampliable y mapa de campaña

Fecha: 4 de noviembre de 2026. Estado: plan aprobado e implementado. La entrega y los formatos definitivos se documentan en [AUDIO-LLUVIA-PAQUETES-CAMPANAS.md](AUDIO-LLUVIA-PAQUETES-CAMPANAS.md); los detalles propuestos aquí se conservan como antecedente.

## Objetivo

Dar más carácter a los coches, mejorar la sensación de velocidad y conducción en mojado, facilitar la incorporación de cosméticos y convertir la campaña en un viaje visible por regiones. Mantener la carretera legible, las compras y el progreso existentes, y el objetivo de 60 FPS.

## Situación encontrada

- `SoundSystem`, dentro de `js/game.js`, usa dos osciladores para el motor y ruido filtrado para neumáticos y viento. Tiene RPM, cambios y rebufo, pero falta identidad acústica y mezcla de grabaciones. La detección de aceleración sonora lee teclado/táctil; el nuevo sistema deberá responder al mismo estado de conducción también con mando.
- Hay lluvia, niebla, gotas y limpiaparabrisas. El shader del mundo no tiene una respuesta específica de asfalto mojado; la carrocería ya dispone de brillo sencillo. El retrovisor utiliza una segunda cámara limitada a 16/24 Hz.
- Música comprable: descubrimiento por carpetas y compras persistentes. Cosméticos: catálogos, validación, composición y precios definidos en `js/avatar.mjs`, con referencias estáticas desde servidor e interfaz.
- Campaña: 24 duelos, nueve capítulos, desbloqueos secuenciales, recompensas y lector de cómics con audio. La presentación sigue siendo una lista de capítulos y rivales.

## Etapa 1 — Sonido de conducción

### Resultado propuesto

Motor con cuerpo y personalidad, frenadas que transmitan esfuerzo y neumáticos suaves que permitan escuchar música y anticipar el límite de agarre. La emoción vendrá de la respuesta a la conducción y del timbre, además del volumen.

### Trabajo

1. Separar `SoundSystem` en un módulo de audio de conducción. Mantener el reproductor musical y sus canciones actuales.
2. Preparar un banco por familia de motor y una asignación por coche. Comenzar con AE86, FD3S y R32 para validar tres personalidades diferentes antes de cubrir el catálogo.
3. Combinar bucles de ralentí, RPM bajas/medias/altas y retención. Modificar tono dentro de un intervalo razonable y fundir capas al cambiar de régimen; evitar estirar una única grabación para todo el tacómetro.
4. Añadir respuesta a carga del acelerador, levantamiento de pedal, cambio de marcha y reducción. Turbo o descarga solo para las configuraciones que correspondan, con intensidad moderada.
5. Diferenciar frenar en línea, acercarse al límite de adherencia, subvirar y derrapar. Activación progresiva basada en velocidad, deslizamiento y agarre utilizado; evitar un chirrido permanente por mantener pulsado el freno.
6. Suavizar entrada y salida de sonidos de neumático, limitar los agudos molestos y controlar picos. Ajustes separados para motor, neumáticos, ambiente/lluvia y música.
7. Diferenciar escucha interior y exterior mediante filtros y mezcla. Rivales cercanos con posición y distancia audibles, con un máximo de tres fuentes rivales y prioridad por proximidad.
8. Cargar solo las muestras necesarias para el coche actual y los rivales presentes; compartir buffers de una misma familia. Conservar la síntesis actual como respaldo si falta un banco.

### Recursos

```text
assets/audio/engines/ae86/
  engine.json
  idle.ogg
  low_on.ogg
  mid_on.ogg
  high_on.ogg
  coast.ogg
assets/audio/tires/
  grip_soft.ogg
  slide_soft.ogg
  wet_slide.ogg
```

`engine.json` declarará RPM de referencia, ganancias, límites de tono y puntos de bucle. Se necesitan grabaciones propias o recursos con permiso de uso, limpios y sin música de fondo. La calidad de esas muestras será determinante: un manifiesto y más filtros no convierten por sí solos la síntesis actual en un motor realista.

Web Audio permite controlar la reproducción y el tono de buffers mediante `AudioBufferSourceNode.playbackRate`. La propuesta es usar ese mecanismo con fundidos entre bandas, sin introducir una dependencia nueva antes de medir que haga falta. [Documentación de Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate).

### Criterio de cierre

Prueba auditiva comparativa de los tres coches: ralentí, aceleración completa, retención, reducción, frenada y derrape sostenido. Sin cortes entre bucles, saturación o sonidos que continúen tras abandonar/pausar. Verificar teclado, mando y táctil, y memoria con cuatro coches. Extender al resto mediante familias y variaciones por modelo.

## Etapa 2 — Lluvia, humedad y reflejos

### Primera entrega

- Identificar asfalto y otros materiales antes de aplicar humedad, para no hacer brillar árboles, salpicadero o cielo como si fueran carretera.
- Añadir un parámetro visual de humedad: asfalto más oscuro, brillo más direccional y respuesta a faros y luces traseras.
- Reflejos aproximados de cielo y luces, con máscaras de charcos discretas y variación de rugosidad. Evitar una carretera completamente pulida.
- Spray corto detrás de las ruedas, más marcado en mojado y con velocidad; salpicaduras pequeñas, limitadas por distancia y calidad.
- Integrar sonido de lluvia, agua sobre neumáticos y limpieza del parabrisas con el nuevo mezclador.
- Un único responsable de las gotas y barrido del cristal en primera persona. Conservar la vista de la curva y las referencias del guardarraíl.
- Hacer que lluvia exterior, primera persona y retrovisor utilicen el mismo estado meteorológico y presupuesto de partículas.

Los reflejos iniciales serán aproximaciones de materiales e iluminación. No mostrarán una copia geométricamente exacta de cada coche o edificio en el suelo.

### Ampliación opcional de calidad

Evaluar reflejos dinámicos de coches en charcos concretos mediante una pasada adicional de baja resolución, con actualización limitada, distancia corta y desactivación por calidad. Decidir su inclusión después del primer prototipo y de medir el peor caso con retrovisor; no convertirlo en requisito de la primera entrega.

### Rendimiento y validación

Conservar el sistema de resolución adaptativa. Medir a 1080p en seco y mojado, de día y noche, con interior/retrovisor, tres rivales y superconcentración. Comparar media, P95, tiempo CPU, memoria y llamadas de dibujo con una escena de referencia cargada; medir la carga inicial por separado. El objetivo es el presupuesto de 16,67 ms, no prometer una cifra para cualquier equipo.

Reutilizar datos de luces y agrupar partículas. Evitar lecturas síncronas de la GPU en producción. Estas decisiones siguen las recomendaciones de [buenas prácticas de WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

La primera fase gráfica no modificará el agarre mojado, las reglas de niebla, los cronómetros ni la IA ya equilibrada.

## Etapa 3 — Catálogo de cosméticos por paquetes

### Convención propuesta

```text
assets/shop/packs/
  v3/
    pack.json
    male/hair/street-cut/
      item.json
      back.png
      front.png
      lines.png
      preview.webp
    female/outfit/rally-suit/
      item.json
      color.png
      lines.png
      preview.webp
  v4/
    pack.json
    ...
```

Para cosméticos conviene un pequeño `item.json` en vez de codificar todo en el nombre del PNG: hay varias capas, compatibilidad de base, tintes, rareza y miniaturas. El descubrimiento por carpetas sí se conserva, como en la música.

Ejemplo de metadatos:

```json
{
  "id": "male.hair.street-cut",
  "name": "Street Cut",
  "slot": "hair",
  "base": "male",
  "rig": "portrait-v2-male",
  "price": 350,
  "rarity": "rare",
  "availableForSale": true,
  "preview": "preview.webp",
  "layers": {
    "back": "back.png",
    "color": "front.png",
    "lines": "lines.png"
  }
}
```

El esquema final definirá capas por categoría y su orden: cabello trasero, base, ropa, rasgos, cabello delantero, contornos y accesorios. Cada artículo tendrá archivos propios y compatibilidad explícita con hombre o mujer, siguiendo la separación ya solicitada para las bases.

### Reglas de versiones y compras

- `v3`, `v4` serán colecciones de contenido. No significarán automáticamente versión 3 o 4 del avatar ni de SQLite.
- Un paquete nuevo podrá seguir usando los rigs actuales. Cambiar la anatomía o los puntos de encaje sí requerirá otro rig, adaptación de assets y, si corresponde, una migración específica.
- IDs permanentes, independientes de carpeta, nombre visible y precio. Mover un artículo o cambiar su precio no obliga a comprarlo de nuevo. Rechazar IDs duplicados.
- Publicar el catálogo desde un registro validado por el servidor. Sustituir las dependencias estáticas de `COSMETICS` en catálogo, compra, validación de perfil y compositor.
- Registrar los artículos nuevos conservando las filas de inventario existentes. Migrar datos solo cuando el esquema lo necesite; no recrear licencias ni compras.
- El servidor sigue decidiendo precio, saldo, propiedad, base y compatibilidad. Las compras siguen siendo atómicas e idempotentes.
- Retirar un artículo de venta mediante metadatos, conservando sus capas para quienes ya lo poseen. Una imagen inválida o ausente no debe bloquear el acceso a la cuenta.
- Validar rutas dentro del paquete, formatos, dimensiones, transparencias y archivos necesarios. Un paquete defectuoso no entra parcialmente en venta.
- Generar categorías y filtros desde los tipos admitidos. Añadir artículos a ropa/cabello/ojos/accesorios será una operación de archivos; una categoría completamente nueva requiere definir primero cómo se equipa y se dibuja.

### Flujo de incorporación

Copiar paquete → validar/reindexar → publicar catálogo → aparece en tienda → comprar y equipar. En desarrollo se podrá refrescar el catálogo; en producción será preferible validar el paquete completo durante el despliegue y publicar una revisión coherente. Copiar archivos al proyecto local no los sube automáticamente a Render.

### Criterio de cierre

Añadir dos paquetes de prueba sin editar el código del catálogo. Comprar y equipar recursos separados para hombre/mujer; reiniciar y comprobar propiedad. Cambiar precio/carpeta, retirar de venta y añadir un paquete defectuoso. Verificar que nada de ello borre inventario o impida renderizar una licencia existente.

## Etapa 4 — Campaña como viaje por regiones

### Dirección visual

Mapa 2D/2,5D estilizado de Japón, con relieve ilustrado, carreteras y nodos de desafío. Inspiración en la lectura de mapas de aventura de Naruto y en la presentación de rivales de Initial D. Mantener identidad propia y la paleta blanca/negra con azul puntual.

### Navegación en dos niveles

1. Vista regional: Gunma, frontera Gunma/Nagano para Usui, Tochigi, Ibaraki y Kanagawa, usando los cursos ya definidos. Indicadores de progreso por región, próximo duelo y capítulo seleccionado.
2. Al seleccionar una zona, acercamiento a sus cursos y recorrido de duelos. Cada nodo muestra retrato del rival; estados bloqueado, disponible, completado y jefe claramente distintos.
3. Seleccionar un rival abre una ficha lateral o inferior con coche, nivel, estilo, recompensa, mejor resultado, especialidad desbloqueable y música de carrera.
4. Entrar enlaza con el lector de cómics y los recursos actuales de `campaign_files/`. La victoria vuelve al mapa, marca el nodo superado y descubre el siguiente duelo con una animación breve.

El mapa será una representación artística de regiones y cursos, no una reconstrucción geográfica exacta. El orden de campaña permanece ligado a los IDs y condiciones del servidor: agrupar cursos por geografía no reordena la historia ni permite saltarse rivales. Una región puede recibir nuevos desafíos más adelante, como ya ocurre con los capítulos de Kanagawa.

### Implementación

- Separar datos de presentación, por ejemplo `assets/campaign-map/map.json`: regiones, coordenadas de nodos, ilustraciones y enlaces a los IDs existentes.
- Empezar con SVG, HTML y transiciones ligeras. Evitar un mapa 3D que obligue a cargar todos los cursos o coches para navegar.
- Minimizar o suspender el fondo 3D del menú cuando el mapa lo oculte por completo.
- Soportar ratón, táctil y mando: selección por cruceta, confirmación, volver y enfoque visible. Desplazar/acercar con límites y disponer de acceso directo al próximo duelo.
- En móvil, mapa navegable y ficha inferior; conservar la selección al volver. Respetar movimiento reducido y permitir saltar transiciones.

### Criterio de cierre

Recorrer los nueve capítulos y 24 nodos, probar bloqueos desde una cuenta nueva y continuar con una avanzada sin perder victorias. Verificar entrada/salida de cómics, selección musical, derrota, victoria, repetición y apertura del siguiente duelo; comprobar escritorio, móvil y mando.

## Orden de entrega recomendado

| Entrega | Prototipo para revisar | Condición para ampliar |
| --- | --- | --- |
| 1. Audio | AE86, FD3S y R32; frenadas y derrapes suaves | Mezcla y timbres aprobados, controles y carga verificados |
| 2. Lluvia/reflejos | Un curso seco/mojado en ambas cámaras | Visibilidad y coste gráfico medidos con cuatro coches |
| 3. Tienda modular | Dos paquetes con categorías existentes | Propiedad y equipamiento conservados tras actualización |
| 4. Mapa de campaña | Una región con sus rivales y cómics | Navegación validada antes de extender a las demás |

Cada entrega debe ser jugable y revisable por separado. Registrar mediciones y capturas de referencia. Los reflejos dinámicos más costosos y los cambios de rig del avatar quedan como ampliaciones con validación propia, no como condiciones para obtener las primeras mejoras.
