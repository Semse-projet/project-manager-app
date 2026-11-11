---
id: "prometeo.omniverse-adapter"
title: "Omniverse Read-Only Projection Adapter"
domain: "prometeo"
sdd_version: "2.0"
version: "1.1"
status: "REVIEW"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: ["SEMSE_OMNIVERSE_ADAPTER_MODE"]
production_evidence: []
related_files:
  - "docs/architecture/ADR-044-operational-intelligence-graph.md"
  - "docs/architecture/ADR-042-universal-connector-trust-boundary.md"
  - "docs/architecture/ADR-045-semse-mcp-inbound-authorization.md"
  - "docs/architecture/SEMSE_API_SURFACE_V1.md"
  - "docs/specs/prometeo/operational-intelligence-program.spec.md"
  - "docs/specs/prometeo/operational-intelligence-program.reconciliation.md"
  - "docs/specs/prometeo/unified-graph-contract.spec.md"
  - "docs/specs/prometeo/unified-query-lineage.spec.md"
  - "packages/auth/src/rbac.ts"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
privacyCritical: true
auditLog: "cada exportación y cada denegación deja un registro de acceso sin contenido (D-09, O-08); destino y nombres de acción por fijar al aprobar el spec (Q-6)"
sse: false
fsmTransicion: "no aplica: solo lectura, sin estados propios"
paymentGovernance: false
last_verified: "2026-11-06"
---

# Spec: Omniverse Read-Only Projection Adapter

> **Estado: REVIEW.** No autoriza código. Requisitos para `APPROVED`: ADR-044 aceptado con fecha, acta aprobada, slices 1 a 3 aprobados y las decisiones de la sección 14 resueltas por el owner.
> Programa: [`prometeo.operational-intelligence-program`](operational-intelligence-program.spec.md). Decisiones aplicadas: D-04 a D-09, D-12 a D-16 del [acta](operational-intelligence-program.reconciliation.md).

## 0. Alcance de trabajo: solo `semse-project-manager-app`

Este spec define **únicamente el lado de este repositorio**: el endpoint, el contrato de salida y los controles que SEMSE aplica antes de entregar datos. El repositorio del consumidor (Omniverse Control Center) **no es parte de este trabajo**: no se modifica, no se despliega y no se prueba desde aquí. Sus requisitos se tratan como **condiciones externas** (sección 13) que el owner acredita; este repositorio no puede verificarlas.

## 1. Problema y resultado

Un consumidor externo de visualización necesita ver una proyección del grafo operativo sin acceso a la base de datos, sin cuerpos sensibles en bruto y sin autoridad de escritura.

Resultado: un endpoint de **solo lectura** que entrega una **instantánea saneada y acotada** del grafo de un proyecto, a una identidad de servicio con permisos mínimos, con todo lo que sale auditado. Omniverse nunca es fuente de verdad.

## 2. Alcance

### Incluido
- Contrato de instantánea saneada sobre el servicio de consulta del slice 3.
- Identidad de servicio dedicada del consumidor, con permiso mínimo de lectura.
- Allowlist estricta de atributos, techo de sensibilidad y minimización de identificadores.
- Metadatos de frescura, degradación y truncamiento.
- Registro de acceso y de denegación de cada exportación, sin contenido.
- Kill switch y semántica de `off/shadow/canary/live`.

### Fuera de alcance
- Cualquier cambio en el repositorio del consumidor y su renderizado 3D.
- Acceso directo a la base de datos y una base espejo en el consumidor.
- Secretos, cuerpos de mensajes en bruto y escrituras críticas (**cero escrituras**, incluida la creación implícita de contexto de actor).
- Reemplazar Mission Control, el Digital Twin, Field Memory 4D, el visor 3D o BIM; este adaptador es una proyección distinta (Q-7).
- Cursor y delta: V1 entrega solo la instantánea (O-19).
- Acciones autónomas de despliegue.
- Conectar al consumidor por Universal Connector o MCP: decisión abierta Q-1.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Consumidor Omniverse (identidad de servicio) | permiso de lectura de instantánea, **propio y mínimo**, nombre a fijar en `packages/auth/src/rbac.ts` (D-04, Q-2) | **un proyecto** de una organización concreta | leer la instantánea de ese proyecto | escribir; leer otro proyecto, otra organización u otro tenant |
| `OPS_ADMIN` | **no se usa** como identidad del consumidor: tiene del orden de 90 permisos, con escritura (O-02) | — | — | — |
| Operador SEMSE | gestionar o revocar la identidad del consumidor, permiso aparte (Q-2) | su tenant | habilitar, suspender, revocar | leer datos fuera de su alcance |

