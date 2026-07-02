# MODULOS_ACTUALES

## Alcance del analisis

Este documento inventaria el estado actual del proyecto sin proponer reescrituras.
El analisis se hizo sobre la copia raiz del workspace:

- `server.js`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `seed.js`
- `list_users.js`
- `make-admin.js`
- `limpiar_todo.js`
- `package.json`

Tambien se reviso la carpeta anidada `Servicios-Digitales/` para determinar si es una segunda aplicacion o una copia del proyecto.

## Resumen ejecutivo

- La aplicacion productiva actual es una SPA montada sobre `Express + PostgreSQL + JWT` con frontend estatico en `public/`.
- El backend real y mas amplio es el `server.js` de la raiz.
- La carpeta `Servicios-Digitales/` es una copia parcial/duplicada del proyecto raiz, con menos rutas y sin varias ampliaciones recientes.
- El frontend actual concentra casi toda la logica en `public/app.js`, archivo grande y con varias redefiniciones de funciones.
- Hay compatibilidad heredada entre PostgreSQL y scripts SQLite locales.
- El proyecto ya contiene semillas de multitenancy tipo SaaS: `admin_panels`, `owner_admin_id`, precios por usuario, distribuidores, revendedores, anuncios por owner y segregacion de inventario.

## Estructura real del workspace

### Raiz del proyecto

- `.env`: variables de entorno.
- `database.sqlite`: base SQLite local heredada.
- `database_danada.sqlite`: respaldo o base rota heredada.
- `tienda.db`: segunda base SQLite heredada.
- `server.js`: backend Express principal.
- `seed.js`: bootstrap inicial de PostgreSQL.
- `list_users.js`: utilitario CLI sobre SQLite.
- `make-admin.js`: utilitario CLI sobre SQLite.
- `limpiar_todo.js`: script de limpieza/reconstruccion de HTML/CSS.
- `package.json`: definicion de dependencias.
- `public/index.html`: unica pagina HTML principal.
- `public/app.js`: toda la logica del cliente.
- `public/styles.css`: estilos principales.

### Carpeta anidada `Servicios-Digitales/`

- Contiene otra copia de `.env`, `.git`, `package.json`, `server.js`, `seed.js`, SQLite y `public/`.
- Su `server.js` expone menos rutas que la raiz.
- Su `public/index.html` tambien es una variante antigua/incrustada del frontend.
- No parece ser otro modulo independiente de produccion; funciona como copia espejo, respaldo o fork local dentro del mismo workspace.

## Dependencias externas instaladas

Segun `package.json` raiz:

- `bcrypt`: hash y validacion de contrasenas.
- `body-parser`: parseo JSON.
- `compression`: compresion HTTP en respuestas.
- `cors`: CORS.
- `express`: servidor HTTP.
- `jsonwebtoken`: JWT para autenticacion.
- `nodemailer`: envio SMTP de recuperacion.
- `pg`: acceso PostgreSQL.
- `sqlite3`: scripts heredados/compatibilidad local.

## Dependencias entre archivos

### Flujo principal

- `public/index.html` carga `public/styles.css` y `public/app.js`.
- `public/app.js` consume rutas HTTP expuestas por `server.js`.
- `server.js` sirve `public/` mediante `express.static("public")`.
- `server.js` abre conexion PostgreSQL via `Pool` usando `DATABASE_URL`.
- `seed.js` inicializa un esquema basico de PostgreSQL, pero `server.js` ademas extiende y migra el esquema en `initDatabase()`.

### Dependencias funcionales

- `public/app.js` depende de JWT almacenado en `localStorage` para todas las llamadas autenticadas.
- `server.js` depende de `users`, `products`, `orders`, `platform_accounts`, `balance_requests`, `account_reports`, `announcements`, `admin_panels`, `user_product_prices`, `subadmin_reseller_prices`, `account_recovery_log`.
- `list_users.js` y `make-admin.js` dependen de `database.sqlite`, no de PostgreSQL.
- `limpiar_todo.js` modifica `public/index.html` y `public/styles.css`, pero no participa en runtime.

## Modulos existentes

## 1. Modulo backend HTTP

Archivo: `server.js`

Responsabilidad general:

- Inicializa Express.
- Configura middleware global.
- Ejecuta migraciones incrementales de esquema.
- Gestiona autenticacion JWT.
- Implementa reglas de negocio de compras, inventario, saldo, reportes, distribuidores y paneles.
- Sirve frontend estatico.

### Submodulos internos dentro de `server.js`

#### 1.1 Configuracion y bootstrap

- `getMailConfig()`
- `isMailConfigured()`
- `formatOrderData(orderData)`
- `initDatabase()`

#### 1.2 Email y notificaciones

- `sendDirectUserEmail({ to, subject, text })`
- `sendNewOrderEmail({ orderId, customerName, customerEmail, productName, amount, orderData })`
- `sendBalanceRequestEmail({ requestId, customerName, customerEmail, amount, bank, reference, accountHolder, proof, notifyToOverride })`
- `sendAccountReportEmail({ reportId, customerName, customerEmail, email, issueType, description })`

#### 1.3 Helpers de datos

- `safeJsonArray(value)`
- `safeJsonObject(value)`
- `normalizeFieldName(name)`
- `formatFechaMX(fecha)`
- `buildDeliveredAccountData(assignedAccount, productName, productCategory, originalDate)`
- `buildComboDeliveredAccountData(accounts)`

#### 1.4 Seguridad y contexto de usuario

- `generateToken(user)`
- `authMiddleware(req, res, next)`
- `adminMiddleware(req, res, next)`
- `mainAdminMiddleware(req, res, next)`
- `distributorMiddleware(req, res, next)`
- `getFullUser(userId, client = pool)`
- `getAdminPanelForEmail(email, client = pool)`
- `getViewerContext(userId, client = pool)`
- `getOwnerAndNotificationForUser(userId, client = pool)`
- `adminOwnedWhere(viewer, alias = "")`
- `getReportScopeOwnerId(req)`
- `getScopedOrdersCondition()`
- `getScopedReportsCondition()`

#### 1.5 Precios, combos e inventario

- `getEffectiveProductPrice(client, user, product)`
- `getComboItems(client, comboItemsValue)`
- `calculateComboPrice(client, user, comboProduct)`
- `findAvailableAccountForProduct(client, product, userId)`

#### 1.6 Reportes de cuenta y reemplazos

- `findReportedPurchase(client, userId, accountEmail)`
- `createAccountReportHandler(req, res)`

#### 1.7 Dashboard/metricas integradas en backend

- `actualizarConteosDashboard()` aparece al final como bloque frontend heredado pegado dentro de `server.js`; no es parte coherente del backend y usa `fetch`, por lo que es un residuo o mezcla accidental de frontend dentro del archivo servidor.

## 2. Modulo frontend SPA

Archivos:

- `public/index.html`
- `public/app.js`
- `public/styles.css`

Responsabilidad general:

- Render de login, registro y panel principal.
- Navegacion por secciones sin recarga completa.
- Consumo de API autenticada.
- Admin de usuarios, productos, pedidos, inventario, reportes, saldo y comunicados.
- Ajustes de visibilidad por rol.

### Submodulos reales dentro de `public/app.js`

#### 2.1 Autenticacion y bootstrap

- `showAuth(type)`
- `toggleSidebar()`
- `showSection(name)`
- `api(path, opt = {})`
- `register()`
- `login()`
- `logout()`
- `loadApp()`

#### 2.2 UI base y utilitarios

- `scrollToAdmin(id)`
- `showMessage(text, type = 'success')`
- `safeText(v)`
- `parseJsonArray(v)`
- `parseJsonObject(v)`
- `normalizeFieldName(n)`
- `fieldLabel(f)`
- `getChargeModeText(m)`
- `getStatusText(s)`
- `formatMoney(v)`
- `copyText(t)`
- `copyToClipboard(text, successMessage)`
- `fallbackCopy(text, successMessage)`

#### 2.3 Dashboard y navegacion por rol

- `openUsersFromDashboard()`
- `reloadDashboard()`
- `openProductsFromDashboard()`
- `openOrdersFromDashboard()`
- `openInventoryFromDashboard()`
- `openBalanceRequests()`
- `openAccountReportsFromDashboard()`
- `openSalesReport()`
- `loadExpiringCount()`
- `updateOutOfStockStats()`
- `updateManualPendingCount()`
- `actualizarConteosDashboard()`
- `cambiarSeccion(seccionDestino)`

#### 2.4 Catalogo y compras

- `loadProducts()`
- `buildCategoryFilter()`
- `filterProducts()`
- `renderProducts(products)`
- `renderProductRow(product)`
- `toggleProduct(id)`
- `renderProductInputs(product)`
- `convertFileToBase64(file)`
- `buyProduct(productId)`
- `isProductOutOfStock(product)`
- `getOutOfStockProducts()`
- `openOutOfStockFromDashboard()`

