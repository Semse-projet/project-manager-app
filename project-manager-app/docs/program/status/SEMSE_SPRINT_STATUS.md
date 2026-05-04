# SEMSE Sprint Status

## Fecha de corte
2026-03-15

## Contexto

Este documento resume el estado real del trabajo ejecutado sobre el core canonico:
- `/home/yoni/labsemse/project-manager-app`

No describe toda la historia del repo.
Describe el estado consolidado del trabajo reciente orientado a cerrar el happy path visible y canónico de SEMSE.

---

## 1. Veredicto ejecutivo

SEMSE ya no esta solo en fase de vision + arquitectura + prototipos dispersos.

Con el trabajo reciente, el proyecto ya tiene:
- una direccion canonica mas clara (`Job-first`);
- un backend mas disciplinado en reservations, contracts, escrow, evidence y disputes;
- una primera capa visible de producto dentro de `apps/web`.

Todavia no es un MVP cerrado.
Pero ya es un sistema con una columna vertebral visible y navegable.

---

## 2. Base canonica confirmada

### Vision oficial
- `~/labsemse/vision`

### Programa oficial
- `~/labsemse/program`

### Core tecnico canonico
- `~/labsemse/project-manager-app`

### Repos/prototipos satelite
- `~/Descargas/semseproject/app`
- `~/Descargas/semse-control-mvp`

### Hallazgo adicional
El release publico `v1.2.0` del repo GitHub ya fue superado por la rama local actual.
No es target de trabajo; es referencia historica.

---

## 3. Lo implementado recientemente

## 3.1 Dominio y lenguaje

### Avances
- se reforzo el lenguaje visible canonico del MVP;
- `POSTED` se consolida como lenguaje visible por encima de `PUBLISHED`;
- `FUND` se consolida como lenguaje visible por encima de `DEPOSIT`;
- `AWARDED` queda marcado como legado transicional y no como estado nuevo a promover.

### Archivos tocados
- `packages/schemas/src/marketplace.schema.ts`
- `docs/foundation/DOMAIN_INVARIANTS.md`
- `docs/foundation/JOB_VS_PROJECT_BOUNDARY.md`
- `docs/foundation/API_MODULE_MAP.md`
- `docs/foundation/IMPLEMENTATION_GAPS_VS_VISION.md`

### Estado
- **bien encaminado**

---

## 3.2 Reservations

### Avances
- create ya trata mejor reservas activas vencidas;
- accept limpia expiraciones reales antes de seguir;
- release es mas idempotente;
- expire es mas idempotente;
- se reduce ambiguedad del lifecycle.

### Archivo principal
- `apps/api/src/modules/reservations/reservations.repository.ts`

### Estado
- **avanzado**, aunque aun mejorable con mas tests y endurecimiento adicional.

---

## 3.3 Contracts

### Avances
- create persiste `clientOrgId`;
- create persiste `professionalOrgId`;
- se fortalece el ownership organizacional del contrato.

### Archivo principal
- `apps/api/src/modules/contracts/contracts.repository.ts`

### Estado
- **bastante bien encaminado**

---

## 3.4 Escrow / Payments

### Avances
- audit de funding ya habla en lenguaje de `escrow.fund`;
- se documenta con claridad que `DEPOSIT` es semantica legacy de persistencia;
- release se bloquea si existe disputa abierta.

### Archivos principales
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `docs/foundation/ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md`

### Estado
- **avanzado**, con deuda aun en la separacion mas profunda entre persistencia heredada y modelo final.

---

## 3.5 Evidence

### Avances
- evidence nueva empuja `jobId` o `milestoneId` como scope canonico;
- `projectId` sin contexto adicional queda explicitamente marcado como legacy/transicional;
- audit agrega `canonicalScope`.

### Archivos principales
- `packages/schemas/src/evidence.schema.ts`
- `apps/api/src/modules/evidence/evidence.service.ts`
- `docs/foundation/ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md`

### Estado
- **bien encaminado**

---

## 3.6 Milestones / review loop

### Avances
- existe surface de `request-changes`;
- milestones ya pueden moverse visualmente desde el frontend nuevo;
- se abre el camino hacia review loop visible.

### Archivos principales
- `apps/api/src/modules/milestones/milestones.controller.ts`
- `apps/web/app/jobs/[jobId]/page.tsx`

### Estado
- **parcial**

### Gap principal
Internamente `request_changes` aun no es una decision de dominio completamente separada de `reject`.

---

## 3.7 Disputes

### Avances
- disputes ya admite entrada canonica por `jobId`;
- internamente resuelve `projectId` como puente tecnico;
- mejora la alineacion del camino de excepcion con el flujo canónico.

### Archivos principales
- `packages/schemas/src/dispute.schema.ts`
- `apps/api/src/modules/disputes/disputes.controller.ts`
- `apps/api/src/modules/disputes/disputes.repository.ts`
- `apps/api/src/modules/disputes/disputes.service.ts`

