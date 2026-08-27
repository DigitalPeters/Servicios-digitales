# Implementación inicial de paneles por subdominio

Esta versión mantiene el sistema actual y agrega una primera capa multi-tenant para paneles de venta de servicios digitales, streaming y trámites.

## Qué agrega

- Cada panel puede tener un `slug` y una URL como `https://nombre-negocio.katalogoclick.com`.
- El propietario del panel queda asociado a ese panel como `super admin`/admin existente.
- Los registros hechos desde el subdominio se crean automáticamente como usuarios/vendedores del panel.
- Los vendedores quedan ligados mediante `owner_user_id` y conservan la lógica actual de productos, pedidos, inventario y distribuidores.
- El nombre del negocio se muestra en la pantalla de acceso cuando se entra por el subdominio.
- Desde el admin principal se puede generar un enlace temporal para que el cliente se registre por su cuenta.
- Al terminar el registro, se crea automáticamente el panel y se muestra/genera su subdominio.
- Los paneles existentes se conservan; la base de datos completa `owner_user_id` por correo cuando sea posible.

## Variable de entorno obligatoria en producción

En Railway agrega:

`PANEL_BASE_DOMAIN=katalogoclick.com`

No pongas aquí `https://` ni una ruta.

## DNS

Para que cualquier subdominio funcione, el DNS debe enviar `*.katalogoclick.com` al mismo servicio de Railway que ejecuta esta aplicación. La configuración exacta del registro depende de lo que Railway muestre para el dominio personalizado/wildcard.

## Flujo de prueba

1. En el admin principal abre Panel propio.
2. Selecciona plan y, si corresponde, fecha de vencimiento.
3. Pulsa `Generar enlace para que el cliente se registre`.
4. Envía el enlace al prospecto.
5. El prospecto elige nombre de negocio, captura su nombre, correo, contraseña, teléfono y datos bancarios.
6. El sistema genera un slug, por ejemplo `streaming-juan`.
7. El panel queda en `https://streaming-juan.katalogoclick.com`.
8. El propietario entra como administrador.
9. Comparte esa URL con sus vendedores.
10. Los nuevos registros desde esa URL quedan asociados automáticamente al propietario del panel.

## Seguridad importante

El ZIP de trabajo no incluye `.env`, `.git` ni `node_modules`.

El proyecto original que se recibió tenía una cadena de conexión de base de datos escrita directamente en `server.js`. Se eliminó del código para que Railway utilice `DATABASE_URL` desde las variables de entorno. Por seguridad, si esa credencial llegó a estar activa, debe cambiarse/rotarse en Railway.
