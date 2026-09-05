---
id: "platform.canonical-state-registry"
title: "Registro Canónico de Estado del Sistema"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "docs/CANONICAL_STATE_REGISTRY.md"
  - "docs/SOURCE_OF_TRUTH.md"
related_tests:
  - "tests/unit/canonical-state-registry.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-08-28"
---

# Spec: Registro Canónico de Estado del Sistema

> Contrato ejecutable SDD 2.0. Este spec es de gobernanza documental, no de
> feature de producto: no expone endpoints, no toca Prisma ni FSM de dominio.
> Las secciones de contrato API/UI/agente y de datos/migración del template
> estándar se marcan explícitamente "No aplica" en vez de forzarse.

## 1. Problema y resultado

**Para quién:** agentes de IA y personas que retoman trabajo en SEMSEproject
a partir de rastros documentales (specs, reportes, checkpoints, nombres de
rama) en vez de verificación directa.

**Problema:** SEMSEproject ya tiene gobernanza sobre las *acciones* de los
agentes (constitución, flujo SDD, RBAC, audit log) pero no gobernanza
equivalente sobre la *verdad* que esos agentes consumen antes de actuar.
`SPEC_INDEX.md` rastrea el estado de contratos autorizados, no el
comportamiento real y verificado de una capacidad; cuando un spec dice
`IMPLEMENTED` pero el código sólo tiene una simulación, o un checkpoint
asume continuidad sobre una rama ya invalidada, un agente puede heredar una
lectura del presente que ya no es cierta, incluso conservando una
comprensión correcta de la arquitectura futura.

**Resultado esperado:** existe un documento único (`docs/CANONICAL_STATE_REGISTRY.md`)
que, para cada capacidad auditada, obliga a declarar evidencia citable,
entorno, commit, limitaciones y fecha de verificación — y que define
explícitamente qué fuente gana cuando dos rastros históricos se contradicen.
Ningún reporte histórico puede, por sí solo, declarar una capacidad
terminada si el registro (o el código en `main`) dice lo contrario.

## 2. Alcance

### Incluido

- Definición de una jerarquía de verdad de 9 niveles, con reglas derivadas
  explícitas sobre cuándo una fila puede declararse `verificada`.
- Esquema de 11 campos por capacidad (Capacidad, Propietario, Estado real,
  Evidencia, Entorno, Commit verificado, Limitaciones, Riesgos, Última
  verificación, Documentos obsoletos, Próxima decisión).
- Definición operacional de `Estado real` (`no_iniciada` / `simulada` /
  `parcial` / `operativa` / `verificada`) que distingue explícitamente
  "código existe" de "está probado" de "está en producción verificada".
  Esta enumeración es un vocabulario nuevo, específico de este registro, y
  deliberadamente no comparte valores con los estados de spec de
  `SPEC_INDEX.md` (`DRAFT`/`APPROVED`/`VERIFIED`/etc.) para que no se
  confundan por igualdad de nombre: un spec `VERIFIED` no implica una fila
  `verificada` en este registro sin re-confirmación.
- Reglas de mantenimiento: no fabricar evidencia, citar fuente exacta,
  caducidad a 60 días, actualización disparada por evento.
- Siembra inicial (Fase 1) de 3 filas verificables en este mismo commit;
  cero filas especulativas.
- Test automatizado mínimo que valida estructura del documento y que las
  rutas citadas como evidencia para filas `operativa`/`verificada` existen
  en el repositorio.
- Referencia cruzada añadida en `docs/SOURCE_OF_TRUTH.md` señalando este
  registro como instrumento operativo de sus "ejes oficiales de verdad".

### Fuera de alcance

- Auditar las nueve capacidades/dominios completos de SEMSEproject fila por
  fila — eso es explícitamente Fase 2, listada como backlog en el `.tasks.md`
  de este mismo spec, no una promesa implícita de esta entrega.
- Automatizar la generación del registro vía `pnpm spec:index` o integrarlo
  al pipeline de CI — se documenta como decisión pendiente, no se implementa
  aquí.
- Cualquier cambio de código de producto (API, Web, Worker, Prisma). Este
  spec no toca `apps/` más allá de citar rutas existentes como evidencia.
- Reemplazar `SPEC_INDEX.md`, `SOURCE_OF_TRUTH.md` o
  `IMPLEMENTATION_STATUS_MATRIX.md` — el registro los complementa y cede
  ante ellos cuando corresponde (spec aprobado sigue gobernando qué se
  autoriza a implementar).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Agente/persona que edita el registro | N/A (documento en Git, no runtime) | Repositorio completo | Añadir/actualizar una fila citando evidencia verificable | Declarar `verificada` sin evidencia de nivel 1-2 de la jerarquía |
