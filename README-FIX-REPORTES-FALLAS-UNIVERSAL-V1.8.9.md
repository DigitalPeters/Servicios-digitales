# Corrección raíz de reportes de fallas — v1.8.9

## Problema
El formulario de reportes podía mostrar `Cargando...` y después indicar que no había una cuenta ligada al pedido. El flujo dependía demasiado de la tabla `order_platform_accounts`, aunque algunos pedidos históricos conservaban la relación solamente en `orders.assigned_platform_account_id` o `platform_accounts.assigned_order_id`. Además, el selector de vendedores/distribuidores identificaba cuentas por ID sin enviar siempre el pedido concreto, lo que es ambiguo cuando se reutiliza el mismo perfil en varios pedidos.

## Correcciones
- Se unificó la resolución histórica de cuentas por pedido usando `order_platform_accounts`, `orders.assigned_platform_account_id`, `platform_accounts.assigned_order_id` y `account_recovery_log`.
- Los endpoints de cuentas reportables para vendedores, compras propias del administrador y ventas directas usan la misma resolución.
- El registro de fallas valida la relación pedido-cuenta y acepta `order_id` explícito para evitar confundir pedidos que reutilizan una cuenta.
- Se corrigió el selector del usuario para conservar juntos el ID de la cuenta y el ID del pedido.
- La migración sincroniza `order_platform_accounts.user_id` con el comprador real de `orders.user_id`.
- Si la carga falla, la interfaz ya no se queda visualmente en `Cargando...`; muestra un estado de error visible.
- La respuesta al registrar el reporte ahora confirma correctamente si se guardó con evidencia o sin ella.
- Se incrementaron las versiones de caché de los scripts afectados.

## Archivos modificados
- `server.js`
- `public/app.js`
- `public/user-orders-balance.js`
- `public/master-ops-v14.js`
- `public/index.html`
- `package.json` y `package-lock.json`

## Despliegue
Conservar las variables de entorno existentes. No subir `.env`, `.git` ni `node_modules`. La tabla histórica ya se crea automáticamente durante el inicio del servidor; no se requiere ejecutar SQL manualmente.

## Validación realizada
Se ejecutaron comprobaciones de sintaxis JavaScript y prueba de integridad del ZIP. No se ejecutó una compra ni un reporte contra la base de datos de producción, por lo que debe probarse un reporte real tras desplegar.
