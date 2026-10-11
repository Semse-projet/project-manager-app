# SEMSE — Selector de organización, proyecto y función (UX + contrato funcional)
**Fecha:** 2026-10-11. **Estado:** propuesta de diseño de producto / especificación para revisión, NO implementación disponible ni desplegada.
**Contexto de descubrimiento:** una sola persona puede ser dueño/administrador de su compañía, cliente o profesional independiente en sus proyectos y trabajador de staffing dentro de una empresa ajena. También puede participar en una obra de una constructora externa sin ser miembro general de esa organización.
**Integración de Workspace existente:** [WORKSPACE_REUSE_AND_CONNECTORS.md](WORKSPACE_REUSE_AND_CONNECTORS.md) define reutilización de tres paneles, paleta y sección Integraciones. El Workspace no es entidad tenancy ni autoridad de roles.
**Dependencias obligatorias:** COMPANY_INVITATIONS_DETAILED_SPEC.md, ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md, core.universal-identity-multi-role (F10 aprobada), ADR-040 WS-01C reconciliada, modelos User/Org/Membership y Policy/Approval existentes.

## 1. Decisión de producto
UNA identidad personal (`User.id`) y múltiples **contextos autorizados**. La aplicación mostrará al usuario claramente **para quién** y **con qué alcance** actúa; permisos efectivos y datos se resuelven en servidor del recurso abierto, **nunca sumando los roles de todas las organizaciones** ni confiando solo en una selección visual.

El término coloquial «workspace» será **espacio de trabajo en la interfaz**, como una *vista/contexto de navegación*, NO una tabla adicional llamada `Workspace`: el repositorio ya tiene un módulo Workspace con otra finalidad y una arquitectura Org/Membership. No diseñar un segundo propietario de identidad.

Ejemplo: la persona tiene (A) su Org «Mi Empresa Eléctrica», donde administra contratos, clientes y empleados; (B) invitación personal como `WORKER` de «Staffing Norte» con acceso solo a su asignación «Edificio Centro, piso 7»; (C) participación de cliente en otro proyecto. Una invitación NO anula sus otros roles ni la obliga a registrarse de nuevo. La función de **contratista/propietario de organización** es autoridad empresarial contextual; `PRO` y `CLIENT` son capacidades funcionales distintas, `WORKER` significa trabajo bajo dirección de otra compañía. No interpretar ADMIN como una licencia global para acceder a otras Orgs.

## 2. Jerarquía de navegación visible
1. **Cuenta personal**: avatar/nombre del usuario, perfil, ajustes de privacidad, seguridad, conexiones personales, invitaciones recibidas.
2. **Espacios de trabajo**: cada Org propia o ajena para la que el usuario tiene `Membership` efectiva, **más proyectos externos específicos** por acceso de recurso (sin afiliación automática a toda la Org).
3. **Proyecto / obra**: sitio, dirección, horario por proyecto, cuadrilla, tareas y evidencias. Puede no existir todavía: la membresía activa de una compañía no concede derechos en cualquier proyecto.
4. **Función efectiva en ese contexto**: `OWNER/ADMIN` empresarial contextual, `PRO` independiente, `CLIENT`, `WORKER` o `CREW_LEAD` delegado al proyecto/cuadrilla, según membresías y políticas reales. Mostrar etiquetas humanas; no fabricar un rol RBAC nuevo `CONTRACTOR`.
5. **Acción**: cada consulta/creación/edición/revisión recorre Identity -> Org/Project -> Membership/External Grant -> RBAC/Policy -> Approval -> Audit; el selector no decide permisos.

**Orden propuesto en pantalla principal**: «Mi trabajo de hoy» contextual, seguido del rótulo fijo «Estás trabajando para: [Empresa] · [Obra] · [Función]». Al cambiar de contexto, recargar/resolver acciones permitidas. Si no hay obra asignada, mostrar «Pendiente de asignación» sin abrir datos de otra obra.