#### 2.5 Pedidos del usuario

- `loadMyOrders()`
- `extractDeliveredAccountEmail(text)`
- `getWarrantyInfoFromOrder(o)`
- `renderWarrantyNotice(o)`
- `renderMyOrders()`
- `renderOrderData(data)`
- `getAccountTextFromOrder(order)`
- `hasAccountDelivery(order)`
- `copyAccountDataFromOrder(orderId, source)`
- `extractAccountEmailFromText(text)`
- `reportDeliveredAccount(orderId)`

#### 2.6 Solicitudes de saldo

- `enviarSolicitudSaldo()`
- `getBalanceRequestStatusText(status)`
- `loadBalanceRequests()`
- `updateBalanceRequestStatus(requestId, status)`
- `notifyBalanceRequest(requestId)`

#### 2.7 Reportes de fallas

- `enviarReporteCuenta()`
- `loadMyReports()`
- `calculateReportRefundInfo(report)`
- `loadAccountReports()`
- `updateAccountReportStatus(reportId)`
- `replaceReportedAccount(reportId)`
- `refundReportedAccount(reportId, fechaCompra)`
- `notifyAccountReport(reportId)`
- `openReportFaultFormFinal()`
- `openFailureResponsesFinal()`
- `loadMyFailureResponsesFinal()`

#### 2.8 Administracion de productos

- `getRequiredFieldsFromInput(id)`
- `toggleCreateProduct()`
- `createProduct()`
- `loadAdminProducts()`
- `toggleAdminProduct(id)`
- `updateProduct(id)`
- `deleteProduct(id)`
- `getSelectedComboItems(prefix)`
- `renderComboOptions(containerId, selectedIds, prefix, excludeId)`
- `toggleComboCreateBox()`
- `toggleComboEditBox(id)`
- `ensureComboCreateControls()`

#### 2.9 Administracion de usuarios y distribuidores

- `loadUsers()`
- `addBalance()`
- `renderAdminSubadminSelect()`
- `toggleSubadmin(userId, value)`
- `loadAdminSubadminPrices()`
- `saveAdminSubadminPrice(userId, productId)`
- `createReseller()`
- `loadDistributorPanel()`
- `resetResellerAccess(id)`
- `deleteReseller(id)`
- `repairResellerByEmail()`
- `addResellerBalance()`
- `loadDistributorPrices()`
- `saveDistributorPrice(productId)`
- `irADirectoAGanancias()`

#### 2.10 Inventario de cuentas streaming

- `populatePlatformProductSelect()`
- `verHistorialRecuperacion()`
- `renderPlatformAccountRow(a)`
- `updatePlatformAccount(id, productName)`
- `markPlatformAccountSoldOutside(id)`
- `createPlatformAccount()`
- `loadPlatformInventory()` aparece asignada a `window.loadPlatformInventory`.

#### 2.11 Comunicados

- `ensureAnnouncementsUI()`
- `ensureAnnouncementAdminPanel()`
- `loadAnnouncements()`
- `loadAdminAnnouncements()`
- `createAnnouncement()`
- `toggleAnnouncement(id, active)`
- `deleteAnnouncement(id)`
- `loadGlobalAnnouncementsFinal()`
- `loadAdminAnnouncementsFinal()`
- `createAnnouncementFinal()`
- `toggleAnnouncementFinal(id, active)`
- `deleteAnnouncementFinal(id)`
- `loadOwnerAnnouncements()` via `window.loadOwnerAnnouncements`
- `createOwnerAnnouncement()` via `window.createOwnerAnnouncement`
- `toggleOwnerAnnouncement(id, active)` via `window.toggleOwnerAnnouncement`
- `deleteOwnerAnnouncement(id)` via `window.deleteOwnerAnnouncement`

#### 2.12 Reportes administrativos y paneles rentados

- `setTodaySalesDate()`
- `loadSalesReport()`
- `makeChartColor(index)`
- `renderDashboardSalesCharts(byUser, byProduct)`
- `ensureAdvancedReportsPanelFinal()`
- `loadHistoryUsersFinal()`
- `renderRecordsTableFinal(type, records)`
- `searchRecordsByDateFinal()`
- `loadUserHistoryFinal()`
- `downloadMonthlyReport()`
- `ensureAdminPanelsPhase1UI()`
- `getAdminPanelPhase1Payload()`
- `clearAdminPanelPhase1Form()`
- `loadAdminPanelsPhase1()`
- `createAdminPanelPhase1()`
- `updateAdminPanelStatusPhase1(panelId, status)`
- `copyAdminPanelInfoPhase1(panelId)`
- `loadBankInfoForPanel()`
- `applyRentedAdminLayout()`

#### 2.13 Recuperacion, cuarentena y soporte

- `forzarIngresoManual(reportId)`
- `mostrarRecuperacion()`
- `cerrarRecuperacion()`
- `solicitarCodigo()`
- `cambiarContrasena()`
- `botonDePanico()`
- `cambiarMiPassword()`
- `checkQuarantineAccounts()`
- `showQuarantineModal(list)`
- `liberarCuentaDeCuarentena(id)`
- `desecharCuenta(id)`
- `abrirModalHistorial()`
- `mostrarBotonRegresar()`
- `ocultarBotonRegresar()`
- `activarHistorialCelular()`
- `loadExpiringAlerts()`
- `loadMotherAccountsAlerts()`
- `searchGlobalEmail()`
- `verHistorialCuenta(id)`
- `inicializarTiendaSaaS()`
- `ejecutarCompraAutomatica(productoId)`
- `subirExcelProcesado(evento)`
- `obtenerMontoBotonFinanciero()`
- `cargarReporteFinancieroDetallado()`

### Observacion clave sobre el modulo frontend

`public/app.js` contiene varias redefiniciones de la misma funcion. Ejemplos confirmados:

- `loadSalesReport()` aparece varias veces.
- `openSalesReport()` aparece varias veces.
- `loadAdminOrders()` aparece mas de una vez.
- `updateOrderStatus()` aparece mas de una vez.
- `loadAccountReports()` aparece mas de una vez.
- `scrollToAdmin()` aparece mas de una vez.
- `showSection()` y `loadApp()` son envueltas/reasignadas varias veces mediante `window`.

Eso implica que la ultima definicion cargada es la efectiva y las anteriores quedan como legado operativo dentro del mismo archivo.

## 3. Modulo de estilos

Archivo: `public/styles.css`

Responsabilidad:

- Variables CSS base.
- Layout desktop/mobile.
- Componentes de auth, sidebar, dashboard, paneles, tablas y tienda.
- Bloques adicionales pegados al final para comunicados, modal, dashboard SaaS y ocultacion de sidebar antigua.

Observacion:

- El archivo mezcla estilos vigentes con parches acumulados.
- Hay un fragmento de JavaScript incrustado accidentalmente al final del CSS que arranca con `function cambiarSeccion(seccionDestino)`; esto no pertenece a un CSS limpio y es un indicador de mezcla manual de capas.

## 4. Modulos utilitarios y heredados

### `seed.js`

Responsabilidad:

- Crear tablas `users`, `products`, `orders` basicas en PostgreSQL.
- Crear o actualizar admin inicial.
- Insertar productos base.

Funciones:

- `main()`

### `list_users.js`

Responsabilidad:

- Leer `database.sqlite`.
- Listar `id`, `name`, `email`, `role`, `balance` desde `users`.

### `make-admin.js`

Responsabilidad:

- Abrir `database.sqlite`.
- Convertir por correo un usuario a admin en SQLite.

### `limpiar_todo.js`

Responsabilidad:

- Eliminar parche `#rescate-total` de `public/index.html`.
- Reescribir por completo `public/styles.css` con un CSS reconstruido.

Conclusiones sobre estos utilitarios:

- `list_users.js` y `make-admin.js` ya no siguen el camino principal de produccion si el sistema productivo usa PostgreSQL.
- `limpiar_todo.js` es una herramienta de mantenimiento manual y no una parte del runtime.

## Pantallas y secciones existentes

Pantallas visibles identificadas en `public/index.html` raiz:

1. Autenticacion
2. Dashboard
3. Mi cuenta
4. Renovaciones
5. Tienda
6. Mis pedidos
7. Cargar saldo
8. Reportar falla
9. Mis vendedores
10. Comunicados del owner/panel
11. Panel admin

### 1. Pantalla de autenticacion

Bloques:

- Login
- Registro

Campos:

- Correo
- Contrasena
- Nombre en registro

Funciones asociadas:

- `showAuth()`
- `login()`
- `register()`

### 2. Dashboard

Elementos:

