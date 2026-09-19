# FIX Rentabilidad real del administrador V1.4.4

## Problema corregido
El reporte `Ventas por usuario` / `Ventas por producto` estaba usando `orders.product_cost_snapshot` sin priorizar el costo real configurado en la cuenta madre. Si ese snapshot histórico contenía, por ejemplo, $30 aunque la cuenta madre costara $11 por perfil, la utilidad aparecía negativa.

## Regla definitiva
- Cuenta madre vendida por perfil: costo = `profile_cost_override` o `purchase_cost_total / configured_profile_count`.
- Cuenta madre completa: costo = `purchase_cost_total`.
- Si no existe vínculo con una cuenta madre, se conserva el snapshot/costo de producto como respaldo.
- Venta directa a vendedor: ingreso admin = `orders.amount`.
- Vendedor perteneciente a distribuidor: ingreso admin = `distributor_cost_snapshot` (precio que el distribuidor paga al admin), no el precio final que paga el vendedor.

Ejemplo Disney perfil:
- Costo admin/proveedor: $11
- Venta a vendedor: $30 -> utilidad admin $19
- Venta a distribuidor: $20 -> utilidad admin $9

## Corrección histórica
Al editar/configurar el costo de una cuenta madre, el sistema ahora propaga el costo unitario a las cuentas de inventario y recalcula el `product_cost_snapshot` de los pedidos históricos vinculados cuando todas las cuentas del pedido tienen costo conocido. Esto evita conservar un snapshot incorrecto como $30 cuando la cuenta madre está configurada en $11 por perfil.

## Rentabilidad y calidad
También se prioriza el costo efectivo de la cuenta madre en el endpoint de Rentabilidad y Calidad y en el histórico acumulado, para que las tarjetas por proveedor/cuenta no vuelvan a mostrar pérdidas artificiales por un snapshot antiguo.

## Caché
`admin-commerce.js` pasó de `v=7` a `v=8`.
