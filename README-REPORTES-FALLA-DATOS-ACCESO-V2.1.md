# Servicios Digitales Peters — Reportes de falla v2.1

## Ajuste
El panel administrativo de Reportes de falla ahora muestra, para el perfil exacto reportado:
- Vendedor que reporta y su correo.
- Correo actual de la cuenta reportada.
- Contraseña actual almacenada para esa cuenta.
- ID/número del perfil reportado.
- Nombre del perfil y PIN cuando existen.
- Pedido original al que está asignada la cuenta.

Los datos se consultan únicamente desde el endpoint administrativo de reportes, por lo que no se exponen en la vista de vendedores.

## Importante
La contraseña mostrada es la que actualmente está guardada en `platform_accounts.account_password`. Si la cuenta fue modificada fuera del sistema, el dato dependerá de la información almacenada en Peters.

## Compatibilidad
Se conserva el seguimiento de proveedor de la versión anterior: fecha de reporte, respuesta, resultado (otra cuenta/reembolso/sin solución/otro), monto recibido y edición posterior de la respuesta.
