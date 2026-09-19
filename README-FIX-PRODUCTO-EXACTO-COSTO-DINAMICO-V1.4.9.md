# V1.4.9 — Producto exacto para costo dinámico

Se corrige el reporte de ventas para que el costo de compra de una cuenta/perfil se tome únicamente del inventario cuyo `product_name` coincide con el producto realmente vendido.

Ejemplo: `Disney perfil` y `Disney Premium + 7 ESPN Perfil` son productos distintos y no pueden compartir el costo dinámico por una coincidencia genérica de plataforma/categoría.

La coincidencia por `platform` queda únicamente como respaldo para inventario antiguo que no tenga `product_name`.

También se endureció la selección de inventario para nuevas ventas con la misma regla.
