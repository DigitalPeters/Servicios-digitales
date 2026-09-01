# Checklist de despliegue — Master V1

1. Haz respaldo de PostgreSQL antes del primer despliegue.
2. Configura `JWT_SECRET` con una cadena larga y aleatoria. No uses el valor de ejemplo.
3. Conserva tu `DATABASE_URL` únicamente en variables del hosting; no la subas al proyecto.
4. Configura `PANEL_BASE_DOMAIN=serviciosdigitalespeters.com` para el sistema actual, o el dominio que realmente uses.
5. Despliega la aplicación.
6. Al arrancar, `initDatabase()` agregará las columnas/tablas nuevas sin borrar información existente.
7. Entra como administrador principal y verifica el bloque `VERSIÓN MAESTRA · Centro de operaciones`.
8. Haz una recarga de saldo de prueba pequeña y verifica que aparezca en `Libro de movimientos de saldo`.
9. Prueba el reinicio de emergencia con un usuario de pruebas: debe entregar una contraseña temporal aleatoria y cerrar la sesión anterior.
10. Prueba cuarentena únicamente con una cuenta de prueba.

## Nota de seguridad
El ZIP entregado de Master V1 está preparado sin `.env`, `.git` ni `node_modules`. Instala dependencias con `npm install` y utiliza variables de entorno del hosting.
