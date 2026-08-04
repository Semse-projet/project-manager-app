---
id: "core.originador-referral-program"
title: "Programa de recompensa para originador/facilitador"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
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
related_files:
  - apps/api/src/modules/payments/payment-governance.service.ts
  - apps/api/src/modules/payments/escrow-release.service.ts
  - apps/api/src/modules/jobs/
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-08-04"
---

# Spec: Programa de recompensa para originador/facilitador

> **APPROVED 2026-08-04.** El owner (Samuel) aprobó explícitamente después
> de que se completara la investigación externa (§11) y la revisión punto
> por punto del gate de riesgo `critical` de pagos (§12b). El mismo día el
> owner resolvió las dos decisiones de Fase 0 que quedaban abiertas — **con
> un efecto importante que amplía el gate de pagos original**:
>
> 1. **Tipo de recompensa:** monetaria real, gateada por un documento de
>    identidad fiscal (pasaporte, seguro social, ITIN, o equivalente local)
>    que permita al originador declarar impuestos — no créditos de
>    plataforma. Esto confirma y generaliza el hallazgo de 1099-NEC/W-9
>    (§7, §11): el requisito deja de ser "solo para personas US" y pasa a
>    ser "documento de identidad fiscal apropiado según el país del
>    originador", con EE.UU. como el único caso ya investigado en detalle.
> 2. **Alcance geográfico: multi-país desde el inicio**, no acotado a
>    EE.UU. como sugería por defecto la investigación de esta sesión. Esto
>    **añade una dependencia nueva** al gate de pagos: activar recompensa
>    real en cualquier país que no sea EE.UU. requiere revisión legal/fiscal
>    de ese país específico, que esta sesión **no hizo** — solo se investigó
>    el marco de EE.UU. (§11). Se documenta como gate explícito nuevo en
>    §12b, no como excepción silenciosa.
>
> El spec queda `APPROVED` como contrato — el mecanismo (hitos verificables,
> período de revisión, estados de fallo explícitos, no-balanceo-ad-hoc) es
> correcto independientemente del país. Lo que **no** queda aprobado es
> activar dinero real en ningún país sin su propia revisión legal, EE.UU.
> incluido (ver Fase 3 del plan).
>
> Contrato ejecutable SDD 2.0. Origen:
> `docs/vision/VISION_PROMETEO_OS_2026.md`. `risk: critical` porque toca
> pagos reales (Stripe/escrow) en múltiples jurisdicciones.

## 1. Problema y resultado

**Para quién:** una persona que ayuda a un tercero (que no tiene cuenta o
no sabe usar SEMSE) a definir y crear un proyecto en la plataforma, sin ser
ni el dueño del proyecto ni el profesional que lo ejecuta.

**Problema:** hoy no existe ningún mecanismo, rol ni incentivo para esta
participación. Grepeando `originador|facilitador|referral` en todo `docs/`
solo aparece "actor originador" en `SEMSE_AI_EXECUTION_BACKLOG.md`, que
significa "quien creó el job" — un concepto distinto y no relacionado con
una recompensa por facilitar la entrada de un tercero al ecosistema.

**Resultado esperado:** existe un mecanismo formal, auditable, para
registrar que un usuario ayudó a crear un proyecto de otro, y para pagarle
una recompensa **atada a hitos verificables del proyecto**, nunca al mero
hecho de publicarlo (para no incentivar publicaciones falsas o de baja
calidad — riesgo explícito que motiva el gate `critical`).

## 2. Alcance

### Incluido

- Registro de la relación "originador ↔ proyecto" en el momento de
  creación del proyecto.
- Catálogo de eventos verificables que disparan recompensa (ver sección 4)
  y los que explícitamente NO la disparan.
- Recompensa **monetaria real** (confirmado con el owner 2026-08-04), no
  créditos de plataforma ni solo puntos de reputación — gateada por
  recolección de un documento de identidad fiscal apropiado al país del
  originador (ver §7).
- Alcance geográfico **multi-país desde el inicio** (confirmado con el
  owner 2026-08-04) — con el gate nuevo de revisión legal por país descrito
  en §12b antes de activar dinero real en cualquiera.
- Reglas de quién puede ser originador (verificación mínima, para evitar
  auto-referidos fraudulentos).

### Fuera de alcance

- No se implementa en esta spec el mecanismo de pago en sí (Stripe
  Connect/payout) — se reutiliza el mecanismo existente de
  `escrow-release.service.ts` como fuente de fondos, con un nuevo tipo de
  beneficiario, no un sistema de pagos paralelo.
