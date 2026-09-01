# Master V1.2.2 — Histórico de costos y tablas de rentabilidad

## Correcciones
- Reconstruye el vínculo histórico pedido → cuenta/perfil usando tres fuentes: `platform_accounts.assigned_order_id`, `orders.assigned_platform_account_id` y `account_recovery_log`.
- Una cuenta liberada/reutilizada sigue aportando su proveedor a la venta histórica.
- Si una venta no conserva vínculo histórico, el costo sigue tomándose del snapshot o de `Productos`; se agrupa bajo **Sin proveedor** y se muestra una advertencia de diagnóstico.
- El Centro de control usa el mismo vínculo histórico para resolver costo de inventario antes de caer al costo actual de Producto.
- Se crea de forma segura `account_recovery_log` si faltara en una instalación nueva.
- Las tablas de Proveedores y Cuenta madre ahora tienen desplazamiento horizontal real; ya no se comprimen ni cortan las columnas de la derecha.
