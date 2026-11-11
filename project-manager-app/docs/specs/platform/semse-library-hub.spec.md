---
id: "platform.semse-library-hub"
title: "SEMSE Library Hub — catálogo y ejecución selectiva de librerías"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/web/package.json"
  - "apps/api/package.json"
  - "apps/worker/package.json"
  - "apps/assistant-portal/package.json"
  - "apps/vision-service/requirements.txt"
  - "packages/schemas/package.json"
  - "packages/tools/package.json"
  - "pnpm-lock.yaml"
  - "docs/specs/platform/semse-library-hub.inventory.md"
  - "docs/specs/platform/semse-library-hub.apps.snapshot.json"
  - "docs/specs/platform/semse-library-hub.packages.snapshot.json"
  - "docs/specs/platform/semse-library-hub.direct-reconciliation.md"
  - "docs/architecture/ADR-SEMSE-LIBRARY-HUB-001.md"
  - "docs/reportes/2026-10-25_library-hub_cross-semse-audit.md"
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "NOT_VERIFIED"
---

# Spec: SEMSE Library Hub — SDD del componente v1.0

> Contrato SDD 2.0, versión funcional 1.0, **DRAFT**. Es infraestructura común para SEMSE, no una Biblioteca Técnica/RAG de documentos ni un ejecutor arbitrario de paquetes. Esta entrega es estrictamente documental: sin código de producto, instalaciones, migraciones, despliegues ni nuevos servicios Railway. Las restricciones de producto indicadas por el propietario están aceptadas; los contratos técnicos del slice ejecutable requieren revisión antes de pasar a APPROVED.

## 1. Problema y resultado

**Para quién:** responsables técnicos de SEMSE, administradores de plataforma, desarrolladores y módulos como Prometeo, BuildOps, Evidence, Time Tracker y aplicaciones UI.

**Problema:** bibliotecas, SDK y motores de diferentes ecosistemas se seleccionan de forma dispersa; pueden duplicarse entre aplicaciones, aumentar costos, ser vulnerables, requerir demasiados recursos o confundirse con herramientas de agentes o con conocimiento RAG. Una librería «disponible» no equivale a una capacidad implementada ni a una dependencia segura para ejecutar.

**Resultado medible:** inventario verificable de dependencias directas y, posteriormente, transitivas; catálogo de capacidades aprobado; solicitud de **solo la capacidad requerida** por una función autorizada; medición de beneficio/riesgo/costo; auditoría de cambios y evaluación trimestral. Ninguna solicitud instala ni ejecuta código arbitrario desde un registry.

## 2. Alcance y decisiones confirmadas

### Restricciones de producto (aprobadas en la conversación)

1. **Cero servicios nuevos en Railway.** Reutilizar Web, API, Worker, Redis y componentes existentes. No habilitar una tarea pesada si perjudica SLA o estabilidad de esos procesos.
2. **Bajo demanda:** la capacidad extra se invoca cuando hace falta y se detiene al finalizar. No agregar un motor dedicado siempre activo. La API/Worker subyacentes pueden permanecer activos por necesidades existentes; lazy import o colas no apagan esos procesos.
3. **Selección mínima:** no instalar, importar, cargar ni ejecutar todas las librerías. Sólo dependencias admitidas para funciones concretas; paquetes presentes en el lockfile pueden formar parte de la imagen sin estar activos.
4. **Rentabilidad basada en evidencia:** comparar alternativa nativa, código existente y dependencias antes de añadir una.
5. **Seguridad, licencias y privacidad como bloqueo real**, no puntuación cosmética.
6. **Revisión trimestral**, más revisión inmediata ante vulnerabilidad crítica, cambio de licencia, abandono o regresión.

### Alcance documental F0 (este PR)

- Cruce de nueve dominios, Mission Control, Product Intelligence, Biblioteca Técnica, ProTools y el prototipo Omega, documentado en `docs/reportes/2026-10-25_library-hub_cross-semse-audit.md`. Este cruce identifica oportunidades; no certifica runtime.

- Inventario por manifiestos existentes, distinguiendo «declarada», «usada», «instalada», «desplegada», «ejecutable» y «verificada». No confundir categorías.
- Arquitectura y separación de dominios; criterios de costos, versiones, SBOM y aprobación.
- Plan por slices pequeños, reversible y con CI al final del trabajo funcional.