| Agente que consume el registro para retomar trabajo | N/A | Lectura | Usar una fila como fuente de verdad si su fecha de verificación es reciente | Tratar una fila caducada (>60 días) como confiable sin revalidar |

- Tenant boundary: no aplica — documento de gobernanza, no dato de negocio.
- Ownership/resource policy: no aplica.
- Step-up o aprobación humana: no aplica; esto es documentación versionada
  en Git, revisada como cualquier PR.
- Datos `privacyCritical`: no aplica — no contiene PII ni datos de negocio.
- Requisitos de auditoría: el propio archivo, versionado en Git con historial
  de commits, es su propio rastro de auditoría; no requiere `AuditLog` de
  runtime porque no hay runtime.

## 4. Escenarios y criterios de aceptación

### P1 — Un agente retoma trabajo y consulta el registro antes que un reporte histórico

```gherkin
DADO que existe una fila en el registro para la capacidad X con
  Última verificación hace menos de 60 días
Y existe un reporte histórico en docs/reportes/ que afirma algo distinto
  sobre la capacidad X
CUANDO un agente necesita decidir el estado real de X
ENTONCES el agente debe preferir la fila del registro (nivel 4 de la
  jerarquía) sobre el reporte histórico (nivel 7)
Y si la fila del registro cita evidencia de nivel 1 o 2, esa evidencia
  prevalece incluso sobre el propio registro
```

Casos borde:

