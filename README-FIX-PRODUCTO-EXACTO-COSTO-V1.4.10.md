# Servicios Digitales Peters — V1.4.10
## Corrección definitiva: costo por producto exacto en reporte de ventas

### Problema
El reporte podía encontrar una cuenta de la misma plataforma/categoría aunque el producto vendido fuera distinto. Ejemplo:
- `Disney perfil`
- `Disney Premium + 7 ESPN Perfil`

Eso podía hacer que el costo de compra del segundo producto terminara aplicado al primero.

### Corrección
El costo dinámico del reporte ahora exige coincidencia exacta, ignorando mayúsculas/minúsculas y espacios externos, entre:
- el nombre real del producto vendido por el pedido (`product_name_snapshot` / producto del pedido), y
- `platform_accounts.product_name` de la cuenta entregada.

La coincidencia por plataforma ya no sirve para cruzar dos productos distintos en este reporte.

### Regla
`Producto vendido exacto -> cuenta entregada del mismo producto -> purchase_price histórico de esa cuenta -> costo de respaldo legacy si no existe costo por unidad.`

### Ejemplo
Si el pedido es `Disney perfil`, nunca debe tomar el costo de `Disney Premium + 7 ESPN Perfil`.

Si el pedido es `Disney Premium + 7 ESPN Perfil`, debe buscar únicamente cuentas de ese producto.
