# Catálogo de competición · 10 de noviembre de 2026

Los 18 coches adicionales conservan identificador, precio, malla y propiedad guardada. Cada uno tiene ahora una preparación arcade propia de aceleración, punta, agarre y frenos. La ficha física deja de ser una copia idéntica para todos los coches del mismo perfil. Son valores de juego; las etiquetas de potencia y peso no sustituyen datos de homologación.

`competitionTier` clasifica la preparación y no el año de fabricación. Un clásico de competición como el AE86 Project D es válido junto a los modelos modernos. Sus valores base son propios; las mejoras del garaje siguen aplicándose una sola vez mediante `applyBuild`.

| Tier | Uso | Coches adicionales |
| --- | --- | --- |
| 1 | Clásicos de iniciación y colección | 180SX, S14, AE86 Coupé |
| 2 | Especialistas intermedios de campaña | Evo III, SilEighty, Civic Type R, GT86 |
| 3 | Preparaciones de competición para NG+ | R34, AE86 Project D, RX-7 RE Amemiya, 4C, Exige S, GT3 RS, R8, 488 GTB, GR Supra, A110S y Cayman |

Los Tier 3 mejoran aproximadamente un 8–14% la aceleración, un 5–9% la punta y un 5–9% el agarre del arquetipo anterior de su perfil. Los ágiles de competición tienen una punta de 66–66,5 m/s, los equilibrados de 73–74 m/s y los de potencia de 76,5–78 m/s. Los frenos base varían entre 1,07 y 1,10 en este nivel. Los perfiles conservan distintos compromisos entre rotación en curva, derrape y velocidad de salida.

El AE86 Project D utiliza el perfil ágil; el RX-7 RE Amemiya mantiene el equilibrado. Hay varias alternativas Tier 3 para cada estilo. Las condiciones y exigencia de NG+ se verifican aparte, en la configuración de campaña y el servidor.

No hay recompra ni reinicio de progreso: los propietarios existentes reciben la nueva ficha al cargar el catálogo, manteniendo pintura, piezas y niveles de mejoras. Los precios siguen entre 900 y 3900 monedas, y mejorar completamente un coche sigue costando 4070. Solo las victorias base de las temporadas seca y lluviosa proporcionan unas 31.368 monedas antes de NG+, sin contar bonificaciones, por lo que el salto de coche puede financiarse jugando la campaña.

Los cambios de física de coches se separan de los récords anteriores mediante la versión de manejo del juego. La propiedad y las victorias de campaña se conservan.

## IA de campaña y acceso a NG+

Cada rival sigue una trazada calculada para el ancho de la carretera y su estilo. El plan anticipa las frenadas a partir de la curvatura de esa trazada, el agarre, la potencia y los frenos del modelo. Grip acepta un vértice más lento para recuperar con aceleración. Balance busca una línea fluida y estable. Skiller prepara el derrape y conserva más velocidad al enlazar curvas. La simulación aplica volante y pedales progresivos y calcula el tiempo a partir del recorrido real del coche.

En temporada lluviosa, los rivales retienen el 96 % de su agarre seco. Los coches del jugador retienen el 75 %. Los duelos de Ashinoko ya parten de lluvia en la temporada inicial. NG+ calibra por circuito el ritmo de sus rivales y aumenta sus prestaciones. Las recompensas siguen el multiplicador ×1,6 del nivel.

El mapa de NG+ muestra el coche equipado y su preparación. Para disputar un duelo se necesita un coche de categoría 3 con motor, chasis y frenos al nivel 3. La tienda identifica los modelos aptos y el servidor verifica la compra y las mejoras guardadas. El primer coche de competición y las mejoras completas se pueden financiar con las victorias de las dos temporadas previas.

El manejo v10 aplica las fichas nuevas a cada modelo. Los récords anteriores quedan guardados con su versión y las clasificaciones de manejo v10 se abren con las marcas nuevas.

La medición con pista libre cubrió los 24 rivales de las tres temporadas. Los 72 duelos terminaron sin golpear los guardrails. Donde cambia el clima, el tiempo del rival aumenta entre 1,1 % y 1,5 % al pasar de seco a lluvia. Los rivales de NG+ llegan entre 0,8 % y 13,2 % antes que su contraparte lluviosa. Los cambios de estado del freno bajaron de 10.782 a 7.896 frente al controlador anterior. `node scripts/audit-rival-corners.mjs` reproduce la medición.

`node --test tests/ngplus-balance.test.mjs` comprueba una victoria física en cada duelo de NG+ con un R34 al máximo, además de victorias sin golpes al guardrail de un AE86 Project D frente a Keisuke y de un GT3 RS frente a Beckenbauer.
