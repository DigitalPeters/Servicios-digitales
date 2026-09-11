# Fix v1.1 — Reportes de clientes directos visibles para el Maestro

Se corrigió el problema por el cual un reporte creado por el administrador desde una Venta rápida podía quedar ligado por error al ID del administrador en `owner_admin_id`, haciendo que el Centro de control y `/api/admin/account-reports` no lo mostraran en el alcance global.

Cambios:
- Los reportes de Venta rápida creados por el administrador principal ahora conservan `owner_admin_id = NULL`, igual que la venta directa global.
- Los reportes de propietarios/paneles conservan el `owner_admin_id` correcto.
- Al iniciar el servidor se corrigen automáticamente reportes directos anteriores para heredar el `owner_admin_id` de su pedido de Venta rápida.
- La consulta de reportes y el contador del Centro de control también reconocen la relación directa con el pedido como respaldo de alcance.
- No se modifica el flujo de reportes de vendedores.
- `node --check server.js` validado correctamente.