- No se cambia el modelo de identidad multi-capacidad (spec separada:
  `docs/specs/core/universal-identity-multi-role.spec.md`), aunque
  "originador" se define como una capacidad más bajo ese modelo.
- No se define aquí el porcentaje/monto exacto de la recompensa por país —
  decisión de producto pendiente, ver plan Fase 0 (T-001).
- No se hace investigación legal/fiscal país por país en esta spec (solo
  EE.UU. está investigado, §11) — cada país requiere su propio cierre de
  gate antes de activar Fase 3 ahí (§12b). Esta spec no sustituye asesoría
  legal profesional.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/resource | Puede | No puede |
|---|---|---|---|---|
| Originador | `project:originate` (nuevo) | proyectos donde quedó registrado como originador | ver el estado de recompensa de sus proyectos originados | aprobar su propia recompensa, editar el proyecto que originó sin ser su dueño |
| Dueño del proyecto | permisos existentes de owner | su propio proyecto | validar/rechazar que alguien lo originó | forzar una recompensa sin que el evento verificable ocurra |
| OPS_ADMIN | `internal:architecture:read` + permisos de pagos existentes | tenant/org según política vigente | auditar y, si aplica, revertir una recompensa mal calculada | pagar recompensas fuera del catálogo de eventos verificables |

- Tenant boundary: la relación originador↔proyecto vive dentro del mismo
  tenant que el proyecto.
- Ownership/resource policy: el originador nunca obtiene permisos de
  owner sobre el proyecto por el solo hecho de haberlo originado.
- Step-up o aprobación humana: el dueño del proyecto debe validar
  explícitamente que fue ayudado por ese originador antes de que cualquier
  evento cuente para recompensa (evita que alguien se auto-asigne como
  originador de un proyecto ajeno sin consentimiento).
- Datos `privacyCritical`: la relación originador↔proyecto es visible para
  ambas partes y para OPS_ADMIN, no pública.
- Requisitos de auditoría: cada evento que dispara o niega recompensa
  queda en audit log con el hito exacto que lo justificó.

## 4. Escenarios y criterios de aceptación

### P1 — Evento verificable dispara recompensa (con período de revisión)

```gherkin
DADO un proyecto con un originador validado por el dueño
CUANDO el proyecto alcanza "primer milestone financiado"
ENTONCES se registra un evento de recompensa en estado "pending_review" para el originador
Y el evento queda auditado con el hito exacto y el monto/tipo de recompensa
Y la recompensa se libera solo si, tras 14 días, ningún flag de fraude/disputa la bloqueó (hallazgo de investigación externa, §11)
```

### P2 — Publicar el proyecto NO dispara recompensa por sí solo

```gherkin
DADO un proyecto recién publicado con un originador asociado
CUANDO no ha ocurrido ningún otro evento del catálogo verificable
ENTONCES no se genera ninguna recompensa
Y el sistema no permite marcar "publicado" como hito recompensable
```

Catálogo de eventos verificables que SÍ disparan recompensa (a definir el
peso/orden exacto en la spec de `plan`):

- proyecto validado por el dueño real (no solo creado);
- primera propuesta recibida;
- profesional contratado;
- primer milestone financiado;
- proyecto completado.

Eventos que explícitamente NO disparan recompensa:

- publicar el proyecto sin más actividad;
- crear múltiples proyectos sin que ninguno avance (señal de abuso, debe
  alimentar risk scoring existente, no bloquear la función per se).

Casos borde:

- [ ] mismo originador en múltiples proyectos del mismo dueño (posible señal de abuso — no bloquear automáticamente, sí flaguear)
- [ ] dueño rechaza la validación del originador después de que ya hubo actividad (no se paga retroactivo)
- [ ] proyecto se cancela/disputa después de pagar una recompensa (definir si es reversible, coordinando con `escrow-release.service.ts` y `payment-governance.service.ts`)
- [ ] `payment-governance.service.ts` falla al liberar una recompensa ya aprobada — el evento queda en estado `release_failed` explícito, nunca en un estado ambiguo que un reporte pudiera contar como "pagado" (gate de pagos §12b)
- [ ] originador acumula US$600+ en recompensas en el año fiscal sin W-9 recolectado (caso EE.UU.) — el sistema debe bloquear la liberación de la siguiente recompensa hasta recolectarlo, no pagar y perseguir el W-9 después (§7, hallazgo 1099-NEC)
- [ ] originador de un país sin gate legal cerrado (§12b) intenta recibir recompensa monetaria — el sistema debe bloquear la liberación real y dejarla en `pending_review` indefinido con motivo "país sin revisión legal", nunca liberar "porque el mecanismo técnico ya funciona"

