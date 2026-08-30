# Servicios Digitales — Fix ganancias de distribuidores y fechas de reemplazo

Fecha: 2026-08-30

## 1. Ganancias del distribuidor

### Problema
El backend ya contaba con `/api/distributor/earnings`, pero la matriz final de visibilidad ocultaba explícitamente el acceso `Ganancias` para el rol distribuidor. También había una detección demasiado estricta para distribuidores heredados/antiguos.

### Corrección
- Se muestra `Mis vendedores` y `Ganancias` al distribuidor real.
- Se mantiene oculto para vendedores normales.
- Se reforzó la detección usando `account_type`, `is_subadmin` e `is_panel_admin`.
- Se conserva el cálculo existente:
  - venta = lo cobrado al vendedor;
  - costo distribuidor = snapshot guardado en la compra;
  - ganancia = venta - costo distribuidor.
- Para pedidos históricos sin snapshot, el reporte mantiene el fallback existente al costo actual y lo identifica como estimado.

No se alteran saldos, pedidos ni precios.

## 2. Fecha de compra/vencimiento al reemplazar una cuenta

### Problema
La fecha original se obtenía correctamente como `YYYY-MM-DD`, pero después JavaScript hacía `new Date('YYYY-MM-DD')`. Ese formato se interpreta como medianoche UTC. Al mostrarlo en `America/Mexico_City`, el calendario retrocedía un día.

Ejemplo del error anterior:
- fecha real: 13/08/2026
- vencimiento real (+28): 10/09/2026
- ticket de reemplazo podía mostrar: 12/08/2026 y 09/09/2026

### Corrección
- Las fechas de servicio de PostgreSQL se tratan como fechas de calendario, no como instantes UTC.
- El reemplazo sigue tomando la fecha original del primer pedido.
- El vencimiento sigue siendo exactamente esa fecha + 28 días.
- Un reemplazo no reinicia la garantía.
- El ticket reconstruido del reemplazo conserva la misma fecha original y el mismo vencimiento.

Ejemplo corregido:
- primera venta: 13/08/2026
- vencimiento: 10/09/2026
- reemplazo por falla: mantiene 13/08/2026 y 10/09/2026

## Archivos modificados

- `server.js`
- `public/app.js`
- `public/admin-users-distributor.js`
- `public/index.html` (solo cache-busters JS)

## Compatibilidad

No se eliminan ni renombran tablas o columnas. No se modifican login, compras, vendedores, distribuidores, saldos, inventario, reportes ni estructura de base de datos.

## Pruebas sugeridas después del deploy

1. Entrar como distribuidor y confirmar que aparecen `Mis vendedores` y `Ganancias`.
2. Hacer una compra desde uno de sus vendedores y abrir `Ganancias`; debe aparecer la venta, el costo del distribuidor y la diferencia como ganancia.
3. Tomar un pedido cuya primera compra sea, por ejemplo, 13/08/2026 y venza 10/09/2026.
4. Reportar la cuenta y hacer un reemplazo.
5. Confirmar que el nuevo ticket siga mostrando 13/08/2026 y 10/09/2026, no un día antes y no 28 días nuevos desde el reemplazo.
