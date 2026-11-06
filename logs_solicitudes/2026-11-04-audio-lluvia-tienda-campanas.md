# Solicitud y aplicación — 4 de noviembre de 2026

El usuario aprobó mejorar motores, frenadas y derrapes suaves; lluvia y reflejos; paquetes extensibles de ropa, maquillaje, cabello y demás cosméticos sobre los avatares existentes; y un menú de campaña por regiones. Añadió prólogos y epílogos de campaña para contextualizar la historia completa. Para los motores eligió **buscar grabaciones reutilizables**.

Se implementó un mezclador de conducción con grabaciones reutilizables y créditos, perfiles por familia, volúmenes separados y rivales audibles; material mojado y spray de coste limitado; registro de paquetes por carpeta con IDs persistentes y dos colecciones iniciales independientes por base; atlas regional con los 24 duelos; y 18 páginas narrativas iniciales reemplazables, carpetas/audio por campaña y lectura guardada en SQLite v6. Se conserva la narrativa por rival.

Guía: `docs/AUDIO-LLUVIA-PAQUETES-CAMPANAS.md`. El plan previo queda como antecedente; esta implementación usa un banco compartido pequeño para limitar memoria, reflejos analíticos y un atlas esquemático sin cargar todos los mapas 3D.