- [x] Fila sin `Última verificación` en los últimos 60 días → tratarla como
      no confiable para decisiones nuevas (documentado en "Cómo se mantiene
      este registro", punto 3).
- [x] Evidencia citada que ya no existe en el repositorio → cubierto por el
      test automatizado, que falla si una ruta citada para una fila
      `operativa`/`verificada` no existe.
- [x] Capacidad sin fila todavía → el documento declara explícitamente que
      ausencia de fila no equivale a `no_iniciada` confirmada, sino a
      "pendiente de auditoría" (ver sección "Qué no es este documento").

### P2 — Un contribuidor añade o actualiza una fila

```gherkin
DADO que un PR cambia el comportamiento real de una capacidad
CUANDO ese PR se abre
ENTONCES el PR debe actualizar la fila correspondiente en el mismo cambio
  (o crear una nueva) citando evidencia exacta, entorno y commit
Y no debe declarar Estado real: verificada sin evidencia de nivel 1 o 2
```

Casos borde:

- [x] Duplicado/reintento: no aplica (documento versionado, no hay
      concurrencia de escritura en runtime).
- [x] Fuente vacía, caída o no autorizada: si no hay evidencia verificable
      todavía, la fila debe quedar en `no_iniciada`/`parcial` con
      "Próxima decisión: auditar" en vez de inventarse un estado.
- [x] Aislamiento cross-tenant/cross-org: no aplica — no hay tenant en un
      documento de gobernanza.

## 5. Contratos

### API — No aplica

Este spec no expone endpoints. El "contrato" es el esquema de columnas del
documento, definido en la sección "Esquema de una fila" de
`docs/CANONICAL_STATE_REGISTRY.md`.

### UI — No aplica

No hay superficie de UI en esta entrega. Una vista consultable (dashboard)
queda como decisión futura, no implícita en este spec.

### Agente/Prometeo — No aplica directamente

Ningún agente invoca este documento como tool en esta entrega. La forma de
"consumo" es que los agentes lean el archivo como parte de su contexto de
sesión, igual que leen `SOURCE_OF_TRUTH.md` o `SPEC_INDEX.md` hoy.

```yaml
tools: []
input_schema: N/A
output_schema: N/A
source_citations_required: true
approval_policy: N/A
forbidden_behavior:
  - "Declarar una fila `verificada` sin evidencia de nivel 1 o 2 de la jerarquía de verdad"
  - "Rellenar filas especulativas para dar apariencia de cobertura completa"
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno — el vocabulario `no_iniciada` / `simulada` /
  `parcial` / `operativa` / `verificada` es deliberadamente **no** una FSM de
  dominio (no vive en `DOMAIN_INVARIANTS.md` ni en `STATE_MACHINES.md`); es
  metadato documental sobre capacidades, no un estado transaccional con
  transiciones válidas/inválidas.
- Invariantes: no aplica (no es un dominio de negocio).
- Eventos declarados: no aplica — no se emite ningún `DomainEvent` ni
  `ProductEvent` nuevo.
- Productor + outbox atómico: no aplica.
- Consumidores + idempotencia: no aplica.
- Replay/rebuild: no aplica.
- DLQ/compensación: no aplica.

## 7. Datos y migración

No aplica — no hay cambios a `packages/db/prisma/schema.prisma` ni a ningún
almacenamiento runtime. El registro vive como Markdown versionado en Git.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: no aplica — documento, no servicio.
- Logs/traces/correlation: no aplica.
- Health/readiness: no aplica.
- Feature flags/allowlists: no aplica.
- Plan de canary: no aplica — `deploy_status: NOT_DEPLOYED` y
  `activation_status: INACTIVE` son correctos y permanentes para este tipo
  de artefacto; nunca se promoverán a `DEPLOYED`/`ACTIVE` porque no hay
  runtime que desplegar. `status: IMPLEMENTED` describe el estado terminal
  correcto para esta capacidad, no un paso intermedio hacia `VERIFIED`.
- Evidencia de producción requerida: no aplica.
- Señal de rollback: revertir el commit/PR si el esquema propuesto resulta
  impracticable.
- Owner operativo: `semse-core`.

## 9. Tests requeridos

- [x] Estructural: `tests/unit/canonical-state-registry.test.ts` confirma
      que `docs/CANONICAL_STATE_REGISTRY.md` existe, conserva las 11
      columnas del esquema y que las rutas citadas como evidencia en filas
      `operativa`/`verificada` existen en el repositorio.
- [ ] Contrato API/BFF: no aplica.
- [ ] Permiso denegado y aislamiento tenant/org: no aplica.
- [ ] Validación y conflicto de estado: no aplica (no hay FSM).
- [ ] Idempotencia/reintento/concurrencia: no aplica.
- [ ] Migración y compatibilidad: no aplica.
- [ ] UI loading/empty/forbidden/degraded/error: no aplica.
- [ ] Canary o smoke autenticado en producción: no aplica.

## 10. Mapa de implementación

### API

- No aplica.

### Web

- No aplica.

### Worker/Packages/DB

- No aplica.

### Docs (en vez de código de producto)

- `docs/CANONICAL_STATE_REGISTRY.md` — nuevo, el registro en sí.
- `docs/SOURCE_OF_TRUTH.md` — actualizado, referencia cruzada.
- `docs/SPEC_INDEX.md` — regenerado vía `pnpm spec:index` para indexar este
  spec.

### Tests

- `tests/unit/canonical-state-registry.test.ts`

## 11. Investigación externa

- Reporte con tres búsquedas primarias: no aplica — este spec formaliza una
  propuesta de gobernanza interna entregada directamente por el usuario del
  proyecto (diagnóstico forense sobre coordinación multiagente y divergencia
  documental), no requirió investigación externa de mercado o de librerías.
- Aplicado ahora: esquema de 11 campos, jerarquía de 9 niveles y reglas de
  mantenimiento tal como fueron propuestos, formalizados en la doctrina y el
  vocabulario ya existentes de `.specify/memory/constitution.md` y
  `docs/SOURCE_OF_TRUTH.md`.
- Backlog: automatización vía `pnpm spec:index`, dashboard consultable,
  integración a `pnpm verify:workspace`.
- Descartado: fusionar este registro dentro de `SPEC_INDEX.md` como columnas
  adicionales — se descartó porque `SPEC_INDEX.md` rastrea specs (contratos
  autorizados), no comportamiento verificado; mezclarlos habría permitido
  que el estado de un spec siga "demostrando" el estado de una capacidad,
  que es exactamente el problema que este spec busca cerrar.

## 12. Gates de cierre

- [x] Spec enlazado por `pnpm spec:index`
- [x] Spec, plan, tasks coherentes (sin `analyze`/`checklist` formales
      separados en esta entrega — ver plan, sección "Gates antes de tareas")
- [x] Tests derivados del spec y verdes (`node --test tests/unit/canonical-state-registry.test.ts`)
- [ ] `pnpm spec:validate:strict` verde (pendiente de correr en esta sesión antes de commit)
- [x] Migración reproducible y rollback/forward-fix documentado (no aplica; documentado como tal)
- [ ] CI `PASS` (pendiente — se registrará en el PR)
- [ ] PR fusionado y SHA registrado (pendiente)
- [ ] Deployment terminal `DEPLOYED` (no aplica — ver sección 8)
- [ ] Activación/canary verificada por separado (no aplica — ver sección 8)
- [x] `production_evidence` y `last_verified` actualizados (vacío intencional; `last_verified` sí registrado)
- [ ] Sólo entonces `status: VERIFIED` — este spec permanece en `IMPLEMENTED`
      hasta que el PR fusione; `VERIFIED` no aplica como estado terminal para
      un artefacto sin deploy/activación (ver sección 8), así que el techo
      de este spec es `IMPLEMENTED` con `code_status: COMPLETE`.
