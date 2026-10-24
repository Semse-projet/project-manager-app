---
id: "labor.personal-continuity"
title: "F1B — Identidad y continuidad de registros personales entre organizaciones"
domain: "labor"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-24"
---

# F1B — Continuidad personal tras cambiar de empresa (SDD 2.0)

> **DRAFT / NO IMPLEMENTAR.** Requiere aceptar ADR-WPI-002 y la decisión de Legal/Privacy antes de códigos o migraciones. Este slice no sustituye F1A, no abre un bypass a tenants anteriores y no autoriza una copia de datos empresariales. F1A está en PR #1036 y el programa F0 en PR #1035; ambos continúan DRAFT.

## 1. Problema y resultado

**Para quién:** usuario que trabaja para varias organizaciones a lo largo del tiempo, o que pierde todas sus membresías empresariales, y desea conservar datos personales legítimos aunque su patrón no use SEMSE.

**Evidencia AS-IS de main, revisión de código 2026-10-24 (NO runtime):**

- `User` es identidad global, pero `findUserByEmail` filtra únicamente `Membership.status=ACTIVE`.
- `AuthService.loginWithPassword` rechaza cuentas sin membresía activa; `AuthSession` y JWT se emiten con `tenantId`, `orgId`, roles. `AuthService.authenticateRequest` verifica roles contra membresía de esa Org.
- `AuthService.register` crea User+Org+Membership propia bajo `SEMSE_DEFAULT_TENANT_ID`; esto ya permite usar SEMSE sin registro del empleador, pero **NO permite permanecer sin cualquier Org**.
- `TimeEntry` y `FreeProject` están asociados a `Tenant` con `onDelete: Cascade`. Un cambio/eliminación de tenant puede amenazar retención si los registros no tienen custodia independiente; no se verificó un flujo real de borrado de tenants.
- `GET /v1/labor/entries` usa tenant y usuario de sesión; no constituye una API self-only universal entre tenants.

**Resultado esperado:** una persona sigue pudiendo autenticarse como individuo y consultar/exportar copias permitidas de su propio historial, aun cuando no pueda operar en ninguna Org. Esta capacidad jamás le concede acciones empresariales ni permiso retrospectivo para ver registros confidenciales de la antigua compañía.

## 2. Ámbitos F1A / F1B / F1C

| Slice | Alcance | Condición |
|---|---|---|
| F1A | Exportación íntegra sobre `TimeEntry` *ya autorizado* por tenant + autor | PR #1036, aún DRAFT |
| F1B | Identidad personal independiente de Membership + custodia de versión permitida, no canónica, de registros personales | ESTE CONTRATO, bloqueado hasta revisión |
| F1C | Fotos/adjuntos/evidencias con licencias, derechos de terceros, consentimientos y custodia especializada | FUTURO, no implementar con F1B |

**Prohibiciones:** no mover TimeEntry a otro tenant, no duplicar motor de tiempo, no crear nuevo rol RBAC genérico `PERSONAL_ADMIN`, no usar selector de Org como autoridad, no habilitar lectura `User.id` entre tenants sin política de recurso, no confundir copia personal con nómina o documento firmado.

## 3. Actores y autoridad propuesta

| Actor | Evidencia de autenticación | Alcance permitido | Denegado |
|---|---|---|---|
| Persona A sin Membership activa | Principal de sesión personal verificable `subject=User A` sin roles organizacionales | Archivo personal permitido de A (`ownerUserId=A`) | `Job/Org/TimeEntry` de otros tenants y cuentas |
| Persona A como miembro de Org X | Contexto empresarial verificado, Membership activa, rol efectivo por recurso | Recursos autorizados de X; acceso a su archivo personal sólo por decisión explícita del guard personal | Privilegios de X sobre Y o sobre B |
| Persona B del mismo tenant anterior | Su sesión personal | Solo archivo B | Archivo A |
| Patrón/administrador empresa X/Y | Sesión empresarial | Operación permitida en empresa y Job | Archivo personal privado ajeno, datos de otra Org |
| OPS_ADMIN | Rol real empresarial | Acceso empresarial vigente | Override de archivo personal sin spec distinta |
| Sistema/Agente/Worker | Identidad de servicio y grant explícito | Sólo proyecciones/acciones permitidas por policy | Impersonación de User o ampliación de roles |

