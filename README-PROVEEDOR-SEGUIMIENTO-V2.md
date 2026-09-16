# Servicios Digitales Peters — Seguimiento de reportes al proveedor V2

Cambios de esta versión:

- Los reportes de falla pueden marcarse como `Reportar al proveedor` desde Reportes de falla.
- El seguimiento queda dentro del mismo reporte, mostrando proveedor, fecha de envío, fecha de respuesta y tiempo de respuesta.
- La respuesta del proveedor ahora se puede editar posteriormente.
- Se registra un resultado estructurado del proveedor:
  - Me dio otra cuenta.
  - Me reembolsó.
  - No me dio nada / no solucionó.
  - Otro.
- Si el resultado es reembolso, se guarda el monto recibido del proveedor.
- Si el resultado es cuenta de reemplazo, se puede guardar el correo/perfil u otro detalle de la cuenta recibida.
- El administrador puede corregir la respuesta, el resultado, el monto, el detalle y la fecha de respuesta.
- Los reportes que ya fueron enviados al proveedor siguen permitiendo aplicar reemplazo o reembolso desde el mismo reporte mientras continúen abiertos.
- El panel de Reportes muestra un resumen de seguimiento: reportados, esperando respuesta, reemplazos recibidos, reembolsos recibidos y casos sin solución.
- Inteligencia / Control maestro muestra por proveedor cuántos casos terminaron en otra cuenta, reembolso y sin solución, además de los tiempos de respuesta existentes.
- No se modifica automáticamente el saldo del vendedor cuando el proveedor reembolsa al administrador: el monto queda registrado como reembolso recibido del proveedor y el reembolso al vendedor continúa siendo una acción administrativa separada.