### Fuera de alcance de F0

- Instalar paquetes, ejecutar scripts desde registros públicos, vender marketplace de código, auto-update en runtime.
- Activar simulador Omega, audio, ML, QIS, visión, RAG o componentes 3D.
- Añadir nuevos servicios o recursos de Railway.
- Modificar Tool Registry, Capability Reality Registry, Biblioteca Técnica TENANT_CURATED o gobernanza de pagos.
- Presumir que un manifiesto garantiza instalación, despliegue o seguridad.

## 3. Actores, permisos y límites (propuesta pendiente de ratificar)

| Actor | Permiso existente o propuesto | Scope | Puede | No puede |
|---|---|---|---|---|
| OPS_ADMIN/administrador de plataforma | permiso nuevo por diseñar: `platform:libraries:manage` | Plataforma | proponer/retirar habilitación y revisar costes | saltarse security gate |
| Revisor independiente seguridad/licencias | workflow de PR + evidencia | Dependencia y versión | aceptar/rechazar riesgo | crear excepción sin rastro |
| Desarrollador | PR protegido | paquetes versionados | solicitar incorporación | instalar paquetes en producción vía API |
| Usuario autenticado | permiso *del dominio consumidor*, nunca `libraries:execute` genérico | tenant/org/objeto | solicitar funcionalidad autorizada | elegir nombre de paquete, import path o comando arbitrario |
| Prometeo/agente | Tool Registry + Policy + permiso de recurso | actor verificado | recomendar capacidad y proponer acción | autoconceder permisos, autoaprobar o ejecutar efectos |
| Worker | identidad técnica restringida + scope del job | job y tenant | consumir capacidad publicada con límites | expandir acceso a datos o servicios |

- La política de autorización reside en el dominio propietario y en el Tool Registry para los agentes. Library Hub **no sustituye RBAC, resource scope, approvals ni Payment Governance**.
- Sin mezclar datos privados: no pasar fotos, contratos, PII o contenidos RAG entre tenant/org sin autorización.
- Revisión humana independiente obligatoria para paquetes de alto riesgo, cómputo externo, audio con captura, modelos que procesen imágenes de obra o licencias no triviales.
- Registros de invocación solo metadatos mínimos (request/correlation, capacidad, versión, consumo y resultado); nunca payload sensible ni secretos.

## 4. Escenarios y aceptación (slices futuros, no ejecutados)

### P1 — Reutilizar antes de instalar

```gherkin
DADO que el equipo solicita gráficas en una vista SEMSE
CUANDO el evaluador detecta Recharts declarado en assistant-portal
ENTONCES marca «reutilización potencial», no «disponible en Web»
Y exige revisar compatibilidad, licencia, versiones y dependencias antes de cambiar Web
```

### P1 — Ejecución selectiva bajo demanda

```gherkin
DADO una capacidad preinstalada, permitida y vinculada a un adapter aprobado
CUANDO un actor autorizado solicita una simulación concreta
ENTONCES la policy comprueba tenant, recurso, cuota y presupuesto antes del adapter
Y ejecuta sólo ese adapter con timeout y concurrencia limitada
Y libera recursos temporales al terminar
Y registra resultado y recursos medidos sin datos sensibles
```

### P0 — Rechazo por seguridad, costos o falta de adapter

```gherkin
DADO un paquete catalogado pero no autorizado, no instalado o sin adapter
CUANDO un usuario o agente lo solicita
ENTONCES se rechaza sin importarlo, descargarlo ni ejecutarlo
Y las operaciones de pagos/Evidence no se modifican
```

### P1 — Revisión trimestral e incidente

```gherkin
DADO una librería autorizada cuyo CVE crítico o licencia cambia
CUANDO se detecta el aviso o llega su revisión periódica
ENTONCES se abre revisión de riesgo y su capacidad afectada puede deshabilitarse
Y se conserva evidencia, responsables, alternativas y plan de rollback
```

**Negativos obligatorios:** suplantación de tenant/rol, ejecución sin adapter, reintento duplicado, payload malformado, límite de CPU/RAM, error de API externa, dependencia comprometida, volumen saturado, recurso fuera de scope, revocación y rollback.

## 5. Contratos propuestos (NO IMPLEMENTADOS)

### Catálogo de metadatos

