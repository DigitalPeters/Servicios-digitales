# Reporte preciso de actividad de vendedores V1

## Objetivo
Agregar al Panel admin de Servicios Digitales Peters un reporte separado para identificar con precisión a los vendedores que pueden limpiarse.

## Clasificaciones
1. **Se registró y nunca vendió**: 0 ventas exitosas y nunca aparece una carga de saldo registrada.
2. **Cargó saldo pero nunca vendió**: existe al menos una carga de saldo (recarga administrativa o solicitud de saldo aprobada), pero 0 ventas exitosas.
3. **Vendió pero lleva más de 30 días sin movimiento**: tiene ventas exitosas, ha cargado saldo y su último movimiento registrado (venta, solicitud de saldo, reporte/falla o movimiento de saldo) supera 30 días.
4. **Activo o reciente**: tiene ventas y actividad dentro de los últimos 30 días.
5. **Otros casos**: situaciones que no deben entrar automáticamente en la limpieza.

## Precisión
El saldo actual NO se usa para decidir si un vendedor alguna vez cargó saldo. Se consulta `balance_ledger` y, como respaldo histórico, `balance_requests` aprobadas.

Las ventas se consideran únicamente con `orders.status = 'exito'`.

## Acciones
Cada usuario del reporte tiene:
- **Deshabilitar/Habilitar**.
- **Eliminar permanentemente**.

La eliminación permanente es deliberadamente segura: el servidor la bloquea si existen pedidos, solicitudes de saldo, reportes, movimientos contables o movimientos de ganancias que deban conservarse. En esos casos se debe deshabilitar para mantener la trazabilidad histórica.

## Alcance
- Admin principal: usuarios directos globales, excluyendo administradores, distribuidores y propietarios de panel.
- Propietario de panel: vendedores directamente ligados a ese panel.

## Archivos principales
- `server.js`: endpoint `/api/admin/user-activity-report` y validación reforzada de eliminación.
- `public/index.html`: panel separado dentro de Usuarios.
- `public/admin-user-activity.js`: interfaz, clasificación y acciones.
