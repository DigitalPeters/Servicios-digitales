# Servicios Digitales Peters — Rentabilidad pendientes v2.9

## Cambio
La sección de cuentas madre pendientes ahora determina la información requerida exclusivamente por `mother_accounts.sell_by_profile` (la casilla "Esta cuenta también se controla y vende por perfiles").

- Modalidad 1 dispositivo/cuenta completa: proveedor + costo de compra cuenta completa + precio de venta al vendedor cuenta completa.
- Modalidad por perfiles: proveedor + costo de compra cuenta completa (base del costo automático) + perfiles totales + precio de venta al vendedor por perfil.
- `profile_cost_override` ya no se considera un dato faltante. Si existe, se muestra aparte como revisión porque el costo por perfil debe calcularse automáticamente con costo cuenta completa / perfiles.
- La edición rápida de pendientes conserva la modalidad existente y no la cambia por el número de perfiles físicos cargados.
- Se añadió acción para eliminar el costo manual por perfil y volver al cálculo automático.
