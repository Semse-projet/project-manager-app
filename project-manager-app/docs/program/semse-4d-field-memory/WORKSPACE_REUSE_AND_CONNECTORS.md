# SEMSE Workspace — reutilización operativa, identidad visual e Integraciones
**Captura de feedback del propietario:** 2026-10-11. **Estado:** diseño e inventario técnico verificable por lectura de código; no implementación, CI ni Railway desplegados.
**Continuación de:** PR #857 fusionado, PR #859 (borrador) selector multi-organización, especificación F10 identidad universal, ADR-040 y ADR-042 Universal Connector.
**Decisión de producto confirmada:** conservar y potenciar SEMSE Workspace; **no reconstruir** otro contenedor ni una segunda plataforma de conectores. Incorporar el conector creado al Workspace con la identidad visual auténtica de SEMSE.

## 1. Feedback de campo que debe guiar el producto
El propietario probó Workspace y reportó que «no puedes hacer nada ahí» y que el color del Workspace no coincide con la aplicación. Pidió aprovechar el Workspace por sus capacidades potenciales y alojar allí el conector que se ha desarrollado. No dar por hecho que un endpoint existente equivale a un flujo operativo completo. Antes de modificar visuales o implementar APIs, validar diseño actual por capturas/uso con producto y una prueba real en despliegue.