- Tarjetas de usuarios
- Tarjetas de productos
- Tarjetas de sin stock
- Tarjetas de inventario
- Tarjetas de pedidos
- Tarjetas de saldo
- Tarjetas de reportes pendientes
- Tarjetas de renovaciones
- Tarjetas de saldo pendiente
- Tarjetas de ventas hoy
- Tarjeta de corte diario
- Tarjeta de reporte mensual
- Tarjeta de distribuidores
- Bloques de acciones rapidas
- Graficas de ventas por producto y usuario

Funciones asociadas:

- `reloadDashboard()`
- `actualizarConteosDashboard()`
- `loadExpiringCount()`
- `renderDashboardSalesCharts()`
- accesos directos a admin, tienda, pedidos, saldo y fallas.

### 3. Mi cuenta

Muestra:

- Nombre
- Correo
- Rol
- Saldo
- Cambio de contrasena

Funciones asociadas:

- `loadApp()`
- `cambiarMiPassword()`

### 4. Renovaciones

Subpantallas:

- Buscador global de correos
- Alertas de renovacion de pedidos proximos a vencer
- Alertas de cuentas madre por fecha oficial de compra

Funciones asociadas:

- `loadExpiringAlerts()`
- `loadMotherAccountsAlerts()`
- `searchGlobalEmail()`

### 5. Tienda

Incluye:

- Busqueda global de producto
- Filtro por categoria
- Cards/rows de productos
- Inputs dinamicos por `required_fields`
- Compra automatica para productos de streaming y combos

Funciones asociadas:

- `loadProducts()`
- `filterProducts()`
- `renderProducts()`
- `buyProduct()`

### 6. Mis pedidos

Incluye:

- Busqueda por producto/correo/pedido
- Filtro por estado
- Respuesta admin
- Copia de credenciales entregadas
- Reportar falla desde pedido entregado
- Indicador de garantia de 28 dias

Funciones asociadas:

- `loadMyOrders()`
- `renderMyOrders()`
- `copyAccountDataFromOrder()`
- `reportDeliveredAccount()`

### 7. Cargar saldo

Incluye:

- Datos bancarios visibles
- Formulario de solicitud
- Copia de CLABE y concepto

Funciones asociadas:

- `enviarSolicitudSaldo()`
- `loadBalanceRequests()`

### 8. Reportar falla

Incluye:

- Correo reportado
- Tipo de falla
- Explicacion
- Evidencia por imagen
- Historial de mis reportes y respuestas

Funciones asociadas:

- `enviarReporteCuenta()`
- `loadMyReports()`
- `loadMyFailureResponsesFinal()`

### 9. Mis vendedores

Incluye:

- Crear vendedor
- Agregar saldo a vendedor
- Ver listado de vendedores
- Reparar acceso por correo
- Configurar precios para vendedores

Funciones asociadas:

- `createReseller()`
- `loadDistributorPanel()`
- `addResellerBalance()`
- `repairResellerByEmail()`
- `loadDistributorPrices()`
- `saveDistributorPrice()`

### 10. Comunicados del owner

Incluye:

- Crear comunicado propio
- Listar comunicados
- Activar/desactivar
- Eliminar

Funciones asociadas:

- `loadOwnerAnnouncements()`
- `createOwnerAnnouncement()`
- `toggleOwnerAnnouncement()`
- `deleteOwnerAnnouncement()`

### 11. Panel admin

Submodulos visibles:

- Usuarios / vendedores registrados
- Precios a subadmin / distribuidor
- Solicitudes de saldo pendientes
- Reportes de fallas pendientes
- Reporte de ventas
- Inventario de cuentas de plataforma
- Productos
- Pedidos
- Paneles admin rentados
- Herramientas avanzadas e historicos

Funciones asociadas:

- `loadUsers()`
- `addBalance()`
- `loadAdminSubadminPrices()`
- `loadBalanceRequests()`
- `loadAccountReports()`
- `loadSalesReport()`
- `loadPlatformInventory()`
- `loadAdminProducts()`
- `loadAdminOrders()`
- `loadAdminPanelsPhase1()`

## Rutas HTTP existentes

El backend raiz expone las siguientes rutas confirmadas.

### Salud y pruebas

- `GET /test-recuperacion`

### Dashboard / metricas

- `GET /api/admin/conteos-dashboard`
- `GET /api/admin/reporte-ventas-hoy`
- `GET /api/productos-tienda`

### Autenticacion y cuenta

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`
- `POST /api/solicitar-codigo`
- `POST /api/cambiar-contrasena`
- `POST /api/user/change-password`

### Productos

- `GET /api/products`
- `POST /api/admin/create-product`
- `PATCH /api/admin/products/:productId`
- `DELETE /api/admin/products/:productId`

### Compras y pedidos

- `POST /api/buy/:productId`
- `GET /api/my-orders`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:orderId/status`

### Renovaciones y alertas

- `GET /api/alerts/expiring`
- `GET /api/alerts/count`
- `GET /api/admin/alerts/mother-accounts`
- `GET /api/admin/search-email`

### Inventario de cuentas de plataforma

- `GET /api/admin/platform-accounts`
- `POST /api/admin/platform-accounts`
- `PATCH /api/admin/platform-accounts/:id`
- `GET /api/admin/accounts/quarantine`
- `POST /api/admin/accounts/:id/release`
- `POST /api/admin/accounts/:id/discard`
- `GET /api/admin/recovery-history`

### Usuarios, saldo y solicitudes

- `GET /api/admin/users`
- `POST /api/admin/add-balance`
- `POST /api/balance-requests`
- `POST /api/user/solicitud-saldo`
- `GET /api/my-balance-requests`
- `GET /api/admin/balance-requests`
- `PATCH /api/admin/balance-requests/:requestId/status`
- `POST /api/admin/balance-requests/:requestId/notify`

### Reportes de fallas

- `GET /api/reportable-accounts`
- `POST /api/account-reports`
- `POST /api/user/reporte-cuenta`
- `GET /api/my-account-reports`
- `GET /api/admin/account-reports`
- `GET /api/admin/account-reports/:reportId/order-accounts`
- `GET /api/admin/account-reports/:reportId/replacement-options`
- `POST /api/admin/account-reports/:reportId/replace`
- `POST /api/admin/account-reports/:reportId/refund-proportional`
- `PATCH /api/admin/account-reports/:reportId/status`
- `POST /api/admin/account-reports/:reportId/notify`
- `POST /api/admin/reemplazo-manual-seguro`

### Distribuidores y revendedores

- `PATCH /api/admin/users/:userId/subadmin`
- `GET /api/admin/subadmin-prices/:userId`
- `PATCH /api/admin/subadmin-prices`
- `GET /api/distributor/resellers`
- `POST /api/distributor/resellers`
- `DELETE /api/distributor/resellers/:id`
- `POST /api/distributor/resellers/:id/reset-access`
- `POST /api/distributor/resellers/repair-by-email`
- `GET /api/distributor/prices`
- `PATCH /api/distributor/prices`
- `POST /api/distributor/add-balance`

### Reportes financieros y consulta historica

- `GET /api/admin/sales-report`
- `GET /api/admin/monthly-report`
- `GET /api/admin/search-records`
- `GET /api/admin/user-history`

### Datos bancarios y comunicados

- `GET /api/bank-info`
- `GET /api/announcements`
- `GET /api/admin/announcements`
- `POST /api/admin/announcements`
- `PATCH /api/admin/announcements/:id`
- `DELETE /api/admin/announcements/:id`
- `POST /api/admin/test-email`

### Paneles admin rentados

- `GET /api/admin/admin-panels`
- `POST /api/admin/admin-panels`
- `PATCH /api/admin/admin-panels/:id/status`

### Mantenimiento / soporte

- `POST /api/admin/panic-reset`
- `POST /api/admin/system/check-expirations`

## Logica de negocio actual

## 1. Autenticacion y tipos de usuario

Tipos de cuenta detectados por backend:

- `usuario`
- `admin_global`
- `admin_distribuidor`
- `panel_propietario`
- `vendedor_panel`
- `distribuidor_del_panel`

Implementacion observada:

- Todos autentican contra `users`.
- Si un correo no existe en `users` pero si existe en `admin_panels`, el login crea automaticamente el usuario admin correspondiente.
- JWT guarda `id` y `role`.
- `adminMiddleware` distingue entre admin global y admin de panel.

## 2. Segmentacion multi-tenant

La segmentacion del SaaS ya existe parcialmente y se basa en:

- `owner_admin_id` en `products`, `orders`, `platform_accounts`, `balance_requests`, `account_reports`, `announcements`.
- `owner_user_id` en `users` para vincular vendedores con su distribuidor/panel owner.
- `admin_panels` para representar paneles rentados o vendidos.

Reglas observadas:

- Admin global opera sobre datos globales (`owner_admin_id` nulo o 0).
- Panel owner opera sobre datos propios (`owner_admin_id = req.user.id`).
- Vendedores de panel usan datos del owner del panel.
- Distribuidor heredado sin panel usa catalogo global con precios derivados.

