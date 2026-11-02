# Revisión del AE86 Project D importado

31 de octubre de 2026. Revisión del archivo `assets/cars/1985_toyota_sprinter_trueno_ae86_project_d.glb`. La revisión inicial no modificó ni integró el archivo. **Actualización posterior del mismo día: integrado exclusivamente como exhibición del menú principal, conservando el GLB original.** Véase `MODELOS-PROPIOS-REFERENCIAS.md`; los modelos de carrera siguen independientes.

## Valoración

El modelo es técnicamente utilizable como base del acabado semirrealista estilizado elegido. Blender 5.1.1 lo importó correctamente y generó dos vistas de estudio conservando sus materiales. Tiene silueta reconocible, rotulación, capó de carbono, interior, cristales y conjuntos de ruedas separados. Resulta una base más avanzada que reconstruir este AE86 desde cero.

La importación confirma la integridad de geometría y texturas, pero no mide su rendimiento dentro del motor del juego. Las vistas de Blender usan Cycles con iluminación de estudio; no representan el sombreado actual del navegador.

## Datos comprobados

| Dato | Resultado |
| --- | --- |
| Tamaño | 6.514.772 bytes, aproximadamente 6,5 MB |
| Triángulos | 90.362 |
| Vértices declarados por las mallas | 78.531 |
| Objetos de malla | 48 |
| Nodos | 95 |
| Materiales | 19 |
| Imágenes/texturas | 35, todas integradas; ninguna ruta de imagen externa |
| Resolución máxima de textura | 4096 × 4096 |
| Animaciones / esqueletos | 0 / 0 |
| Normales y UV | Presentes en todas las primitivas revisadas |
| Dimensiones globales importadas en Blender | Aproximadamente 0,01830 × 0,04228 × 0,01312 m |

La longitud de importación es de unos **4,23 cm**. La jerarquía conserva una escala de 0,01 relacionada con la importación FBX. Para la vista de estudio se normalizó únicamente en memoria a 4,25 m de largo, factor aproximado 100,53. La integración deberá aplicar una escala coherente con el resto de autos y conservar correctamente las transformaciones de los nodos.

Por nombres de grupo, el interior suma 26.781 triángulos, las ruedas/frenos 16.260, el conjunto trasero 20.978, el delantero 11.965 y la base 8.640. Hay oportunidades de reducción sin modificar primero la silueta exterior.

Si todas las imágenes se subieran como RGBA8 sin compresión, sumarían aproximadamente 79 MiB, o 105 MiB incluyendo la cadena completa de mipmaps. Es una estimación de presupuesto gráfico, no una medición de VRAM: depende del formato de subida, deduplicación y compresión del motor. La textura 4K de pintura representa buena parte de ese coste. Varias instancias del mismo auto deben compartir geometría y texturas.

## Adaptaciones recomendadas

1. **Normalizar escala y origen.** Mantener las proporciones y verificar apoyo de ruedas, centro, frente y anclajes con las unidades del juego.
2. **Crear variantes de detalle.** Conservar el original para el garaje o vistas cercanas y preparar una versión más ligera para carreras y otra para rivales distantes. Reducir detalles ocultos del interior y bajos antes de simplificar la carrocería.
3. **Simplificar materiales y texturas.** Agrupar piezas estáticas por material, convertir mapas de valores constantes en parámetros y evaluar bajar la textura 4K a 2K. Mantener separados pintura, cristales, carbono, luces y ruedas.
4. **Adaptar el cargador y el sombreado.** El renderizador actual no interpreta de forma completa este GLB de 48 mallas ni sus extensiones `KHR_materials_clearcoat`, `KHR_materials_specular`, `KHR_materials_emissive_strength` y `KHR_materials_transmission`. El compilador de props estáticos tampoco sustituye una ruta específica para vehículos.
5. **Preparar movimiento y personalización.** Los centros de las piezas de rueda aparecen diferenciados, lo cual ayuda a agruparlas y animarlas. El archivo no contiene animaciones; apertura de faros, giro/dirección de ruedas y otras piezas móviles requieren preparación. La geometría de los faros debe revisarse por componentes, pues muchos objetos están agrupados por material.
6. **Revisar luces y cristales.** Las vistas muestran transparencias funcionales, pero conviene ajustar su acabado y los colores de los pilotos traseros en el motor del juego. Preservar el color de luces de freno e indicadores.
7. **Medir en el juego.** Comparar un coche y cuatro participantes, lluvia, noche, cámara exterior e interior. Cuatro instancias del original sumarían 361.448 triángulos solo en autos. Esa cifra no lo descarta automáticamente, pero no basta el peso del archivo para asegurar 60 FPS.

## Procedencia y licencia declarada

El GLB incluye estos metadatos:

- Autor: **Ddiaz Design**.
- Título: **1985 Toyota Sprinter Trueno AE86 Project D**.
- Fuente indicada: [ficha de Sketchfab](https://sketchfab.com/3d-models/1985-toyota-sprinter-trueno-ae86-project-d-1a53966c790c4784bbdbcf1b130ccc8a).
- Licencia indicada: **CC BY-NC-SA 4.0**.

La [descripción oficial de esa licencia](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es) exige atribución, limita el uso a fines no comerciales y requiere mantener una licencia compatible al distribuir adaptaciones del modelo. Una publicación comercial necesitaría una autorización que cubra ese uso o un recurso con otra licencia apropiada. La condición CompartirIgual se refiere aquí al material adaptado; esta revisión no determina por sí sola la licencia del código del juego.

La ficha de Sketchfab devolvió acceso denegado a la consulta automatizada. La procedencia y licencia anteriores se atribuyen a los metadatos locales; no se afirma haber confirmado la ficha en línea. Sí se consultó la descripción oficial de Creative Commons.

## Evidencia y reproducción

- Auditoría de GLB: `data/car-review/audit.json` y `gltf-metadata.json`.
- Auditoría de Blender: `data/car-review/blender-audit.json` y `blender.log`.
- Vistas: `data/car-review/ae86-importado-vista-a.png` y `ae86-importado-vista-b.png`.
- Script: `scripts/review-car-model.py`, ejecutado con Blender en segundo plano y configuración temporal de fábrica. Solo escribe el informe y las vistas, no un `.blend` ni un GLB nuevo.

SHA-256 del original: `0006CF7F95086EFEE95A5A0A175DDCC0844B730EB6237228692E0BCFBF2BD86F`.

Las vistas de estudio representan el modelo de Ddiaz Design bajo la licencia declarada CC BY-NC-SA 4.0; se ajustaron escala, cámara, entorno e iluminación para la revisión. No hay cambios exportados sobre su geometría original.
