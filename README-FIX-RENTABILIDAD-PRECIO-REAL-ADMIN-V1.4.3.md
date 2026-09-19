# Fix V1.4.3 — Rentabilidad contra precio real cobrado por el admin

## Regla definitiva
La utilidad del administrador se calcula siempre como:

**Ingreso real del administrador - costo real de compra al proveedor**

Ejemplo Disney perfil:
- Costo admin/proveedor: $11
- Precio al vendedor: $30 -> utilidad admin: $19
- Precio al distribuidor: $20 -> utilidad admin: $9

Si un vendedor pertenece a un distribuidor y compra a $30, el pedido conserva `distributor_cost_snapshot = $20`; para la rentabilidad del admin se usan esos $20 como ingreso del admin, no los $30 del vendedor final.

Si la venta es directa a un vendedor o a un distribuidor y no existe `distributor_cost_snapshot`, se usa `orders.amount`.

## No se usa
- `products.price` como ingreso teórico del admin.
- El precio de lista para reemplazar el precio realmente cobrado.

## Costos
El costo sigue priorizando el costo real guardado/asignado a la cuenta o perfil, con los respaldos existentes. Los trámites continúan fuera de la rentabilidad.

## Archivos modificados
- `server.js`
- `public/master-admin.js`
