# Servicios Digitales Peters — V1.4.8
## Corrección de contabilidad de trámites y ventas del día

### Problema corregido
Los reportes de **Ventas hoy** y **Reporte de ventas** estaban excluyendo los productos identificados como trámites del cálculo de costo. Eso hacía que una venta de trámite pudiera aparecer con costo $0 y, por consecuencia, inflara artificialmente la ganancia. La exclusión también provocaba que el total de Ventas hoy no coincidiera con las ventas reales del día.

### Regla financiera aplicada
Para cada pedido exitoso:

- **Venta real:** `orders.amount`, excepto cuando la venta pertenece a un vendedor de un distribuidor y existe `distributor_cost_snapshot`; en ese caso el ingreso real del administrador es ese precio del distribuidor.
- **Costo de un trámite:** primero `orders.product_cost_snapshot` (costo guardado en el momento de la venta); si el histórico no lo tiene, `products.cost_price`.
- **Costo de streaming/cuentas:** se conserva la lógica existente de costo real del inventario, snapshot y respaldos.
- **Ganancia:** ingreso real del administrador − costo real del producto.

### Pantallas/endpoints corregidos
- `/api/admin/sales-report`
  - Ventas hoy
  - Reporte de ventas
  - Venta por usuario
  - Venta por producto
  - Costo total
  - Ganancia total
  - Detalle por pedido
- `/api/admin/master/operations`
  - KPI de Ventas hoy
  - Utilidad bruta del día

### Qué NO se modificó
- Inventario de cuentas streaming.
- Costos históricos de cuentas y perfiles.
- Reglas de precios para vendedores/distribuidores.
- Flujo de compras, entregas, saldo y reembolsos.
- Rentabilidad por proveedor: los trámites siguen fuera de la distribución por proveedor/inventario porque no tienen cuenta madre/proveedor.

### Compatibilidad histórica
Los pedidos antiguos que tengan `product_cost_snapshot` conservan ese costo. Si un trámite antiguo no tiene snapshot de costo, el reporte usa el `cost_price` actual del producto como respaldo y lo identifica en el detalle como `tramite:producto`.