- **`projectId` es obligatorio** (O-03). No existe instantánea de «todo el tenant».
- **Aislamiento:** 404 si el recurso es de otro tenant o inexistente, 403 si es de otra organización (D-05). Matriz 2 tenants × 2 organizaciones, con la identidad del consumidor.
- **Cero escrituras (O-16):** la ruta de lectura **no puede** llamar a `ActorContextService.ensureActorContext`, que hace *upsert* de tenant, organización y usuario. Una identidad de servicio no vinculada a una sesión SEMSE no debe provisionar nada (ADR-045). Se demuestra con una prueba que cuenta escrituras a base de datos durante la lectura.
- **Nodos ocultos** se omiten sin rastro (D-06); nodo de inicio no visible → 404.
- **Datos `privacyCritical`:** nada `confidential` ni `restricted` sale hacia el consumidor; el techo recomendado es `internal` (Q-2). Sin datos personales ni ubicaciones.
- **Autorización parcial:** se entrega solo lo visible para esa identidad, sin indicar lo omitido.

## 4. Escenarios y criterios de aceptación

### P1 — Instantánea saneada de un proyecto
```gherkin
Dado la identidad de servicio del consumidor, habilitada para el proyecto P de la organización O
Cuando solicita la instantánea de P con maxDepth y maxNodes válidos
Entonces recibe nodos y aristas solo de P, con atributos de la allowlist
  Y ningún nodo supera el techo de sensibilidad
  Y la respuesta incluye generatedAt, freshness, degradedSources, truncated, maxDepthApplied y correlationId
```

### P1 — Sin escrituras
```gherkin
Dado una instantánea solicitada por una identidad de servicio sin sesión SEMSE previa
Cuando se atiende la petición
Entonces no se crea ni se modifica ninguna fila de tenant, organización ni usuario
```

### P1 — Aislamiento
```gherkin
Dado la identidad habilitada para el proyecto P del tenant A
Cuando solicita un proyecto del tenant B
Entonces recibe 404 sin información de existencia
Y si es de otra organización del mismo tenant, recibe 403
```

### P1 — Sin proyecto no hay instantánea
```gherkin
Dado una petición sin projectId
Cuando se valida
Entonces responde 400 y no consulta ningún proveedor
```

### P1 — Sin fugas
```gherkin
Dado un nodo con atributos fuera de la allowlist, con datos personales o con secretos
Cuando se proyecta
Entonces esos campos no aparecen en la respuesta
  Y la respuesta no contiene nombres de variables de secretos conocidos
```

### P1 — Determinismo y acotación
```gherkin
Dado el mismo grafo y la misma petición
Cuando se solicita dos veces
Entonces el contenido es idéntico salvo generatedAt y correlationId
Y si se piden límites por encima del tope del servidor, se aplica el del servidor con truncated=true
```

### P1 — Flag apagado y revocación
```gherkin
Dado SEMSE_OMNIVERSE_ADAPTER_MODE ausente, desconocido u off
Cuando el consumidor llama al endpoint
Entonces recibe 404
Y dado una identidad revocada con el flag activo, recibe 401 en la siguiente petición
```

### P1 — Auditoría de exportaciones
```gherkin
Dado una exportación o una denegación
Cuando termina la petición
Entonces queda un registro con identidad, tenant, organización, proyecto, alcance y correlationId, sin contenido del grafo
```

## 5. Contratos

Contratos Zod (`.strict()`) en `packages/schemas/src`, reutilizando los del slice 1. Forma de referencia:

```text
POST <prefijo>/omniverse/snapshot        (prefijo propio, sin rutas @Public)
  projectId   (obligatorio)
  root?       { nodeType, sourceId }     -- debe pertenecer al proyecto
  maxDepth?, maxNodes?                   -- el servidor aplica sus topes

Respuesta
  generatedAt, correlationId
  graphSourceSha | null                  -- revisión del grafo técnico si se conoce; null si no (Q-5)
  freshness: [{ provider, asOf | null }] -- por proveedor; null cuando se desconoce, nunca inventado
  nodes[], edges[]                       -- proyección saneada
  degradedSources[{provider, reason}], truncated, maxDepthApplied
```

- **La salida respeta el contrato del padre** (O-05): incluye `maxDepthApplied` y `correlationId`.
- **Proyección saneada:** la allowlist de atributos se **publica** como parte del contrato (O-04). No salen `tenantId` ni `orgId`; los `sourceRefs` se reducen a lo mínimo para que el consumidor distinga nodos, sin referencias a conversaciones. La estabilidad y opacidad de las claves de nodo se decide en Q-2.
- **Errores:** 400 (falta `projectId` o entrada inválida), 401 (identidad inválida o revocada), 403 (otra organización), 404 (otro tenant, inexistente o flag apagado), 429 (cuota), 503 (`source_unavailable`, fuente autoritativa caída), 504 (`timeout`). Los mensajes no incluyen detalles internos.
- **Idempotente y sin estado:** misma petición, mismo contenido; sin cursores ni caché persistente.

