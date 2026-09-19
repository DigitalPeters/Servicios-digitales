# Servicios Digitales Peters — V1.4.11

## Corrección de acceso a Rentabilidad

Se corrigió el error PostgreSQL:

`missing FROM-clause entry for table "pa"`

La consulta de vínculos históricos de Rentabilidad utilizaba `pa.purchase_price` sin incluir `platform_accounts pa` en el `FROM` de la consulta externa.

### Cambio

Se agregó la unión:

`JOIN platform_accounts pa ON pa.id = l.account_id`

Esto no cambia las reglas de cálculo de rentabilidad ni los precios. Solo corrige la consulta para que el apartado Rentabilidad pueda cargar correctamente.

La lógica de costo dinámico y coincidencia exacta de producto de V1.4.10 se conserva.
