# Master V1.8 — Preparación para clonación

## Integridad de datos
El panel **Control maestro** incluye diagnóstico de:
- pedidos exitosos sin producto identificable;
- ventas sin costo conocido;
- inventario sin cuenta madre;
- perfiles/credenciales disponibles potencialmente duplicados;
- reportes que apuntan a pedidos inexistentes;
- paneles sin propietario enlazado.

El diagnóstico es de solo lectura: no borra ni repara automáticamente datos delicados.

## Aislamiento multiempresa
Audita cruces de datos globales relacionados con usuarios que pertenecen a paneles. Es una auditoría de datos; antes de lanzar el clon comercial se debe conservar el checklist de revisión de endpoints `owner_admin_id`.

## Respaldos
Se añadió un registro de checkpoints para anotar `pg_dump`, ubicación, tamaño y si se validó con `pg_restore --list`. El servidor no puede inspeccionar automáticamente un respaldo guardado en la PC del dueño.

## Migraciones
Se crea `schema_migrations`. Las nuevas V1.7 y V1.8 quedan registradas explícitamente. Las futuras versiones deben añadir nuevas migraciones versionadas en lugar de crecer sólo mediante `ALTER TABLE` dispersos.

## Modularización inicial
La lógica reutilizable de scoring y exportación CSV se extrajo a `lib/master-utils.js`. No se movieron masivamente rutas antiguas para evitar una regresión antes de declarar estable la versión personal.

## Seguridad
- Sesiones identificables y revocables.
- Bloqueo temporal tras 6 intentos fallidos de login en 15 minutos.
- `mainAdminMiddleware` exige `ADMIN_EMAIL` cuando está configurado.
- `CORS_ORIGINS` puede limitar orígenes permitidos sin cambiar el comportamiento actual si no se configura.

## Estado
Esta versión se considera **candidata a MASTER ESTABLE** después de probar en producción:
1. login/logout;
2. venta y entrega;
3. reembolso/reemplazo;
4. proveedor/compra/renovación;
5. ranking y exportaciones;
6. trazabilidad;
7. diagnóstico e aislamiento;
8. restauración del respaldo si fuera necesaria.