## 5. Contratos

### API — `POST /v1/projects/:projectId/originator`

```yaml
auth: required
permissions: ["project:originate"]
input_schema: "{ originatorUserId: string }"
output_schema: "{ status: 'pending_owner_validation' }"
errors:
  400: proyecto ya tiene originador registrado
  401: no autenticado
  403: usuario no elegible como originador (verificación mínima no cumplida)
  404: proyecto no existe
  409: originador ya validado, no se puede reasignar
effects:
  audit_log: sí, registra originatorUserId + projectId + timestamp
  domain_event: "project.originator_proposed.v1"
  sse: notificación al dueño del proyecto para validar
  payment_governance: ninguno en este endpoint (solo el pago posterior lo toca)
```

### UI

```yaml
surfaces:
  - flujo de creación de proyecto "en nombre de otro" para el originador
  - panel de validación para el dueño del proyecto
  - resumen de recompensas del originador en su dashboard
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
required_behavior:
  - el dueño del proyecto ve claramente quién lo originó antes de validar
  - el originador ve el catálogo de eventos pendientes, no solo el monto final
```

### Agente/Prometeo

```yaml
tools:
  - projects.propose_originator (write, requiere aprobación por policy existente de tools críticas)
input_schema: "{ projectId: string, originatorUserId: string }"
output_schema: "{ status: string }"
source_citations_required: true
approval_policy: write/critical — aprobación humana obligatoria, igual que cualquier mutación de pagos según `docs/specs/prometeo/tool-registry-governance.spec.md`
forbidden_behavior:
  - Prometeo no calcula ni libera montos de recompensa directamente; solo propone el registro de originador, la liberación pasa por el flujo de pagos existente con su propia auditoría
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: nuevo sub-estado de proyecto para
  `originatorStatus` (`none | pending_owner_validation | validated |
  rejected`).
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` (verificar que no
  contradiga invariantes de ownership de proyecto).
- Eventos declarados: nuevos en `docs/foundation/EVENT_CATALOG.md`:
  `project.originator_proposed.v1`, `project.originator_validated.v1`,
  `project.originator_reward_earned.v1`.
- Productor + outbox atómico: sí, mismo patrón que el resto de eventos de
  dominio (outbox transaccional).
- Consumidores + idempotencia: el consumidor que calcula recompensa debe
  ser idempotente por evento + originatorUserId + projectId.
- Replay/rebuild: recalculable desde el historial de eventos del proyecto.
- DLQ/compensación: si el cálculo de recompensa falla, debe ir a DLQ sin
  liberar fondos parcialmente.

## 7. Datos y migración

- Modelos Prisma: nuevo modelo `ProjectOriginator` (projectId,
  originatorUserId, status, validatedAt) y tabla de eventos de recompensa
  ligada a los mecanismos de pago existentes — diseño exacto en fase de
  `plan`, no en esta spec. El evento de recompensa declara como mínimo un
  estado `pending_review | released | release_failed | reversed` (nunca
  colapsar `release_failed` con `released`, hallazgo §11/§12b) y una fecha
  de fin del período de revisión de 14 días.
- Requisito de datos nuevo, generalizado a multi-país (decisión del owner
  2026-08-04): antes de que un originador sea elegible para recompensa
  monetaria, el sistema debe poder recolectar y almacenar un
  `TaxIdentityDocument` (país, tipo de documento, referencia) — para
  EE.UU. concretamente un W-9 con acumulado anual para disparar 1099-NEC
  al cruzar US$600 (§11, ya investigado); para cualquier otro país, el
  tipo de documento y umbral de reporte **no están investigados todavía**
  y no se implementan hasta cerrar el gate de §12b para ese país
  específicamente. El modelo no hardcodea "W-9" — declara un campo de
  país + tipo de documento desde el diseño inicial, aunque solo EE.UU.
  tenga lógica real detrás al lanzar.
- El diseño exacto de dónde vive el acumulado anual (nuevo modelo vs.
  extensión de uno existente de Finance) se decide en `plan`, coordinado
  con el owner de payments/finance.
- Migración: aditiva, sin tocar modelos de pago existentes directamente.
- Estrategia expand/contract: expand-only en esta primera fase.
- Backfill: no aplica (funcionalidad nueva, sin datos históricos que
  migrar).
- Compatibilidad hacia atrás: proyectos sin originador no cambian de
  comportamiento.
- Verificación de drift: confirmar que `ProjectOriginator` nunca gana
  permisos de owner por error de policy.
