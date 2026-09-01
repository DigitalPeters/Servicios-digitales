# Deploy Master V1.6.2

1. Sustituir los archivos del Patch sobre la versión V1.6.1.
2. Ejecutar `node --check server.js` y `node --check public/master-intelligence-v16.js`.
3. Revisar `git status` y `git diff --stat`.
4. Hacer commit y push.
5. En producción, abrir Inteligencia con el mismo rango donde exista un reembolso y confirmar que la tarjeta Reembolsos coincide con el detalle.

No requiere migración de PostgreSQL.