## 6. Eventos, idempotencia y reconstrucción

Solo lectura. Las instantáneas no emiten eventos de dominio. El registro de acceso (D-09) no es un evento de dominio.

## 7. Datos y migración

Sin migración del núcleo. Sin base espejo en el consumidor en V1. Si el registro de acceso o el registro de identidades de servicio exigieran una tabla nueva, sería una migración y requiere decisión previa (Q-1, Q-6).

## 8. Observabilidad, flag y rollout

- Flag `SEMSE_OMNIVERSE_ADAPTER_MODE`: ausente o desconocido = `off` (D-14).
- `off`: endpoint 404. `shadow`: se calcula la instantánea y se registran métricas, **sin entregar nada** al consumidor. `canary`: una identidad, un proyecto y una organización. `live`: solo tras evidencia del canary y de las condiciones externas.
- **Nombres candidatos de métricas** (versión 2 del paquete, adoptados como candidatos por el owner el 2026-11-07, B01-1): latencia de la instantánea; bytes serializados; número de nodos y aristas; campos rechazados o saneados; fuentes degradadas. Son nombres, no valores; los valores y los SLO siguen pendientes de medición.
- **Kill switch:** poner el flag en `off` y/o revocar la identidad del consumidor; cualquiera de los dos corta el acceso sin desplegar.
- Throttling: el limitador global actual tiene un valor fijo (hallazgo O-18); el límite propio del adaptador y las cuotas se fijan en Q-4. **Este slice no modifica `CORS_ORIGINS` ni otras variables de producción**: el consumidor llama de servidor a servidor.
- Métricas por modo y código de resultado: latencia, denegaciones, degradados, truncados. Nombres, SLO, alertas y responsable: por aprobar (Q-4).
- Logs sin contenido de nodos; solo identificadores, conteos y códigos.

## 9. Tests requeridos (derivados de la sección 4)

| Criterio | Prueba |
|---|---|
| Instantánea saneada | allowlist, techo de sensibilidad y metadatos completos |
| Sin escrituras | contador de escrituras a base de datos igual a cero durante la lectura, con identidad sin sesión previa |
| Aislamiento | matriz 2 × 2 con la identidad del consumidor; 404/403 |
| Sin proyecto | 400 y ningún proveedor consultado |
| Sin fugas | datos personales, ubicaciones y nombres de secretos ausentes |
| Determinismo y topes | doble solicitud idéntica; topes del servidor |
| Flag y revocación | `off` → 404; revocada → 401 |
| Auditoría | registro de exportación y de denegación sin contenido |
| Contrato | el consumidor no recibe ruta ni credencial de acceso directo a base de datos |
| Integración | contra base de datos real para la ruta completa |

Las pruebas se escriben primero y deben fallar antes del código.

## 10. Mapa de implementación

Rutas definitivas por confirmar al aprobar (sección 15):
- Servicio y controlador del adaptador en el módulo nuevo del slice 1; contratos Zod en `packages/schemas/src/`.
- Identidad de servicio y permisos: `packages/auth/src/rbac.ts` y el mecanismo que decida Q-1.
- `docs/architecture/SEMSE_API_SURFACE_V1.md` (O-23).
- Pruebas bajo `apps/api/test/`.

## 11. Investigación externa