## 2. Inventario AS-IS comprobado por lectura del repositorio en 2026-10-11
| Dominio | Existe en fuente | Restricción observada / trabajo |
|---|---|---|
| Entrada web | `apps/web/app/workspace/page.tsx` y `components/WorkspaceLayout.tsx` | Shell de tres paneles, barra blanca y colores `bg-white`, `text-slate-900`; apariencia no usa el tema principal dinámico |
| Navegación | `LeftPanel.tsx` | Seis secciones hardcodeadas: Inicio, Proyectos, Evidencia, Presupuestos, Planificación, Configuración. No Integraciones; sin filtrado contextual por permisos |
| Centro | `CentralPanel.tsx`, `MissionLoader.tsx` | Formulario crea identificador aleatorio y muestra nombre/tipo de misión. **No ejecuta por sí mismo** tarea, evidencia, presupuesto, contrato ni acción BuildOps |
| Derecha | `RightPanel.tsx` | Operacional/Configuración con texto mínimo y título de misión, no inspector real del recurso ni conector |
| API | `apps/api/src/modules/workspace/{workspace.controller,workspace.service,workspace.repository,workspace.fsm}.ts` | `GET context`, `POST navigation`, `POST mission/load`, `POST mission/unload`; controla estado de la interfaz, no ACL de dominio ni edición de entidades |
| Persistencia | `PrismaWorkspaceStateRepository` | Clave de lectura/escritura `(tenantId,userId)`; no incluye org/proyecto. Fallback local en memoria no es estado canónico; proteger contaminación inter-org |
| Estado cliente | `apps/web/lib/stores/workspaceStore.ts`, `apps/web/lib/bff/workspace.ts` | Cliente con refresh, navegación y carga/descarga de misión; no hidrata ni ejecuta dominios |
| Prometeo | `apps/api/src/modules/prometeo-copilot/prometeo-copilot.service.ts` | Puede sugerir/crear misión Workspace; acciones de negocio quedan `pending` y exigen herramientas de dominio y gobernanza reales |
| Navegación general | `apps/web/lib/navigation-registry.ts` | Registro con capa, OS, permisos y rutas canónicas, reutilizable para menús; debe resolver permisos por recurso, no role global de otra Org |
| Tema | `apps/web/app/globals.css`, `packages/design-tokens/src/colors.ts`, `apps/mobile/src/theme/theme.ts` | Paleta SEMSE clara/oscura: azul de marca (oscuro #3b82f6, claro #2563eb), naranja acento (oscuro #ff6a00, claro #ea580c). No duplicar hexadecimales en módulos; usar variables/tokens |
| Config integraciones **existente** | `apps/web/app/(app)/admin/settings/page.tsx` sección «Integraciones», `apps/api/src/modules/admin/admin.controller.ts` y `admin-integrations.service.ts` | Tiene estados y verificación, protegido por `ops:dashboard:read/write` a nivel tenant. **Reutilizar** la lógica; antes de exponer por Org, rediseñar autorización/acceso por ámbito. No mostrar `verify` a cualquier WORKER |
| Conector universal | `packages/shared/src/universal-connector/{contracts,enforcement,runtime-trust,idempotency,webhook-trust}.ts`, `docs/specs/platform/universal-connector-trust.spec.md` | Contrato de seguridad proveedor-neutral y pruebas unitarias, pero spec leída registra `code_status: IN_PROGRESS, ci_status: FAIL, deploy_status: NOT_DEPLOYED, activation_status: INACTIVE` con última verificación 2026-10-06. Ese registro puede estar obsoleto: **no** anunciar conector universal activado sin CI/production check |
| Otras integraciones | `apps/api/src/integrations` y adapters de dominios, `apps/web/app/api/semse/admin/integrations` | Revisar idoneidad de cada adapter para integración gestionada por Org; no mezclar conexión tenant/admin global con una conexión por empresa sin migración y contrato explícitos |

**Conclusión:** Workspace es recuperable y ahorra infraestructura visual, routing, estado, memoria y conexión a Prometeo, pero actualmente es un **orquestador de UI**, no un centro operacional. No basta insertar un botón «Integraciones» o reetiquetar misiones.

## 3. La experiencia objetivo: una sola superficie de operación
**Header común** de Workspace: marca/logo de SEMSE, usuario, `Empresa activa → Obra → Función` (contexto validado), estado de jornada, campana de invitaciones, Prometeo. Todas las vistas comparten mismo tema y escalas de tipografía/espaciado que aplicación.

**LeftPanel dinámico por contexto:**
- Propietario/admin de su compañía: Inicio, Equipo, Proyectos, Cuadrillas, Jornadas, Evidencias, Contratos, **Integraciones**, Informes, Ajustes.
- Encargado de una cuadrilla autorizada: Mi obra, Cuadrilla, Tareas, Asistencia de equipo autorizada, Evidencias, Prometeo. Integraciones solo lectura operacional explícitamente concedida, no secretos ni configuración empresarial.
- Trabajador: Mi jornada, Mis tareas, Reportar trabajo, Fotos/Videos, Historial propio, Prometeo. No hay botones de instalar integraciones, subir permisos o administración global.
- Usuario cliente/PRO independiente: rutas y operaciones válidas para su proyecto/capacidad, no menú ajeno.
- GC invitado exclusivamente a una obra: evidencia/tareas acordadas por grant, no nómina de compañía ni estado de conectores internos salvo concesión muy específica.

**CentralPanel:** renderiza listas y formularios reales por dominio (reuse existing pages via navigation adapter or isolated component composition), no sólo tarjetas de «Misión X». Mantener filtros/posición en cada contexto, cargar detalles autorizados de proyecto/tarea/evidencia, mostrar pendientes y acciones que ejecuten APIs canónicas existentes. Un clic en Integraciones despliega el **catálogo y estado de conexiones permitidas del contexto actual**, con etiquetas claras `NO CONFIGURADO`, `CONFIGURADO NO VERIFICADO`, `VERIFICADO`, `DEGRADADO`, `SIMULACIÓN`, `SUSPENDIDO`, `INACTIVO` según las fuentes; no pintar verde por la mera presencia de código o variables.

**RightPanel:** inspector contextual de la conexión elegida (proveedor, organización propietaria, scopes y capacidades, modo READ_ONLY/HYBRID si aplica, última verificación, sincronización, origen y auditoría, errores) y de tarea/evidencia según entidad. Sólo permitir acciones conforme a policy real: conectar, autorizar, verificar, probar lectura, sincronizar, suspender, revocar, exportar eventos; implementar por fases. Nunca texto genérico «listo» cuando faltan verificaciones.

**En móvil:** encabezado compacto persistente con Org/obra/rol; navegación inferior para acciones frecuentes. Integraciones administrativas como subpágina de Ajustes, no distraer al trabajador de reloj/tareas. Mantener flujos ES/EN, responsividad, VoiceOver, alto contraste y estados vacíos/errores.

## 4. Integraciones: reutilizar plano de control, no duplicar conectores
- **Única capa de confianza:** `Universal Connector` + Policy/Approval + per-provider adapter. El Workspace sólo **consume** sus vistas y emite solicitudes autorizadas, no aloja secretos ni ejecuta la conexión directamente.
- **Administración existente:** `Dashboard → Settings → Integraciones` sigue siendo el control de configuración actual. Workspace monta una **vista reutilizada** de ese control, no crea un segundo registro de proveedores ni duplica persistencia. Si el sistema actual es tenant-wide, no habilitar acceso org-specific hasta que un API de ámbito por Org con permiso explícito esté definido e implementado.
- **Catálogo vs conexiones instaladas:** las tarjetas de catálogo describen capacidades propuestas/disponibles y requisitos; la sección «Mis conexiones» sólo incluye conexiones reales devueltas por backend. Estado NO CONFIGURADO ≠ CONNECTED. Permisos de visibilidad separados de conectar/desconectar.
- **Flujo propuesto:** (1) admin abre Empresa A → Integraciones; (2) elige proveedor compatible; (3) visualiza permisos concretos y consentimiento; (4) proveedor se autentica fuera de Prometeo, con PKCE/OAuth o credencial secreta almacenada en backend; (5) backend valida tenant/Org, binding de runtime, scopes, Policy/Approval y secreto en vault; (6) estado ACTIVADO sólo después de prueba real; (7) se auditan actividad, fallos, expiración y revocación; (8) interfaz reacciona a desconexión/errores. Un importador externo no confiere automáticamente ACL.
- **Autorización:** usuario administrador de Org A no hereda `ops:dashboard:write` de su cuenta en Org B; separar plataforma admin de admin de compañía. Las empresas de staffing no ven integraciones privadas de constructora. Prometeo propone/conduce por herramientas autorizadas pero no obtiene tokens ni concede scopes.
- **Dependencias:** verificación del conector universal (actualidad CI/producción), convenciones del adaptador por proveedor, seguridad de OAuth/callback CSRF, webhooks, retries, rate limit, secretos, modo read-only por defecto y cancelación.

## 5. Identidad visual: defectos actuales y contrato para arreglarlos
**Defecto comprobado:** `WorkspaceLayout`, `LeftPanel`, `CentralPanel` y `RightPanel` fijan colores utilitarios blanco/slate/negro, en lugar de respetar `var(--bg)`, `var(--surface)`, `var(--ink)`, `var(--border)`, `var(--brand)`, `var(--accent)` ya usados por SEMSE en `globals.css`. El modo claro/oscuro y la identidad corporativa se rompen visualmente.
**Contrato:**
- Reemplazar colores rígidos de Workspace con variables compartidas; evitar nuevas paletas y divergencias entre web/móvil.
- Heredar componentes de la librería UI existente donde sea apropiado, sin duplicar componentes genéricos ni CSS inline.
- Mantener contraste WCAG, foco/hover/disabled, tipografía y medidas coherentes; comprobar modo claro/oscuro, tablet, móvil y escritorio.
- Menú «Integraciones» pertenece a la misma navegación/tema que Jobs/Evidence/BuildOps; se declara en `navigation-registry.ts` según su contrato, con guard real.
- La paleta concreta puede evolucionar por diseño global SEMSE; Workspace **debe seguir tokens**, no aplicar otra identidad fija.
- Validar capturas reales en producción antes/después con aprobación del propietario: código revisado por sí solo no demuestra renderizado idéntico.

## 6. Peligros y restricciones de implementación
1. **Clave de estado actual `(tenantId,userId)`:** compartir `currentScreen`/`activeMission` entre Org A y Org B del mismo tenant puede enseñar el título de una misión o ruta previa; antes de añadir selector, rediseñar clave contextual o filtrar/hidratar por `orgId/projectId` autorizado y eliminar estado anterior del render. No cambiar directamente la clave BD sin migración/backfill, compatibilidad y rollback. Fallback in-memory no es una fuente persistente compartida y no debe conducir permisos.
2. **Identidad multirol:** actual login toma primera Membership; el selector requiere resolución real por recurso, sin un conmutador global de sesión prohibido por F10/ADR-040.
3. **Títulos de misión son datos:** revelar nombre de un proyecto de Org A al entrar a Org B puede ser filtración aun sin abrir detalle; purgar/segregar en server y client cache.
4. **Acciones falsas:** crear «Misión de presupuesto» no equivale a generar presupuesto; declarar `PENDING` cuando no hay invocación efectiva y no simular completado. Cada acción central debe tener dueño API con request/response validado, idempotencia y auditabilidad.
5. **Integraciones sensibles:** no exponer API keys, OAuth tokens, PII, scopes administrativos, historial de conexiones de otro tenant/Org ni webhooks internos.
6. **El Workspace no es otra Org:** prohibido crear entidad/membresía de Workspace nueva; mantener nombre existente sólo para shell UI, no dominio de identidad.
7. **Producción:** no afirmar conector READY, Workspace completo ni unificar rutas por documentación únicamente. Evidencia = CI, tests con identidades multiempresa, merge, SHA Railway, canary y rollout flag.

## 7. Entregas secuenciales y verificables (PR slices propuestos)
**WS-0 — Reconocer lo existente:** inventario endpoints BFF, estado Workspace, SCHEMA y real adaptador de Integraciones, pruebas y baseline. Capturas de aspecto/temas + escenarios de dueño/worker/GC.
**WS-1 — Tema único SEMSE (P1 visual, bajo riesgo si aislado):** refactor de WorkspaceLayout/LeftPanel/CentralPanel/RightPanel/MissionLoader a variables de diseño y UI compartida; no cambiar API ni RBAC. Prueba clara/oscuro/responsive + accesibilidad.
**WS-2 — Contexto autorizado real (P0 seguridad):** resolver multi-Org/rol/proyecto conforme F10/ADR-040; segregar estado Workspace por contexto y pruebas anti-leak; no habilitar menú contextual hasta obtener autorización segura.
**WS-3 — Navegación y datos reales (P0 producto):** sustituir menú hardcodeado por navigation-registry filtrado por permisos del recurso; hidratar centro con BuildOps/Tasks/Labor/Evidence sin nueva autoridad de negocio, panel derecho inspector real. La navegación no modifica negocio.
**WS-4 — Integraciones embebidas (P1):** exponer «Integraciones» a administrador de empresa autorizado reutilizando configuración de SEMSE y contratos Universal Connector, sin nuevos secretos en UI; primero lectura+estado real, después gestionar conexión tras controles; path/guard por Org.
**WS-5 — Prometeo+misiones ejecutables (P1):** conectar sugerencias/acciones a herramientas existentes y aprobaciones humanas; resultados de ejecución reales y comprobables con cita/auditoría; no simular.
**WS-6 — Canarios y lanzamiento (P0):** pruebas cross-tenant/Org, offline, móvil, tema, conectores reales, feature flags por tenant, Railway API+Web+Worker/vision si aplica, documentación exacta de SHA y rollback.
**Dependencia clave:** WS-1 puede salir por separado; WS-4 no debe habilitar operaciones cross-Org hasta WS-2 y validación del control plane con seguridad.

## 8. Matriz de prueba de aceptación (por implementar)
- **WSP-01:** Workspace en modo oscuro comparte tokens y apariencia con web SEMSE; sin fondo blanco forzado.
- **WSP-02:** en modo claro texto/contraste/tipografía/espaciado coinciden y son accesibles.
- **WSP-03:** móvil/tablet/desktop ofrece navegación contextual sin dejar acciones fuera de pantalla.
- **WSP-04:** owner de Org A ve menú Integraciones, worker Org B no ve control de conexión ni estado privado de A.
- **WSP-05:** al entrar a Org B no se muestran títulos, pestañas, misión, navegación ni datos caché de A.
- **WSP-06:** integración sin credenciales queda NO CONFIGURADA, no «conectada»; conectores no verificados no figuran activos.
- **WSP-07:** Workspace consulta el backend existente de estado y muestra última verificación real, sin mocks.
- **WSP-08:** panel derecho permite ver permiso/scopes sólo con grant; secrets nunca visibles en UI, logs, Prometeo o export.
- **WSP-09:** botón «Conectar» sin backend seguro/política queda inhabilitado con explicación; jamás genera falsos éxitos.
- **WSP-10:** operador revoca conexión, app informa y rechaza futuras ejecuciones por provider/Prometeo; auditable.
- **WSP-11:** tarea de séptimo piso abierta desde Workspace carga datos reales, permite crear/asignar según permiso y conserva reloj independiente.
- **WSP-12:** misión sugerida por Prometeo se distingue de tarea real y no se marca completada sin dominio ejecutado.
- **WSP-13:** abrir una Org nueva con jornada de la anterior en curso no detiene reloj ni cruza subidas de evidencia.
- **WSP-14:** mismo usuario con dos Memberships mantiene roles/menús correctos, revocación corta acceso anterior con token no vencido.
- **WSP-15:** una actualización de tema no altera rutas/Estado/FSM de Workspace ni API de admin settings.
- **WSP-16:** desconexión de proveedor o falla de red produce estado degradado/pendiente verificación, nunca simulación de conexión real.

## 9. Resultado y evidencia pendiente
**Resultado objetivo**: Workspace se convierte en la puerta única de trabajo SEMSE — empresa, obra, tareas, tiempo, evidencia, proyectos y conectores en una identidad visual unificada; conserva los tres paneles y la memoria, pero cada sección puede ejecutar **acciones de negocio reales** por las APIs canónicas y privilegios efectivos.

**Lo comprobado hasta ahora:** piezas de código y documentos; NO se verificó visualmente producción, ni se corrieron tests o CI ni hay evidencia nueva de Railway. Declarar este documento un paquete de diseño para ingeniería, no la entrega del Workspace funcional.
