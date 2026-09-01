# Deploy Master V1.5

1. Tener respaldos de codigo y PostgreSQL.
2. Copiar el contenido del patch sobre el repositorio actual.
3. Ejecutar:
   - `git status`
   - `node --check server.js`
   - `node --check public/app.js`
   - `node --check public/master-admin.js`
   - `node --check public/master-ops-v14.js`
   - `node --check public/admin-commerce.js`
4. Revisar `git diff --stat`.
5. Commit y push solamente despues de revisar los cambios.
6. En Railway revisar logs de arranque.

## Migraciones automaticas
V1.5 agrega de forma segura:
- `platform_accounts.entry_source`
- `platform_accounts.entry_batch_id`
- asegura `account_traceability` e indices de trazabilidad.

No elimina columnas ni modifica datos de ventas existentes.

## Pruebas recomendadas
- Buscar una cuenta madre ya vendida.
- Buscar un numero de pedido antiguo.
- Buscar un vendedor/distribuidor.
- Confirmar que aparecen ventas recuperadas cuando existen en `account_recovery_log`.
- Confirmar reporte/reemplazo si la cuenta tuvo falla.
- Abrir **Pedidos por entregar**, seleccionar un pedido manual y atenderlo.
- Cargar una cuenta manual nueva y verificar que indique `Ingreso manual`.
- Hacer una carga CSV nueva y verificar `Carga masiva CSV`.
