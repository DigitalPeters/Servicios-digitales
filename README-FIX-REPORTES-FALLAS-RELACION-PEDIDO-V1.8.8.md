# Fix raíz — Reportes de fallas ligados al pedido

## Problema
Los perfiles/cuentas reutilizables podían quedar con `platform_accounts.assigned_order_id` apuntando únicamente al último pedido. Además, varios flujos de reportes exigían `status = 'delivered'`.

Eso provocaba que una compra sí apareciera en Pedidos, pero el vendedor o administrador no pudiera reportar ese perfil.

## Solución
Se creó `order_platform_accounts`, una relación histórica permanente entre:

- `order_id`
- `platform_account_id`
- `user_id`
- `relation_type` (`purchase` / `replacement`)

El sistema la rellena automáticamente para compras nuevas y hace backfill de pedidos históricos usando la relación que todavía existe en `orders.assigned_platform_account_id` y `platform_accounts.assigned_order_id`.

## Reglas nuevas
Un perfil puede reportarse si:

1. pertenece al pedido mediante `order_platform_accounts`;
2. el pedido pertenece al usuario que reporta;
3. el pedido está en `exito`;
4. la cuenta no está `failed`, `discarded` ni `recovery_pending`;
5. no existe un reemplazo ya entregado para ese mismo reporte.

El estado `available` / `disponible` ya no impide reportar una cuenta reutilizable que fue vendida y quedó disponible para reutilización.

## Flujos cubiertos
- Compra normal automática.
- Compra reutilizable.
- Compra de combo.
- Entrega manual registrada por el administrador.
- Compra propia del administrador.
- Venta rápida a cliente directo.
- Reemplazos automáticos y manuales.

## Importante
No se utiliza `assigned_order_id` como única fuente histórica para saber a qué pedido perteneció una cuenta reutilizable. Ese campo sigue existiendo para operación/inventario actual, mientras `order_platform_accounts` conserva la trazabilidad histórica.
