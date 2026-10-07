# Fix — Reportar fallas en compras propias del administrador

## Problema
Las compras realizadas por el administrador desde su propio panel se guardaban como pedidos normales (`orders.user_id = admin`), pero la interfaz administrativa solo mostraba el botón de reporte para `admin_quick_sale` (ventas directas a cliente final). Por eso el administrador no podía reportar una falla de una cuenta que él mismo había comprado.

## Corrección de raíz
- Se agregó `GET /api/admin/my-purchase/order-accounts` para obtener las cuentas entregadas del pedido propio del administrador.
- El endpoint exige que `orders.user_id = req.user.id`, que no sea Venta rápida, que el pedido esté en `exito` y que la cuenta esté `delivered`.
- La UI de Pedidos de administrador ahora muestra **“⚠ Reportar falla de mi compra”** únicamente en compras propias exitosas con cuenta entregada.
- El reporte se registra mediante el flujo existente `/api/account-reports`, conservando `order_id`, `reported_account_id`, proveedor, reemplazos, reembolsos y trazabilidad.
- Se selecciona el ID exacto de la cuenta/perfil, por lo que también funciona cuando el mismo correo se utiliza en varias plataformas.
- No se modifica el flujo existente de vendedores ni el flujo de Venta rápida a clientes finales.

## Validación
- `node --check` de todos los archivos JavaScript: OK.
- No se cambiaron tablas ni se requiere migración SQL nueva.
