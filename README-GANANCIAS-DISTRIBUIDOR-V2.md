# Ganancias del Distribuidor V2

## Objetivo
Separar completamente el **Saldo para compras** del distribuidor de las **Ganancias generadas por sus vendedores**.

Antes, el reporte calculaba la utilidad por venta, pero esa utilidad no existía como una cuenta independiente ni podía transferirse al saldo del distribuidor.

## Qué cambia

### 1. Dos cuentas separadas
El distribuidor ahora ve:

- **Mi saldo**: dinero disponible para realizar sus propias compras.
- **Mis ganancias**: utilidad generada por las compras de sus vendedores.

Las ganancias no se suman automáticamente al saldo.

### 2. Transferencia manual de Ganancias a Saldo
En **Mis ganancias** el distribuidor puede indicar cuánto desea convertir a saldo.

Ejemplo:

- Saldo de compra: $500
- Ganancias disponibles: $120
- Transfiere: $50

Resultado:

- Saldo de compra: $550
- Ganancias disponibles: $70

La operación se ejecuta en una transacción PostgreSQL y queda registrada en el historial de movimientos.

### 3. Ajuste proporcional cuando hay un reembolso
Si una venta de un vendedor genera utilidad para el distribuidor y después se aplica un reembolso parcial o total, la utilidad del distribuidor se reduce en la misma proporción del reembolso.

Ejemplo:

- Vendedor pagó: $80
- Costo del distribuidor: $50
- Ganancia original: $30

Si se reembolsan $40 de los $80:

- Porcentaje reembolsado: 50%
- Ajuste de ganancia: -$15
- Ganancia final de esa venta: $15

Si se reembolsan los $80 completos:

- Porcentaje reembolsado: 100%
- Ajuste de ganancia: -$30
- Ganancia final de esa venta: $0

### 4. Si las ganancias ya fueron transferidas
El sistema **no descuenta automáticamente el dinero que el distribuidor recargó con fondos propios**.

Si el distribuidor ya transfirió sus ganancias a saldo y posteriormente llega un reembolso, la cuenta de Ganancias puede quedar temporalmente en negativo.

Ejemplo:

- Ganancia: +$30
- Transfiere $30 a saldo
- Ganancias disponibles: $0
- Después se reembolsa el 50% de la venta
- Ajuste de ganancia: -$15
- Ganancias disponibles: -$15

Las siguientes ganancias cubrirán primero ese ajuste antes de permitir nuevas transferencias.

### 5. Libro de movimientos
Se agrega `distributor_earnings_ledger` para registrar:

- Ganancia por venta
- Ajuste por reembolso
- Transferencia de ganancias a saldo

Cada movimiento conserva referencias al pedido, vendedor y reporte de falla cuando aplica.

Las ventas y reembolsos no pueden duplicarse porque se usan claves de referencia únicas.

### 6. Historial existente
La primera vez que un distribuidor abre Ganancias, el sistema inicializa su cuenta usando las ventas anteriores que ya existen en la base de datos.

Para pedidos modernos usa `distributor_cost_snapshot`.
Para pedidos antiguos que no tengan ese snapshot, se usa el costo actual del distribuidor y el reporte lo identifica como estimado, igual que ocurría en la versión anterior.

### 7. Reporte mejorado
El reporte ahora muestra por vendedor, producto y pedido:

- Venta bruta
- Reembolso
- Venta neta
- Costo proporcional
- Ganancia original
- Ajuste de ganancia por reembolso
- Ganancia final

También se actualizó la exportación CSV.

## Tablas nuevas

- `distributor_earnings_ledger`
- `distributor_earnings_state`

Las migraciones usan `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` e índices seguros.

No se eliminan ni renombran tablas existentes.

## Archivos modificados

- `server.js`
- `public/index.html`
- `public/app.js`
- `public/admin-users-distributor.js`
- `README-GANANCIAS-DISTRIBUIDOR-V2.md`

## Pruebas recomendadas

### Venta normal
1. Distribuidor con costo de $50.
2. Su vendedor compra a $80.
3. Verificar Ganancias: +$30.

### Transferencia
1. Transferir $10 a saldo.
2. Verificar Ganancias: $20.
3. Verificar Saldo: aumenta $10.

### Reembolso parcial
1. Sobre esa venta de $80 aplicar reembolso de $40.
2. Verificar ajuste de ganancia: -$15.
3. Ganancia final de la venta: $15.

### Reembolso total
1. Nueva venta con ganancia de $30.
2. Reembolso total de $80.
3. Verificar ajuste: -$30.
4. Ganancia final: $0.

### Ganancia ya transferida
1. Ganar $30.
2. Transferir los $30 a Saldo.
3. Aplicar posteriormente un reembolso del 50%.
4. Ganancias debe quedar en -$15.
5. El Saldo comprado/transferido no debe ser descontado automáticamente.
6. La siguiente ganancia debe cubrir primero el -$15.
