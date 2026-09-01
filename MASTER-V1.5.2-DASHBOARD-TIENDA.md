# Master V1.5.2 — Dashboard limpio, venta a cliente final y tienda

## Cambios funcionales

- El Centro de control conserva como accesos operativos superiores:
  - Pedidos por atender.
  - Fallas pendientes.
  - Saldo por validar.
- Se eliminan sus accesos duplicados dentro de **Administrar el negocio**.
- `Venta rápida` queda únicamente como acción superior y ahora representa una venta directa del administrador a un cliente final.
- La venta rápida ya no solicita vendedor/distribuidor ni descuenta saldo. Guarda nombre, WhatsApp y correo del cliente final en la trazabilidad del pedido.
- Se agrega **Tienda** en Administrar el negocio.
- La Tienda permite elegir un vendedor o distribuidor y visualizar el precio efectivo que ese usuario verá, comparado con el precio base de Productos.
- Incluye búsqueda de productos y disponibilidad/stock.
- La Trazabilidad global también puede localizar ventas rápidas por el nombre/WhatsApp/correo guardado del cliente final.

## Base de datos

Esta versión no crea tablas ni columnas nuevas.

## Compatibilidad

Parte de Master V1.5.1 y conserva trazabilidad, pedidos por atender, proveedores, rentabilidad y controles anteriores.
