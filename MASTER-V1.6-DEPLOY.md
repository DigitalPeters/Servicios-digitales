# Deploy Master V1.6

Base recomendada: Master V1.5.3.

## Cambios de base de datos

Al arrancar, `server.js` crea de forma aditiva:

- `admin_cash_movements`
- índice `idx_admin_cash_owner_date`

No elimina ni modifica ventas, usuarios, inventario, cuentas madre o saldos existentes.

## Archivos principales modificados

- `server.js`
- `package.json`
- `package-lock.json`
- `public/index.html`
- `public/styles.css`
- `public/master-intelligence-v16.js` (nuevo)

## Después del deploy

1. Revisar logs de arranque.
2. Entrar como administrador principal.
3. Abrir **Inteligencia** desde Administrar el negocio.
4. Confirmar que cargue el pronóstico de stock.
5. Confirmar el periodo financiero.
6. Registrar un gasto pequeño de prueba y eliminarlo si no se desea conservar.
7. Revisar Conciliación de saldos; usuarios sin libro histórico pueden aparecer como `Sin historial` y no representan por sí mismos un error.