### Estado
- **avanzado en baseline**, pero aun sin una resolucion operativa rica.

---

## 4. Frente visible del producto (`apps/web`)

## 4.1 Superficies ya implementadas

### Dashboard shell minima
- archivo: `apps/web/app/sprint-1-dashboard.tsx`
- integrada en: `apps/web/app/page.tsx`

### Create Job UI minima
- ruta: `/jobs/new`
- archivo: `apps/web/app/jobs/new/page.tsx`

### Job detail + milestones shell
- ruta: `/jobs/[jobId]`
- archivo: `apps/web/app/jobs/[jobId]/page.tsx`

### Escrow UI minima por job
- ruta: `/jobs/[jobId]/escrow`
- archivo: `apps/web/app/jobs/[jobId]/escrow/page.tsx`

### Evidence UI minima por job
- ruta: `/jobs/[jobId]/evidence`
- archivo: `apps/web/app/jobs/[jobId]/evidence/page.tsx`

---

## 4.2 Proxies web creados

### Jobs
- `apps/web/app/api/semse/jobs/route.ts`
- `apps/web/app/api/semse/jobs/[jobId]/route.ts`

### Escrow
- `apps/web/app/api/semse/jobs/[jobId]/escrow/route.ts`

### Evidence
- `apps/web/app/api/semse/jobs/[jobId]/evidence/route.ts`
- `apps/web/app/api/semse/evidence/presign/route.ts`

### Milestones
- `apps/web/app/api/semse/jobs/[jobId]/milestones/route.ts`
- `apps/web/app/api/semse/milestones/[milestoneId]/[action]/route.ts`

---

## 4.3 Lectura del estado web

La capa web ya no es solo control surface + cortex.
Ahora existe un primer circuito comercial visible:

1. dashboard
2. create job
3. job detail
4. milestones
5. escrow
6. evidence

### Estado
- **funcional como shell inicial**
- **no final en UX**
- **valioso como base canonica navegable**

---

## 5. Tickets del Sprint 1: estado resumido

## Muy avanzados
- S1-T001 naming visible del MVP
- S1-T002 regla Job-first
- S1-T003 reservation create/list
- S1-T004 reservation lifecycle
- S1-T005 contracts ownership alignment
- S1-T006 funding por job
- S1-T007 fronteras escrow/payments
- S1-T009 evidence job-first
- S1-T011 dispute baseline
- S1-T013 create job UI minima
- S1-T014 escrow UI minima
- S1-T015 evidence UI minima
- S1-T016 dashboard shell minima

## Parciales
- S1-T008 release por milestone aprobado
- S1-T010 milestone review loop
- S1-T012 resolucion minima de dispute
- S1-T017 audit trail parcial
- S1-T018 audit trail end-to-end

---

## 6. Gaps reales abiertos

### Gap A — request_changes aun no es dominio puro
La surface existe, pero el runtime aun recicla parte de `reject`.

### Gap B — release UX aun no esta visible en producto
Existe logica backend, pero no una experiencia clara y cerrada en la UI.

### Gap C — create job UI sigue minimalista
Todavia no absorbe completamente:
- categoria;
- subcategoria;
- location;
- urgency;
- attachments;
- wizard multistep.

### Gap D — falta una vista mas rica de milestones y progresion
Hoy existe shell funcional, pero no timeline ni vista de progreso cuidada.

### Gap E — Project sigue vivo como puente fuerte
Se redujo el problema, pero la transicion a `Job-first` no esta cerrada estructuralmente.

---

## 7. Recomendacion de siguiente ola

## Opcion recomendada: Sprint 1.5

### Bloque 1 — cerrar review/runtime fino
- separar mejor `request_changes` de `reject`;
- revisar mejor release ligado a milestone approved;
- fortalecer dispute resolve baseline.

### Bloque 2 — refinar shell comercial
- mejorar job detail;
- hacer milestones mas expresivos;
- conectar mejor evidence y review;
- mejorar estados vacios y mensajes.

### Bloque 3 — calidad y pruebas
- smoke test del circuito visible;
- revisar audit trail end-to-end;
- pulir naming visible en todas las surfaces nuevas.

### Bloque 4 — decidir expansion de create job
Elegir entre:
- ampliar backend para soportar mas campos del satelite UI;
- o seguir fortaleciendo ejecucion/review antes de enriquecer intake.

### Preferencia recomendada
Primero fortalecer:
- job detail;
- milestones;
- review;
- release visible.

Despues ampliar create job.

---

## 8. Conclusión final

SEMSE ya tiene una base mejor que la que parecia al inicio de la auditoria.

Hoy existe:
- una direccion conceptual clara;
- una consolidacion mas fuerte del dominio;
- un backend bastante mas cercano al happy path canónico;
- y una primera capa de producto navegable en `apps/web`.

Lo siguiente ya no es descubrir que es SEMSE.
Lo siguiente es cerrar las deudas del review loop, endurecer la ultima parte del flujo y pasar de shell funcional a MVP realmente demostrable.
