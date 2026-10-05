---
id: "platform.finance-resource-scope"
title: "C51 — aislamiento de facturas y gastos"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/finance/finance.service.ts
  - apps/api/src/modules/finance/finance.repository.ts
  - apps/api/src/modules/finance/finance.controller.ts
  - apps/api/src/common/resource-scope.resolver.ts
  - apps/api/src/modules/finance/finance-access.policy.ts
  - apps/api/src/infrastructure/sse/finance-event-access.ts
related_tests:
  - apps/api/test/finance-resource-scope.test.ts
  - apps/api/test/operational-context-participation.test.ts
related_endpoints:
  - GET /v1/finance/invoices
  - POST /v1/finance/invoices
  - GET /v1/finance/invoices/:id
  - PATCH /v1/finance/invoices/:id
  - POST /v1/finance/invoices/:id/pay
  - GET /v1/finance/expenses
  - POST /v1/finance/expenses
  - GET /v1/finance/expenses/:id
  - GET /v1/finance/projects/:projectId/summary
  - GET /v1/sse/finance
related_events: []
related_agents: []
last_verified: "2026-10-05"
---

# C51 — aislamiento de facturas y gastos

Autorizado por el dueño el 2026-10-05: implementar toda la etapa financiera
auditada, desplegarla y dejar un camino mantenible de escalamiento. Reutiliza
`platform.resource-scope`; C51 transversal permanece PARTIAL.

## 1. Problema y resultado

Facturas/gastos por ID solo comprueban tenant; marcar pagada ignora incluso
ese filtro en la escritura. Listados usan org emisora en vez del proyecto.
Las asociaciones y el PATCH permiten introducir ownership arbitrario.
Resultado: todas las entradas al servicio requieren actor y aplican una misma
política; ninguna denegación escribe ni entrega PDF/contexto financiero.

## 2. Alcance

Incluye invoices, expenses, PDF, send/pay/viewed, approve/reject, resumen y
contexto financiero, SSE autorizado por factura, consumidores internos, duplicados y paginación.
No rediseña escrow, mueve dinero real, cambia roles ni cierra otros pendientes
de C51. Templates/OCR conservan sus contratos existentes. Sin cambios Prisma.

## 3. Actores, permisos y límites

- API conserva `finance:read`/`finance:write` además de policy.
- Tenant del actor obligatorio; otro tenant/inexistente ⇒ 404, incluso OPS_ADMIN.
- Proyecto/job asociado manda: `client` (cliente dueño u OPS_ADMIN), conforme a
  DOMAIN_INVARIANTS y ScopeAccess. Profesional asignado no obtiene financials
  por defecto. Una futura excepción debe aprobarse como política explícita.
- Sin proyecto/job: org propietaria no vacía u OPS_ADMIN del mismo tenant.
- Crear requiere org propietaria no vacía; tenant/org/user vienen del actor.
- Proyecto/job declarado inexistente, eliminado o de otro tenant ⇒ 404;
  mismo tenant sin autorización ⇒ 403; pares incompatibles ⇒ 400.
- Filas históricas con asociación inexistente: no-OPS denegado (403); OPS del
  tenant puede inspeccionarlas para reconciliación. Ownership no recupera acceso.
- La coherencia proyecto/job se garantiza en creación, no se afirma que los
  datos históricos ya se hayan reconciliado.
- `clientOrgId` asociado se deriva del scope; un valor contrario ⇒ 400. Sin
  asociación, un destinatario explícito debe ser org real del tenant y no es ACL.
- Un hito deriva el proyecto; la factura enlazada se autoriza y deriva sus
  asociaciones si faltan. Toda combinación declarada se comprueba antes de crear.
- PATCH solo acepta contenido editable; no ownership, asociaciones, actor,
  totales calculados ni estado. Los endpoints de estado conservan su autoridad.
- Datos privacyCritical: no introducir nuevo envío a modelos cloud.

## 4. Escenarios y criterios de aceptación

