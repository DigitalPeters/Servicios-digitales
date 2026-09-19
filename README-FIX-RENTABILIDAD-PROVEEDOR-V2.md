# Servicios Digitales Peters — Fix Rentabilidad / Ventas sin proveedor V2

## Problema corregido
La tarjeta de Rentabilidad podía mostrar ventas en **Sin proveedor** mientras la sección **Ventas sin proveedor** mostraba 0. Esto ocurría porque las ventas mostradas como Sin proveedor podían ser ventas históricas que ya no conservaban vínculo con una cuenta madre.

## Comportamiento nuevo
- La sección **Ventas sin proveedor** ahora incluye:
  1. ventas con cuenta madre vinculada pero sin proveedor;
  2. ventas históricas sin cuenta madre vinculada y sin proveedor.
- La lista se construye con la misma lógica de identificación de venta usada por Rentabilidad, por lo que el contador debe coincidir con las ventas sin proveedor.
- Si la venta tiene cuenta madre, asignar proveedor actualiza la cuenta madre y su histórico.
- Si la venta no tiene cuenta madre, asignar proveedor guarda una asignación histórica directamente en la venta (`orders.profitability_provider_override`).
- Las ventas históricas sin cuenta madre siguen usando su costo guardado en la venta (`product_cost_snapshot`) o el respaldo existente, por lo que la asignación del proveedor no inventa costos.
- Las ventas con proveedor manual a nivel de venta aparecen en el proveedor correspondiente en Rentabilidad.
- Se incrementó la versión del JS a `admin-profit-quality.js?v=4` para evitar caché del navegador.

## Base de datos
El servidor crea automáticamente, si no existe:

`orders.profitability_provider_override TEXT DEFAULT ''`

No requiere ejecutar SQL manualmente si el servidor tiene permisos para ejecutar sus migraciones de inicio, como las demás columnas del proyecto.

## V2.1 — Exclusión de trámites

Los pedidos identificados como **trámites digitales** quedan fuera de la rentabilidad por proveedor/inventario y de la bandeja **Ventas sin proveedor**. La detección usa la categoría histórica/actual del producto y, como respaldo, el nombre histórico/actual cuando contiene "tramite/trámite".

Esto evita que servicios que no tienen proveedor, cuenta madre ni perfiles aparezcan artificialmente como **Sin proveedor**.
