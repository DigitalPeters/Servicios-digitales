# Master V1.9 — tiempos de proveedor y perfil en trazabilidad

## Cambios
- `account_reports` ahora conserva proveedor, fecha/hora en que se reportó al proveedor, fecha/hora de respuesta y nota de respuesta.
- Al marcar un reporte como `proveedor_reportado`, se registra automáticamente `provider_reported_at`.
- Nuevo endpoint para registrar la respuesta del proveedor, con fecha/hora actual o fecha histórica indicada por el administrador.
- Los reportes existentes con estado `proveedor_reportado` y `reviewed_at` reciben esa fecha como referencia de envío; no se inventa una fecha de respuesta.
- La pantalla de reportes muestra proveedor, fechas y tiempo de respuesta.
- El ranking de proveedores incorpora tiempo promedio de respuesta, reportes medidos, respuestas en <=24 h y pendientes.
- La trazabilidad de cada cuenta muestra el perfil exacto (por ejemplo P1/P2) y PIN asociado en las ventas/entregas.
- La trazabilidad de fallas muestra proveedor y fechas de reporte/respuesta.
- Se conserva la lógica existente de inventario, reemplazos, cuarentena, ventas y multiusuario.
