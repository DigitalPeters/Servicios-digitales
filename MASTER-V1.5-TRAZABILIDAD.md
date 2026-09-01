# Master V1.5 - Trazabilidad y pedidos por entregar

## Objetivo
Convertir el buscador global en una herramienta de trazabilidad operativa y dejar visible la cola de pedidos que requieren entrega/intervencion del administrador.

## Trazabilidad global
El boton superior ahora se muestra como **Trazabilidad** y busca en paralelo coincidencias generales e historial de inventario.

Cuando existe una cuenta/perfil relacionado puede mostrar:
- origen de ingreso al inventario;
- fecha de ingreso;
- cuenta madre y perfil;
- fecha oficial y vencimiento de garantia a 30 dias;
- pedido(s) en los que se utilizo la cuenta, incluso si despues fue recuperada;
- comprador y tipo: vendedor, distribuidor o vendedor de distribuidor;
- modalidad: cuenta completa o perfil;
- reportes de falla;
- si la cuenta fue reportada o se utilizo como reemplazo;
- recuperaciones/liberaciones;
- relacion entre cuentas madre reemplazadas.

La busqueda acepta cuenta madre, perfil, PIN, numero de pedido, vendedor y distribuidor.

## Origen de inventario
Se agregan a `platform_accounts`:
- `entry_source`
- `entry_batch_id`

Nuevos registros se marcan como:
- `manual`
- `bulk_csv`
- `manual_delivery`
- `manual_replacement`

Para inventario antiguo, si existe un evento historico `ACCOUNT_CREATED` se marca como `bulk_inferred`. Los registros sin evidencia suficiente permanecen como `legacy` y la interfaz muestra "Historico / origen no registrado".

## Pedidos por entregar
Se agrega una cola visible desde el Centro de control:
- modulo **Pedidos por entregar**;
- modal con pedidos pendientes;
- identifica vendedor/distribuidor;
- muestra producto, monto, estado, fecha y motivo;
- boton **Atender** abre el pedido directamente en el formulario administrativo.

Los productos manuales aparecen primero. Tambien se muestran otros pedidos pendientes que requieren revision del administrador.

## Base de datos
La migracion es aditiva. No borra pedidos, inventario, cuentas madre, fallas ni usuarios.

Tambien se asegura la existencia de `account_traceability` para instalaciones nuevas.
