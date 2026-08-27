# Corrección de jerarquía de administradores

Fecha: 2026-08-26

## Objetivo
Separar de forma estable al administrador principal del propietario de un panel rentado.

- `ADMIN_EMAIL` identifica al administrador principal cuando está configurado.
- La pertenencia de un usuario a un panel se determina por `admin_panels.owner_user_id`.
- Ya no se usa el correo como relación principal entre `users` y `admin_panels`.
- Crear un panel nuevo ya no actualiza una cuenta existente mediante `ON CONFLICT ... DO UPDATE`.
- El administrador principal no puede ser convertido accidentalmente en panel rentado.

## Variable requerida en el proyecto principal
En Railway/Render del proyecto principal:

`ADMIN_EMAIL=tizacell75@gmail.com`

No incluir secretos en este archivo.

## Validación
Se comprobó la sintaxis con `node --check` para:

- `server.js`
- `public/app.js`
- `public/auth-session.js`
