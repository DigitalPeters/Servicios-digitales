# MASTER V1.6.1 — Reembolsos y navegación

## Cambios
- Reembolsos ahora aparece como módulo visible del administrador principal.
- Inteligencia financiera muestra una tarjeta propia con monto y cantidad de pedidos reembolsados.
- El historial de reembolsos incluye pedido, comprador, distribuidor, producto, importe original, monto devuelto, tipo, reporte relacionado y fecha.
- La navegación entre módulos reinicia la posición de la página para no conservar el scroll del módulo anterior.
- Los paneles internos usan margen de scroll para no quedar tapados por la barra superior.

## Base de datos
No agrega tablas ni columnas. El reporte se reconstruye desde orders, account_reports y balance_ledger.
