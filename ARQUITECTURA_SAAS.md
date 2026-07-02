# ARQUITECTURA_SAAS

## Objetivo

Este documento define la arquitectura objetivo del producto para toda la refactorizacion futura.

No describe el estado actual del codigo como implementacion final.
Describe el estado objetivo al que debe converger el sistema sin reescrituras bruscas y sin romper produccion.

## Principios obligatorios

1. Existira un solo Dashboard para todos los tipos de usuario.
2. No existiran dashboards separados por rol.
3. La interfaz base sera la misma para todos.
4. La diferencia entre usuarios se controlara por permisos y modulos visibles.
5. El sistema debe poder ocultar o mostrar tarjetas, botones, menus y acciones segun permisos.
6. No debe existir logica duplicada por rol.
7. No debe existir HTML duplicado por rol.
8. No debe existir CSS duplicado por rol.
9. No debe existir JavaScript duplicado por rol.
10. La arquitectura debe basarse en permisos y no solo en roles.

## Vision final del producto

El sistema dejara de comportarse como una aplicacion tradicional con secciones divergentes por tipo de usuario.

La plataforma final sera una aplicacion SaaS con:

- una sola experiencia de entrada
- una sola estructura de Dashboard
- una sola capa de navegacion principal
- modulos activados por permisos
- visibilidad condicional de acciones
- reglas de negocio centralizadas por capacidad

El objetivo no es construir varias aplicaciones dentro de una sola base de codigo.
El objetivo es construir un solo producto con una sola interfaz y capacidades variables por tenant y por usuario.

## Arquitectura final del sistema

## 1. Capa de presentacion

Habra una sola shell de aplicacion.

Esa shell sera responsable de:

- barra superior fija
- area central de Dashboard
- tarjetas grandes de modulos
- acciones rapidas
- navegacion responsive
- barra inferior en moviles

La shell no dependera del rol de usuario para existir.
Siempre sera la misma.

Lo unico variable sera:

- que modulos aparecen
- que tarjetas aparecen
- que botones aparecen
- que acciones dentro del modulo quedan habilitadas
- que operaciones son de solo lectura o de escritura

## 2. Capa de navegacion

La navegacion final no se construira por paginas aisladas para admin, distribuidor o usuario.

Se construira sobre un registro unico de modulos.

Cada modulo tendra metadatos como:

- `id`
- `nombre`
- `descripcion`
- `icono`
- `ruta_interna`
- `orden`
- `visible_si`
- `acciones_disponibles`
- `prioridad_mobile`

El Dashboard renderizara ese registro en funcion de permisos.

## 3. Capa de permisos

La autorizacion final tendra dos niveles:

- tipo de cuenta o contexto de usuario
- permisos efectivos

El tipo de cuenta seguira existiendo como dato de negocio, pero no como motor principal de render.

El render del frontend y la autorizacion de backend se basaran en permisos efectivos.

## 4. Capa de modulos funcionales

El sistema quedara organizado por modulos funcionales y no por pantallas ligadas a roles.

Modulos esperados:

- Dashboard
- Cuenta
- Usuarios
- Productos
- Pedidos
- Inventario
- Saldo
- Reportes de fallas
- Renovaciones
- Reportes financieros
- Comunicados
- Paneles SaaS
- Herramientas de soporte

Cada modulo podra tener:

- vista resumen para el Dashboard
- vista detalle
- acciones permitidas
- metricas
- filtros

## 5. Capa de backend

El backend final no debe tomar decisiones de UI por rol.
Debe exponer:

- identidad del usuario
- tenant efectivo
- permisos efectivos
- alcance de datos
- modulos visibles
- capacidades operativas

El backend seguira protegiendo las operaciones sensibles, pero la interfaz dejara de inferir demasiado desde `role` y flags sueltos.

## 6. Capa de tenancy SaaS

La plataforma final debe distinguir claramente:

- sistema global
- tenant propietario de panel
- distribuidores dentro o fuera de tenant
- vendedores subordinados
- usuarios finales

La interfaz seguira siendo unica.
Lo que cambia sera el alcance de los datos y el conjunto de permisos.

## Flujo de permisos

## 1. Principio general