## 3. UX móvil — propuesta textual de pantallas, no captura implementada
### M-01 — Cabecera del tablero contextual
```text
┌─────────────────────────────────────────┐
│ SEMSE                         [Perfil]  │
│ Trabajo actual                         │
│ [Staffing Norte             ▾]         │
│  Edificio Centro · Piso 7              │
│  Función: Trabajador                    │
│─────────────────────────────────────────│
│  Hoy: 6:30 am – (en curso)              │
│  Mi jornada  | Mis tareas | Evidencia   │
│  Prometeo: consulta esta obra           │
└─────────────────────────────────────────┘
```
La cabecera acompaña las pantallas donde se pueden ejecutar acciones: siempre queda visible el nombre/función mediante barra condensada al hacer scroll. Durante subida de evidencia, permitir volver sin perder borrador ni destino.

### M-02 — «Cambiar espacio de trabajo»
```text
┌─────────────────────────────────────────┐
│ ← Cambiar espacio de trabajo            │
│ Buscar empresa o proyecto               │
│ MI EMPRESA                              │
│ ◉ Mi Empresa Eléctrica                  │
│   Administrador · 3 proyectos           │
│ ORGANIZACIONES DONDE COLABORO           │
│ ○ Staffing Norte                        │
│   Trabajador · 1 obra asignada          │
│ PROYECTOS EXTERNOS                      │
│ ○ Remodelación Casa López               │
│   Profesional invitado · Solo proyecto  │
│─────────────────────────────────────────│
│ + Ver invitaciones (2 pendientes)       │
│ Gestionar mis relaciones                │
└─────────────────────────────────────────┘
```
Estas son **etiquetas ficticias de ejemplo**: nunca mostrar organizaciones reales del usuario sin resultado API autorizado. Los elementos derivados de invitación pendiente no habilitan acceso hasta aceptar/verificar. Mostrar fecha de caducidad o estado suspendido como no seleccionable, sin exponer datos privados.

### M-03 — Selección de obra y función
- Si el espacio tiene varias obras, aparece paso «¿En qué obra trabajarás?» (solo permitidas). Cada tarjeta muestra sitio, número/fecha si aplica, ubicación general y encargado.
- Si una misma persona tiene más de una capacidad válida *dentro del mismo proyecto*, mostrar «¿Con qué función participarás?» únicamente cuando de verdad sean opciones autorizadas y semánticamente distintas. Nunca pedirle al usuario elegir un rol inexistente para ese proyecto.
- Si hay una sola opción, entrada directa, sin pasos redundantes.
- Al confirmar, la UI expresa: «Ahora estás en [Org/Proyecto] como [Función]» y actualiza menú, rutas, tareas, evidencia y Prometeo; backend autoriza cada operación.
- Para entrar a **su empresa** puede mostrar panel administrativo; para entrar como **trabajador** muestra reloj/tareas/evidencia, sin panel empresarial. Para proyecto externo invitado solo muestra alcance de ese proyecto.
- Nunca preservar el rol administrativo de una Org al navegar hacia otra.

### M-04 — Invitación recibida
- Notificación/enlace: «[Empresa] te invita como [función]».
- Vista previa: empresa, rol, destinatario parcialmente oculto, expiración, privacidad y términos; botones «Aceptar» / «Rechazar».
- Si no ha iniciado sesión, autenticación/registro seguro **sin crear Org nueva**; aceptar exige prueba del destinatario.
- Tras aceptación: «Ya formas parte de [Empresa]», pero no afirma estar asignado a obra; si viene `projectId` y existe asignación verificada, pregunta «¿Abrir la obra asignada?».
- Enlaces vencidos/revocados: mensaje neutral + solicitud de nueva invitación.
- No se solicita ubicación antes de ingresar a la obra y aprobar el permiso separado.

