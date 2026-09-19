# FIX Reporte de ventas V1.4.5

## Problema
El Panel Maestro mostraba `Error generando reporte de ventas` después del ajuste de rentabilidad real.

## Causa
La nueva fórmula de ingreso administrativo utiliza `users.owner_user_id` para distinguir ventas de usuarios pertenecientes a distribuidores, pero las consultas de resumen y de ventas por producto no estaban incluyendo la tabla `users`. PostgreSQL rechazaba la consulta.

## Corrección
Se añadió `LEFT JOIN users ON users.id = orders.user_id` en las consultas de resumen y ventas por producto del endpoint `/api/admin/sales-report`.

No se cambia la fórmula de negocio:
- vendedor directo: ingreso admin = `orders.amount`
- venta mediante distribuidor: ingreso admin = `distributor_cost_snapshot`
- costo: primero costo real de cuenta madre/perfil; después snapshots/fallbacks
- trámites siguen fuera de la rentabilidad cuando corresponde a la lógica existente

## Validación
`node --check server.js` pasa correctamente.
