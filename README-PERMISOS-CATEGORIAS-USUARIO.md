# Permisos de categorías por usuario — Servicios Digitales Peters

## Qué cambia
- Los registros de clientes realizados desde un subdominio/panel existente quedan pendientes de activación.
- El administrador puede seleccionar las categorías que cada usuario puede ver y comprar.
- Al activar al usuario se exige al menos una categoría autorizada.
- Las categorías bloqueadas no se entregan en `/api/products`.
- El servidor rechaza compras directas de productos de categorías no autorizadas.
- Los permisos están ligados al `user_id`, no al rol. Cambiar un usuario de cliente a distribuidor no elimina ni amplía sus categorías.
- Los métodos de pago, saldo, carrito y flujo de compra no se modifican.

## Compatibilidad
Los usuarios existentes sin registros en `user_category_permissions` conservan el comportamiento anterior (acceso completo), evitando bloquear cuentas ya existentes.

## Base de datos
En el arranque se crean automáticamente:
- `users.activation_pending`
- `user_category_permissions`

No hace falta ejecutar un SQL manual.

## Administración
En la lista de usuarios aparece:
- `Pendiente de activación` para nuevos registros.
- `Autorizar categorías y activar` para registros pendientes.
- `Editar categorías` para usuarios ya autorizados.

La activación requiere seleccionar al menos una categoría.

## Nota
El ZIP de despliegue se preparó sin `.env` y sin `.git` para evitar incluir credenciales o metadatos de Git.