**Contrato lógico de autoría:** acceso personal se decide por sesión personal **y** registro derivado `ownerUserId`, `recordClass`, estado de custodia, retención y revocación. Para el origen operativo, siempre `Tenant/Org/ResourceScope`; el archivo NO autoriza abrir ese origen. No recibir `ownerUserId` arbitrario como query para cambiar de persona.

## 4. Escenarios P0

### P0-01 — Empleador no usa SEMSE

```gherkin
DADO A con cuenta personal existente y Org propia creada por el registro actual
Y un proyecto personal legítimo no asociado a la empresa del patrón
CUANDO A registra tiempo personal y exporta su historial
ENTONCES no requiere una cuenta de su patrón
Y ninguna empresa recibe permisos o evidencia automáticamente
```

### P0-02 — Ninguna membresía activa

```gherkin
DADO A con User global activo y sin Membership ACTIVE
CUANDO autentica y solicita sólo sus registros personales permitidos
ENTONCES obtiene un principal PERSONAL de alcance restringido sin roles de Org
Y ninguna ruta organizacional acepta ese principal
Y sesiones empresariales anteriores se consideran revocadas/inválidas
```

### P0-03 — Cambia de compañía y tenant

```gherkin
DADO A con origen permitido personal en tenant X y Membership de X revocada
Y A recibe nueva Membership en tenant Y
CUANDO A consulta su archivo personal desde su identidad global
ENTONCES ve sólo sus versiones personales autorizadas con su procedencia y estado
Y el patrón de Y no puede consultar el archivo X ni acceder al Job de X
Y A tampoco obtiene permiso para leer directamente recursos corporativos de X
```

### P0-04 — Eliminación de tenant

```gherkin
DADO una proyección personal elegible y verificada, custodiada fuera del ciclo de vida de Tenant X
CUANDO se simula eliminar X en un ensayo aislado y autorizado
ENTONCES la copia permitida sigue recuperable por A según política de retención
Y se marca que la fuente original ya no está disponible
Y no se declara preservación total de fotos, tiempos empresariales o datos no elegibles
```

### P0-05 — Denegaciones

```gherkin
DADO una sesión PERSONAL de A y una sesión empresarial suspendida en Org X
CUANDO se llama un endpoint de Job, pagos, reportes, Evidence, SSE o Prometeo de X
ENTONCES la llamada es denegada sin devolución de datos o filtrado de existencia
Y el principal personal sólo puede acceder a las rutas self autorizadas
```

### P0-06 — Corrección e integridad

```gherkin
DADO un TimeEntry original de A con versión derivada permitida en custodia personal
CUANDO el origen se corrige mediante el procedimiento auditado
ENTONCES el original canónico no se altera por la proyección
Y el archivo incorpora una nueva versión o estado de procedencia, no sobreescribe silenciosamente
Y cualquier exportación explica si la fuente está disponible, verificada, disputada o removida
```

### P0-07 — Retención y revocación

```gherkin
DADO una copia permitida con plazo de conservación y una solicitud de supresión o disputa
CUANDO Privacy ejecuta la política aplicable
ENTONCES se registra el resultado (retener por obligación, restringir, rectificar o borrar según ley)
Y no se promete que revocar una compartición elimine copias de terceros ya recibidas
Y jamás se elimina la evidencia de una disputa activa sin evaluación de legal hold
```

## 5. Criterios de aceptación obligatorios

