# Servicios Digitales Peters — Rentabilidad v2.7

## Ajuste de edición rápida de cuentas madre

La bandeja **Cuentas madre pendientes de completar** ahora usa el dato correcto para la operación comercial por perfiles:

- **Costo cuenta completa** = costo de compra de la cuenta madre.
- **Costo para vendedor · perfil** = `sale_price_profile`, es decir, el importe que paga el vendedor por cada perfil.

El campo ya no captura `profile_cost_override` desde la bandeja rápida.

El costo real de compra por perfil continúa calculándose internamente a partir del costo de compra de la cuenta madre y el número de perfiles (o desde el override interno cuando exista), por lo que no se mezcla con el precio que se cobra al vendedor.

La lista de pendientes también considera faltante el **costo para vendedor · perfil** cuando la cuenta se vende/controla por perfiles.

Al guardar desde la bandeja rápida se conserva cualquier precio de venta completo o configuración existente que no se esté editando.
