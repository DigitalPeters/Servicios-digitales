# Servicios Digitales Peters — V1.4.7
## Costo de compra dinámico desde la carga masiva

### Regla financiera
La rentabilidad del administrador usa como costo real el costo capturado en la cuenta de inventario:

1. `platform_accounts.purchase_price` — precio_compra de la fila del CSV.
2. Si una cuenta histórica fue alterada por una versión anterior, se recupera el `purchase_price` guardado en la traza `ACCOUNT_CREATED`.
3. Solo como respaldo se usa el costo unitario de la cuenta madre.
4. El `products.cost_price` queda como último respaldo para ventas sin inventario vinculado.

### Ejemplo
- Disney perfil comprado al proveedor: $11
- Precio vendedor: $30
- Precio distribuidor: $20
- Venta directa de vendedor: $30 - $11 = $19
- Venta del distribuidor: $20 - $11 = $9

Si mañana el CSV trae Disney a $12, las nuevas cuentas quedan con costo $12. No se sobrescribe cada cuenta con el costo fijo del producto.

### Corrección de carga masiva
La carga CSV ya no vuelve a copiar `mother_accounts.purchase_cost_total / perfiles` sobre `platform_accounts.purchase_price`. Cada fila conserva el precio_compra exacto del CSV.

El total de la cuenta madre se recalcula de forma informativa con los costos actuales de sus unidades, pero no reemplaza los snapshots individuales.

### Lista de precios para distribuidor
La tabla de Panel Maestro conserva tres precios separados:

- Precio de compra: último costo real registrado en inventario.
- Precio vendedor: precio general del producto.
- Precio distribuidor: precio especial que el administrador cobra al distribuidor.
- Ganancia admin: precio distribuidor - precio de compra.

### Rentabilidad
Se corrigieron:
- Panel Maestro / reporte de ventas.
- Rentabilidad y Calidad.
- Rentabilidad por proveedor.
- Histórico acumulado por cuenta madre.
- Bandeja de ventas sin proveedor.

Esto evita que una venta como Vix $15 aparezca con costo $15 solo porque `products.cost_price` vale $15, cuando la cuenta cargada tenía otro precio de compra.
