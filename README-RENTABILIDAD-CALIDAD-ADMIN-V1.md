# Rentabilidad y calidad - Admin V1

Módulo privado para el administrador principal de Servicios Digitales.

## 1. Rentabilidad por cuenta madre y proveedor

- Ingreso real del administrador: venta menos reembolso menos ganancia final del distribuidor.
- Costo histórico vendido: `orders.product_cost_snapshot`.
- Costo adicional de reemplazos: `platform_accounts.purchase_price` de la cuenta usada como reemplazo.
- Utilidad estimada: ingreso admin - costo vendido - costo de reemplazos.
- Margen porcentual.
- Agrupación por cuenta madre y proveedor.
- Campo privado `provider_name` y `purchase_cost_total` en `mother_accounts`.
- El costo total de cuenta madre es referencia administrativa; no se descuenta otra vez del periodo para evitar duplicar el costo que ya fue congelado en cada venta.

## 2. Estadísticas de fallas y reemplazos

Se agrupan por:
- plataforma;
- proveedor;
- vendedor;
- producto.

Muestran ventas, ventas afectadas, reportes, reemplazos, reembolsos, monto reembolsado, costo conocido de reemplazos y tasa de falla.

La tasa de falla usa **ventas únicas afectadas / ventas**, no cantidad de reportes / ventas. Así varios reportes sobre una misma venta no inflan artificialmente el porcentaje.

## Proveedores y costos

En Inventario, al crear una cuenta puedes capturar:
- proveedor de la cuenta madre;
- costo total de la cuenta madre;
- costo del perfil/acceso individual.

Para cuentas históricas también puedes completar proveedor y costo total directamente desde Rentabilidad y calidad.

La carga/descarga CSV acepta columnas opcionales:
- `proveedor`
- `costo_cuenta_madre`

## Reemplazos

Un reemplazo **no se cuenta como una venta nueva**. Se registra como costo adicional de calidad y queda asociado a la cuenta madre/proveedor que originó la falla.

## Seguridad

Las rutas de este módulo usan `mainAdminMiddleware`; distribuidores, vendedores y paneles admin rentados no pueden consultar la información global de costos/rentabilidad.

## Base de datos

Migración idempotente y no destructiva:
- `mother_accounts.provider_name`
- `mother_accounts.purchase_cost_total`

No elimina ni renombra tablas/columnas existentes.