### M-05 — Cambio durante una jornada activa o tarea en edición
Al elegir otra organización cuando el reloj actual está en marcha, **no cerrar, pausar, mover ni reclasificar automáticamente tiempo**. Mostrar:
```text
Tienes una jornada activa en Staffing Norte.
[Continuar sin detenerla] [Revisar reloj] [Cancelar]
```
«Continuar» abre contexto nuevo SOLO en modo permitido; **si intenta iniciar un segundo reloj solapado, bloquear o solicitar cierre/revisión explícita** según negocio. Mostrar siempre banner «Jornada activa en [Org/Obra]» con CTA visible. Fotos/tareas en borrador deben conservar su `tenantId/orgId/projectId/taskId` original, sin reanclarlas silenciosamente. Geocerca activa no cambia de sitio por cambiar de pestaña/contexto; su continuidad depende de la asignación y permisos de ubicación.

## 4. UX web — navegación lateral y selector
En escritorio/tablet, selector persistente superior izquierdo o menú de avatar: Org → Proyecto → función autorizada. Panel lateral se regenera por permisos efectivos del contexto. Ejemplo:
- «Mi Empresa Eléctrica · Administrador»: Personal, Cuadrillas, Proyectos, Evidencias, Horarios, Invitaciones, Ajustes autorizados.
- «Staffing Norte · Trabajador»: Mi turno, Mis tareas, Fotos y videos, Mi cuadrilla, Mis solicitudes.
- «Casa López · Profesional invitado»: Solo su proyecto, sus entregables y comunicaciones permitidas.

**Accesibilidad:** tamaños de toque ≥44px, texto bilingüe ES/EN sin truncar empresa/rol (página detalle), foco/VoiceOver/TalkBack, confirmación legible de cambio, offline y lector de pantalla. En móvil, una mano y guantes, sin navegación profunda para fichar. Eventos offline solo pueden operar con último grant/scope comprobado y política segura: no autorizar acciones de alto impacto sin revisión online posterior.

## 5. Máquina de navegación y estados
```text
UNAUTHENTICATED
  -> AUTHENTICATING
  -> RESOLVING_MY_CONTEXTS
  -> SELECTOR_EMPTY | CONTEXT_READY
CONTEXT_READY
  -> SELECTING_ORG_OR_EXTERNAL_PROJECT
  -> VALIDATING_ACCESS [server]
  -> SELECTING_PROJECT? [only if >1 valid]
  -> SELECTING_CAPABILITY? [only if ambiguous & allowed]
  -> CONTEXT_READY (new, verified)
SELECTING...
  -> ACCESS_DENIED | MEMBERSHIP_REVOKED | PROJECT_UNASSIGNED | OFFLINE_DEGRADED
```
La preferencia «última organización vista» puede orientar la UX, **nunca** ser una autoridad de seguridad. Si un enlace directo abre una tarea en una Org distinta, validar grant antes de mostrar la tarea; si no, 403/404 con recuperación. Si usuario tiene varias membresías y login actual elige primera, no suponer que la sesión ya opera en la Org buscada.