- Rollback de código: desactivar el endpoint y el consumidor de eventos;
  sin impacto en proyectos sin originador.
- Rollback/forward-fix de datos: nunca editar una migración aplicada — ver
  regla general de `docs/specs/templates/semse-spec-template.md` §7.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: proyectos con originador validado vs. total; recompensas
  pagadas vs. proyectos originados (para detectar abuso).
- Logs/traces/correlation: cada evento de recompensa correlacionado con el
  proyecto y el originador.
- Health/readiness: sin cambio.
- Feature flags/allowlists: lanzar detrás de flag por tenant, empezando
  con `tenant_default` en modo solo-registro (sin pago real) antes de
  activar el pago.
- Plan de canary: fase 1 solo registro/validación (sin dinero); fase 2
  recompensa real, con aprobación explícita separada.
- Evidencia de producción requerida: al menos un ciclo completo
  originador→hito verificado→recompensa pagada, auditado end-to-end.
- Señal de rollback: cualquier recompensa pagada sin hito verificable
  real, o abuso detectado por risk scoring.
- Owner operativo: semse-core + owner de payments (a confirmar).

## 9. Tests requeridos

- [ ] Unitarios del dominio/proyección
- [ ] Contrato API/BFF
- [ ] Permiso denegado y aislamiento tenant/org
- [ ] Validación y conflicto de estado
- [ ] Idempotencia/reintento/concurrencia
- [ ] Migración y compatibilidad
- [ ] UI loading/empty/forbidden/degraded/error
- [ ] Canary o smoke autenticado en producción
- [ ] Test explícito: publicar sin actividad NO genera recompensa
- [ ] Test explícito: rechazo del dueño bloquea toda recompensa futura

## 10. Mapa de implementación

### API

- `apps/api/src/modules/jobs/` (o módulo nuevo `originator/`, a decidir en `plan`)
- `apps/api/src/modules/payments/payment-governance.service.ts` (integración de liberación de recompensa)

### Web

- Flujo de creación de proyecto "en nombre de otro"
- Panel de validación del dueño
- Dashboard de recompensas del originador

### Worker/Packages/DB

- Consumidor de eventos de recompensa en `apps/worker/src/`
- `packages/db/prisma/schema.prisma` (modelo `ProjectOriginator`)

### Tests

- `apps/api/test/` (contrato + catálogo de eventos)

## 11. Investigación externa

