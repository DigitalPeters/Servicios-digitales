# Master V1.5.1 - Trazabilidad, entregas y proveedor de inventario

## Trazabilidad global
El botón **Trazabilidad** prioriza la historia completa de una cuenta/perfil. Cuando existen datos muestra:
- ingreso manual, carga masiva CSV, entrega manual o reemplazo;
- fecha de ingreso y lote de carga;
- proveedor y costo de la cuenta madre;
- vencimiento del ciclo/garantía a 30 días;
- pedidos asociados con número, comprador y vendedor/distribuidor;
- modalidad cuenta completa o perfil;
- fallas/reportes;
- si la cuenta fue reportada o usada como reemplazo;
- recuperaciones y reemplazos de cuenta madre.

## Pedidos por entregar
Se incorpora una bandeja **Pedidos por entregar** en el Centro de control. Prioriza productos manuales y muestra vendedor/distribuidor, producto, pedido, monto, estado, fecha y motivo. El botón **Atender** abre el pedido en el panel administrativo.

## Proveedor al ingresar inventario
### Ingreso manual
El campo Proveedor usa sugerencias del módulo Proveedores y se guarda en la cuenta madre.

### Carga masiva
Se agrega **Proveedor para esta carga masiva**. Se usa como proveedor predeterminado sólo cuando la fila del CSV no trae `proveedor`. Si una fila sí lo trae, el valor de la fila tiene prioridad.

La migración es aditiva y no borra inventario, pedidos ni historial.
