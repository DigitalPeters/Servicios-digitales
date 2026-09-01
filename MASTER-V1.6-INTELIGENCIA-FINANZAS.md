# Master V1.6 — Inteligencia de inventario y finanzas

Esta versión agrega un módulo exclusivo del administrador principal llamado **Inteligencia**.

## 1. Pronóstico de inventario

Para cada producto con control de stock activo calcula:

- stock actual;
- unidades vendidas en los últimos 7 y 30 días;
- promedio diario reciente;
- días estimados de cobertura;
- tendencia contra el promedio de 30 días;
- compra sugerida para recuperar una cobertura objetivo de 7 días;
- nivel de riesgo: sin stock, crítico, alto, medio, estable o sin movimiento.

El cálculo usa ventas exitosas no reembolsadas del negocio principal y la zona horaria `America/Mexico_City`.

## 2. Finanzas y utilidad neta

El periodo es configurable. El resumen separa:

- venta bruta;
- reembolsos;
- ganancia de distribuidores;
- ingreso que realmente corresponde al administrador;
- costo del inventario vendido;
- costo de reemplazos;
- gastos operativos registrados;
- otros ingresos;
- utilidad neta;
- inversión realizada en inventario.

**Importante:** la compra de inventario no se vuelve a descontar como gasto al calcular utilidad. La inversión se muestra por separado y el costo se reconoce cuando el inventario se vende.

## 3. Caja y gastos administrativos

Nueva tabla `admin_cash_movements` para registrar, entre otros:

- servidor / hosting;
- dominios;
- publicidad;
- comisiones;
- impuestos;
- oficina;
- transporte;
- otros ingresos/gastos;
- retiros del dueño.

Cada movimiento puede indicar si **afecta o no la utilidad neta**. Esto permite registrar, por ejemplo, un retiro personal sin convertirlo en gasto operativo.

Crear y eliminar movimientos deja registro en la bitácora administrativa.

## 4. Conciliación de saldos

Compara el saldo actual del vendedor/distribuidor contra el último `balance_after` guardado en `balance_ledger`.

También revisa continuidad interna del libro: el `balance_before` de cada movimiento debe coincidir con el `balance_after` anterior.

Estados:

- **Correcto:** coincide el saldo y no hay saltos.
- **Diferencia:** el saldo actual no coincide o existe una ruptura en la secuencia.
- **Sin historial:** el usuario aún no tiene movimientos registrados por el libro maestro. No se inventa un saldo inicial.

Los usuarios pertenecientes a paneles rentados/propietarios se excluyen mediante el árbol de propietarios para no mezclar la operación de Servicios Digitales Peters.