## 3. Catalogo y precios

Cada producto maneja:

- `price`: precio base.
- `cost_price`: costo interno.
- `charge_mode`: `on_purchase` o `on_success`.
- `stock_enabled`, `stock`.
- `product_type`: `streaming_auto`, `manual`, `combo_auto`.
- `required_fields`: lista JSON de campos requeridos.
- `combo_items` y `combo_discount` para combos.

Reglas de precio efectivas:

- Admin global compra a precio base.
- Usuario normal puede tener precio especial en `user_product_prices`.
- Vendedor de distribuidor usa `subadmin_reseller_prices`; si no existe, usa el precio especial del owner o el base.
- Combo calcula suma dinamica de items menos descuento por item.

## 4. Compras

### Producto manual

- Crea pedido con `status = accion_en_espera`.
- Si `charge_mode = on_purchase`, descuenta saldo al comprar.
- Si `charge_mode = on_success`, descuenta cuando admin marque exito.

### Producto `streaming_auto`

- Busca cuenta disponible en `platform_accounts`.
- Si hay cuenta, crea pedido en `exito` y entrega credenciales automaticamente.
- Marca cuenta como `delivered` salvo si la cuenta es reusable.

### Producto `combo_auto`

- Resuelve varios `platform_accounts`.
- Si falta una cuenta para cualquier item, aborta toda la compra.
- Inserta un pedido unico con snapshot y credenciales combinadas.

## 5. Garantia, expiracion y renovaciones

- La garantia funcional del sistema se calcula a 28 dias.
- `delivered_account_data` guarda fecha de entrega y fecha de vencimiento.
- `/api/alerts/expiring` y `/api/alerts/count` detectan cuentas proximas a expirar.
- Existe tambien manejo de `official_purchase_date` para cuentas madre y alerta de 30 dias en `/api/admin/alerts/mother-accounts`.

## 6. Reportes de fallas

Flujo actual:

- El usuario reporta una cuenta entregada.
- El backend valida que esa cuenta o correo realmente provenga de una compra del usuario.
- Bloquea duplicados pendientes por `reported_account_id`.
- El admin puede:
  - marcar `resuelto`
  - hacer `reemplazo`
  - hacer `reembolso`

El reemplazo:

- puede usar cuenta disponible del inventario
- o alta manual de una nueva cuenta
- preserva o recalcula dias restantes respecto de la compra original

El reembolso:

- es proporcional a dias restantes sobre una base de 28 dias
- marca el pedido como `refunded = 1`

## 7. Solicitudes de saldo

Flujo actual:

- Usuario crea solicitud con monto, banco, referencia, titular y comprobante.
- Se asigna `owner_admin_id` segun el owner del usuario.
- El admin aprueba o rechaza.
- Si aprueba, suma saldo al usuario dentro de transaccion.
- Se puede notificar por correo despues de la decision.

## 8. Distribuidores y revendedores

Capacidades actuales:

- Convertir usuario en distribuidor mediante `is_subadmin`.
- Crear vendedores subordinados (`owner_user_id`).
- Definir precios al distribuidor (`user_product_prices`).
- Definir precios del distribuidor hacia sus vendedores (`subadmin_reseller_prices`).
- Reparar acceso de vendedores existentes por email.
- Sumar saldo a vendedores.

## 9. Paneles SaaS rentados

Capacidades actuales:

- Crear `admin_panels`.
- Asociar correo del panel con un usuario admin.
- Configurar negocio, banco, notificaciones, plan y expiracion.
- Suspender o inactivar panel.
- Segregar productos, inventario, anuncios y solicitudes por owner.

## 10. Cuarentena y recuperacion de cuentas

Capacidades actuales:

- Detectar cuentas entregadas expiradas y moverlas a `recovery_pending`.
- Liberarlas con nueva contrasena y registrar recuperacion en `account_recovery_log`.
- Desechar cuentas en cuarentena.
- Consultar historial de recuperacion.

## Consultas SQL actuales

La aplicacion contiene muchas consultas SQL. A continuacion se listan agrupadas por area funcional. Se conserva la intencion y las tablas/columnas usadas.

## A. SQL de bootstrap y migracion en `initDatabase()`

### Creacion de tablas

- `CREATE TABLE IF NOT EXISTS users (...)`
- `CREATE TABLE IF NOT EXISTS products (...)`
- `CREATE TABLE IF NOT EXISTS orders (...)`
- `CREATE TABLE IF NOT EXISTS balance_requests (...)`
- `CREATE TABLE IF NOT EXISTS account_reports (...)`
- `CREATE TABLE IF NOT EXISTS platform_accounts (...)`
- `CREATE TABLE IF NOT EXISTS user_product_prices (...)`
- `CREATE TABLE IF NOT EXISTS subadmin_reseller_prices (...)`
- `CREATE TABLE IF NOT EXISTS announcements (...)`
- `CREATE TABLE IF NOT EXISTS admin_panels (...)`

### Alteraciones incrementales

#### `users`

- `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_subadmin BOOLEAN DEFAULT FALSE`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_user_id INTEGER`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`

#### `products`

- `ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Otros'`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS required_fields TEXT DEFAULT '[]'`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS charge_mode TEXT DEFAULT 'on_purchase'`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_enabled INTEGER DEFAULT 0`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'streaming_auto'`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS combo_items TEXT DEFAULT '[]'`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS combo_discount NUMERIC DEFAULT 0`
- `ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`

#### `orders`

- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_data TEXT DEFAULT '{}'`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accion_en_espera'`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT ''`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS charged INTEGER DEFAULT 0`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded INTEGER DEFAULT 0`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_platform_account_id INTEGER`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_account_data TEXT DEFAULT ''`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT DEFAULT ''`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_category_snapshot TEXT DEFAULT ''`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_cost_snapshot NUMERIC DEFAULT 0`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1`

#### `platform_accounts`

- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS platform VARCHAR(100)`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS product_name VARCHAR(150)`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS account_email VARCHAR(255)`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS account_password VARCHAR(255)`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS profile_name VARCHAR(100)`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS profile_pin VARCHAR(50)`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS extra_data TEXT`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS terms_conditions TEXT`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS access_url TEXT DEFAULT ''`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'available'`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS assigned_order_id INTEGER`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`
- `ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS manual_replacement_source TEXT DEFAULT ''`

#### `balance_requests`

- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS bank TEXT DEFAULT ''`
- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT ''`
- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS account_holder TEXT DEFAULT ''`
- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS proof TEXT DEFAULT ''`
- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente'`
- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT ''`
- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`
- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`
- `ALTER TABLE balance_requests ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`

#### `account_reports`

- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS email TEXT DEFAULT ''`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS issue_type TEXT DEFAULT 'otro'`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente'`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS admin_response TEXT DEFAULT ''`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS order_id INTEGER`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS reported_account_id INTEGER`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS resolution_type TEXT DEFAULT ''`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS reported_platform TEXT DEFAULT ''`
- `ALTER TABLE account_reports ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`

#### tablas de precios

- `ALTER TABLE user_product_prices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`
- `ALTER TABLE user_product_prices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`
- `ALTER TABLE subadmin_reseller_prices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`
- `ALTER TABLE subadmin_reseller_prices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`

#### anuncios

- `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS owner_admin_id INTEGER`

### Indices

- `CREATE INDEX IF NOT EXISTS idx_platform_accounts_available ON platform_accounts (status, lower(product_name), lower(platform))`

### SQL de normalizacion/migracion de datos

- `UPDATE orders SET quantity = 1 WHERE quantity IS NULL OR quantity < 1`
- `UPDATE orders SET quantity = GREATEST(...) WHERE product_name_snapshot ~* '\\s+x[0-9]+$'`
- `UPDATE users SET role = 'user' WHERE role IS NULL`
- `UPDATE users SET balance = 0 WHERE balance IS NULL`
- `UPDATE users SET is_subadmin = FALSE WHERE is_subadmin IS NULL`
- `UPDATE users u SET is_subadmin = FALSE FROM admin_panels ap WHERE lower(u.email) = lower(ap.email)`
- `UPDATE products SET cost_price = 0 WHERE cost_price IS NULL`
- `UPDATE products SET active = 1 WHERE active IS NULL`
- `UPDATE products SET category = 'Otros' WHERE category IS NULL`
- `UPDATE products SET required_fields = '[]' WHERE required_fields IS NULL`
- `UPDATE products SET charge_mode = 'on_purchase' WHERE charge_mode IS NULL`
- `UPDATE products SET stock_enabled = 0 WHERE stock_enabled IS NULL`
- `UPDATE products SET stock = 0 WHERE stock IS NULL`
- `UPDATE products SET product_type = 'streaming_auto' WHERE product_type IS NULL OR product_type = ''`
- `UPDATE products SET combo_items = '[]' WHERE combo_items IS NULL OR combo_items = ''`
- `UPDATE products SET combo_discount = 0 WHERE combo_discount IS NULL`
- `UPDATE orders SET order_data = '{}' WHERE order_data IS NULL`
- `UPDATE orders SET status = 'accion_en_espera' WHERE status IS NULL`
- `UPDATE orders SET admin_response = '' WHERE admin_response IS NULL`
- `UPDATE orders SET charged = 0 WHERE charged IS NULL`
- `UPDATE orders SET refunded = 0 WHERE refunded IS NULL`
- `UPDATE orders SET delivered_account_data = '' WHERE delivered_account_data IS NULL`
- `UPDATE orders SET product_name_snapshot = '' WHERE product_name_snapshot IS NULL`
- `UPDATE orders SET product_category_snapshot = '' WHERE product_category_snapshot IS NULL`
- `UPDATE orders SET product_cost_snapshot = 0 WHERE product_cost_snapshot IS NULL`
- `UPDATE platform_accounts SET access_url = '' WHERE access_url IS NULL`
- `UPDATE platform_accounts SET status = 'available' WHERE status IS NULL OR status = ''`
- `UPDATE balance_requests SET bank = '' WHERE bank IS NULL`
- `UPDATE balance_requests SET reference = '' WHERE reference IS NULL`
- `UPDATE balance_requests SET account_holder = '' WHERE account_holder IS NULL`
- `UPDATE balance_requests SET proof = '' WHERE proof IS NULL`
- `UPDATE balance_requests SET status = 'pendiente' WHERE status IS NULL`
- `UPDATE balance_requests SET admin_response = '' WHERE admin_response IS NULL`
- `UPDATE account_reports SET email = '' WHERE email IS NULL`
- `UPDATE account_reports SET issue_type = 'otro' WHERE issue_type IS NULL`
- `UPDATE account_reports SET description = '' WHERE description IS NULL`
- `UPDATE account_reports SET status = 'pendiente' WHERE status IS NULL`
- `UPDATE account_reports SET admin_response = '' WHERE admin_response IS NULL`
- `UPDATE account_reports SET refund_amount = 0 WHERE refund_amount IS NULL`
- `UPDATE account_reports SET resolution_type = '' WHERE resolution_type IS NULL`

## B. SQL de `seed.js`

- `CREATE TABLE IF NOT EXISTS users (...)`
- `CREATE TABLE IF NOT EXISTS products (...)`
- `CREATE TABLE IF NOT EXISTS orders (...)`
- `SELECT id FROM users WHERE email = $1`
- `INSERT INTO users (...) VALUES (...)`
- `UPDATE users SET role = 'admin', password = $1 WHERE email = $2`
- `SELECT id FROM products WHERE name = $1 AND active = 1`
- `INSERT INTO products (...) VALUES (...)`

## C. SQL de scripts SQLite heredados

### `list_users.js`

- `SELECT id, name, email, role, balance FROM users`

### `make-admin.js`

- `UPDATE users SET role = 'admin' WHERE email = ?`

## D. SQL de autenticacion y contexto

- `SELECT u.id, u.email, u.name, u.role, u.balance, ... FROM users u LEFT JOIN admin_panels ap ... WHERE u.id = $1`
- `SELECT id, role, COALESCE(is_subadmin, false) AS is_subadmin FROM users WHERE id = $1`
- `SELECT id, name, email, role, balance, COALESCE(is_subadmin, false) AS is_subadmin, owner_user_id FROM users WHERE id = $1`
- `SELECT id, business_name, admin_name, email, status, plan_type, expires_at, bank_name, bank_holder, bank_clabe, payment_concept, notification_email FROM admin_panels WHERE lower(email) = lower($1) LIMIT 1`
- `SELECT u.id, u.name, u.email, ... LEFT JOIN admin_panels ap ... LEFT JOIN users owner_user ... LEFT JOIN admin_panels owner_panel ... WHERE u.id = $1`
- `SELECT u.id, u.email, u.owner_user_id, owner.email AS owner_email, own_panel.id AS owner_panel_id, ... WHERE u.id = $1 LIMIT 1`

## E. SQL de dashboard y metricas directas

- `SELECT COUNT(*) FROM usuarios WHERE rol = 'vendedor'`
- `SELECT COUNT(*) FROM productos`
- `SELECT COUNT(*) FROM inventario WHERE estado = 'disponible'`
- `SELECT COUNT(*) FROM ventas`
- `SELECT COUNT(*) FROM ventas WHERE estado = 'pendiente'`
- `SELECT COUNT(*) FROM fallas WHERE estado = 'abierta'`
- `SELECT COUNT(*) FROM recargas WHERE estado = 'pendiente'`
- `SELECT COALESCE(SUM(precio_venta - costo_producto), 0) as ganancias_netas FROM ventas WHERE fecha_venta::date = CURRENT_DATE`
- `SELECT p.id, p.nombre, COUNT(i.id) as stock_actual, COALESCE(p.precio, 0) as precio_venta FROM productos p LEFT JOIN inventario i ... GROUP BY p.id, p.nombre, p.precio`

Observacion:

- Estas consultas usan tablas `usuarios`, `productos`, `inventario`, `ventas`, `fallas`, `recargas` en espanol, diferentes al esquema principal en ingles (`users`, `products`, `orders`, etc.). Son un bloque heredado o injertado de otra version del sistema.

## F. SQL de autenticacion de usuarios

- `INSERT INTO users (name, email, password, role, balance) VALUES (...) RETURNING id, name, email, role, balance`
- `SELECT * FROM users WHERE lower(regexp_replace(trim(email), '\\s+', '', 'g')) = lower(regexp_replace($1, '\\s+', '', 'g')) ORDER BY id DESC LIMIT 1`
- `SELECT password FROM admin_panels WHERE id = $1`
- `INSERT INTO users (name, email, password, role, balance, is_subadmin) VALUES (...) RETURNING *`
- `SELECT u.id, u.name, u.email, u.role, u.balance, ... FROM users u LEFT JOIN admin_panels ap ... WHERE u.id = $1`

## G. SQL de productos y precios

- `SELECT id, name, description, price, cost_price, category, required_fields, charge_mode, active, stock_enabled, stock, product_type, combo_items, combo_discount, owner_admin_id FROM products WHERE active = 1 AND ... ORDER BY category ASC, name ASC`
- `SELECT sale_price FROM subadmin_reseller_prices WHERE owner_user_id = $1 AND product_id = $2`
- `SELECT sale_price FROM user_product_prices WHERE user_id = $1 AND product_id = $2`
- `SELECT id, name, description, price, cost_price, category, required_fields, charge_mode, active, stock_enabled, stock, product_type, combo_items, combo_discount FROM products WHERE id = ANY($1::int[]) AND active = 1`
- `INSERT INTO products (...) VALUES (...)`
- `UPDATE products SET name = ..., description = ..., price = ..., cost_price = ..., category = ..., required_fields = ..., charge_mode = ..., stock_enabled = ..., stock = ..., product_type = ..., combo_items = ..., combo_discount = ... WHERE id = $13 AND active = 1 AND ...`
- `UPDATE products SET active = 0 WHERE id = $1 AND active = 1 AND ...`

## H. SQL de compras, combos y pedidos

- `SELECT * FROM products WHERE id = $1 AND active = 1 AND ... FOR UPDATE`
- `SELECT id, name, email, role, balance, COALESCE(is_subadmin, false) AS is_subadmin, owner_user_id FROM users WHERE id = $1 FOR UPDATE`
- `SELECT * FROM platform_accounts WHERE status = 'available' AND ... ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
- `INSERT INTO orders (user_id, product_id, amount, order_data, status, admin_response, charged, refunded, assigned_platform_account_id, delivered_account_data, product_name_snapshot, product_category_snapshot, product_cost_snapshot, owner_admin_id) VALUES (...) RETURNING id`
- `UPDATE platform_accounts SET status = 'delivered', assigned_order_id = $1, assigned_user_id = $2, delivered_at = NOW() WHERE id = $3`
- `UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0`
- `SELECT COUNT(*)::int AS total FROM platform_accounts WHERE lower(product_name) = lower($1) OR lower(platform) = lower($1) OR lower(platform) = lower($2)`
- `SELECT * FROM platform_accounts WHERE status = 'available' AND (...) ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
- `UPDATE users SET balance = balance - $1 WHERE id = $2`

## I. SQL de renovaciones y busqueda global

- `SELECT id, product_name_snapshot AS product_name, created_at, (created_at + INTERVAL '28 days') AS expires_at FROM orders WHERE status = 'exito' AND refunded = 0 AND (...) BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 days')::date ORDER BY expires_at ASC`
- `SELECT COUNT(*) AS total FROM orders WHERE status = 'exito' AND refunded = 0 AND (...) BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 days')::date`
- `SELECT id, platform, account_email, profile_name, official_purchase_date, (official_purchase_date + INTERVAL '30 days') as mother_expiration FROM platform_accounts WHERE official_purchase_date IS NOT NULL AND (official_purchase_date + INTERVAL '30 days') <= (CURRENT_DATE + INTERVAL '5 days') ORDER BY mother_expiration ASC`
- `SELECT id, platform, account_email, status, official_purchase_date FROM platform_accounts WHERE account_email ILIKE $1`
- `SELECT o.id, u.name as vendedor_name, p.name as product_name, o.status, o.created_at FROM orders o LEFT JOIN users u ON o.user_id = u.id LEFT JOIN products p ON o.product_id = p.id WHERE o.assigned_platform_account_id = ANY($1) OR o.id IN (SELECT assigned_order_id FROM platform_accounts WHERE id = ANY($1) AND assigned_order_id IS NOT NULL) ORDER BY o.created_at DESC`

