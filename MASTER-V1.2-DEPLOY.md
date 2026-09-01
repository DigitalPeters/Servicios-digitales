# Despliegue Master V1.2 — Costos por cuenta madre

Esta actualización parte de Master V1.1 y conserva el rediseño del administrador.

## Cambios de base de datos
Al iniciar `server.js`, PostgreSQL agrega de forma no destructiva tres columnas a `mother_accounts`:

- `sell_by_profile`
- `configured_profile_count`
- `profile_cost_override`

No borra tablas ni información existente.

## Flujo recomendado
1. Mantén guardado `ServiciosDigitalesPeters-PreMasterV1.dump`.
2. Copia el parche sobre el repositorio local actual.
3. Ejecuta:
   - `node --check server.js`
   - `node --check public\\admin-profit-quality.js`
   - `node --check public\\master-admin.js`
   - `git diff --check`
4. Revisa `git status` y `git diff --stat`.
5. Commit sugerido:
   `git commit -m "Master V1.2 - costos reales por cuenta madre y perfil"`
6. `git push origin main`.
7. En Railway revisa Deploy Logs antes de configurar costos.

## Prueba funcional mínima
En Rentabilidad y calidad abre una cuenta madre y prueba:

**Caso perfil**
- costo cuenta: 250
- se vende por perfiles: sí
- perfiles: 5
- costo manual: vacío
- resultado esperado: costo por venta = 50

**Caso manual**
- costo cuenta: 250
- perfiles: 5
- costo manual por perfil: 55
- resultado esperado: costo por venta = 55

**Caso cuenta completa**
- costo cuenta: 250
- se vende por perfiles: no
- resultado esperado: costo por venta = 250