- **AC-01:** ninguna Org activa: el usuario autenticado sólo obtiene acceso PERSONAL; no obtiene roles `CLIENT/PRO/WORKER/OPS_ADMIN` de sesión empresarial por ese hecho.
- **AC-02:** A/B en mismo tenant histórico y C externo: archivo A sólo A; no consultar por email/tenantId para buscar copias ajenas.
- **AC-03:** volver a entrar en Org X, estar en Org Y o perder Membership no concede ni quita arbitrariamente acceso personal válido; sí cambia permisos empresariales.
- **AC-04:** prohibido `select * from TimeEntry where createdBy=A` cross-tenant en una solicitud personal; custodia derivada de datos elegibles y revalidada, sin autoridad corporativa.
- **AC-05:** `AuthSession` PERSONAL claramente diferenciada y probada en API/BFF/Worker/SSE/agents; `@RequirePermissions` de empresa fail-closed en toda ruta.
- **AC-06:** custodia personal conserva los datos permitidos al simular eliminación de tenant sólo después de que la captura autorizada haya sido confirmada y su retención aprobada; fuentes indisponibles marcadas explícitamente.
- **AC-07:** datos de terceros, foto cliente, GPS y compensación empresarial fuera por defecto; se prueban políticas `recordClass` y `redaction`.
- **AC-08:** proyección idempotente con transacción/outbox real o mecanismo equivalente probado; reconstrucción, DLQ y ausencia de duplicados bajo reintentos.
- **AC-09:** hash/versiones/fuente/fecha, no valor jurídico de firma; corrección genera nueva versión visible, jamás sobrescritura silenciosa.
- **AC-10:** step-up para export masiva, revocación de sesión y rate limits; auditoría sin PII y borrado/legal hold documentados.
- **AC-11:** ES/EN conserva consentimiento versionado; pruebas mobile, offline, restauración y regresión de multirol/multiorg.
- **AC-12:** F1B no se declara VERIFIED sin prueba autenticada de caso sin Org y canary por ambiente autorizado, observación de métricas, rollback y verificación independiente.

## 6. Contratos API/UI — CANDIDATOS, no aprobados

```yaml
principalKinds:
  - ORG     # membresía ACTIVE + contexto recurso, existente
  - PERSONAL # identidad User revalidada, SIN roles de Org
personalScope:
  owner: authenticated User.id only
  data: legally permitted personal archive/projections only
  errors:
    401: no identity/session
    403: principal or policy forbids request
    404: resource not self-owned or not available
    409: requested version/snapshot not consistent
    429: download quota exceeded
effects:
  payment_governance: none
  auto_share_to_company: false
  auto_sign: false
  audit_log: required per catalog review
```

**Rutas posibles, NO finales:** `GET /v1/me/personal-records`, `GET /v1/me/personal-records/export`, `GET /v1/me/personal-records/:recordId`. El nuevo guard de identidad no reutiliza un `OrgActor` falso; revisar naming collisions con ADR-040 y API_SURFACE. Semántica de sesión personal y persistencia aún sujetas a propuesta de Auth.

**UI:** «Mi cuenta / Mi historial personal» independiente del selector de organizaciones, sin mostrar empresas antiguas salvo procedencia permitida y redactada; aclarar registro personal, documento de empresa y archivo compartido; estados `ready/loading/empty/restricted/recovering/error`. Nunca presentar medio inaccesible como copiado.

**Prometeo:** solo consulta a través del mismo permiso self; ninguna decisión, firma, sharing, certificación o borrado autónomo.

## 7. Datos, eventos y rollback

**NO se implementa un nuevo modelo en este PR.** Si se aprueba la alternativa C del ADR:
- Diseñar un archivo derivado cifrado con clave por usuario, fuera de dependencia referencial/cascada del tenant original, sujeto a retención legal.
- Cada registro derivado tiene `ownerUserId`, clasificación, fuente original, revisión y hash; validar unicidad de proyección para evitar duplicados.
- El propietario de escritura de `TimeEntry` y `FreeProject` permanece Labor Engine; la copia de lectura no se usa para calcular nomina/costo.
- Eventos/outbox según `DOMAIN_INVARIANTS`, `EVENT_CATALOG` y `STATE_MACHINES`, no inventar nombres de eventos aprobados.
- Backfill sólo de fuentes que el worker realmente puede exportar y tiene derecho a conservar; marca de corte/procedencia.
- Rollback detiene lectura/proyección y revoca tokens sin destruir evidencia original ni violar legal hold; migraciones expand/contract y checksum verificables si luego hay schema.

## 8. Decisiones críticas que bloquean implementación