Identidad única: ecosistema + nombre canónico + versión exacta + origen + integridad/hash y, cuando aplique, Package URL (purl). Vínculo: manifiesto, lockfile, owner, consumer, propósito, alternativa actual, licencia/SPDX verificada, dependencias transitivas/SBOM, advisory/CVE, mantenimiento, derechos de redistribución, coste estimado y medido, controles y fecha de revisión.

**Estados de aprobación:** `CANDIDATE → UNDER_REVIEW → APPROVED → DEPRECATED/REVOKED`. `REJECTED` es terminal salvo nueva propuesta/version. **Separadamente** se registra `declared/installed/deployed/executable/verified` como evidencia operacional, nunca como sinónimo de aprobación.

### API (propuesta de posible slice F2)

```yaml
GET /v1/platform/libraries        # lectura restringida de catálogo aprobado
POST /v1/platform/libraries/reviews # solo OPS_ADMIN con control humano
POST /v1/platform/capabilities/:id/invoke # NO habilitar en F0; reconsiderar si basta Tool Registry existente
auth: required
input_schema: zod, sin packageName/importPath/command arbitrario en input del usuario
output_schema: metadata allowlisted; invocationId, status, resourceMetrics si aplica
errors: [400,401,403,404,409,429,503]
effects:
  audit_log: solo cambios de aprobación/activación y bloqueos significativos
  domain_event: TBD en EVENT_CATALOG antes de implementar
  sse: not_required_F0
  payment_governance: never_bypass
```

No se agregará endpoint de invocación si el Tool Registry gobernado existente puede brindar el contrato sin duplicación.

### UI (propuesta F2+)

```yaml
surfaces: [admin_library_catalog]
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior: [filtros_por_ecosistema_y_estado, costo_estimado_vs_real, origen_y_licencia, aprobacion_humana, fecha_proxima_revision]
```

### Agente/Prometeo

Prometeo ve **capacidades filtradas**, no una terminal de instalación. `adapterPending=true` hasta que exista código y tests de adapter. `approvalPolicy` y permisos reales se ejecutan antes del adapter. Las mutaciones permanecen bajo las políticas del dominio y sus aprobaciones.

## 6. FSM, eventos y reconstrucción

- La FSM propuesta es del **ciclo de vida de aprobación de dependencias**, no FSM de Project/Milestone/Evidence/Payment.
- Transiciones `APPROVED/REVOKED` requieren razón, versión, responsable y auditoría persistida cuando se implemente.
- Si se decide añadir eventos al dominio, registrarlos primero en `docs/foundation/EVENT_CATALOG.md` y definir productor, outbox, consumers idempotentes, replay y DLQ. No emitir eventos ficticios en F0.
- Ante reintento de job, usar idempotency key y *no* duplicar efectos o consumo.

## 7. Datos y migración

F0: Markdown versionado en Git, **sin Prisma ni migración**. F1: decidir expresamente entre catálogo versionado en Git (preferido para dependencias de build) y proyección persistente solo si existe un caso operacional verificable. No agregar tablas por defecto. Si se requiere Prisma: migración aditiva con expand/contract, `prisma migrate deploy`, checksum, compatibilidad, backup y rollback/forward-fix; nunca `db push` en producción.

**Referencia vs copia:** por defecto manifiesto + lockfile + caché/build reproducible, no almacenar cada paquete completo en SEMSE. Vendoring de una copia interna solo con justificación legal/técnica específica, procedencia verificable, hashes, actualización y autorización. Nunca descarga en caliente ni ejecutar código externo no confiable dentro de API/Worker.

## 8. Rendimiento, economía, observabilidad y despliegue

- **Uso efectivo** = coste de compute incremental (CPU/RAM, almacenamiento, salida/red/API externa) + mantenimiento y riesgo + integración amortizada, frente a ahorro de horas/defectos/tiempo.
- `beneficio_neto = horas_ahorradas*valor_hora + costo_evitado - (integracion_amortizada + mantenimiento + runtime + API_externa + riesgo_esperado)`; solo aprobar por rentabilidad si se puede validar con piloto y supuestos explícitos.
- Umbrales iniciales de CPU/RAM, concurrencia, duración, frecuencia y presupuesto: **TBD por benchmark**, no cifras inventadas. Deshabilitar cuando se supere presupuesto o perjudique recursos existentes. Node worker_threads resourceLimits **no es** sandbox de seguridad ni un límite global de memoria.
- Métricas por capability/version/job: invocation_count, rejected, errors, elapsed_ms, CPU time, heap/RSS antes/después, bytes outbound y costo estimado/medido. Correlation ID, retención acotada.
- No nuevos servicios; probar primero código de navegador o lógica pura; cálculos medianos en Worker **si hay capacidad sobrante comprobada**, procesos aislados existentes y límites reales; Python solo en servicio ya existente compatible y aprobado. Si el aislamiento/recursos requeridos no caben sin servicio extra, queda **BLOCKED**, no se relaja seguridad.
- Flag `SEMSE_LIBRARY_HUB_ENABLED`: **propuesta no configurada**; OFF por defecto hasta implementación.
- F0: sin deploy/activación. F1+: canary sintético sin datos productivos, reporte de consumo y kill switch; rollback no puede vulnerar controles de seguridad previos.

