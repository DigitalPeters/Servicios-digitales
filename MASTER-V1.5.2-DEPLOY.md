# Deploy Master V1.5.2

1. Copiar el contenido del Patch sobre el repositorio actual de Servicios Digitales Peters.
2. Revisar `git status` y `git diff --stat`.
3. Ejecutar:
   - `node --check server.js`
   - `node --check public/master-admin.js`
   - `node --check public/master-ops-v14.js`
   - `git diff --check`
4. Hacer commit y push sólo después de revisar los cambios.
5. En Railway comprobar que el deployment quede activo.
6. Recargar el navegador con Ctrl+F5 para evitar caché.

No requiere migración de PostgreSQL.