| ID | Decisión | Autoridad |
|---|---|---|
| F1B-D01 | Tipo PERSONAL de sesión, login sin Membership, revocación/step-up y guard fail-closed | Identity/Auth/Security |
| F1B-D02 | Datos elegibles y derechos de autoría de empresa/cliente, legal hold, retención y supresión | Legal/Privacy |
| F1B-D03 | Modelo mínimo de archivo derivado cifrado vs export de usuario, duración y claves | Architecture/Records |
| F1B-D04 | Captura atómica, consistencia, correcciones, DLQ, recuperación y riesgo offline | Labor/Data |
| F1B-D05 | Consecuencias de eliminación/retención tenant, pruebas aisladas y operaciones de restore | DBA/Ops/Legal |
| F1B-D06 | Uso en Prometeo, BFF, móvil, cachés, SSE y herramientas de servicio sin bypass | Security |
| F1B-D07 | Integración con F1A/#1036 y programa #1035 sin conflictos de SDD index | SDD/Product |
| F1B-D08 | Revisión legal de jurisdicción y atribución profesional/registro de trabajador | Legal/Product |

## 9. Secuencia de gates

1. F0 programa y ADR-WPI-001 se revisan; F1A/#1036 continúa en su propio alcance.
2. ADR-WPI-002 y F1B se ratifican como arquitectura/contrato, con decisión explícita de owner y responsables.
3. Tests negativos de autenticación PERSONAL vs ORG, BOLA/IDOR, tenant deletion sintética, retención y correcciones.
4. Implementación en slices: Auth personal fail-closed → datos personales derivados bajo policy → API export personal → UX ES/EN.
5. Staging sintético, review independiente Security/Privacy, rollback y restauración.
6. **CI al final**: index/validador SDD, tests integración y cobertura, typecheck/build, CI terminal.
7. Merge/deploy/activación por autorizaciones separadas; evidencia real, no inferida.

**Estado:** DRAFT, NOT_STARTED, NOT_RUN, UNMERGED, NOT_DEPLOYED, INACTIVE. No hay migración ni feature flag activa.

## 10. Addendum G0: contrato obligatorio de separación de principal

**Revisión de seguridad de diseño 2026-10-24:** `docs/reportes/2026-10-24_f1b-auth-compatibility-threat-review.md` inspecciona guardas API, `RequestContext`, middleware/cookie web, SSE, modelos DB y autenticación.

**Bloqueos críticos previos al primer código:**
- `@AuthenticatedAccess` actual en `RbacGuard` no discrimina una hipotética sesión PERSONAL de una sesión ORG. Debe mantener comportamiento **ORG-only** por defecto hasta migración explícita de rutas self y su policy.
- `appRoleFromRoles([])` devuelve `client`. **Está prohibido** representar `PERSONAL` como `roles: []` y esperar que el middleware web restrinja rutas; el discriminante se valida antes de cualquier ruta o dashboard por rol.
- `RequestContext = RequestIdentity` exige `tenantId/orgId/roles`: no falsificar tenant/Org en una sesión personal para satisfacer tipos. Los controladores ORG deben usar exclusivamente actor de Org validado; los controladores personales, principal de identidad verificable.
- Los headers `x-semse-*` y la sesión web firmada no son facultades corporativas. El backend debe validar token de ámbito y sesión durable; todos los SSE, Worker, agentes, WebSocket y API empresariales rechazan PERSONAL si no existe una policy individual especializada.
- La cookie/JWT y `AuthSession` deberán diferenciar clase/`audience` y fail-closed; sesiones antiguas sin clase se interpretan solo como ORG con Membership activa, y valores desconocidos deben rechazarse.

**AC-G0-01:** autenticación personal sin Membership no abre ni una ruta organizacional marcada `@AuthenticatedAccess`, aunque no haya `@RequirePermissions`.

**AC-G0-02:** roles vacíos en cookie PERSONAL nunca redirigen a cliente ni permiten `/client`, `/worker`, `/admin`, `/jobs`, `/agents` ni `/workspace`.

**AC-G0-03:** `principalKind` y `audience` declarados/revalidados en sesión durable y token; `ORG` legado sin discriminante no eleva privilegios y `PERSONAL` no puede acceder a endpoints `GET /v1/labor/entries` originarios de tenants anteriores.

**AC-G0-04:** comprobar compatibilidad bajo logout/refresh/revocación/expiración, sesión suspendida, cambio de Membership, procesos, SSE y fallos de disponibilidad Auth.

**Decisión requerida:** Identity/Security aprueban política exacta por decorador/ruta, discriminación de tokens y plan de compatibilidad. Este addendum NO cambia el estado DRAFT ni autoriza implementación.