## J. SQL de inventario streaming

- `SELECT * FROM platform_accounts WHERE ... ORDER BY id DESC`
- `INSERT INTO platform_accounts (platform, product_name, account_email, account_password, profile_name, profile_pin, extra_data, terms_conditions, access_url, status, owner_admin_id, reusable, official_purchase_date) VALUES (...) RETURNING *`
- `UPDATE platform_accounts SET platform = $1, product_name = $2, account_email = $3, account_password = $4, profile_name = $5, profile_pin = $6, access_url = $7, status = $8, reusable = $9, official_purchase_date = $10 WHERE id = $11 RETURNING *`

## K. SQL de pedidos y vistas de usuario/admin

- `SELECT orders.id, orders.user_id, orders.product_id, orders.amount, orders.order_data, orders.status, orders.admin_response, orders.delivered_account_data, orders.charged, orders.refunded, orders.created_at, products.name AS product_name, products.category AS product_category, products.charge_mode AS charge_mode, products.product_type AS product_type FROM orders JOIN products ON orders.product_id = products.id WHERE orders.user_id = $1 ORDER BY orders.id DESC`
- `SELECT u.id, u.name, u.email, u.role, u.balance, ... FROM users u ... WHERE u.owner_user_id = $1 ORDER BY u.id DESC`
- `SELECT u.id, u.name, u.email, u.role, u.balance, ... FROM users u ... ORDER BY u.id DESC`
- `UPDATE users SET balance = balance + $1 WHERE id = $2 AND ...`
- `SELECT orders.id, orders.user_id, orders.product_id, orders.amount, orders.order_data, orders.status, orders.admin_response, orders.delivered_account_data, orders.charged, orders.refunded, orders.created_at, users.name AS customer_name, users.email AS customer_email, products.name AS product_name, products.category AS product_category, products.charge_mode AS charge_mode, products.product_type AS product_type FROM orders JOIN users ... JOIN products ... WHERE ... ORDER BY orders.id DESC`
- `SELECT orders.*, products.charge_mode AS charge_mode, products.product_type AS product_type FROM orders JOIN products ON products.id = orders.product_id WHERE orders.id = $1 FOR UPDATE`
- `SELECT id, name, email, balance FROM users WHERE id = $1 FOR UPDATE`
- `UPDATE orders SET charged = 1 WHERE id = $1`
- `UPDATE orders SET refunded = 1 WHERE id = $1`
- `SELECT id, name, category FROM products WHERE id = $1 AND ...`
- `SELECT id FROM platform_accounts WHERE assigned_order_id = $1 ORDER BY id DESC LIMIT 1`
- `UPDATE platform_accounts SET platform = ..., product_name = ..., account_email = ..., account_password = ..., profile_name = ..., profile_pin = ..., access_url = ..., extra_data = ..., status = 'delivered', assigned_order_id = ..., assigned_user_id = ..., delivered_at = COALESCE(delivered_at, NOW()) WHERE id = $11`
- `INSERT INTO platform_accounts (...) VALUES (...) RETURNING id`
- `UPDATE orders SET assigned_platform_account_id = $1, delivered_account_data = $2 WHERE id = $3`
- `UPDATE orders SET status = $1, admin_response = $2, delivered_account_data = COALESCE($4, delivered_account_data) WHERE id = $3`

## L. SQL de solicitudes de saldo

- `INSERT INTO balance_requests (user_id, amount, bank, reference, account_holder, proof, status, admin_response, owner_admin_id) VALUES (...) RETURNING id`
- `SELECT name, email FROM users WHERE id = $1`
- `SELECT id, amount, bank, reference, account_holder, proof, status, admin_response, created_at, reviewed_at FROM balance_requests WHERE user_id = $1 ORDER BY id DESC`
- `SELECT balance_requests.id, balance_requests.user_id, balance_requests.amount, balance_requests.bank, balance_requests.reference, balance_requests.account_holder, balance_requests.proof, balance_requests.status, balance_requests.admin_response, balance_requests.created_at, balance_requests.reviewed_at, users.name AS customer_name, users.email AS customer_email FROM balance_requests JOIN users ON balance_requests.user_id = users.id WHERE ... ORDER BY balance_requests.id DESC`
- `SELECT * FROM balance_requests WHERE id = $1 AND ... FOR UPDATE`
- `SELECT id, name, email, balance FROM users WHERE id = $1 FOR UPDATE`
- `UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2`
- `UPDATE balance_requests SET status = $1, admin_response = $2, reviewed_at = NOW() WHERE id = $3`
- `SELECT br.*, u.name AS customer_name, u.email AS customer_email FROM balance_requests br JOIN users u ON u.id = br.user_id WHERE br.id = $1 AND ... LIMIT 1`

## M. SQL de reportes de cuenta

