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
  - apps/api/src/modules/payments/stripe-connect.service.ts
  - packages/db/prisma/schema.prisma
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
> **Actualización — Fase 0 completamente resuelta (2026-08-04):**
>
> 1. **Modelo de monto:** híbrido — bono fijo en el hito "primer milestone
>    financiado" + un porcentaje pequeño sobre `platformFeeCents` (la
>    comisión que SEMSE ya cobra, no el valor bruto del proyecto) al llegar
>    a "proyecto completado". Esto garantiza que SEMSE nunca paga más de lo
>    que gana en ese proyecto — el propio razonamiento del owner. Ambos
>    montos arrancan como piloto pequeño, ajustable con datos reales, no
>    fijos de entrada (ver §2, §4).
> 2. **Documento de identidad fiscal → se delega a Stripe Connect**, no se
>    construye recolección propia. `packages/db/prisma/schema.prisma` ya
>    tiene `StripeConnectAccount` (usado hoy para pagos a `PRO`); el
>    originador simplemente necesita su propia cuenta Connect igual que un
>    profesional. El onboarding de Stripe ya recolecta y valida los datos
>    fiscales (equivalente a W-9/W-8) y genera 1099 automáticamente para
>    cuentas de EE.UU. — se reemplaza el modelo `TaxIdentityDocument`
>    propuesto antes por reutilizar `StripeConnectAccount` (§7).
> 3. **Países siguientes tras EE.UU.: Latinoamérica primero** (México,
>    Colombia y similares) — no se investiga "todos los países" a la vez.
> 4. **Elegibilidad — híbrido de las dos opciones planteadas:** registrarse
>    como originador de un proyecto solo requiere una cuenta SEMSE
>    verificada (fricción baja, como ya funciona hoy). Pero **ningún hito
>    del catálogo empieza a contar para recompensa** hasta que el
>    originador complete el onboarding de `StripeConnectAccount`
>    (`payoutsEnabled: true`) — más temprano que "recién antes de pagar",
>    para que no se puedan acumular hitos fantasma bajo una identidad no
>    verificada (§3, §4).
>
> **Corrección sobre el gate de pagos original (§12b):** al confirmar que
> Fase 3 reutiliza el mismo `StripeConnectAccount`/transfer que ya mueve
> dinero real a profesionales hoy (no un riel de pagos nuevo), el bloqueo
> original hacia el Shared Economic Ledger (F5) estaba sobre-cautelado —
> SEMSE ya paga dinero real sin F5 para `PRO`. Se corrige en §12b en vez de
> dejarlo inconsistente.
>
> Contrato ejecutable SDD 2.0. Origen:
> `docs/vision/VISION_PROMETEO_OS_2026.md`. `risk: critical` porque toca
> pagos reales (Stripe Connect) en múltiples jurisdicciones.

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
- Recompensa **monetaria real, modelo híbrido** (confirmado con el owner
  2026-08-04): bono fijo en "primer milestone financiado" + porcentaje
  pequeño sobre `platformFeeCents` en "proyecto completado" — nunca sobre
  el valor bruto del proyecto, para que SEMSE siempre mantenga margen
  positivo en cada proyecto originado. Lanza como piloto con montos
  ajustables (ver §4, §8).
- Elegibilidad para recompensa gateada por `StripeConnectAccount`
  (`payoutsEnabled: true`) — se reutiliza el mecanismo que ya usan los
  profesionales, sin construir recolección de documentos fiscales propia
  (ver §7).
- Alcance geográfico **multi-país desde el inicio** (confirmado con el
  owner 2026-08-04) — con el gate nuevo de revisión legal por país descrito
  en §12b antes de activar dinero real en cualquiera. Latinoamérica es la
  prioridad después de EE.UU.
- Reglas de quién puede ser originador: cuenta SEMSE verificada para
  registrarse (fricción baja), `StripeConnectAccount` completo antes de
  que cualquier hito empiece a contar para recompensa (fricción alta,
  antes de que haya dinero en juego) — híbrido confirmado por el owner.

### Fuera de alcance

- No se implementa el mecanismo de pago en sí (Stripe Connect/payout) —
  se reutiliza `StripeConnectAccount`/`stripe-connect.service.ts` y
  `escrow-release.service.ts` como mecanismo único, con el originador como
  un nuevo tipo de beneficiario, no un sistema de pagos paralelo.
- No se construye recolección de documentos fiscales propia — se delega
  por completo al onboarding de Stripe Connect (§7).
- No se cambia el modelo de identidad multi-capacidad (spec separada:
  `docs/specs/core/universal-identity-multi-role.spec.md`), aunque
  "originador" se define como una capacidad más bajo ese modelo.
- No se define aquí el monto exacto del bono fijo ni el % sobre
  `platformFeeCents` — decisión de producto pendiente para el piloto, ver
  plan Fase 0 (T-001).
