# Servicios Digitales Peters — Master V1.2 Costos

## Objetivo
Convertir la cuenta madre en la fuente real de costos para que el administrador pueda ver rentabilidad útil aunque el inventario histórico no tuviera costo por perfil capturado.

## Nueva configuración por cuenta madre
- Proveedor.
- Costo total pagado por la cuenta completa.
- Opción **Se vende por perfiles**.
- Cantidad de perfiles comprados/configurados.
- Costo manual por perfil opcional.
- Costo efectivo por venta calculado automáticamente.

### Reglas
- Cuenta completa: costo por venta = costo total de la cuenta.
- Venta por perfiles + costo manual: costo por venta = costo manual por perfil.
- Venta por perfiles sin costo manual: costo por venta = costo total / cantidad de perfiles.

## Integración financiera
Al guardar una configuración con costo efectivo conocido:
1. El costo se propaga a los accesos/perfiles de esa cuenta madre para ventas futuras.
2. Los pedidos históricos con costo $0 se completan únicamente cuando todos los accesos vinculados al pedido ya tienen costo conocido.
3. Rentabilidad y calidad puede usar el costo de la cuenta madre como respaldo cuando un snapshot histórico está en $0.
4. El Centro de control usa el costo real del inventario como respaldo para la utilidad bruta del día.
5. Los reemplazos también toman el costo configurado de la cuenta madre cuando el acceso no tenía precio de compra individual.

## Base de datos
Se agregan de forma no destructiva a `mother_accounts`:
- `sell_by_profile BOOLEAN NOT NULL DEFAULT FALSE`
- `configured_profile_count INTEGER`
- `profile_cost_override NUMERIC`

No se eliminan columnas ni datos existentes.