La investigación de este slice depende de la plataforma consumidora, que no es parte de este trabajo (O-25). Referencias de contexto: W3C Trace Context (https://www.w3.org/TR/trace-context/) y OpenTelemetry context propagation (https://opentelemetry.io/docs/concepts/context-propagation/), sin secretos ni cuerpos en el contexto propagado.

## 12. Prerrequisitos y dependencias

- Depende del slice 3 (servicio de consulta) y, por él, de los slices 1 y 2; orden vigente 1 → 2 → 3 → 4 (D-16).
- Depende de la decisión de identidad del consumidor (Q-1), alineada con ADR-042 (Universal Connector) y ADR-045 (MCP entrante, `PROPOSED`).

## 13. Condiciones externas y gates de cierre

**Condiciones externas (fuera de este repositorio; las acredita el owner, este repositorio no las verifica):** antes de `canary` el consumidor debe acreditar, con evidencia del propio consumidor, autenticación obligatoria fail-closed, control de acceso, identidad de servicio, auditoría, capacidad de revocación y pruebas negativas, y no mostrar datos demo como si fueran de producción. El acta (§9.1) registra hallazgos previos sobre el consumidor que justifican tratarlo como **no confiable** hasta entonces.

**Gates de este repositorio:**
- [ ] ADR-044 aceptado con fecha y acta aprobada; slices 1 a 3 aprobados y fusionados
- [ ] Spec `APPROVED` (decisiones de la sección 14 resueltas)
- [ ] Pruebas escritas y en rojo antes del código, incluida la de cero escrituras
- [ ] `spec:validate:strict`, índice y cobertura en verde
- [ ] CI PASS, merge SHA, despliegue terminal y activación registrados por separado
- [ ] Evidencia del owner de las condiciones externas, adjunta antes del `canary`
- [ ] Canary autenticado con una identidad, un proyecto y una organización
- [ ] Evidencia sin secretos

## 14. Decisiones abiertas (requieren al owner)

| ID | Decisión | Recomendación del coordinador |
|---|---|---|
| Q-1 | Identidad del consumidor y cómo se conecta (D-13): cliente OAuth con consentimiento por organización (ADR-045), conexión del Universal Connector (ADR-042) o credencial de servicio propia | Una identidad de servicio **no vinculada a sesión de usuario**, con consentimiento por organización y revocación inmediata; no `OPS_ADMIN`. Los dos ADR siguen `PROPOSED` o con alcance distinto, así que esto requiere decisión explícita |
| Q-2 | Permisos (lectura de instantánea y gestión de la identidad), techo de sensibilidad, allowlist publicada y opacidad/estabilidad de las claves de nodo | Permiso propio mínimo; techo `internal`; claves opacas por solicitud salvo que el consumidor necesite estabilidad entre solicitudes |
| Q-3 | Obligaciones de retención, purga y revocación sobre datos ya entregados (O-15) | Retención máxima y purga al revocar, como cláusula de la condición externa; SEMSE no puede retirar datos ya entregados |
| Q-4 | Valores numéricos: `maxDepth`, `maxNodes`, límite y cuota propios, SLO, nombres de métricas y responsable | Los propone el implementador con datos medidos y los aprueba el owner; no se inventan aquí |
| Q-5 | Definición de `graphSourceSha` y de `freshness` | `null` cuando se desconoce; nunca un valor inventado |
| Q-6 | Destino y nombres del registro de acceso (¿`AuditLog` existente o tabla nueva?) y quién acredita las condiciones externas | Reutilizar `AuditLog` con acciones nuevas catalogadas; el owner acredita las condiciones |
| Q-7 | Nombre y relación con Mission Control, Digital Twin, Field Memory 4D, visor 3D y BIM (O-10, O-11) | Proyección independiente, sin reemplazar ni duplicar esas superficies; nombre que no choque con ellas |
| Q-8 | ¿Se divide el slice (identidad de servicio frente a instantánea)? | Sí, si Q-1 exige un mecanismo de identidad nuevo: la identidad es un riesgo de seguridad por sí misma |

### 14.1 Resoluciones del owner (2026-11-06)

El owner respondió «aplica todo» al plan de respuestas del coordinador. Se registran tal como se recomendaron. Esto **no aprueba el spec**: pasa a `APPROVED` cuando el ADR-044 esté aceptado con fecha, el acta aprobada y los slices previos aprobados (sección de gates).

| ID | Resolución |
|---|---|
| Q-1 | Identidad de servicio propia, **sin sesión de usuario**, con consentimiento por organización y revocación inmediata. No `OPS_ADMIN`. El mecanismo concreto sigue ligado a ADR-042 y ADR-045, que continúan `PROPOSED` |
| Q-2 | Permiso propio mínimo `lineage:snapshot:read` para el consumidor; el permiso de gestión de la identidad se nombra al diseñar Q-1. Techo de sensibilidad `internal`. Claves de nodo opacas por solicitud |
| Q-3 | Retención máxima y purga al revocar, como cláusula de las condiciones externas. SEMSE no puede retirar datos ya entregados. **Plazos pendientes** |
| Q-4 | Topes, cuota, SLO y métricas: se miden y se proponen; el owner aprueba. **Pendiente de dato** |
| Q-5 | `graphSourceSha` y `freshness` valen `null` cuando se desconocen |
| Q-6 | El registro de acceso reutiliza `AuditLog` con acciones nuevas catalogadas. El owner acredita las condiciones externas del consumidor |
| Q-7 | Proyección independiente; no reemplaza Mission Control, Digital Twin, Field Memory 4D, el visor 3D ni BIM |
| Q-8 | Se divide la identidad de servicio de la instantánea si Q-1 exige un mecanismo de identidad nuevo |

## 15. Archivos y endpoints planificados (aún inexistentes)

Se mantienen fuera del frontmatter porque `spec:validate:strict` exige que `related_files` y `related_endpoints` existan. Pasan al frontmatter cuando el slice los cree.

- servicio y controlador del adaptador en el módulo nuevo del slice 1 (nombre en Q-1 del slice 1)
- contratos Zod en `packages/schemas/src/` (archivo tentativo)
- `apps/api/test/` (pruebas del adaptador, nombres tentativos)
- endpoint: `POST <prefijo>/omniverse/snapshot` (prefijo propio, sin rutas `@Public`)
