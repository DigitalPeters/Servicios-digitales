# Deploy Master V1.3

1. Conservar el backup PostgreSQL PreMaster ya creado.
2. Copiar el parche sobre el repositorio actual.
3. Ejecutar:
   - `node --check server.js`
   - `node --check public/admin-profit-quality.js`
   - `node --check public/master-admin.js`
   - `git diff --check`
4. Revisar `git status` y `git diff --stat`.
5. Commit y push cuando esté aprobado.
6. En Railway verificar que el arranque termine sin errores y probar una sola cuenta madre primero.

## Prueba sugerida

Para una cuenta de 7 perfiles con costo de compra $210 y venta por perfil $60:
- costo automático por perfil: $30;
- si quedan 6 disponibles, el histórico debe detectar al menos 1 unidad salida;
- si el pedido está enlazado, usa el importe real del pedido;
- si no está enlazado, la unidad se muestra como estimada y usa $60 de referencia;
- utilidad estimada de esa unidad: $30 antes de reemplazos/reembolsos.
