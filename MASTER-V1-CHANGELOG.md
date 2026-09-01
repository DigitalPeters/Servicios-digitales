# Servicios Digitales Peters — Versión Maestra V1

Fecha: 31 de agosto de 2026

Esta versión parte del proyecto original enviado por el propietario y fortalece primero la operación del administrador principal antes de crear el futuro clon comercial.

## Implementado en Master V1

### 1. Centro de operaciones del dueño
Se agregó un bloque exclusivo del administrador principal en el Dashboard con:
- Ventas del día.
- Utilidad bruta estimada del día (venta menos costo registrado).
- Pedidos pendientes / en proceso.
- Reportes de falla pendientes.
- Solicitudes de saldo pendientes y monto total por validar.
- Cuentas disponibles de inventario.
- Cuentas en cuarentena.
- Cuentas madre que vencen dentro de 7 días.
- Lista de pendientes prioritarios ordenada por antigüedad.
- Accesos rápidos a Pedidos, Inventario, Fallas, Saldo, Libro de saldo y Bitácora.

Endpoints nuevos:
- `GET /api/admin/master/operations`
- `GET /api/admin/master/balance-ledger`
- `GET /api/admin/master/audit-log`

Frontend nuevo:
- `public/master-admin.js`

### 2. Libro maestro de movimientos de saldo
Se creó la tabla `balance_ledger`.

A partir de esta versión registra movimientos nuevos como:
- Compra de productos.
- Recarga manual del administrador.
- Retiro manual del administrador.
- Solicitud de saldo aprobada.
- Cobro al completar un pedido manual.
- Reembolso de pedido rechazado.
- Reembolso proporcional por falla.
- Reembolso completo por falla.

Cada registro incluye saldo anterior, saldo posterior, monto, tipo, usuario, referencia y fecha.

Importante: no se fabrican movimientos históricos anteriores a Master V1. El libro empieza a ser confiable desde la activación de esta versión.

### 3. Bitácora administrativa
Se creó la tabla `admin_audit_log` para comenzar a registrar acciones sensibles, entre ellas:
- Agregar/quitar saldo.
- Aprobar/rechazar solicitudes de saldo.
- Cambio de estado de pedidos.
- Reemplazo manual.
- Reinicio de contraseña de emergencia.
- Movimiento de cuentas a cuarentena.
- Liberación y descarte de cuentas de cuarentena.

La bitácora evita guardar contraseñas, comprobantes e imágenes sensibles dentro de metadata.

### 4. Seguridad de sesiones
Se agregó `users.token_version`.

El middleware de autenticación ahora:
- Verifica que el usuario siga existiendo.
- Verifica que el acceso siga habilitado.
- Permite invalidar sesiones anteriores mediante `token_version`.
- Comprueba el estado del panel propietario y su jerarquía antes de permitir una petición.

Esto hace que una suspensión pueda afectar también sesiones ya abiertas en la jerarquía del panel.

### 5. Botón de emergencia de contraseña
Se eliminó la contraseña universal `123456`.

Ahora:
- Genera una contraseña temporal aleatoria.
- Incrementa `token_version`, cerrando sesiones anteriores.
- Marca `must_change_password`.
- Muestra aviso al usuario hasta que cambie la contraseña.
- Registra el evento en bitácora sin guardar la contraseña temporal.

### 6. Aislamiento reforzado
Se corrigieron operaciones que podían trabajar de forma global:
- `/api/admin/reemplazo-manual-seguro` ahora exige autenticación de administrador y valida pertenencia.
- Reembolsos proporcional/completo validan alcance del panel.
- Actualización administrativa de pedido valida alcance del panel.
- Verificación de vencimientos y cuarentena respeta `owner_admin_id`.
- Listado, liberación, descarte e historial de recuperación respetan el propietario.

### 7. Separación de KatalogoClick
Se eliminaron referencias fijas a `katalogoclick.com` dentro del flujo de paneles.

El dominio se obtiene desde `PANEL_BASE_DOMAIN` y las URLs se generan en servidor mediante `buildPanelUrl()`.

Para la instalación actual el valor de ejemplo es:
`PANEL_BASE_DOMAIN=serviciosdigitalespeters.com`

Cuando se cree el clon comercial bastará configurar el nuevo dominio sin volver a escribir el frontend.

### 8. JWT sin secreto predecible
Se eliminó el fallback fijo `mi_super_secreto`.
Si `JWT_SECRET` no está configurado se genera uno temporal y se muestra una advertencia. Para producción debe configurarse un secreto largo y estable.

## Cambios de base de datos automáticos
Al iniciar el servidor se crean/agregan, si no existen:
- `users.token_version`
- `users.must_change_password`
- tabla `balance_ledger`
- tabla `admin_audit_log`
- índices correspondientes

No se borran tablas ni datos existentes.

## Siguiente bloque recomendado de Versión Maestra
1. Venta / pedido manual rápido desde el Dashboard del dueño.
2. Proveedores y compras de inventario.
3. Pronóstico de stock por velocidad de venta.
4. Búsqueda global (usuario, pedido, correo de cuenta, reporte, referencia).
5. Auditoría endpoint por endpoint antes de generar el clon comercial.
6. Respaldos/restauración documentados y probados.
