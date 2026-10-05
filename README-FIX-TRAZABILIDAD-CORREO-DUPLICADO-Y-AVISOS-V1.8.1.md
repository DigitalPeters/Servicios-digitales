# FIX V1.8.1 · Trazabilidad por cuenta madre y avisos de vencimiento

## 1. Mismo correo en varias plataformas

La búsqueda de trazabilidad por correo ya no depende del correo como identificador único.

Cuando el mismo correo pertenece a más de una cuenta madre, el sistema muestra una lista para elegir la cuenta exacta, con:

- Plataforma / producto
- ID de cuenta madre
- Correo
- Fecha de vencimiento
- Número de perfiles
- Estado

Después de elegir, la trazabilidad se consulta usando `mother_account_id`, evitando mezclar Disney, Prime u otras plataformas que compartan el mismo correo.

## 2. Avisos automáticos por correo

Se agregó un proceso automático que revisa las cuentas madre activas y envía aviso por correo cuando faltan los días configurados.

Por defecto:

- 7 días antes
- 3 días antes
- 1 día antes
- El día del vencimiento

Los avisos se registran en `mother_account_expiration_notifications` con una restricción única por cuenta y día de aviso para evitar duplicados tras reinicios o ejecuciones concurrentes.

El proceso utiliza la infraestructura de Resend ya existente (`RESEND_API_KEY`, `FROM_EMAIL` y `NOTIFY_EMAIL`). En paneles con propietario, intenta enviar al correo del propietario; en el panel global utiliza `NOTIFY_EMAIL`.

## Configuración opcional

```env
MOTHER_EXPIRATION_NOTIFICATION_DAYS=7,3,1,0
```

El chequeo se ejecuta al iniciar el servidor y posteriormente cada hora.

## Validaciones realizadas

- `node --check server.js`
- `node --check public/app.js`
