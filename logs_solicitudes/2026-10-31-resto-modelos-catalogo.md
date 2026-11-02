# Solicitud: continuar con los demás modelos

Fecha: 31 de octubre de 2026.

El usuario aprueba el resultado de la familia AE86 y pide continuar con el resto del catálogo siguiendo el mismo estilo.

Se amplía la producción a los otros 22 coches y preparaciones, cubriendo los 25 identificadores existentes. Se crean fuentes Blender y GLB originales, carrocerías con proporciones propias, ópticas, alerones, pasos de rueda, llantas, LOD y datos de montaje individuales. El cargador usa el identificador exacto de coche, permite caché compartida por carrocería y limita a ocho cuerpos la memoria residente. Se mantienen las opciones del garaje, la animación de ruedas/faros, campaña y online. El modelo importado del menú sigue independiente.

Documentación y referencias: `docs/MODELOS-CATALOGO.md`. Verificación de geometría y caché, capturas de los 25 coches, faros cerrados, personalización y carrera a 1080p con cuatro modelos distintos. La suite completa alcanza 189 pruebas aprobadas.

Pasan también el flujo real del FD con H, cámara interior y regreso al menú, todos los menús y la persistencia del coche. Se verifican 20 comparaciones de visibilidad y seis tamaños de retrovisor. La última medición de cuatro modelos mantiene aproximadamente 60 FPS y P95 de 16,8 ms a 1080p, con caché de ocho cuerpos. El servidor local entrega las exportaciones nuevas con MIME GLB correcto.