- No se hace investigación legal/fiscal país por país en esta spec (solo
  EE.UU. está investigado, §11) — cada país requiere su propio cierre de
  gate antes de activar Fase 3 ahí (§12b), empezando por la lista de
  Latinoamérica a priorizar en Fase 0 (T-004). Esta spec no sustituye
  asesoría legal profesional.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/resource | Puede | No puede |
|---|---|---|---|---|
| Originador | `project:originate` (nuevo) | proyectos donde quedó registrado como originador | registrarse con solo cuenta verificada; ver el estado de recompensa de sus proyectos originados | acumular hitos recompensables sin `StripeConnectAccount.payoutsEnabled`; aprobar su propia recompensa; editar el proyecto que originó sin ser su dueño |
| Dueño del proyecto | permisos existentes de owner | su propio proyecto | validar/rechazar que alguien lo originó | forzar una recompensa sin que el evento verificable ocurra |
| OPS_ADMIN | `internal:architecture:read` + permisos de pagos existentes | tenant/org según política vigente | auditar y, si aplica, revertir una recompensa mal calculada | pagar recompensas fuera del catálogo de eventos verificables |

- Tenant boundary: la relación originador↔proyecto vive dentro del mismo
  tenant que el proyecto.
- Ownership/resource policy: el originador nunca obtiene permisos de
  owner sobre el proyecto por el solo hecho de haberlo originado.
- Step-up o aprobación humana: el dueño del proyecto debe validar
  explícitamente que fue ayudado por ese originador antes de que cualquier
  evento cuente para recompensa (evita que alguien se auto-asigne como
  originador de un proyecto ajeno sin consentimiento). Además, ningún
  evento cuenta para recompensa hasta que `StripeConnectAccount.
  payoutsEnabled === true` para ese originador (decisión de elegibilidad
  híbrida del owner, 2026-08-04) — dos gates independientes, ambos
  necesarios.
- Datos `privacyCritical`: la relación originador↔proyecto es visible para
  ambas partes y para OPS_ADMIN, no pública.
- Requisitos de auditoría: cada evento que dispara o niega recompensa
  queda en audit log con el hito exacto que lo justificó.

## 4. Escenarios y criterios de aceptación

### P1a — Bono fijo en el primer milestone financiado (con período de revisión)

```gherkin
DADO un proyecto con un originador validado por el dueño y StripeConnectAccount.payoutsEnabled=true
CUANDO el proyecto alcanza "primer milestone financiado"
ENTONCES se registra un evento de recompensa de tipo "bono fijo" en estado "pending_review"
Y el evento queda auditado con el hito exacto y el monto (piloto, ajustable — spec §2)
Y la recompensa se libera solo si, tras 14 días, ningún flag de fraude/disputa la bloqueó (hallazgo de investigación externa, §11)
```

### P1b — Porcentaje de platformFeeCents al completar el proyecto

```gherkin
DADO el mismo proyecto, ya con el bono fijo de P1a liberado
CUANDO el proyecto alcanza "proyecto completado"
ENTONCES se registra un segundo evento de recompensa de tipo "porcentaje", calculado como (% piloto) × platformFeeCents del proyecto — nunca sobre el valor bruto
Y sigue el mismo período de revisión de 14 días antes de liberarse
Y si platformFeeCents es 0 o negativo (ej. proyecto con margen reducido), el monto de este evento es 0, nunca negativo
```

### P2 — Publicar el proyecto NO dispara recompensa por sí solo

```gherkin
DADO un proyecto recién publicado con un originador asociado
CUANDO no ha ocurrido ningún otro evento del catálogo verificable
ENTONCES no se genera ninguna recompensa
Y el sistema no permite marcar "publicado" como hito recompensable
```

Catálogo de eventos verificables. Con el modelo híbrido confirmado
(2026-08-04), solo dos de estos eventos disparan pago directamente — los
demás son señal de progreso/anti-abuso, no gatillos de dinero:

- proyecto validado por el dueño real (no solo creado) — **no paga**, es
  prerrequisito para que cualquier otro evento cuente (§3);
- primera propuesta recibida — **no paga**, señal de progreso real;
- profesional contratado — **no paga**, señal de progreso real;
- **primer milestone financiado — paga el bono fijo (P1a)**;
- **proyecto completado — paga el % de `platformFeeCents` (P1b)**.

Un originador solo cobra si el proyecto llega hasta financiar un
milestone y, más adelante, completarse — los eventos intermedios existen
para auditoría y detección de abuso, no generan pago por sí mismos.

Eventos que explícitamente NO disparan recompensa:

- publicar el proyecto sin más actividad;
- crear múltiples proyectos sin que ninguno avance (señal de abuso, debe
  alimentar risk scoring existente, no bloquear la función per se).

Casos borde:

