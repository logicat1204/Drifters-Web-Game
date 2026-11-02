# Exhibición del menú y producción de modelos propios

31 de octubre de 2026.

## Implementado: AE86 de exhibición

El menú principal presenta el archivo `assets/cars/1985_toyota_sprinter_trueno_ae86_project_d.glb`, estacionado en un mirador de montaña al amanecer. El cielo usa el atlas existente, con sol, montañas en capas, barandilla, árboles y alumbrado. La cámara tiene encuadres distintos para escritorio y móvil. La indicación «Tu coche de carrera» sigue mostrando la selección real del usuario.

`js/menu-model.mjs` carga el modelo únicamente al entrar al menú principal. Conserva normales, UV y materiales, hornea las transformaciones de la jerarquía para esta exhibición estática, agrupa las 48 mallas en 19 lotes de material y adapta su longitud a 4,25 m. Las texturas integradas se limitan a 2048 píxeles en memoria, sin modificar el archivo fuente. Incluye una respuesta de pintura, metal y cristal específica para esta escena. No es un renderizador PBR completo.

La pantalla de entrada no descarga el GLB. Durante la carga o si falla se utiliza el AE86 procedural. El registro de coches de carrera permanece independiente: carreras, garaje y personalización continúan con sus modelos jugables. El modelo descargado no será la base geométrica, de UV o texturas para los futuros modelos propios.

El servidor entrega `.glb` como `model/gltf-binary` y admite rangos de bytes. El menú incorpora enlaces al autor y a la licencia:

- Autor: **Ddiaz Design**.
- [Modelo original en Sketchfab](https://sketchfab.com/3d-models/1985-toyota-sprinter-trueno-ae86-project-d-1a53966c790c4784bbdbcf1b130ccc8a).
- [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es). La exhibición mantiene estas condiciones; su incorporación al menú no cambia su licencia.
- Adaptación: escala, agrupación de materiales, representación de materiales y escena de exhibición. El GLB original conserva su contenido.

Verificación: parser sobre el archivo real, valores finitos y normales unitarias, medidas normalizadas, rechazo de cabeceras inválidas, integridad SHA-256, MIME y rangos HTTP. El flujo del navegador comprueba carga diferida, ausencia de errores WebGL, selección independiente, vuelta al menú y exclusión de la exhibición durante la carrera. Capturas de escritorio, móvil y horizontal. Medición local del menú a 1440 × 900 con GPU nativa: aproximadamente 60 FPS, 16,67 ms por imagen y 29 llamadas de dibujo; no garantiza el mismo rendimiento en otros equipos.

## Próximo trabajo: modelos de carrera propios

Validación final de esta entrega: **182 pruebas aprobadas**, comprobación de sintaxis y flujo del menú. El flujo adicional de rendimiento de carrera a 1920 × 1080 obtuvo aproximadamente 60 FPS, 16,67 ms por imagen, P95 de 16,8 ms y resolución al 100 % en este equipo; también verificó seis configuraciones de retrovisor sin lecturas de GPU durante su dibujo.

Acabado elegido: **semirrealista estilizado**, con silueta y proporciones reconocibles, superficies limpias y detalles selectivos. La calidad debe funcionar desde la cámara de carrera, no solamente en una vista de estudio.

Puedo recopilar referencias de fabricantes y fotografías del vehículo real, contrastando frontal, lateral, trasera y tres cuartos. El catálogo y la lista de pilotos del proyecto determinan las carrocerías necesarias. El usuario no necesita reunir imágenes de todos los coches. Para una preparación especial que no quede definida en el catálogo, será útil indicar versión, año, etapa del anime o kit concreto, y aportar una imagen si quiere una modificación muy específica.

Referencias oficiales iniciales consultadas:

| Familia | Referencia | Utilidad |
| --- | --- | --- |
| AE86 Sprinter Trueno | [Historia y ficha de Toyota](https://www.toyota-global.com/company/history_of_toyota/75years/vehicle_lineage/car/id60009032/) | Diferenciar dos y tres puertas; medidas y proporciones de fábrica. |
| RX-7 FD | [Galería histórica de Mazda](https://www2.mazda.com/en/100th/cars/detail_025_rx7.html) | Silueta y detalles de la tercera generación. |
| Skyline GT-R BNR32 | [Nissan Heritage Collection](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/skyline_gt-r_1989.html) | Fotografías y dimensiones de la carrocería. |

Estas referencias no autorizan reutilizar texturas o geometría ajenas. Se construirá una malla y unas texturas propias a partir de la observación de las formas. Las partes que no se vean deberán contrastarse con más vistas o resolverse de forma aproximada.

Orden propuesto:

1. Primer prototipo: **AE86 Trueno de tres puertas**, base común y preparación Project D separada para capó, ruedas y detalles.
2. Modelar en Blender carrocería, ruedas con pivotes, cristales, faros escamoteables y puntos de montaje del garaje. UV y texturas originales.
3. Presupuesto inicial: 10.000–20.000 triángulos cerca, LOD de 2.000–5.000 lejos y texturas hasta 2K. Ajustarlo con mediciones, sin prometer FPS por el número de polígonos.
4. Preparar una importación para vehículos móviles que conserve piezas y materiales. La ruta estática del menú no resuelve dirección, giro de ruedas ni animación de faros.
5. Validar pintura, luces, ruedas, personalización y lectura de silueta en carrera. Medir cuatro coches simultáneos y retrovisor antes de extender la producción al resto del catálogo.

En la entrega de exhibición se implementó únicamente el menú. **Actualización posterior del 31 de octubre:** la primera etapa de modelos propios ya sustituye visualmente la familia AE86 en carrera y garaje; ver `MODELOS-CARRERA-AE86.md`. El resto del catálogo continúa pendiente de renovación.
