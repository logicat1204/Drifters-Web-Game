# Campaña, monedas, colección y superconcentración

Implementación de la solicitud registrada en `logs_solicitudes/2026-10-30-campania-superconcentracion-tienda.md`.

## Campañas y contenido

La plantilla de pilotos se transcribió de `assets/lista_de_pilotos_y_autos.md` a `js/campaign.mjs`, conservando el orden, los autos, colores y estilos. Son **24 duelos en nueve campañas**: Akina, Akagi, Irohazaka, Usui, Tsukuba, Tsubaki Line, Odawara Pikes Peak, Lake Ashinoko GT y Peninsula Manazuru. Los niveles son 1 Fácil, 2 Medio, 3 Difícil, 4 Profesional y 5 Leyenda. El 6 Insane de Kanata en la guía se adapta a 5 porque la solicitud explícita define esa escala.

Cada duelo exige haber vencido al anterior. Los capítulos futuros se pueden consultar y sus pilotos se muestran, pero no se pueden iniciar. Se pueden repetir los niveles superados. Ni modificar `arcadeStage` en el perfil ni jugar un duelo especial del modo individual desbloquea la campaña.

La IA usa el mismo sistema físico que el jugador: acelera, frena, gira, pierde velocidad y cruza realmente la meta. No se teletransporta para cumplir un reloj. Kanata puede activar un contraataque temporal cuando el jugador lo adelanta. Los cinco niveles cambian el uso de agarre y de punta. El estilo asigna una preparación independiente al rival:

| Estilo | Preparación arcade | Comportamiento |
| --- | --- | --- |
| Grip | 76 m/s de punta, aceleración 19,0, agarre 1,00 | Potente en rectas; necesita frenar más en curvas |
| Skiller | 64 m/s, aceleración 15,4, agarre 1,32 | Menor punta; mayor velocidad de paso por curva |
| Complete | 70 m/s, aceleración 17,1, agarre 1,16 | Compromiso entre ambas |

El selector global de dificultad se elimina. Los parámetros actuales, firmas y contraataque de Kanata se detallan en [IA-JEFES.md](IA-JEFES.md). Estos valores son ajustes de juego, no fichas técnicas reales. La dificultad sigue importando dentro de cada estilo. Las pruebas comprueban frenada/giro y llegada sin impactos para los 24 rivales, progresión de dificultad y una victoria posible en cada nivel con uno de los tres autos iniciales de referencia y una trayectoria de adelantamiento física, sin compras.

Odawara, Ashinoko y Manazuru tienen trazados originales de interpretación arcade. No son levantamientos exactos de los circuitos reales. Se mantienen los siete cursos anteriores para juego individual/online. **Lake Ashinoko fuerza lluvia, niebla y día**; los otros capítulos de MFG son diurnos y los de Initial D nocturnos. El servidor fija las condiciones y el rival aunque el cliente envíe otras.

Ashinoko tiene un perfil de niebla más cerrado: comienza a 8 m y oculta por completo la geometría a 60 m, frente a los 35–185 m del perfil genérico. La distancia se mide desde el auto para mantener la misma visibilidad del entorno en las cuatro cámaras y el retrovisor. Se conservan las referencias cercanas de pista y guardarraíles. Es un ajuste visual, sin cambios a la física mojada ni al ritmo de los rivales. La comprobación visual reproducible es `npm run test:ashinoko-fog`.

## Retratos y cómics

`scripts/build-campaign-assets.mjs` indexa los archivos existentes de `assets/campanias/` y genera `assets/campaign-media.json`. Las rutas conservan los nombres y mayúsculas originales y se codifican por segmentos para funcionar también en Linux/Render. Se incluyen **24 retratos y 24 cómics**. Si hay archivos con `comic` en el nombre, se usan como páginas en orden numérico; en las carpetas actuales con títulos descriptivos se toma la imagen de historia más grande y el otro archivo como retrato. Revisar el manifiesto si se añaden nombres ambiguos.

Antes de iniciar cada duelo se abre el lector. **Continuar**, fijo abajo a la derecha, avanza de página o inicia la carrera. Ampliar permite leer la página a mayor tamaño; Volver cancela sin iniciar un intento. El reloj del intento del servidor empieza después del cómic. Las presentaciones vuelven a mostrarse al repetir un nivel. Los diálogos de las imágenes son contenido narrativo; no cambian el orden o las reglas de la guía.

El retrato del rival también se muestra en el HUD de campaña. La API estática admite PNG, JPEG y WebP.

## Especialidades

La licencia guarda `focusType`. Balance es la selección inicial, pero permanece bloqueada hasta vencer a Takumi de Akina.

| Tipo | Desbloqueo verificado | Agarre | Aceleración | Frenada | Punta | Aspecto |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Balance | Takumi Fujiwara (Inicial), Akina | +22% | +10% | +10% | +6% | Aura morada |
| Time Master | Keisuke Takahashi, Akagi | +8% | +65% | +90% | +8% | Impulso amarillo y aura azul |
| Drift Master | Kai Kogashiwa, Irohazaka | +52% | +4% | +10% | +2% | Aura celeste clara y alas |

Drift Master mejora también la alineación de la trayectoria. Todos conservan la misma barra: se carga con curvas limpias, requiere 30%, se activa con X y dura de **1,5 a 5 segundos** según carga. Consume la carga entera, no recarga mientras está activo, deja tres segundos de recuperación y se cancela con un golpe o reposicionamiento. Las opciones bloqueadas no pueden activarse ni cargarse; las especialidades Time/Drift bloqueadas tampoco pueden equiparse. Balance se puede mantener como selección inicial bloqueada.

