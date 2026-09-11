# Reportes de falla para ventas directas del Maestro

## Qué se agregó
- En pedidos de Venta rápida con entrega automática aparece `⚠ Reportar falla de este cliente`.
- El administrador puede seleccionar el perfil/cuenta exacta cuando el pedido contiene más de una cuenta.
- Se registra la falla ligada al pedido, cuenta, cliente final y propietario.
- El dashboard reutiliza `Reportes pendientes` para contar estas fallas pendientes de reportar al proveedor.
- Desde Reportes se puede marcar una falla directa como `Reportado al proveedor` y dejar una nota o folio.
- Las opciones existentes de reemplazo por inventario/manual siguen funcionando y conservan la relación con el pedido.
- El reemplazo no reinicia la garantía; usa la lógica de garantía existente.

## Base de datos
Al iniciar el servidor se crean automáticamente, si no existen, estas columnas en `account_reports`:
- `direct_customer_report`
- `direct_customer_name`
- `direct_customer_phone`
- `direct_customer_email`

No requiere migración manual con pgAdmin.

## Despliegue
Reemplazar los archivos del proyecto por esta versión y hacer deploy normal en Railway.
No subir `.env` al repositorio. Mantener las variables de entorno de Railway existentes.