Un usuario autenticado no habilita la interfaz por rol directo.
Primero se resuelve su contexto y luego se calculan sus permisos.

Flujo objetivo:

1. El usuario inicia sesion.
2. El backend resuelve identidad, owner, tenant y estado de cuenta.
3. El backend calcula permisos efectivos.
4. El frontend recibe un objeto de sesion enriquecido.
5. El Dashboard consulta ese objeto y decide visibilidad.
6. Cada modulo habilita sus acciones usando permisos, no comparaciones dispersas de rol.

## 2. Permisos efectivos esperados

Los permisos finales deben expresarse como capacidades atomicas.

Ejemplos:

- `dashboard.view`
- `account.view`
- `account.edit_self`
- `users.view`
- `users.create`
- `users.edit`
- `users.assign_distributor`
- `users.add_balance`
- `products.view`
- `products.create`
- `products.edit`
- `products.delete`
- `orders.view_self`
- `orders.view_all`
- `orders.update_status`
- `inventory.view`
- `inventory.create`
- `inventory.edit`
- `inventory.release`
- `balance.request`
- `balance.review`
- `reports.account.create`
- `reports.account.review`
- `reports.account.replace`
- `reports.account.refund`
- `sales.view`
- `sales.export`
- `announcements.view`
- `announcements.manage`
- `panels.view`
- `panels.create`
- `panels.suspend`
- `support.panic_reset`
- `support.recovery.manage`

## 3. Fuentes de permisos

Los permisos pueden derivarse de:

- rol base del sistema
- tipo de cuenta
- tenant propietario
- estado del panel
- relacion de ownership
- politicas futuras configurables

La regla importante es esta:

- el rol ayuda a calcular permisos
- el rol no debe ser la condicion final de renderizado en el frontend

## 4. Resolucion de alcance de datos

Ademas del permiso, el sistema debe calcular alcance.

Ejemplos de alcance:

- global
- tenant propio
- subordinados propios
- solo self
- solo registros asociados a owner

Un permiso sin alcance no es suficiente.

Ejemplo:

- dos usuarios pueden tener `users.view`
- uno con alcance global
- otro con alcance solo a subordinados del tenant

## Flujo de navegacion

## 1. Entrada unica

Todos los usuarios entran al mismo Dashboard.

No habra:

- dashboard de admin
- dashboard de distribuidor
- dashboard de vendedor
- dashboard de usuario

Habra un unico punto de entrada con composicion dinamica.

## 2. Navegacion principal objetivo

### Desktop

- barra superior fija
- buscador o acceso rapido central
- acciones de sesion en extremo derecho
- zona de tarjetas grandes como home
- secciones de detalle dentro del mismo shell

### Mobile

- barra superior compacta
- contenido principal responsive
- barra inferior de navegacion
- acciones frecuentes expuestas como accesos rapidos

## 3. Modelo de navegacion

La navegacion debe funcionar en tres capas:

### Capa 1: Dashboard unico

Muestra tarjetas resumen de modulos visibles.

### Capa 2: Modulo

Al entrar a una tarjeta se abre el modulo correspondiente en vista detalle.

### Capa 3: Accion

Dentro del modulo se habilitan acciones segun permisos.

Ejemplo:

- dos usuarios pueden ver la tarjeta `Usuarios`
- solo uno puede ver `Crear usuario`
- otro solo puede listar subordinados

## 4. Navegacion orientada a modulos

El sistema debera migrar de navegacion por secciones hardcodeadas a una navegacion basada en una definicion comun de modulos.

Esa definicion debera controlar:

- visibilidad
- nombre
- icono
- orden
- prioridad en mobile
- acciones rapidas disponibles

## Jerarquia de usuarios

## 1. Niveles de negocio esperados

La jerarquia funcional del sistema sera:

1. Admin global
2. Panel propietario o tenant owner
3. Distribuidor
4. Vendedor subordinado
5. Usuario final

## 2. Interpretacion arquitectonica

Esta jerarquia no define interfaces distintas.
Define alcance y permisos.

### Admin global

- alcance global
- puede administrar la plataforma completa
- puede ver y operar sobre multiples tenants segun reglas

### Panel propietario