1. "referral fee regulation real estate RESPA anti-kickback marketplace
   referral commission legal risk" —
   [CFPB — § 1024.14 Prohibition against kickbacks and unearned
   fees](https://www.consumerfinance.gov/rules-policy/regulations/1024/14/)
2. "referral program fraud prevention milestone based payout not signup
   marketplace best practices" —
   [impact.com — Design a Fraud-Proof Referral
   Program](https://help.impact.com/brand/what-would-you-like-to-learn-about/advocate-program/protect-your-advocate-program/design-a-fraud-proof-referral-program)
3. "1099 tax reporting requirement referral commission paid to individual
   US gig marketplace IRS" —
   [IRS — Instructions for Forms 1099-MISC and
   1099-NEC](https://www.irs.gov/instructions/i1099mec)

**Hallazgos aplicables:**

- **RESPA/CFPB (referencia regulatoria, no aplicación directa):** RESPA
  regula específicamente kickbacks en transacciones de bienes raíces con
  hipotecas federales — no aplica literalmente a un marketplace de
  construcción/servicios. Pero el patrón que ilustra es real y
  transferible: **pagar a alguien por referir un cliente hacia una
  transacción de servicios es una categoría de riesgo regulatorio
  conocida**, con precedente de escrutinio activo (la fuente cita una
  petición de reglamentación de 2026 del CFPB sobre redes de referral fees
  en bienes raíces). Esto no bloquea el programa, pero sí exige no asumir
  que "es solo un referral fee" es automáticamente seguro en toda
  jurisdicción o vertical — particularmente si SEMSE algún día cubre
  verticales regulados (seguros, financiero, legal). Se documenta como
  riesgo permanente a revisar por vertical, no como bloqueo del MVP
  (construcción/servicios generales).
- **Fraude (impact.com):** confirma el diseño ya propuesto en el spec
  (pagar por hito verificable, no por publicar) y agrega un patrón que el
  spec original no tenía: **período de revisión** (14-60 días) entre que
  el hito ocurre y el pago se libera, para poder detectar/revertir fraude
  antes de mover dinero. Se incorpora como requisito nuevo (ver §4 y §7
  actualizados abajo).
- **1099-NEC (IRS):** cualquier originador que reciba US$600 o más en un
  año fiscal requiere reporte 1099-NEC y, antes de eso, recolectar un W-9.
  Esto es un requisito de datos nuevo que el spec original no tenía. Se
  incorpora como requisito de datos (ver §7 actualizada).

**Aplicado ahora:**

- Se agrega un período de revisión de 14 días entre "hito verificado" y
  "recompensa liberada" (ver P1 actualizado en §4 y Fase 3 del plan).
- Se agrega recolección de W-9 como prerrequisito para que un usuario sea
  elegible como originador con recompensa monetaria, y tracking de
  acumulado anual para disparar 1099-NEC sobre US$600 (ver §7).

**Backlog:** definir el proceso operativo de emisión de 1099-NEC (a quién
le corresponde: Finance/payments, no Core) — no se diseña en detalle en
esta spec, solo se deja el requisito de datos que lo hace posible.
**Además (decisión del owner 2026-08-04):** investigación legal/fiscal
país por país para cada jurisdicción fuera de EE.UU. donde se quiera
activar recompensa monetaria real — no hecha en esta sesión, es
prerrequisito de Fase 3 en cada país (§12b).

**Descartado:** ninguno — la pregunta "¿acotar a EE.UU. o ir multi-país?"
ya no está abierta: el owner decidió multi-país desde el inicio
(2026-08-04). Lo que queda explícitamente sin resolver por esta
investigación es el contenido legal de esa decisión para cualquier país
que no sea EE.UU.

## 12b. Revisión del gate de riesgo `critical` de pagos (SDD_GOVERNANCE §7 — Economía)

Revisión explícita, punto por punto, contra `docs/SDD_GOVERNANCE.md` §7:

| Regla del gate | Cómo la cumple esta spec |
|---|---|
| Payment provider y ledger son responsabilidades separadas | La spec no reimplementa liberación de fondos: reutiliza `payment-governance.service.ts`/`escrow-release.service.ts` como único mecanismo (§5, §7 del spec). No se introduce un provider ni un ledger paralelo. |
| Fallos/reversals no cuentan como dinero liberado o gastado | Nuevo requisito explícito (added below, §7): si `payment-governance.service.ts` falla al liberar la recompensa, `ProjectOriginator`/el evento de recompensa queda en estado explícito de fallo, nunca en un estado que un reporte pudiera confundir con "pagado". |
| Reversals inmutables y moneda explícita | La recompensa se liga a la moneda del proyecto (no se introduce una moneda o unidad de valor nueva); cualquier reversal de una recompensa ya pagada se registra como un movimiento nuevo, nunca editando el registro original (mismo principio que migraciones, `SDD_GOVERNANCE.md` §8). |
| Débitos y créditos balanceados cuando aplique ledger | SEMSE no tiene todavía un ledger double-entry general (`Shared Economic Ledger` es F5, `PENDIENTE` — ver `IMPLEMENTATION_STATUS_MATRIX.md`). Esta spec **no puede** cumplir balanceo double-entry porque esa capacidad no existe aún en el sistema. Se declara dependencia explícita: la Fase 3 (recompensa real) de esta spec no se activa en producción hasta que exista al menos un mecanismo de registro contable consistente con el resto de Payments (a definir en plan, coordinado con el owner de payments) — no se inventa un balanceo ad-hoc solo para este programa. |
| Gate adicional — jurisdicción (decisión del owner 2026-08-04, multi-país) | Este gate no estaba en la versión original de `SDD_GOVERNANCE.md` §7, pero se declara aquí por la misma lógica de riesgo `critical`: **ningún país activa recompensa monetaria real sin su propia revisión legal/fiscal previa.** EE.UU. es el único país con esa revisión hecha en esta sesión (§11: RESPA como referencia de riesgo, 1099-NEC/W-9 como requisito concreto). Activar en cualquier otro país sin repetir esa investigación ahí sería exactamente el tipo de "excepción silenciosa" que este spec existe para evitar — no se hace. |

Con esto, el gate de riesgo `critical` queda revisado explícitamente
punto por punto — incluyendo la dimensión de jurisdicción que introdujo la
decisión de multi-país — no de forma genérica, cumpliendo lo que pedía el
spec original antes de `APPROVED`.

## 12. Gates de cierre

- [x] Aprobación explícita recibida — `status: DRAFT -> APPROVED` 2026-08-04.
- [x] Investigación externa (§11) completada antes de `APPROVED`.
- [x] Revisión del gate de riesgo `critical` de pagos completada punto por
      punto (§12b), no de forma genérica.
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
