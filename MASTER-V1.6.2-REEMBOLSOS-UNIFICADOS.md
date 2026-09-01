# Master V1.6.2 — Reembolsos unificados

## Corrección principal
- Inteligencia financiera y el detalle de Reembolsos usan ahora el mismo origen de datos.
- El reembolso se atribuye al día real en que se aplicó, no al día de creación del pedido.
- Un reembolso de hoy sobre una venta antigua aparece hoy en ambos lugares.
- La utilidad neta y el ingreso admin se recalculan con ese mismo importe.
- Los ajustes de ganancia de distribuidores también se atribuyen por la fecha real del movimiento.

## Interfaz
- Se elimina el acceso duplicado de Reembolsos dentro de “Administrar el negocio”.
- La tarjeta Reembolsos dentro de Inteligencia es el acceso principal.
- Al abrir el detalle, hereda exactamente el rango Desde/Hasta seleccionado en Inteligencia.

## Base de datos
No crea tablas ni columnas nuevas y no modifica datos históricos.