- alcance sobre su tenant
- puede administrar usuarios, inventario, productos y operaciones del panel propio

### Distribuidor

- alcance sobre su red comercial y sus precios derivados
- puede operar usuarios subordinados y algunos datos de negocio acotados

### Vendedor subordinado

- alcance operativo limitado
- compra, vende, consulta pedidos, saldo y reportes segun permisos

### Usuario final

- alcance sobre su cuenta, pedidos, saldo y reportes propios

## 3. Regla de arquitectura

La jerarquia existe para resolver permisos y alcance.
No debe obligar a duplicar vistas.

## Modulos visibles por tipo de usuario

Esta tabla define una propuesta objetivo de visibilidad.

## 1. Admin global

Modulos visibles esperados:

- Dashboard
- Cuenta
- Usuarios
- Productos
- Pedidos
- Inventario
- Saldo
- Reportes de fallas
- Renovaciones
- Reportes financieros
- Comunicados
- Paneles SaaS
- Herramientas de soporte

## 2. Panel propietario

Modulos visibles esperados:

- Dashboard
- Cuenta
- Usuarios
- Productos
- Pedidos
- Inventario
- Saldo
- Reportes de fallas
- Renovaciones
- Reportes financieros
- Comunicados

No deberia ver herramientas globales que administran toda la plataforma, salvo que se deleguen permisos explicitos.

## 3. Distribuidor

Modulos visibles esperados:

- Dashboard
- Cuenta
- Usuarios
- Productos
- Pedidos
- Saldo
- Reportes de fallas
- Renovaciones
- Reportes financieros
- Comunicados

Visibilidad condicionada:

- Inventario solo si el modelo de negocio se lo permite
- Herramientas avanzadas solo por permiso

## 4. Vendedor subordinado

Modulos visibles esperados:

- Dashboard
- Cuenta
- Productos
- Pedidos
- Saldo
- Reportes de fallas
- Renovaciones
- Comunicados

## 5. Usuario final

Modulos visibles esperados:

- Dashboard
- Cuenta
- Productos
- Pedidos
- Saldo
- Reportes de fallas
- Renovaciones
- Comunicados visibles si aplica

## 6. Regla comun

La visibilidad anterior es un objetivo base.
La implementacion real debe terminar resolviendo modulos por permisos efectivos, no solo por tipo de usuario.

## Estructura del Dashboard unico

## 1. Shell general

El Dashboard unico se organizara asi:

- barra superior fija
- bloque de bienvenida/contexto
- grid de tarjetas de modulos
- bloque de acciones rapidas
- widgets de resumen dinamicos
- modulo abierto en area de trabajo principal
- barra inferior en mobile

## 2. Barra superior fija

Debe quedar preparada para:

- identidad del usuario
- tenant actual
- saldo o dato principal
- notificaciones futuras
- busqueda futura
- acceso a cuenta y sesion

La barra lateral actual no debe ser el centro de la arquitectura futura.
Debe poder eliminarse completamente cuando llegue el momento.

## 3. Tarjetas grandes de modulos

Cada tarjeta representara un modulo funcional.

Cada tarjeta podra incluir:

- titulo
- icono
- resumen o descripcion corta
- metrica principal
- indicador de alertas
- accion principal

Las tarjetas se renderizaran desde una definicion comun y no desde HTML duplicado por rol.

## 4. Acciones rapidas

Las acciones rapidas no seran estaticas para todos.
Se definiran segun permisos.

Ejemplos:

- crear usuario
- agregar saldo
- crear producto
- revisar pedidos pendientes
- revisar reportes
- descargar reporte

## 5. Widgets de resumen

Los widgets del Dashboard unico deben ser modulares.

Ejemplos:

- usuarios
- productos
- pedidos
- saldo pendiente
- reportes abiertos
- renovaciones proximas
- ventas del dia

Cada widget debe poder:

- mostrarse u ocultarse
- cambiar prioridad visual
- redirigir al modulo correspondiente

## 6. Vista detalle del modulo

Al entrar a un modulo, la shell del Dashboard no cambia.
Solo cambia el contenido principal.

Esto evita tener varias aplicaciones internas distintas.

## 7. Mobile

En mobile, el Dashboard unico debe usar:

- barra superior compacta
- grid de tarjetas adaptable
- barra inferior con modulos prioritarios
- acciones secundarias dentro del modulo

## Reglas de implementacion futura del Dashboard unico

1. Un solo arbol de componentes o secciones principales.
2. Un solo registro de modulos.
3. Un solo sistema de evaluacion de permisos.
4. Una sola fuente de verdad para visibilidad.
5. Una sola capa de navegacion principal.
6. Cero duplicacion de layouts por rol.

## Plan de migracion desde el Dashboard actual

La migracion no debe ser disruptiva.
Debe ser incremental y reversible por etapas.

## Etapa 0. Congelar objetivo arquitectonico

Objetivo:

- definir reglas finales antes de tocar UI o backend estructural

Resultado esperado:

- este documento sirve como contrato de arquitectura

## Etapa 1. Inventario y clasificacion

Objetivo:

- clasificar el sistema actual por modulos funcionales
- separar logica por dominio y no por pantalla

Trabajos esperados:

- mapear funciones duplicadas
- mapear rutas por modulo
- mapear permisos implicitos actuales
- detectar checks directos por rol en frontend y backend

## Etapa 2. Introducir capa de permisos efectiva

Objetivo:

- mantener los roles actuales, pero agregar una capa clara de permisos efectivos

Trabajos esperados:

- centralizar permisos en backend
- exponer permisos en `me` o en un endpoint de sesion
- reducir condiciones dispersas como `if role === admin`

## Etapa 3. Normalizar modulos del frontend

Objetivo:

- reorganizar el frontend actual en modulos reutilizables sin cambiar diseño todavia

Trabajos esperados:

- agrupar funciones por dominio
- eliminar wrappers y redefiniciones duplicadas
- definir un registro de modulos visible por permisos

## Etapa 4. Unificar visibilidad del Dashboard actual

Objetivo:

- seguir usando el Dashboard actual, pero gobernado por una sola logica de visibilidad

Trabajos esperados:

- centralizar que tarjetas, menus y botones se muestran
- desacoplar visibilidad de comparaciones de rol repartidas

## Etapa 5. Unificar navegacion

Objetivo:

- preparar la futura eliminacion de la barra lateral

Trabajos esperados:

- mover la navegacion a una estructura comun de topbar y modulo activo
- definir prioridades de modulos para mobile

## Etapa 6. Migracion visual futura del Dashboard

Objetivo:

- implementar el Dashboard unico final cuando la arquitectura interna ya este limpia

Trabajos esperados:

- barra superior fija
- grid de tarjetas definitivas
- acciones rapidas unificadas
- barra inferior mobile
- retiro completo de la barra lateral

Importante:

- esta etapa no se implementa ahora
- primero debe resolverse arquitectura interna y permisos

## Criterios de aceptacion de la arquitectura final

La arquitectura final se considerara alineada con este documento cuando se cumpla todo lo siguiente:

1. Todos los usuarios entren al mismo Dashboard.
2. No exista HTML duplicado para dashboards por rol.
3. No exista CSS duplicado para dashboards por rol.
4. No exista JavaScript duplicado para dashboards por rol.
5. Los modulos visibles se resuelvan por permisos efectivos.
6. Las acciones internas de modulo se resuelvan por permisos efectivos.
7. La navegacion pueda sobrevivir sin barra lateral.
8. Mobile y desktop compartan la misma arquitectura base.
9. Backend y frontend compartan la misma interpretacion de permisos.
10. La migracion se haya logrado sin romper la funcionalidad existente.

## Restricciones de trabajo para las siguientes fases

Durante la refactorizacion futura se debe respetar lo siguiente:

- no reescribir el proyecto desde cero
- no romper produccion
- no cambiar funcionalidad sin validacion
- no cambiar diseño antes de tiempo
- no introducir dashboards paralelos temporales como solucion final
- no duplicar componentes solo para resolver permisos

## Decision de arquitectura

La decision central es esta:

El producto no evolucionara hacia multiples interfaces por rol.
Evolucionara hacia una sola plataforma SaaS con una sola interfaz base y una capa de permisos capaz de componer experiencias distintas desde el mismo Dashboard.