1. Cliente dueño lee/muta/PDF con permiso; org ajena ⇒ 403 sin escritura.
2. Otro tenant ⇒ 404 para leer y cada mutación, incluso OPS_ADMIN.
3. Listado = propias sin asociación + recursos de proyectos/jobs autorizados;
   creador de otra org no oculta una factura al cliente del proyecto.
4. `?projectId` se autoriza antes de consultar finanzas (404/403).
5. Creación rechaza asociaciones arbitrarias, hito/factura incompatibles y job
   eliminado, sin reservar número, insertar ni emitir efectos.
6. Duplicados se buscan solo en el mismo tenant/org/project/job/currency; no
   se devuelven ids financieros de otro ámbito.
7. Repositorio muta con id + tenant. PATCH no puede reasignar propietario.
8. Listados limitados (máximo 500) con cursor y orden estable; sin projectId,
   enumeración completa de ids con tope cerrado 422, sin truncar permisos.
9. Prometeo pasa actor real y no sirve finanzas cacheadas tras perder ownership.
10. Números nuevos usan UUID para evitar la carrera de count+1 entre réplicas;
    números históricos conservados. No se promete numeración secuencial.

## 5. Contratos API/UI/agentes

Rutas existentes y envoltura `ok(data)` conservadas; listados continúan siendo
arrays. `cursor` opcional = último id recibido; acceso al cursor también se
autoriza. Cliente puede avanzar sin offsets crecientes. 400 input incompatible,
401 auth, 403 ownership, 404 tenant/existencia, 422 exceso de asociaciones.
UI/BFF consumen mismos endpoints; pruebas sobre controller/service/repository.
Agentes no disponen de bypass implícito por tenant ni roles sintéticos.

## 6. FSM, eventos y reconstrucción

No agrega transiciones ni eventos. Marcar viewed conserva estados terminales;
PATCH no cambia estado. Conserva hooks F3 existentes y su carácter best-effort;
este slice no los convierte en outbox atómico ni registra pagos reales.

## 7. Datos, compatibilidad y rollback

Invoice y ProjectExpense existentes. Sin migración/backfill ni borrados.
Asociaciones inmutables en PATCH. Auditar datos previos mediante SQL de solo
lectura antes de un backfill futuro; nunca deducir autorización desde org emisora
cuando hay asociación. Rollback de código = SHA previo verificado; dado que
reintroduciría BOLA, preferir forward-fix o deshabilitar acceso financiero.

## 8. Observabilidad, despliegue y escalamiento

CI terminal sobre head actual, merge SHA, Railway Deploy/health/provenance y
deployment IDs por servicio. Smoke autenticado de lectura y pruebas negativas
con cuentas reales autorizadas; sin credenciales se registra NO VERIFICADO.
Monitorizar 5xx, latencia, reinicios y errores de autorización durante release.
No proclamar ACTIVE/VERIFIED con health únicamente.
Camino de escala: paginación acotada ahora; filtros projectId evitan enumerar
todo; después joins de ACL e índices tenant/job/orden tras medir EXPLAIN, con
migración aditiva y mismos tests. No elevar el tope ni cachear grants para ocultar
latencia. Numeración UUID elimina contención count+1.

## 9. Tests requeridos

Tests ejecutan implementación real compilada: actor×tenant×org, todas las
mutaciones sin escritura en denegación, asociaciones, listados, PDF/contexto,
cursor, límites, duplicados, PATCH y llamadas internas. Regresión resolver,
finance y contractor; build/typecheck/lint, spec tooling y CI completos.

## 10. Investigación externa

Tres búsquedas primarias realizadas el 2026-10-05:
- OWASP API1 BOLA: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- Prisma filtros no únicos en update: https://docs.prisma.io/docs/orm/v6/reference/prisma-client-reference
- PostgreSQL índices compuestos: https://www.postgresql.org/docs/16/indexes-multicolumn.html
Aplicado: policy en cada recurso y escritura id+tenant. Backlog: índices medidos
y joins para ACL masiva. Descartado: otro resolver o grants cacheados sin revocación.

## 11. Gates de cierre

Spec→plan→tasks→tests→implement→validación→CI→merge→deploy→smoke autenticado→
evidencia. Cada estado se registra por separado. C51 sigue PARTIAL.