## 6. Contratos de lectura sugeridos (NO endpoints existentes)
El backend debe preferir adaptar `GET /v1/users/me/capabilities`, `GET /v1/organizations` y políticas por recurso. Nuevos contratos, si se requieren:
```ts
type AvailableWorkContext = {
  contextKey: string;       // identificador opaco estable, sin autoridad propia
  contextType: "ORGANIZATION" | "EXTERNAL_PROJECT";
  tenantId: string;         // exclusivamente del servidor
  orgId?: string;
  projectId?: string;
  orgDisplayName: string;
  projectDisplayName?: string;
  membershipStatus?: "ACTIVE" | "INVITED" | "SUSPENDED" | "REVOKED";
  relationship: "OWNER" | "EMPLOYEE" | "CONTRACTOR" | "CLIENT" | "GUEST";
  availableCapabilities: Array<"CLIENT" | "PRO" | "WORKER" | string>;
  effectiveCapability?: string;
  scopeLabel?: string;
  hasActiveTimeEntry: boolean;
  canOpen: boolean;
  blockedReason?: "REVOKED" | "SUSPENDED" | "NOT_ASSIGNED" | "EXPIRED";
  accessRevision: string;  // servidor; invalida preferencias/cachés obsoletos
};
type WorkContextsResponse = {
  contexts: AvailableWorkContext[];
  pendingInvitationsCount: number;
};
```
**Endpoints candidatos:**
- `GET /v1/me/work-contexts` -> solo contextos **permitidos al actor autenticado**, sin lista global de empresas.
- `GET /v1/me/work-contexts/:key/projects` -> solo proyectos accesibles, paginados.
- `POST /v1/me/work-contexts/resolve` -> resuelve y valida **un recurso** y devuelve acciones permitidas, no cambia privilegios por sí mismo.
- `GET /v1/me/active-time-sessions` -> consulta el propietario Labor Engine (read-only) para bandera de jornada activa.
Las URLs y nombres son **propuestas**; no hay cambios de API en este documento. Un simple `orgId` seleccionado en navegador nunca debe bastar para leer datos del tenant.

**Bloqueo arquitectónico P0 a resolver antes de código:** el login actual de `AuthService` selecciona `memberships[0]` y firma `orgId/roles` en el JWT. La F10 aprobada exige capacidad por proyecto/org, y ADR-040 rechazó un switch global de Org guardado en sesión. El equipo de identidad debe decidir la solución compatible: p. ej. **resolver el recurso autorizado y emitir/actualizar una credencial de alcance ligada a esa identidad+Org/Proyecto**, o un boundary que calcule y verifique permiso real de cada recurso; nunca mezclar roles del JWT de Org A para Org B. Una simple UI de selector sobre JWT estático es **insuficiente**. No implantar un `OrgContextService` o `WorkspaceMembership` paralelo que contradiga ADR-040; documentar decisión en SDD/ADR actualizada y pruebas de rendimiento/seguridad de autorización.

## 7. Separación de datos, eventos y riesgos
- El `User.id` permanece idéntico al alternar. `tenantId/orgId/projectId` efectivos de cada acción pertenecen al recurso, verificados en servidor.
- No mostrar nómina, documentos laborales o información de clientes de su compañía cuando está en una obra ajena. Una invitación `WORKER` no concede `ADMIN`, aunque tenga `ADMIN` en su propia Org.
- El equipo GC que opera en otro software solo accede a invitaciones de **proyecto externo** o paquetes de evidencia explícitamente compartidos; no obtiene automáticamente `Membership` staffing ni acceso al padrón.
- Prometeo recibe `ActorContext` resuelto y límite de recursos para **cada** tool; al preguntar "¿Qué hicieron hoy?" debe consultar la obra actualmente abierta, no todos los espacios juntos. Consultas跨-org requieren grants autorizados separados y una intención explícita.
- Nunca mezclar evidencia de obra A en la tarea de obra B por cambio rápido o retorno offline; auditoría: `actorUserId, tenantId, orgId, projectId, roleUsed, contextKey, correlationId, policyDecision`.
- Logs/auditoría de selección muestran **intención y resultado verificado**, no una elevación en sí misma. Nunca replicar enlaces de invitación secretos en historial/UI.
- Revocación de membresía debe invalidar acceso incluso con token no vencido para recursos sensibles. Probar caché y revocation epoch sin reabrir el incidente de latencia de base de datos.
- Si termina asignación externa, contexto externo desaparece o aparece solo como historial autorizado, no como obra operable. La identidad, Org propia y otros trabajos quedan intactos.
- Operar en varias Organizaciones no significa que tiempo de nómina, contratos o evidencia se compartan, ni que un empleado represente a su propia empresa por defecto.

