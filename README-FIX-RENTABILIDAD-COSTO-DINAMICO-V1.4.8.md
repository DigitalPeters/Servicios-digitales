# Servicios Digitales Peters — V1.4.8

## Corrección definitiva del costo de compra dinámico

La rentabilidad del administrador no debe tomar `products.cost_price` como costo real de una cuenta de streaming/perfil.

### Fuente de verdad

Para cada unidad de inventario:

1. `account_traceability.metadata.purchase_price` del evento `ACCOUNT_CREATED` de la carga masiva.
2. `platform_accounts.purchase_price` si no existe la traza.
3. Costo unitario de `mother_accounts` únicamente como respaldo legacy.

Esto conserva el precio de compra con el que se cargó cada unidad y permite tener costos diferentes entre compras de distintos días.

### Precios de venta

La utilidad del administrador se calcula con el ingreso real del administrador:

- Venta directa a vendedor: `precio vendedor - costo de compra`.
- Venta mediante distribuidor: `precio distribuidor - costo de compra`.

El precio final que paga el vendedor de la red no se usa como ingreso del administrador.

### Importante

Se eliminó la propagación que sobrescribía `platform_accounts.purchase_price` al editar el costo de una cuenta madre. La cuenta madre puede conservar un costo total para referencia, pero no modifica el costo individual de las unidades cargadas por CSV.

### Reporte de ventas

El reporte intenta vincular cada pedido con:

- `assigned_platform_account_id`;
- cuentas con `assigned_order_id`;
- cuentas recuperadas en `account_recovery_log`.

Para streaming/perfiles, si no encuentra una unidad vinculada, usa únicamente `orders.product_cost_snapshot` como respaldo histórico de la entrega y no `products.cost_price`.

Los trámites quedan excluidos de la rentabilidad.
