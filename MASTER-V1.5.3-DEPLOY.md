# Deploy Master V1.5.3

1. Sustituir los archivos del Patch sobre la versión V1.5.2.
2. Ejecutar:
   - `node --check server.js`
   - `node --check public/app.js`
   - `node --check public/master-admin.js`
   - `git diff --check`
3. Revisar `git status` y `git diff --stat`.
4. Commit y push a `main` sólo después de revisar los cambios.
5. En Railway verificar que el deployment quede activo y revisar los logs.
6. Probar en el Centro de control:
   - Renovaciones en 3 días.
   - Cuentas madre por vencer.
   - Atención prioritaria.
   - Sección Renovaciones / Vencimiento Cuentas Madre.

No requiere migración de PostgreSQL.