- [ ] mismo originador en múltiples proyectos del mismo dueño (posible señal de abuso — no bloquear automáticamente, sí flaguear)
- [ ] dueño rechaza la validación del originador después de que ya hubo actividad (no se paga retroactivo)
- [ ] proyecto se cancela/disputa después de pagar una recompensa (definir si es reversible, coordinando con `escrow-release.service.ts` y `payment-governance.service.ts`)
- [ ] `payment-governance.service.ts` falla al liberar una recompensa ya aprobada — el evento queda en estado `release_failed` explícito, nunca en un estado ambiguo que un reporte pudiera contar como "pagado" (gate de pagos §12b)
- [ ] originador sin `StripeConnectAccount.payoutsEnabled` llega a "primer milestone financiado" — el evento de bono fijo se registra pero queda bloqueado (no `pending_review`, un estado distinto: `blocked_no_payout_account`) hasta que complete el onboarding; no se pierde el hito, pero tampoco arranca el período de revisión hasta que el gate de elegibilidad esté cerrado
- [ ] `platformFeeCents` del proyecto es 0 o no calculable al momento de "proyecto completado" — el evento P1b se registra en monto 0, nunca se bloquea el evento de auditoría en sí, solo el monto es 0
- [ ] originador de un país sin gate legal cerrado (§12b) intenta recibir recompensa monetaria — el sistema debe bloquear la liberación real y dejarla en `pending_review` indefinido con motivo "país sin revisión legal", nunca liberar "porque el mecanismo técnico ya funciona" (el `country` viene de `StripeConnectAccount.country`, ya limitado a los países que Stripe Connect soporta)

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
  estado `pending_review | blocked_no_payout_account | released |
  release_failed | reversed` (nunca colapsar `release_failed` con
  `released`, hallazgo §11/§12b) y una fecha de fin del período de
  revisión de 14 días, más un `type: "fixed_bonus" | "platform_fee_share"`
  (modelo híbrido, §4) y el `platformFeeCents` de origen para el evento
  tipo `platform_fee_share`.
- **Identidad fiscal delegada a Stripe Connect (decisión del owner
  2026-08-04):** no se crea un modelo nuevo de documento fiscal. Se
  reutiliza `StripeConnectAccount` (`packages/db/prisma/schema.prisma`,
  ya usado hoy para pagos a `PRO`) — el originador necesita su propia fila
  con `payoutsEnabled: true` antes de que cualquier evento de recompensa
  salga de `blocked_no_payout_account`. `StripeConnectAccount.country` es
  la fuente de verdad para el gate legal por país de §12b; como Stripe
  Connect no está disponible en todos los países, esto además acota de
  entrada el conjunto de países donde esta feature es técnicamente
  posible, antes incluso de considerar el gate legal.
- El acumulado anual y el reporte 1099-NEC para EE.UU. los genera Stripe
  Connect automáticamente sobre la cuenta conectada — no se construye un
  acumulado propio en SEMSE para esto.
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
  recompensa real en EE.UU. con montos piloto (bono fijo + % de
  `platformFeeCents`), aprobación explícita separada; fase 3+ un país
  nuevo a la vez, empezando por Latinoamérica, cada uno con su propio
  gate legal cerrado (§12b) antes de habilitarse.
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
- `apps/api/src/modules/payments/stripe-connect.service.ts` (reutilizado para el `StripeConnectAccount` del originador, mismo patrón que `PRO`)

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
| Débitos y créditos balanceados cuando aplique ledger | **Corregido 2026-08-04** (ver blockquote de apertura). Versión original de esta fila asumía que Fase 3 necesitaba F5 (Shared Economic Ledger, `PENDIENTE`) antes de mover dinero real. Al confirmarse que Fase 3 reutiliza `StripeConnectAccount`/transfer — el mismo mecanismo con el que SEMSE **ya paga dinero real a `PRO` hoy, sin F5** — ese razonamiento estaba sobre-cautelado: si F5 no bloquea los pagos a `PRO` que ya corren en producción, tampoco es coherente bloquear con F5 específicamente esta feature. **Ya no es gate duro de Fase 3.** Riesgo real que sí queda, más chico: el componente `platform_fee_share` reparte por primera vez una porción del ingreso propio de SEMSE (`platformFeeCents`) hacia un tercero — se registra explícitamente como tal en el evento de recompensa (§7) para que, cuando F5 exista, sea fácil de reconciliar; no se bloquea esperándolo. |
| Gate adicional — jurisdicción (decisión del owner 2026-08-04, multi-país) | Este gate no estaba en la versión original de `SDD_GOVERNANCE.md` §7, pero se declara aquí por la misma lógica de riesgo `critical`: **ningún país activa recompensa monetaria real sin su propia revisión legal/fiscal previa Y sin que Stripe Connect esté disponible en ese país** (§7). EE.UU. es el único país con esa revisión hecha en esta sesión (§11: RESPA como referencia de riesgo, 1099-NEC/W-9 como requisito concreto, ambos cubiertos automáticamente por Stripe Connect). Activar en cualquier otro país sin repetir esa investigación ahí sería exactamente el tipo de "excepción silenciosa" que este spec existe para evitar — no se hace. |

Con esto, el gate de riesgo `critical` queda revisado explícitamente
punto por punto — incluyendo la corrección del ítem de ledger y la
dimensión de jurisdicción que introdujo la decisión de multi-país — no de
forma genérica, cumpliendo lo que pedía el spec original antes de
`APPROVED`.

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