- `SELECT pa.id, pa.assigned_order_id AS order_id, pa.platform, pa.product_name, pa.account_email, pa.profile_name, pa.profile_pin, pa.delivered_at, o.created_at AS order_created_at, COALESCE(NULLIF(o.product_name_snapshot, ''), p.name, '') AS order_product_name FROM platform_accounts pa JOIN orders o ON o.id = pa.assigned_order_id LEFT JOIN products p ON p.id = o.product_id WHERE pa.assigned_user_id = $1 AND o.user_id = $1 AND o.status = 'exito' AND pa.status IN ('delivered','failed') ORDER BY o.id DESC, pa.id ASC`
- `SELECT ... FROM platform_accounts pa JOIN orders o ON o.id = pa.assigned_order_id JOIN products p ON p.id = o.product_id WHERE pa.assigned_user_id = $1 AND lower(pa.account_email) = lower($2) AND o.status = 'exito' AND pa.status IN ('delivered','failed') ORDER BY o.id DESC LIMIT 1`
- `SELECT ... FROM platform_accounts pa JOIN orders o ... WHERE pa.id = $1 AND pa.assigned_user_id = $2 AND ... LIMIT 1`
- `SELECT ... FROM orders o JOIN products p ON p.id = o.product_id WHERE o.user_id = $1 AND o.status = 'exito' AND (COALESCE(o.delivered_account_data, '') ILIKE $3 OR COALESCE(o.admin_response, '') ILIKE $3) ORDER BY o.id DESC LIMIT 1`
- `SELECT id FROM account_reports WHERE reported_account_id = $1 AND status = 'pendiente' LIMIT 1`
- `INSERT INTO account_reports (user_id, email, issue_type, description, status, admin_response, order_id, reported_account_id, refund_amount, resolution_type, reported_platform, owner_admin_id, evidence_image) VALUES (...) RETURNING id`
- `SELECT id, email, issue_type, description, status, admin_response, created_at, reviewed_at, order_id, reported_account_id, refund_amount, resolution_type, evidence_image FROM account_reports WHERE user_id = $1 ORDER BY id DESC`
- `SELECT account_reports.id, account_reports.user_id, account_reports.email, account_reports.issue_type, account_reports.description, account_reports.status, account_reports.admin_response, account_reports.created_at, account_reports.reviewed_at, account_reports.order_id, account_reports.reported_account_id, account_reports.refund_amount, account_reports.resolution_type, account_reports.evidence_image, users.name AS customer_name, users.email AS customer_email, orders.amount AS order_amount, orders.created_at AS order_created_at, products.name AS product_name, products.category AS product_category, platform_accounts.platform AS platform, platform_accounts.product_name AS account_product_name, platform_accounts.status AS account_status FROM account_reports JOIN users ... LEFT JOIN orders ... LEFT JOIN products ... LEFT JOIN platform_accounts ... ORDER BY account_reports.id DESC`
- `SELECT id, order_id, reported_account_id FROM account_reports WHERE id = $1 LIMIT 1`
- `SELECT * FROM platform_accounts WHERE id = $1 AND assigned_order_id = $2 LIMIT 1 FOR UPDATE`
- `UPDATE account_reports SET reported_account_id = $1, reported_platform = $2, owner_admin_id = COALESCE(owner_admin_id, $3) WHERE id = $4`
- `SELECT id, platform, product_name, account_email, profile_name, profile_pin, status, delivered_at FROM platform_accounts WHERE assigned_order_id = $1 ORDER BY id ASC`
- `SELECT ar.*, o.owner_admin_id AS order_owner_admin_id, p.name AS product_name, p.category AS product_category, pa.platform, pa.product_name AS account_product_name, COALESCE(ar.owner_admin_id, o.owner_admin_id, pa.owner_admin_id, p.owner_admin_id) AS resolved_owner_admin_id FROM account_reports ar JOIN orders o ... JOIN products p ... LEFT JOIN platform_accounts pa ... WHERE ar.id = $1 LIMIT 1`
- `SELECT id, platform, product_name, account_email, profile_name, profile_pin, created_at FROM platform_accounts WHERE status = 'available' AND (...) AND (...) ORDER BY id ASC LIMIT 30`
- `SELECT ar.*, o.amount, o.product_id, o.created_at AS order_created_at, o.owner_admin_id AS order_owner_admin_id, p.name AS product_name, p.category AS product_category, p.owner_admin_id AS product_owner_admin_id, pa.platform, pa.product_name AS account_product_name, pa.account_email, pa.owner_admin_id AS reported_account_owner_admin_id, COALESCE(ar.owner_admin_id, o.owner_admin_id, p.owner_admin_id, pa.owner_admin_id) AS resolved_owner_admin_id FROM account_reports ar JOIN orders o ... FOR UPDATE OF ar, o`
- `INSERT INTO platform_accounts (...) VALUES (...) RETURNING *` para reemplazo manual
- `SELECT * FROM platform_accounts WHERE id = $1 AND status = 'available' ... LIMIT 1 FOR UPDATE` para reemplazo elegido
- `SELECT * FROM platform_accounts WHERE status = 'available' ... ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED` para reemplazo automatico
- `UPDATE platform_accounts SET status = 'delivered', assigned_order_id = $1, assigned_user_id = $2, delivered_at = NOW(), expires_at = $4 WHERE id = $3`
- `UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0`
- `UPDATE platform_accounts SET status = 'failed' WHERE id = $1`
- `UPDATE orders SET assigned_platform_account_id = $1, delivered_account_data = $2, admin_response = $2, status = 'exito', owner_admin_id = COALESCE(owner_admin_id, $4) WHERE id = $3`
- `UPDATE account_reports SET reported_account_id = $1, owner_admin_id = COALESCE(owner_admin_id, $4), status = 'reemplazo', resolution_type = 'reemplazo', admin_response = $2, reviewed_at = NOW() WHERE id = $3`
- `SELECT ar.*, o.amount, o.created_at AS order_created_at, o.refunded FROM account_reports ar JOIN orders o ON o.id = ar.order_id WHERE ar.id = $1 FOR UPDATE`
- `UPDATE users SET balance = balance + $1 WHERE id = $2`
- `UPDATE orders SET refunded = 1 WHERE id = $1`
- `UPDATE account_reports SET status = 'reembolso', resolution_type = 'reembolso', refund_amount = $1, admin_response = $2, reviewed_at = NOW() WHERE id = $3`
- `UPDATE account_reports SET status = $1, admin_response = $2, reviewed_at = NOW() WHERE id = $3`
- `SELECT ar.*, u.name AS customer_name, u.email AS customer_email FROM account_reports ar JOIN users u ON u.id = ar.user_id WHERE ar.id = $1 AND ... LIMIT 1`

## N. SQL de distribuidores y precios

- `SELECT u.id, u.name, u.email, u.role, u.balance, ... FROM users u ... WHERE u.id = $1 LIMIT 1`
- `UPDATE users SET is_subadmin = $1 WHERE id = $2 AND role <> 'admin' RETURNING ...`
- `SELECT products.id AS product_id, products.name, products.category, products.price AS general_price, products.cost_price, COALESCE(user_product_prices.sale_price, products.price) AS sale_price FROM products LEFT JOIN user_product_prices ON ... WHERE products.active = 1 ORDER BY products.category ASC, products.name ASC`
- `UPDATE user_product_prices SET sale_price = $3, updated_at = NOW() WHERE user_id = $1 AND product_id = $2`
- `INSERT INTO user_product_prices (user_id, product_id, sale_price, created_at, updated_at) VALUES (...)`
- `SELECT id, name, email, role, balance, owner_user_id, created_at FROM users WHERE owner_user_id = $1 ORDER BY id DESC`
- `SELECT id, name, email, owner_user_id FROM users WHERE lower(trim(email)) = lower($1) LIMIT 1`
- `UPDATE users SET name = $1, email = $5, password = $2, role = 'user', owner_user_id = $3, is_subadmin = FALSE WHERE id = $4 RETURNING ...`
- `INSERT INTO users (name, email, password, role, balance, owner_user_id, is_subadmin) VALUES (...) RETURNING ...`
- `SELECT id, name, email, owner_user_id FROM users WHERE id = $1 AND owner_user_id = $2 LIMIT 1`
- `SELECT (SELECT COUNT(*)::int FROM orders WHERE user_id = $1) AS orders_count, (SELECT COUNT(*)::int FROM balance_requests WHERE user_id = $1) AS balance_count, (SELECT COUNT(*)::int FROM account_reports WHERE user_id = $1) AS reports_count`
- `DELETE FROM subadmin_reseller_prices WHERE owner_user_id = $1`
- `DELETE FROM user_product_prices WHERE user_id = $1`
- `DELETE FROM users WHERE id = $1 AND owner_user_id = $2`
- `UPDATE users SET email = lower(trim(email)), password = $1, role = 'user', owner_user_id = $2, is_subadmin = FALSE WHERE id = $3 AND (...) RETURNING ...`
- `SELECT id, owner_user_id FROM users WHERE lower(regexp_replace(trim(email), '\s+', '', 'g')) = lower(regexp_replace($1, '\s+', '', 'g')) ORDER BY id DESC LIMIT 1`
- `UPDATE users SET name = $1, email = $2, password = $3, role = 'user', owner_user_id = $4, is_subadmin = FALSE WHERE id = $5 RETURNING ...`
- `SELECT products.id AS product_id, products.name, products.category, products.price AS general_price, COALESCE(products.cost_price, products.price, 0) AS owner_price, COALESCE(subadmin_reseller_prices.sale_price, products.price) AS reseller_price FROM products LEFT JOIN subadmin_reseller_prices ON ... WHERE products.active = 1 AND products.owner_admin_id = $1 ORDER BY ...`
- `SELECT products.id AS product_id, products.name, products.category, products.price AS general_price, COALESCE(user_product_prices.sale_price, products.price) AS owner_price, COALESCE(subadmin_reseller_prices.sale_price, user_product_prices.sale_price, products.price) AS reseller_price FROM products LEFT JOIN user_product_prices ... LEFT JOIN subadmin_reseller_prices ... WHERE products.active = 1 AND (products.owner_admin_id IS NULL OR products.owner_admin_id = 0) ORDER BY ...`
- `SELECT id FROM products WHERE ... LIMIT 1`
- `UPDATE subadmin_reseller_prices SET sale_price = $3, updated_at = NOW() WHERE owner_user_id = $1 AND product_id = $2`
- `INSERT INTO subadmin_reseller_prices (owner_user_id, product_id, sale_price, created_at, updated_at) VALUES (...)`
- `UPDATE users SET balance = balance + $1 WHERE id = $2 AND owner_user_id = $3`

## O. SQL de reportes financieros e historicos