El servidor captura la especialidad y el permiso al iniciar un intento o una carrera online. La reproducción del intento valida las activaciones. Los mensajes de controles no pueden conceder poderes y las instantáneas online incluyen el estado autoritativo. Las auras 3D también se ven alrededor de los otros jugadores; la vista del propio jugador añade estelas y alas de pantalla. Las animaciones de pantalla respetan movimiento reducido.

Se usa `HANDLING_VERSION=v8`: las marcas anteriores se conservan, pero no se mezclan con los récords de esta física. Cada nueva partida registra el tipo de concentración y si estaba habilitado.

## Economía

Solo una **victoria de campaña completada y verificada** da monedas. Una derrota, un abandono o una carrera individual/online no concede premios de campaña.

El premio principal de un nivel es:

```text
220 + nivel × 80 + floor(índice global del duelo / 3) × 25
+ min(160, floor(puntos de conducción / 150))
```

El índice comienza en cero. La base está entre **300 y 795 monedas**. Las primeras victorias de toda la campaña dan 13.700 de base y como máximo 17.540 incluyendo bonificaciones. Al mejorar después la puntuación solo se paga la diferencia pendiente del bonus principal, cuyo límite sigue siendo 160 por nivel.

Una **nueva carrera ganada** en un nivel superado concede además un premio reducido:

```text
35 + nivel × 5 + min(25, floor(puntos de conducción / 600))
```

Son entre **40 y 85 monedas** por repetición, para permitir completar la colección jugando. Reenviar el mismo resultado, recargar la página o repetir una petición de guardado no concede otro premio. Cada recompensa requiere un ID de intento nuevo y conducción completa; la reproducción y el reloj del servidor impiden enviar un tiempo o una puntuación inventados. La reproducción física no pretende ser un detector de automatización de controles.

`wallets` guarda el saldo y `economy_ledger` cada ingreso o compra. El guardado del resultado, la victoria, la mejora y el abono se realizan en una transacción. El saldo tiene restricción de no ser negativo. Los puntos históricos siguen siendo estadísticas y no se convierten retroactivamente en dinero.

## Tienda y autos

Hay **25 autos en total**: los siete anteriores se conservan disponibles y los **18 nuevos** de campaña se compran. Los precios nuevos van de **900 a 3.900 monedas**. Las mallas e interiores son interpretaciones geométricas originales sobre familias de carrocería, con detalles propios; no son modelos escaneados. Las preparaciones mantienen los tres perfiles de conducción y comprar un deportivo moderno no hace innecesario frenar.

El garaje muestra los autos propios. Los modelos nuevos solo se pueden equipar, usar en individual o enviar a una sala después de comprarlos. Mirar una vista previa en la tienda no equivale a poseerlo. La selección del coche predeterminado se conserva en la licencia.

Se añaden **30 cosméticos de pago**, independientes para hombre y mujer:

- Hombre: degradado, trenzas, gorra de piloto como cabello, miradas nuevas, mono de piloto, mono de fórmula, chaqueta de rally, piloto nocturno legendario, gafas de colores y marcas de equipo.
- Mujer: cabello asimétrico, gorra de piloto, moños, cabello de seda legendario, miradas nuevas, mono de piloto, vestidos de noche/verano/zafiro, bikini deportivo, gafas de colores, rubor, delineado y brillo de labios.

Los precios van de 140 a 1.200 monedas. Las prendas conservan los colores editables. Los cosméticos no modifican estadísticas ni poderes. La tienda permite previsualizar, comprar y equipar; la licencia solo ofrece las piezas que pertenecen al usuario. Una compra duplicada es idempotente y no vuelve a cobrar. El servidor toma precio y propiedad del catálogo, nunca del importe que envía el navegador. Equipar una pieza de otra base o una pieza no comprada se rechaza.

## Migración y assets

`003-campaign-economy.sql` eleva SQLite a `user_version=3`. Añade especialidad, cartera, progreso, autos propios, libro de moneda y datos de concentración en cada resultado. Al migrar se mantienen cuentas, fotos, avatares, sesiones, coches anteriores y récords. Se añaden las opciones gratuitas de maquillaje sin pieza (`none`) y se actualiza la versión del retrato para invalidar caché. La nueva campaña empieza sin victorias y sin conceder poderes por los antiguos duelos genéricos.

El catálogo del avatar sigue en versión 2 para conservar IDs. `makeup` ausente se interpreta como `none` y la migración lo guarda explícitamente. El generador exporta **111 capas PNG y 111 fuentes SVG** en `assets/avatars/v2/{layers,sources}/{male,female}/`. Las nuevas piezas nunca comparten geometría entre bases. Añadir una pieza requiere catálogo, precio, máscaras y contornos de su rig; concederla a cuentas previas necesita una migración de inventario.

## Comandos y pruebas

```sh
npm run assets:campaign
npm run assets:avatars
npm test
npm run check
npm run test:progression
npm run test:menu
npm run test:ui
npm run test:focus-visual
```

Las pruebas usan datos temporales/en memoria. Las de navegador admiten `PLAYWRIGHT_MODULE` y `BROWSER_EXECUTABLE`; el generador de PNG admite `SHARP_MODULE`. `test:focus-visual` es una escena de prueba aislada del renderizador real, no envía partidas ni concede saldo. Las capturas de comprobación quedan en `screenshots/campania-*.png` y `screenshots/focus-*.png`.

El despliegue incluye tanto `assets/campaign-media.json` como las imágenes referenciadas y los nuevos PNG. No es necesario ejecutar Sharp en Render si esos archivos ya se han generado e incluido en el repositorio. El servidor debe reiniciarse para cargar catálogo y migración nuevos.
