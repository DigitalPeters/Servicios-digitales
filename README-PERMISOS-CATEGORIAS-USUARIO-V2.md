# Servicios Digitales Peters — Permisos por categoría V2

## Objetivo
Los usuarios que se registran mediante el registro normal quedan pendientes de autorización y NO reciben sesión automática.

El administrador debe seleccionar al menos una categoría y usar **Guardar y activar**. Desde ese momento el usuario puede entrar y solamente ve las categorías autorizadas.

## Reglas
- El registro normal crea `is_enabled = false` y `category_access_configured = false`.
- El registro normal no devuelve JWT.
- El login de una cuenta pendiente es rechazado.
- Las categorías autorizadas se guardan en `user_category_permissions`.
- `is_subadmin` / Distribuidor NO cambia ni amplía los permisos de categorías.
- Si un usuario pasa a Distribuidor, conserva exactamente sus categorías autorizadas.
- `/api/products` filtra las categorías autorizadas en servidor.
- `/api/buy/:productId` vuelve a validar la categoría en servidor antes de permitir la compra.
- El botón normal de Habilitar no puede activar una cuenta que no tenga categorías autorizadas.
- Usuarios existentes que no tienen la configuración de categorías siguen funcionando para evitar bloquear cuentas históricas.
- Paneles propietarios y cuentas `admin` no quedan sujetos a esta restricción porque administran su catálogo.
- Métodos de pago, saldo, carrito y flujo de compra no se sustituyen.

## Panel administrador
En Usuarios aparece:
- **Autorizar categorías** para cuentas nuevas.
- **Editar categorías** para cuentas ya configuradas.

Dentro del cuadro se pueden marcar las categorías del catálogo y elegir:
- **Guardar permisos**: guarda las categorías sin activar una cuenta pendiente.
- **Guardar y activar**: guarda y activa; exige al menos una categoría.

## Migración automática
Al iniciar el servidor se crean automáticamente:
- `users.category_access_configured`
- `user_category_permissions`

No requiere SQL manual.
