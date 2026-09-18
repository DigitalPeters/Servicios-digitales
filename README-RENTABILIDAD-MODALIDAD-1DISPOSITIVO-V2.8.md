# Servicios Digitales Peters — Rentabilidad v2.8

## Corrección: cuentas de 1 dispositivo vs cuentas por perfiles

La bandeja **Cuentas madre pendientes de completar** ahora usa exclusivamente `mother_accounts.sell_by_profile` para determinar si una cuenta requiere datos de costo por perfil.

- `sell_by_profile = false`: cuenta vendida para 1 dispositivo. No se considera pendiente por costo por perfil.
- `sell_by_profile = true`: cuenta controlada/vendida por perfiles. Puede requerir cantidad de perfiles y costo por perfil.

Se eliminó la inferencia anterior basada en cantidad de registros de `platform_accounts` o en que el nombre del producto contenga la palabra "perfil", porque esas señales podían producir falsos pendientes.

La edición rápida conserva proveedor y costo de cuenta completa para las cuentas de 1 dispositivo. En esas filas se muestra **1 dispositivo** y **No aplica** para costo por perfil.

Al guardar desde la bandeja, no se cambia accidentalmente una cuenta de 1 dispositivo a cuenta por perfiles.
