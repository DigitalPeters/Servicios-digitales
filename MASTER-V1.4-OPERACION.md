# Servicios Digitales Peters — Master V1.4

## Operación del dueño

Esta versión continúa la Versión Maestra V1.3 y añade herramientas para operar el negocio antes de crear el clon comercial.

### 1. Venta rápida desde el administrador
- Selección de vendedor/cliente y producto.
- Usa el precio efectivo configurado para ese usuario, con opción de modificar el monto en la venta.
- Permite indicar transferencia, efectivo, saldo u otro método.
- Puede descontar el saldo del vendedor y deja movimiento en `balance_ledger`.
- Para streaming/combo puede tomar inventario y entregar automáticamente.
- Para trámites/manuales puede dejar el pedido pendiente o marcarlo como éxito.
- Registra la operación en `admin_audit_log`.
- Las ventas externas no se cobran después del saldo al cambiar el pedido a éxito.

### 2. Buscador global
Busca sin recorrer módulos por:
- usuario/nombre/correo/ID;
- pedido/ID/producto/cliente;
- producto;
- cuenta de inventario;
- cuenta madre/proveedor;
- reporte de falla.

Atajo de teclado: `Ctrl + K`.

### 3. Ficha 360° del usuario
Muestra:
- saldo actual;
- pedidos exitosos y pendientes;
- ventas, costo y utilidad;
- reportes abiertos;
- últimos pedidos;
- movimientos recientes del libro de saldo.

### 4. Proveedores y compras
Nuevas tablas:
- `suppliers`
- `inventory_purchases`

Permiten guardar datos del proveedor y registrar compras de inventario sin modificar el historial de las cuentas madre. El resumen cruza los proveedores escritos previamente en `mother_accounts.provider_name` con los proveedores formales.

### 5. Alertas de stock crítico
El Centro de control incorpora productos de stock limitado con 2 unidades o menos dentro de Atención prioritaria.

## Migraciones automáticas
Al iniciar la aplicación se crean, si no existen:
- `orders.payment_source`
- `orders.admin_quick_sale`
- `orders.created_by_admin_id`
- tabla `suppliers`
- tabla `inventory_purchases`

No se eliminan columnas ni datos existentes.
