# 2026-10-31 — Visibilidad de Lake Ashinoko GT

## Solicitud

Conservar la IA actual de Ashinoko, cuyo ritmo bajo lluvia resulta apropiado, y reducir mucho más la visibilidad del jugador mediante niebla para equilibrar el desafío y acompañar la ambientación solicitada.

## Implementación

- Perfil exclusivo de Ashinoko cuando la carrera tiene niebla: transición entre 8 y 60 metros, en lugar de los 35–185 metros del perfil genérico.
- Color gris azulado uniforme con el cielo, ocultando curvas, paisaje y autos distantes sin tapar las referencias inmediatas.
- Distancia calculada desde el auto del jugador para mantener coherencia entre cámaras exterior, cercana, capó, interior y retrovisor.
- Sin cambios en la IA, las velocidades, el agarre mojado, la progresión ni la base de datos. Los demás perfiles atmosféricos mantienen sus valores.
- Se utiliza el sombreado de niebla existente, sin añadir pasadas de renderizado.

## Verificación

- Pruebas de aislamiento del perfil y comparación de física e IA idénticas con y sin niebla para los tres rivales del capítulo.
- Prueba de navegador con lectura real de píxeles: rival a 90 m oculto y rival a 18 m visible en las cuatro cámaras, sin errores gráficos.
- Capturas de comparación de vista exterior e interior en `screenshots/ashinoko-*`.
