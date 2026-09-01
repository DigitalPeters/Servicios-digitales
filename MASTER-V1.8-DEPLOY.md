# Despliegue Master V1.8

1. Conserva el `pg_dump` pre-Master y la rama Git de respaldo.
2. Sustituye sólo los archivos del Patch.
3. Ejecuta:
   - `node --check server.js`
   - `node --check public/master-control-v178.js`
   - `git diff --check`
4. Revisa `git status`, haz commit y push a `main`.
5. En Railway revisa logs. Se crearán de forma aditiva:
   - `schema_migrations`
   - `supplier_service_cases`
   - `mother_account_renewals`
   - `auth_sessions`
   - `backup_checkpoints`
   - `users.admin_permissions`
6. Cierra sesión y vuelve a iniciar sesión para que la sesión actual quede registrada en `auth_sessions`.
7. Abre **Control maestro** y prueba Ranking, Renovaciones, Exportaciones, Sesiones, Diagnóstico y Aislamiento.

## Variables recomendadas
- `ADMIN_EMAIL`: correo exacto del administrador principal.
- `JWT_SECRET`: secreto persistente fuerte.
- `CORS_ORIGINS`: opcional; lista separada por comas de orígenes permitidos. Si se deja vacío conserva la compatibilidad anterior.
