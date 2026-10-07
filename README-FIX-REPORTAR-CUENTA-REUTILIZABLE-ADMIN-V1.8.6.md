# Fix v1.8.6 — Reportar fallas de compras del administrador

## Problema
Una cuenta comprada desde el panel del administrador podía quedar en estado `available`/`disponible` cuando el producto usa inventario reutilizable. El modal de reporte buscaba exclusivamente `status = 'delivered'`, por lo que mostraba:

> No hay un perfil entregado disponible para reportar en este pedido.

## Corrección
Los endpoints administrativos que cargan cuentas reportables ahora aceptan los estados:
- `delivered`
- `available`
- `disponible`

siempre que la cuenta esté ligada exactamente al pedido y al usuario/propietario correspondiente.

El endpoint que registra el reporte también acepta esos estados para evitar que el selector cargue la cuenta pero después rechace el envío.

## Alcance
No se modifica el funcionamiento normal de vendedores, distribuidores ni clientes. La validación sigue exigiendo que la cuenta pertenezca al pedido exacto.
