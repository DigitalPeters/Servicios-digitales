# Master V1.5.3 — Alertas de renovación y cuentas madre

## Cambios

- El aviso de renovación de clientes se redujo a los **3 días previos** al vencimiento.
- El ciclo mostrado para renovaciones de streaming es de **30 días desde la venta**.
- El contador de renovaciones sólo considera pedidos exitosos con evidencia de entrega de cuenta/perfil.
- Se agregó un KPI independiente **Cuentas madre por vencer**.
- Las cuentas madre próximas a vencer usan un margen de **5 días**, para dar tiempo a renovar con el proveedor o comprar reemplazo.
- Se separan las cuentas madre **próximas a vencer** de las **ya vencidas que siguen activas**; estas últimas ya no inflan el contador de próximos vencimientos.
- Las cuentas madre próximas a vencer aparecen también en **Atención prioritaria** con proveedor y perfiles disponibles.
- La sección de alertas muestra una recomendación operativa: renovar/reponer de inmediato cuando queda poco inventario o revisar renovación cuando todavía hay margen.
- Las fechas se muestran como fechas locales de México para evitar desplazamientos de un día por UTC.

## Umbrales

- Renovación cliente: 3 días.
- Cuenta madre / proveedor: 5 días.
- Ciclo de renovación cliente: 30 días desde la venta.

## Base de datos

No agrega tablas ni columnas. No borra ni modifica ventas históricas.
