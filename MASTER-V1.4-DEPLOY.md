# Deploy Master V1.4

1. Confirma que tu respaldo PostgreSQL PreMaster siga guardado.
2. Sustituye únicamente los archivos del parche sobre tu repositorio actual V1.3.
3. Ejecuta:

```cmd
node --check server.js
node --check public\master-admin.js
node --check public\master-ops-v14.js
node --check public\admin-users-distributor.js
git diff --check
git status
```

4. Revisa los archivos modificados antes del commit.
5. Haz commit y push a `main` sólo después de revisar.
6. En Railway revisa el arranque. Debe crear las nuevas columnas/tablas sin borrar información.
7. Pruebas mínimas después de desplegar:
   - abrir Venta rápida y verificar usuarios/productos;
   - cotizar una venta sin guardarla;
   - usar Buscador global;
   - abrir Ficha 360° de un vendedor;
   - guardar un proveedor de prueba;
   - registrar una compra de prueba sólo si deseas conservarla;
   - confirmar que Atención prioritaria muestre stock crítico cuando corresponda.

## Rollback de código
La rama `backup-pre-master-v1` conserva la versión anterior a la Versión Maestra. Para un problema exclusivo de V1.4 también puedes revertir el commit V1.4 desde Git/Railway sin restaurar PostgreSQL, siempre que no necesites eliminar las tablas nuevas (son aditivas y pueden permanecer vacías).
