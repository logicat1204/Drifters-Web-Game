# Cartas de colección

Para publicar una carta, añade un archivo como `005.json` y su imagen en esta carpeta. Los nombres admiten entre 3 y 8 dígitos. Usa PNG, WebP o JPEG, con recorte vertical recomendado de 4:5.

```json
{"id":"005","title":"Nombre de la carta","tier":"rare","description":"Historia de la carta.","image":"005.webp"}
```

El ID debe coincidir con el nombre del JSON. Las rarezas admitidas son `common`, `rare`, `special` y `legendary`, con pesos de 62, 26, 10 y 2 por tirada. El cofre entrega tres tiradas por 750 monedas. Cada copia repetida incrementa la cantidad de la carta.
