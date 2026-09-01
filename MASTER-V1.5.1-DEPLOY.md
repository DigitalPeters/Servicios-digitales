# Deploy Master V1.5.1

1. Copia el patch sobre el repositorio actual.
2. Ejecuta `git status`.
3. Valida sintaxis:
   - `node --check server.js`
   - `node --check public/app.js`
   - `node --check public/master-admin.js`
   - `node --check public/master-ops-v14.js`
   - `node --check public/admin-commerce.js`
4. Ejecuta `git diff --check` y `git diff --stat`.
5. Haz commit/push sólo después de revisar.

Migraciones automáticas heredadas de V1.5: `platform_accounts.entry_source`, `platform_accounts.entry_batch_id` y `account_traceability`. No elimina datos.
