# Master V1.7 — Control administrativo

## Proveedores
- Ranking 0–100 con componentes visibles: rentabilidad, calidad, atención y resolución.
- ROI operativo calculado sobre costo consumido del periodo (incluye costo de reemplazos).
- Tasa de fallas y reemplazos.
- Costo de reemplazos atribuible al proveedor.
- Atención 1–5, tiempos de solución y casos resueltos/no resueltos.
- Recomendación automática: Excelente / Bueno / Regular / Riesgo alto.

> La puntuación es una herramienta de decisión, no una verdad absoluta. La atención empieza a medir desde que se registran seguimientos en V1.7.

## Renovaciones
- Historial por cuenta madre: vencimiento anterior, nuevo vencimiento, costo, resultado y notas.
- Las renovaciones con costo se registran también como inversión de inventario para conservar la salida de caja sin duplicarla en utilidad.

## Alertas avanzadas
- Proveedores con puntuación baja o tasa de fallas alta.
- Reportes pendientes por más de 12 horas.
- Diferencias entre saldo actual y último saldo del libro maestro.

## Exportaciones
CSV para ventas, inventario, proveedores, saldos, renovaciones y reembolsos. Excel puede abrir estos CSV directamente.

## Sesiones y permisos
- Las sesiones se registran al iniciar sesión con V1.8.
- El dueño puede cerrar una sesión o todas las sesiones de un usuario.
- Matriz de permisos administrativos almacenada en `users.admin_permissions`.
- Los módulos Master continúan reservados al administrador principal; la matriz queda preparada para el futuro clon y para delegación controlada.
