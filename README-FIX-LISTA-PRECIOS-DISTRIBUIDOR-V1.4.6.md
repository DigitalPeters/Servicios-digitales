# Servicios Digitales Peters — V1.4.6
## Lista de precios para distribuidores: compra / vendedor / distribuidor

Se corrigió la sección **Panel Maestro → Precios para admin distribuidor** para separar explícitamente los tres valores que intervienen en el negocio:

1. **Precio de compra**: `products.cost_price` — lo que le cuesta al administrador comprar el producto/cuenta al proveedor.
2. **Precio vendedor**: `products.price` — precio base que el administrador cobra a un vendedor.
3. **Precio distribuidor**: `user_product_prices.sale_price` — precio que el administrador cobra al distribuidor seleccionado.

La tabla ahora muestra también **Ganancia admin = precio distribuidor − precio de compra**.

Ejemplo Disney perfil:
- Compra: $11
- Vendedor: $30
- Distribuidor: $20
- Ganancia admin si vende al distribuidor: $9

El cambio no altera los precios ya guardados ni obliga a que el precio distribuidor sea mayor que el costo; si se configura por debajo del costo, la pérdida es real y se muestra como tal. El objetivo es que ya no se confunda el costo de compra con el precio al distribuidor.
