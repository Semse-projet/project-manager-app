# ADR-WPI-002 — Continuidad personal sin autorización empresarial implícita

- **Fecha:** 2026-10-24
- **Estado:** Proposed / NO APPROVED / NO CODE
- **Riesgo:** critical — autenticación, privacidad, retención y derechos de terceros
- **Padres:** programa `labor.worker-independence-growth-program` (#1035), F1A `labor.personal-record-export` (#1036), ADR-WPI-001 Proposed
- **Dueños de decisión:** Product, Identity/Auth, Security/Privacy y Legal/Records
- **Aplicación:** propuesta F1B; F1A continúa limitado al ámbito actualmente autorizado

## Problema verificable en main (inventario estático 2026-10-24)

1. `User` es identidad global; `Membership` representa roles por `Org` y tiene `ACTIVE/SUSPENDED/REVOKED`.
2. `AuthRepository.findUserByEmail` carga únicamente membresías `ACTIVE`; `AuthService.loginWithPassword` selecciona `memberships[0]` y deniega login si no hay ninguna.
3. `AuthService.issueSession` exige `userId`, `tenantId` y `orgId`; `AuthSession` los guarda como strings obligatorios. `authenticateRequest` revalida sesiones y membresías activas de esa Org.
4. `TimeEntry` y `FreeProject` tienen `createdBy` y `tenantId`; `TimeEntry.orgId` es obligatorio. Lecturas actuales usan `tenantId` de sesión + `createdBy`.
5. `Tenant.freeProjects` y `Tenant.timeEntries` referencian la entidad `Tenant` con `onDelete: Cascade`. **El riesgo de pérdida al eliminar tenant es estructural; no se ha verificado que exista un flujo autorizado que elimine tenants en producción.**
6. El registro actual crea un `User`, `Org` propia y `Membership` en el tenant predeterminado; por eso una persona puede usar SEMSE sin que su patrón tenga cuenta, pero **no es una identidad sin Org**.
7. `ADR-040` rechaza el cambio global de Org en sesión como autoridad. La preferencia de organización es exclusivamente navegación; el role resolver es contextual y se debe revalidar.

## Objetivo innegociable

La persona debe poder recuperar el **registro personal que tiene derecho a conservar** aun cuando cambie de empleador, una membresía de empresa termine o la empresa deje SEMSE. No obtiene de ese modo acceso a Jobs, compensaciones de terceros, instrucciones confidenciales, archivos de obra o datos legalmente retenidos por el patrón. Ninguna copia convierte por sí sola horas declaradas en horas aprobadas.

## Opciones evaluadas

### A — Leer todos los tenants con `WHERE createdBy = User.id` (RECHAZADA)

Rompe el límite de tenant por consulta, reintroduce BOLA/IDOR y permitiría combinar datos de empleo/obra con datos personales. Un `User.id` correcto **no** demuestra derechos para mostrar cada nota, evidencia, tarifa o Job vinculados a ese usuario.

### B — Cambiar `tenantId` de cada `TimeEntry` al tenant nuevo o crear segundo motor personal (RECHAZADA)

Borraría procedencia y rompería contratos de `Labor Engine`, auditoría, pagos, evidencias y referencias originales. Reescribir el propietario histórico no es portabilidad.

### C — Sesión personal separada de sesiones empresariales + archivo derivado permitido, inmutable y bajo custodia personal (RECOMENDADA PARA DISEÑO; AÚN NO APROBADA)

**Identidad:** usar el mismo `User.id` y un *contexto de acceso personal* verificable por sesión. Una sesión personal demuestra identidad/autenticación y sólo habilita rutas personales expresamente permitidas; no contiene autoridad empresarial. Una sesión de organización continúa exigiendo membresía activa. No aplicar `CLIENT`, `PRO` o `WORKER` como permiso de Org mediante una sesión personal. La implementación puede añadir un tipo discriminado de sesión y guard por tipo o mecanismo equivalente, sujeto a la decisión de Auth; no convertir a null de manera global `tenantId/orgId` sin una auditoría de consumidores.

**Datos:** `TimeEntry` sigue siendo la fuente canónica de hechos operativos y correcciones. El **archivo personal derivado** (si Legal/Privacy lo permite) conserva versiones permitidas de registros personales y manifiestos de procedencia firmados/hash con campos mínimos. No recibe autoridad para editar, aprobar, borrar ni pagar entradas originales. Se liga a `User.id`, no a la organización actual, y su custodia no depende de que la Org de origen siga activa. No convertir registros de empleo de una organización en archivos personales por defecto sin análisis legal y consentimiento/política aplicables.

**Proyección propuesta, NO esquema aprobado:** `PersonalRecordReceipt(ownerUserId, sourceTenantId, sourceOrgId, sourceEntryId, sourceRevision, recordClass, capturedAt, sourceHash, projectionHash, encryptedPayloadRef, retentionClass, provenanceStatus)`; identificadores de origen sólo para auditoría interna, nunca como capability tokens. Alternativamente, servicio de exportes versionados y cifrados sin tabla permanente, si se demuestra que la retención queda garantizada. Proteger datos con cifrado y llaves independientes por usuario; clasificar `recordClass` y permitir sólo campos aprobados.

**Captura atómica/idempotente:** cuando exista un evento autorizado de tiempo personal, registrar outbox en la misma transacción de escritura canónica; proyector idempotente por `(sourceTenantId, sourceEntryId, revision, recordClass)`; fallos visibles, reintentos/DLQ, sin afirmar captura completada si falla. No bloquear el cronómetro offline por una réplica no crítica. Elegibilidad/retención se decide antes de proyectar; exportación histórica/backfill exige revisión humana y autorización de alcance.

**Revocación:** la Org suspendida deja de autorizar lectura corporativa; no debe borrar automáticamente registros personales válidamente custodiados. La sesión personal es independiente de la Membership suspendida, pero sigue sujeta a suspensión global del `User`, revocación de AuthSession, step-up y políticas de conservación/borrado. Un permiso de compartición personal revocado impide nuevas lecturas por terceros, no retira copias ya entregadas legalmente.

**Límite:** ningún endpoint corporativo, `@RequirePermissions` existente, SSE, WebSocket, Prometeo tool, Worker o BFF puede aceptar un token personal como si fuera token empresarial. Fail closed. No añadir un `Workspace` paralelo ni `OrgContextService` contrario a ADR-040.

### D — Obligar a conservar una Org propia y dar acceso sólo por sus tokens (MITIGACIÓN TRANSITORIA, NO CUMPLE F1B)

Permite trabajo sin patrón que use SEMSE mediante la Org que crea `register`, pero si la identidad queda sin Membership activa no tiene login. Tampoco resuelve tenant de origen distinto o cascadas por eliminación. Puede mantenerse mientras C pasa gates, sin anunciar portabilidad cross-tenant.

## Límites y consentimiento

- Distinguir `personal_private`, `org_business`, `worker_submitted_to_job`, `legally_restricted` y `disputed`. La autoría no equivale a propiedad legal universal.
- En `personal_private`, sólo el propietario lee su copia. En `worker_submitted_to_job`, cualquier resumen portable exige revisión de confidencialidad, contratos y derechos de terceros.
- GPS preciso, fotos, ubicaciones privadas, salarios de terceros, números de clientes, secretos empresariales y textos de contratos nunca entran en una copia personal por implicación.
- Políticas explícitas de retención, derecho de acceso/corrección, borrado, legal hold, respuesta a solicitud de datos y destrucción de llaves; evitar garantías de permanencia ilimitada.
- La exportación debe marcar `source_confirmed`, `derived_snapshot`, `pending_local`, `redacted`, `source_unavailable` según corresponda, con fecha de corte. No falsificar procedencia ni firma legal.

## Matriz de autoridad

| Principal | Contexto y recursos | Puede | No puede |
|---|---|---|---|
| User A, sesión PERSONAL | archivo permitido donde `ownerUserId=A` | leer/exportar su copia autorizada y sus metadatos | leer Job/TimeEntry empresarial del antiguo tenant; consultar B; publicar |
| User A, sesión ORG X activa | recursos de X autorizados por ResourceScope y membership | acciones de X con roles efectivos | heredar permisos de Y; leer archivo personal de B |
| User A, membership X revocada | sesión PERSONAL activa, sin recursos de X | su archivo personal permitido | sesiones corporativas de X, permisos admin X |
| User B, mismo tenant anterior | su archivo | sus registros | archivo A incluso si B es OPS_ADMIN |
| Compañía X/Y | sus propios Jobs y evidencias vigentes | dominio propio | histórico personal de A, salvo grant explícito |
| Prometeo/Worker | servicio con token/actor/policy explícitos | acciones sólo con autoridad delegada | ampliar contexto global, crear copias o divulgarlas sin permiso |

## Riesgos especialmente críticos

1. `auth bypass`: tratar token personal como empresarial o roles de otro Org.
2. `tenant deletion`: `onDelete: Cascade` sin mecanismo legal y técnico de custodia personal.
3. `over-sharing`: proyectar notas de obra, GPS/fotos, tarifas empresariales sin derecho.
4. `drift`: copia personal no concuerda con corrección/rechazo original; siempre versionar e indicar procedencia.
5. `recovery/account takeover`: robo de cuenta permitiría descargar el archivo completo; requiere step-up adaptado al riesgo, límites y alertas.
6. `data erasure/legal hold`: políticas incompatibles entre tenant y persona, backups o jurisdicciones.
7. `offline`: un evento no confirmado localmente no puede presentarse como dato server-verified.

## Gates para aceptar ADR y diseñar código

- **G0:** Identity/Auth confirma sesión personal discriminada, vigencia, recuperación sin Org y política de revocación, con pruebas para todos los guards.
- **G1:** Security verifica que ningún endpoint corporativo ni worker/agent interprete token personal como `OrgActor`; pruebas A/B mismo tenant y cross-tenant.
- **G2:** Legal/Privacy/Records determina categorías elegibles y derecho de conservación, retención, revocación, borrado y derechos de terceros.
- **G3:** Architecture/DB determina custodia realmente independiente de `Tenant`, consistencia/outbox, integridad, cifrado, almacenamiento y migración, sin crear otro motor de horas.
- **G4:** Data/Operations presenta plan de exportación/recovery ante eliminación del tenant, fallos, RPO/RTO y restore drill sintético.
- **G5:** Aprobación humana explícita de spec F1B, pruebas/implementación por slices reversibles; CI **al final**, luego merge, deploy y activación autorizados por separado.

## Referencias

`docs/architecture/ADR-029-labor-engine-canonical-time-owner.md` ·
`docs/architecture/ADR-040-ws01c-identity-organization-context.md` ·
`docs/specs/core/universal-identity-multi-role.spec.md` ·
`docs/specs/core/business-access-foundation.spec.md` ·
`docs/specs/labor/labor-engine-remediation.spec.md` ·
`docs/specs/labor/free-project-mutation-guard.spec.md` ·
`docs/foundation/DOMAIN_INVARIANTS.md` ·
`docs/SDD_GOVERNANCE.md`

**No implementation, auth change, schema migration, flag, tenant cleanup, CI, merge or deploy is authorized by this Proposed ADR.**