## 8. Requisitos de prueba (E2E + seguridad)
- **CTX-01:** una misma persona `User.id` es dueño/admin/PRO o CLIENT en su propia Org y `WORKER` en staffing ajeno; puede abrir cada contexto sin cuenta nueva.
- **CTX-02:** menús, rótulo fijo, acciones y datos cambian correctamente por Org/Proyecto y rol. Ningún permiso de `OWNER/ADMIN` se hereda en otra Org.
- **CTX-03:** invitación externa concede solo proyecto y no acceso a todos los usuarios/proyectos de la constructora.
- **CTX-04:** onboarding de invitado crea `Membership` correcta sin duplicar User u Org; y "Abrir obra" no funciona hasta asignación validada.
- **CTX-05:** cambio de empresa con una jornada en curso no detiene ni pierde tiempo; bloquea dos relojes superpuestos y no mueve evidencia/geo.
- **CTX-06:** el selector muestra solo contextos realmente autorizados; `orgId` falsificado, `projectId` adivinado y URL directa cruzada devuelven denegación sin fuga.
- **CTX-07:** revocar/suspender Org B mientras usuario sigue admin de A corta acceso B con JWT previo, sin impedir A.
- **CTX-08:** al cambiar durante upload/edición offline, borrador se mantiene ligado a su obra original, y reconciliación no provoca cruce de tenant.
- **CTX-09:** un proyecto con un único rol no pregunta innecesariamente por rol; con varios roles efectivos sí muestra opciones autorizadas.
- **CTX-10:** Prometeo cita solo documentos del contexto actual y deniega herramientas/no revela secretos desde otra Org.
- **CTX-11:** si login da JWT basado en primera membresía, el producto no simula acceso a otra Org sin boundary autorizante real.
- **CTX-12:** worker revocado no recibe notificaciones ni eventos SSE de proyecto; pruebas iOS/Android/web con cuenta multirol y bajo latencia.

## 9. Entrega por fases
- **UX-0:** auditoría de rutas reales del multirol, sesión JWT, capability flag, RBAC, Membership.status, external project grants; diagramar data/control flow. No asumir UI ya desplegada.
- **UX-1:** especificación API y seguridad de context resolution compatible con F10 y ADR-040; tests de aislamiento/revocación y prueba de no regresión de login/latencia antes de habilitar selección.
- **UX-2:** componente UI web/PWA (selector, barras de contexto, invitaciones, org/proyecto, error/suspensión); componente React Native equivalente para mobile, ES/EN y accesibilidad.
- **UX-3:** tareas, tiempo, evidencia, geocerca y Prometeo todos reciben contexto verificado y no mezclan peticiones concurrentes; recuperación offline.
- **UX-4:** e2e cross-org/role, canary autenticado multi-org, control de logs/PII, monitoreo, feature flag y rollback. Producción confirmada solo mediante CI + merge + Railway + dispositivo.
**Definición de terminado:** no basta que el menú se vea. El mismo usuario cambia de empresa y proyecto sin perder identidad, sin heredar permisos, sin mezclar horas y evidencias, y los tests/registros de producción lo prueban.

## 10. Decisiones para propietario del producto
Se presume **aprobada** por la conversación la elección de un selector simple de trabajo para una cuenta multirol. No se presume aprobada la arquitectura de sesiones aún.
- Si se muestra "Último lugar visitado" por conveniencia, debe ser solo preferencia visual; no puede elevar permisos.
- ¿Permitir cambiar de contexto con jornada en curso? Recomendación: sí, con aviso persistente y sin iniciar otro reloj simultáneo.
- ¿Invitado externo puede subir evidencias al GC sin Membership completa? Recomendación: sí, pero únicamente con grants de proyecto verificables y revocables.
- ¿Una persona puede actuar en propia empresa como PRO y administrador? Sí si ambas capacidades están autorizadas; no fusionar permisos en un rol universal global.

**Registro de continuidad:** Esta especificación materializa el acuerdo oral posterior al PR #857: «un workspace para cada organización/proyecto», entendido como navegación por contexto, no nueva entidad de autoridad. Debe enlazarse al PR y a todos los futuros child SDD specs de implementación.
