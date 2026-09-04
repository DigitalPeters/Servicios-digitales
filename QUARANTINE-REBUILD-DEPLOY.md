# Cuarentena — reconstrucción limpia

- `public/quarantine.js` es el único módulo dueño de Cuarentena.
- `dashQuarantineCard` no tiene `onclick` inline.
- Cuarentena nunca llama `openSalesReport()` ni `openInventoryFromDashboard()`.
- El KPI de Cuarentena del Master abre `openQuarantineFromDashboard(event)`.
- Admin Principal: consulta y recuperación global.
- Panel rentado: Cuarentena oculta y sin datos.
- Recuperación acepta nueva contraseña, nuevo PIN o ambos.
- Compra/entrega/stock no se modifica.
