# Servicios Digitales Peters — Importación CSV y Rentabilidad V2.5

## Corrección
La carga masiva de inventario por CSV conserva proveedor y costo de cuenta madre y ahora, al finalizar la carga, sincroniza automáticamente la ficha financiera de cada cuenta madre tocada.

Cuando una cuenta madre tiene varios perfiles o el nombre del producto contiene `perfil`, se marca como venta por perfil y se usa el número real de perfiles cargados. Si falta el costo total pero todos los perfiles tienen `precio_compra`, el costo total se deriva de la suma de esos costos. Después se propaga el costo unitario a los perfiles.

Ejemplo: 6 perfiles x $5.83 = $34.98, mostrado como aproximadamente $35.00 en la cuenta madre; costo unitario $5.83.

## Rentabilidad
Se agregó un bloque separado llamado `Cuentas madre pendientes de completar` con conteos y detalle de:
- Sin proveedor.
- Sin costo de cuenta completa.
- Sin costo por perfil.

Esto permite ir directamente a las cuentas que necesitan corrección sin recorrer todo el inventario.
