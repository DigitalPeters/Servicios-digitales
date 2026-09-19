# Servicios Digitales Peters — Proveedores V1.4.1

Cambios:
- Panel maestro > Proveedores muestra únicamente proveedores registrados en la tabla `suppliers`.
- Cada proveedor tiene Editar y Borrar.
- Editar corrige el nombre y actualiza las referencias textuales del proveedor para conservar consistencia histórica.
- No permite borrar un proveedor que tenga cuentas, compras, movimientos de caja, casos de servicio o renovaciones vinculadas.
- Se eliminó visualmente el bloque “Atención prioritaria” del Centro de control.
- Se incrementaron versiones de cache de `master-admin.js` y `master-ops-v14.js`.