- `SELECT ((NOW() AT TIME ZONE 'America/Mexico_City')::date)::text AS today`
- `SELECT COUNT(*)::int AS total_orders, COALESCE(SUM(orders.amount), 0)::numeric AS total_sales, COALESCE(SUM(COALESCE(NULLIF(orders.product_cost_snapshot, 0), products.cost_price, 0)), 0)::numeric AS total_cost, COALESCE(SUM(orders.amount - COALESCE(NULLIF(orders.product_cost_snapshot, 0), products.cost_price, 0)), 0)::numeric AS total_profit FROM orders JOIN products ... WHERE orders.status = 'exito' AND ...`
- `SELECT users.id AS user_id, users.name AS customer_name, users.email AS customer_email, COUNT(orders.id)::int AS total_orders, COALESCE(SUM(orders.amount), 0)::numeric AS total_sales, ... FROM orders JOIN users ... JOIN products ... WHERE ... GROUP BY ... ORDER BY total_profit DESC, total_sales DESC, total_orders DESC`
- `SELECT COALESCE(NULLIF(orders.product_name_snapshot, ''), NULLIF(substring(orders.delivered_account_data from 'Producto: ([^\\n\\r]+)'), ''), products.name) AS product_name, COALESCE(NULLIF(orders.product_category_snapshot, ''), products.category, 'Otros') AS product_category, COUNT(orders.id)::int AS total_orders, COALESCE(SUM(orders.amount), 0)::numeric AS total_sales, ... FROM orders JOIN products ... WHERE ... GROUP BY ... ORDER BY ...`
- `SELECT orders.id, users.name AS customer_name, users.email AS customer_email, ... to_char(((orders.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City'), 'DD/MM/YYYY HH24:MI:SS') AS created_at_mx FROM orders JOIN users ... JOIN products ... WHERE ... ORDER BY orders.created_at DESC`
- `SELECT orders.id, users.name AS customer_name, users.email AS customer_email, COALESCE(NULLIF(orders.product_name_snapshot, ''), products.name) AS product_name, COALESCE(NULLIF(orders.product_category_snapshot, ''), products.category, 'Otros') AS product_category, orders.amount, COALESCE(NULLIF(orders.product_cost_snapshot, 0), products.cost_price, 0) AS cost_price, (orders.amount - COALESCE(NULLIF(orders.product_cost_snapshot, 0), products.cost_price, 0)) AS profit, orders.status, to_char(...) AS fecha_mexico FROM orders JOIN users ... JOIN products ... WHERE ... ORDER BY orders.created_at DESC`
- `SELECT account_reports.id, account_reports.order_id, account_reports.email, account_reports.issue_type, account_reports.description, account_reports.status, account_reports.admin_response, account_reports.created_at, account_reports.reviewed_at, users.name AS customer_name, users.email AS customer_email FROM account_reports JOIN users ON users.id = account_reports.user_id WHERE account_reports.created_at::date >= $1::date AND account_reports.created_at::date <= $2::date AND ... ORDER BY account_reports.created_at DESC`
- `SELECT orders.id, orders.amount, orders.status, orders.admin_response, orders.created_at, COALESCE(NULLIF(orders.product_name_snapshot, ''), products.name) AS product_name, users.name AS customer_name, users.email AS customer_email FROM orders JOIN users ... JOIN products ... WHERE orders.created_at::date >= $1::date AND orders.created_at::date <= $2::date AND ... ORDER BY orders.created_at DESC`
- `SELECT orders.id, orders.amount, orders.status, orders.admin_response, orders.order_data, orders.delivered_account_data, orders.created_at, COALESCE(NULLIF(orders.product_name_snapshot, ''), products.name) AS product_name, users.name AS customer_name, users.email AS customer_email FROM orders JOIN users ... JOIN products ... WHERE orders.user_id = $1 AND ... ORDER BY orders.created_at DESC`

## P. SQL de banco, anuncios y paneles SaaS

- `SELECT email FROM users WHERE id = $1`
- `SELECT id, message, active, created_at FROM announcements WHERE active = 1 AND (...) ORDER BY id DESC LIMIT 10`
- `SELECT id, message, active, created_at FROM announcements WHERE (...) ORDER BY id DESC LIMIT 50`
- `INSERT INTO announcements (message, active, owner_admin_id) VALUES ($1, 1, $2) RETURNING id, message, active, created_at`
- `UPDATE announcements SET active = $1 WHERE id = $2 AND (...) RETURNING id, message, active, created_at`
- `DELETE FROM announcements WHERE id = $1 AND (...)`
- `SELECT id, business_name, admin_name, email, phone, bank_name, bank_holder, bank_clabe, payment_concept, notification_email, status, plan_type, expires_at, created_at, updated_at FROM admin_panels ORDER BY id DESC`
- `SELECT id FROM admin_panels WHERE lower(email) = lower($1)`
- `INSERT INTO admin_panels (business_name, admin_name, email, password, phone, bank_name, bank_holder, bank_clabe, payment_concept, notification_email, status, plan_type, expires_at) VALUES (...) RETURNING ...`
- `INSERT INTO users (name, email, password, role, balance, is_subadmin) VALUES (...) ON CONFLICT (email) DO UPDATE SET ... RETURNING id`
- `UPDATE admin_panels SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, business_name, admin_name, email, status`

## Q. SQL de soporte, panic reset y cuarentena

- `UPDATE account_reports SET status = 'reemplazo', admin_response = $1 WHERE id = $2`
- `SELECT id FROM users WHERE email = $1`
- `UPDATE users SET password = $1 WHERE email = $2`
- `SELECT * FROM users WHERE id = $1`
- `UPDATE users SET password = $1 WHERE id = $2`
- `UPDATE users SET password = $1 WHERE lower(email) = $2 RETURNING email, name`
- `UPDATE platform_accounts SET status = 'recovery_pending' WHERE status = 'delivered' AND expires_at IS NOT NULL AND expires_at < NOW() RETURNING id, platform, account_email`
- `SELECT id, platform, account_email, account_password, profile_name, profile_pin, (official_purchase_date + INTERVAL '35 days' - CURRENT_TIMESTAMP) as dias_restantes FROM platform_accounts WHERE status = 'recovery_pending' ORDER BY expires_at DESC`
- `SELECT assigned_order_id, assigned_user_id, delivered_at FROM platform_accounts WHERE id = $1`
- `INSERT INTO account_recovery_log (account_id, order_id, user_id, delivered_at, recovered_at) VALUES ($1, $2, $3, $4, NOW())`
- `UPDATE platform_accounts SET status = 'available', account_password = $1, assigned_order_id = NULL, assigned_user_id = NULL, delivered_at = NULL, expires_at = NULL WHERE id = $2 AND status = 'recovery_pending'`
- `SELECT l.recovered_at, pa.platform, pa.account_email, l.order_id FROM account_recovery_log l JOIN platform_accounts pa ON l.account_id = pa.id ORDER BY l.recovered_at DESC LIMIT 50`
- `UPDATE platform_accounts SET status = 'discarded' WHERE id = $1`

## Inconsistencias y dependencias cruzadas relevantes

## 1. Doble stack de base de datos

- Runtime principal: PostgreSQL.
- Scripts locales heredados: SQLite.
- Resultado: coexistencia de `database.sqlite`, `tienda.db`, `database_danada.sqlite` con un backend productivo basado en `pg`.

## 2. Dos versiones del proyecto en el mismo workspace

- Raiz: version mas amplia.
- `Servicios-Digitales/`: copia mas antigua o paralela.

## 3. Bloques heredados incrustados

- `server.js` contiene bloques tipo dashboard en espanol que consultan tablas distintas a las del esquema principal.
- `public/styles.css` contiene un bloque de JavaScript incrustado al final.
- `public/app.js` mezcla logica vigente con parches acumulados y wrappers sobre `window`.

## 4. Llamadas frontend sin confirmacion de endpoint equivalente limpio

Se detectan llamadas o referencias frontend que no corresponden a una ruta clara del backend raiz o parecen arrastre de versiones previas:

- `POST /api/admin/platform-accounts/:id/sold-outside` es llamada desde `markPlatformAccountSoldOutside(id)` pero no aparece definida en el backend raiz.
- `GET /api/admin/accounts/:id/history` es llamada desde `verHistorialCuenta(id)` y no aparece definida en el backend raiz.
- `POST /api/comprar-perfil` es llamada desde `ejecutarCompraAutomatica(productoId)` y no aparece en `server.js` raiz.
- `POST /api/admin/cargar-inventario-excel` es llamada desde `subirExcelProcesado(evento)` y no aparece en `server.js` raiz.

## 5. Duplicidades funcionales confirmadas

- Endpoints duplicados por compatibilidad:
  - `POST /api/balance-requests` y `POST /api/user/solicitud-saldo`
  - `POST /api/account-reports` y `POST /api/user/reporte-cuenta`
- Funciones frontend redefinidas varias veces:
  - `loadSalesReport`
  - `openSalesReport`
  - `loadAdminOrders`
  - `updateOrderStatus`
  - `loadAccountReports`
  - `scrollToAdmin`
  - wrappers sobre `showSection` y `loadApp`

## Conclusion operacional

El proyecto actual ya implementa una base SaaS incremental sobre una aplicacion originalmente monolitica:

- usuarios con roles
- multitenancy parcial por owner
- paneles administradores rentados
- inventario segregado
- precios por usuario y reventa
- reportes financieros por ambito
- anuncios por tenant

La arquitectura actual no esta reescrita ni modularizada; esta extendida por capas y parches acumulados. Eso explica que convivan:

- codigo productivo funcional
- compatibilidad heredada
- rutas duplicadas
- funciones sobreescritas
- dos copias del proyecto dentro del mismo workspace
- SQL de dos epocas distintas del sistema

Este documento describe el estado actual antes de cualquier refactorizacion.