# Deploy MASTER V1.6.1

1. Sustituir los archivos del Patch sobre la versión V1.6.
2. Ejecutar `node --check server.js`, `node --check public/app.js` y `node --check public/master-intelligence-v16.js`.
3. Revisar `git diff --check`.
4. Commit y push.
5. Validar en producción: Inteligencia > Reembolsos, botón Reembolsos y navegación de Usuarios/Productos/Inventario/Pedidos/Rentabilidad.

No requiere migración de PostgreSQL.
