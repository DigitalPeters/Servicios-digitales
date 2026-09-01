# Master V1.2.1 - Corte diario y fallback de costos

Correcciones sobre Master V1.2:

- Centro de control usa la fecha local `America/Mexico_City` correctamente para `created_at` almacenado en UTC.
- `Ventas hoy` y `Utilidad bruta` ya no arrastran ventas de la tarde/noche del día anterior durante las primeras horas del día en México.
- Jerarquía de costo por venta:
  1. snapshot histórico positivo guardado en el pedido;
  2. costo real de inventario/cuenta madre/perfil;
  3. costo actual configurado en Productos;
  4. cero únicamente si no existe ninguno.
- Los reportes diario y mensual tratan un snapshot histórico en `0` como costo faltante y pueden usar `products.cost_price`.
- Rentabilidad informa cuántas ventas usaron el costo actual de Productos como fallback.
- Costo vendido por proveedor solo representa unidades vendidas dentro del rango seleccionado. La inversión registrada permanece separada.
- La utilidad del Centro de control puede ser negativa; ya no se fuerza a cero.
- Vencimientos de 7 días usan también la fecha de Ciudad de México.

No crea ni elimina tablas/columnas. No requiere migración de PostgreSQL.
