# Deploy Master V1.2.1

1. Copiar el contenido de este parche sobre el repositorio que ya tiene Master V1.2.
2. Ejecutar:

   node --check server.js
   node --check public/master-admin.js
   node --check public/admin-profit-quality.js
   git diff --check
   git status

3. Revisar los cambios antes de commit/push.
4. Después del deploy, comprobar antes de hacer ventas nuevas:
   - Centro de control: si no hubo ventas en la fecha local de México, Ventas hoy = $0.00 y Utilidad bruta = $0.00.
   - Reporte de ventas de hoy: mismo número de pedidos e importe que Centro de control.
   - Rentabilidad: seleccionar un rango con ventas antiguas que tengan snapshot en 0; debe usar costo de inventario o costo configurado en Productos.

No se requiere restaurar ni modificar PostgreSQL.