## 9. Tests requeridos (pendientes)

- [ ] Inventario reproducible de todos los `package.json` workspace, lockfile pnpm y requirements Python (incluyendo subproyectos).
- [ ] SBOM (dependencias directas y transitivas, purl, versión, integridad, licencia verificada).
- [ ] Catálogo: estados, hash, revisión, idempotencia, migración futura si se aprueba.
- [ ] Evaluador: deny-by-default para licencia/CVE crítico/origen desconocido; pruebas adversariales.
- [ ] Integración: sólo adapter allowlisted, no import/instalación remota; permisos y cross-tenant/cross-org.
- [ ] Recursos: timeout, cuotas, concurrencia, aborto, CPU/RAM y saturación del Worker existente.
- [ ] UI: estados y prueba ES/EN sin pérdida de información.
- [ ] Plan de restauración/rollback y canary autenticado antes de activar.

## 10. Mapa de implementación por cortes independientes

- **F0 documentación:** este spec, inventario, ADR, plan, tasks, checklist. Sin runtime.
- **F1 inventario verificable:** script estático que lea manifiestos/lockfile/requirements, exporte JSON/SBOM, comparación automática; sin nuevas dependencias de runtime.
- **F2 gobierno:** evaluación, estados, revisión, trazabilidad y políticas en paquetes existentes; plan y permisos propios antes de código.
- **F3 primer adapter:** piloto de librería *ya declarada*, lectura o cálculo puro de bajo riesgo; measurement+quota, sin nuevas infra.
- **F4 UI y Prometeo Omega:** solo después de F3 acreditado, adaptar audio/DSP/simulaciones sin interpretar métricas conceptuales como mediciones científicas.
- **F5 ampliar ecosistemas:** evaluaciones separadas para WebGPU/Python avanzado; CI al final de cada corte, nunca declarar PASS sin ejecutarlo.

## 11. Investigación externa (fuentes primarias)

1. OWASP SCVS V1 Inventory: https://scvs.owasp.org/scvs/v1-inventory/ — componentes identificados por tipo, versión, SBOM y origen; aplicado a F1.
2. OpenSSF Scorecard: https://openssf.org/projects/scorecard/ — señales de mantenibilidad, vulnerabilidades y build; aplicado al evaluador, no equivalen a garantía.
3. CISA 2026 SBOM Minimum Elements: https://www.cisa.gov/sbom — exigir component hash, licencia y contexto del inventario en F1.
4. Node.js worker_threads: https://nodejs.org/api/worker_threads.html — `resourceLimits` no cubre memoria externa ni sustituyen aislamiento del proceso.

**Aplicado ahora:** inventario por evidencia, decisión mínima, procedencia y no ejecución arbitraria. **Backlog:** SBOM automatizado completo, métricas reales y pipeline de revisión. **Descartado:** copia universal de paquetes, microservicio nuevo, motor genérico de comandos.

## 12. Gates de cierre

- [ ] Spec incluido en `pnpm spec:index` (pendiente; CI al final).
- [ ] Revisar y aprobar contratos técnicos de F1 antes de implementar.
- [ ] Tests rojos→verdes de F1; inventario SBOM verificable.
- [ ] `pnpm spec:validate:strict`, build/typecheck/lint según slice.
- [ ] CI terminal verde, PR fusionado con SHA; registrar por separado deploy y activación cuando correspondan.
- [ ] Aprobación independiente de seguridad/licencias en slices que ejecuten nueva capacidad.
- [ ] `production_evidence` y `last_verified` únicamente después de comprobar.
