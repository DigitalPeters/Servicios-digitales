# Master V1.3 - Rentabilidad real por cuenta madre

## Cambios principales

- Elimina los accesos duplicados de Validar saldo y Atender fallas en "Acciones del dueño"; esas funciones permanecen una sola vez dentro de Gestión.
- Reemplaza la tabla horizontal de cuentas madre por fichas responsivas, sin obligar a arrastrar hacia la derecha.
- Añade `sale_price_full` y `sale_price_profile` en `mother_accounts`.
- Permite configurar por cuenta madre: proveedor, costo de compra total, venta por cuenta completa, venta por perfil, cantidad de perfiles y costo manual por perfil.
- Muestra una previsualización de costo, venta de referencia y utilidad por unidad.
- Rentabilidad por cuenta madre ahora separa:
  - Periodo seleccionado: operaciones reales dentro de las fechas elegidas.
  - Histórico de la cuenta: operaciones acumuladas de toda la vida de esa cuenta.
- El histórico usa el importe real del pedido cuando conserva vínculo. Si el inventario demuestra que una unidad salió pero falta el vínculo histórico, puede estimar el ingreso con el precio de venta configurado y lo marca explícitamente como estimación.
- Detecta ventas históricas mediante asignación actual, `orders.assigned_platform_account_id`, `account_recovery_log` y diferencia entre perfiles configurados y disponibles.
- Los proveedores ahora muestran rentabilidad del periodo y rentabilidad histórica acumulada en tarjetas responsivas.
- El rango inicial de Rentabilidad pasa a últimos 30 días para evitar que el primer día del mes oculte ventas recientes. También se agrega "Todo el historial".

## Migración automática

Al iniciar el servidor se ejecuta:

```sql
ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS sale_price_full NUMERIC;
ALTER TABLE mother_accounts ADD COLUMN IF NOT EXISTS sale_price_profile NUMERIC;
```

No elimina ni reemplaza datos existentes.
