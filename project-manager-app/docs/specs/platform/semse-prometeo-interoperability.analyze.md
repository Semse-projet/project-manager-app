# Analyze — SEMSE/Prometeo/Universal Connector/MCP (2026-10-15)

**Fuente:** `platform.semse-prometeo-interoperability`. **Alcance:** análisis estático de documentos y PRs GitHub disponibles; **no se ejecutaron tests, CI, consultas de DB ni smoke Railway** durante esta preparación. El análisis no aprueba diseño pendiente.

## 1. Matriz AS-IS vs TO-BE

| Componente | Evidencia actual | Objetivo TO-BE | Brecha y riesgo | Acción |
|---|---|---|---|---|
| SEMSE core (API/Prisma/FSM) | Constitución: `apps/api` único dueño de negocio | Toda tool delega al servicio canónico | Evitar segundo kernel | Ningún dominio en adaptador |
| Prometeo Tool Registry F2 | Spec aprobada y rutas `v1/prometeo/tools`, `/invoke` | Manifest de capacidades internas/externas bajo Policy | Wiring/reachability deben verificarse contra HEAD | Auditar antes de registrar |
| Prometeo Copilot/orquestación | ADR-038: rutas API+BFF sin consumidor UI en algunas superficies | Copiloto común, no implementación duplicada | APIs «hechas» no necesariamente visibles | Reutilizar o justificar cambios |
| Universal Connector Trust | PR #797 MERGED; `packages/shared/src/universal-connector/**` y tests autoría | Control único provider-neutral, fail-closed | Metadata spec desactualizada o contradictoria; runtime desconocido | Conciliar con SHAs y evidencias |
| Settings → Integraciones | `admin-integrations.service.ts`, `admin/settings/page.tsx`; tenant-wide | Configuración por organización autorizada | Roles por tenant no equivalen a org | Child spec S4 |
| MCP Server SEMSE | No se acreditó gateway desplegado | Publicar tools SEMSE read-only | authz, trazabilidad, host/client | S1 |
| MCP Client Prometeo | ADR-025 opción C excluye creación | Consumir tools externas aprobadas | Falta decisión formal, egress y consentimiento | Reabrir ADR, S2 |
| MCP Apps | Sin evidencia de `ui://` productivo | UI opcional host-compatible | CSP/sandbox/host support | S3 |
| CRM/ERP existentes | Adapter infrastructure mencionada en PR #797 / Workspace | Reutilizar connectors | Inventario y status connection/tenant ausentes | Auditoría S0 |
| ADR-042 | Colisión histórica de dos decisiones | ADR-044 propuesto para grafo, ADR-042 reservado a conector | Corregir backlinks y ratificar solo mediante aprobación propia | Gobernanza S0 |

## 2. Contradicciones explícitas

**C-01 (HIGH):** PR #797 fusionado frente a `universal-connector-trust.spec.md` con `merge_status: UNMERGED` y `ci_status: FAIL`. No cambiar estado CI/deploy por inferencia; revisar HEAD, revisión efectiva, SHA, pipeline, Railway.

**C-02 (CRITICAL GOVERNANCE):** la colisión entre dos `ADR-042` se reconcilia documentalmente con `ADR-044-operational-intelligence-graph.md` y un acta de procedencia; no cambia el estado PROPOSED de la decisión del grafo. Confirmar CI y merge del PR de seguimiento.

**C-03 (CRITICAL DECISION):** ADR-025 aceptó opción C de aplazar MCP Client externo el 2026-10-11; el nuevo programa describe S2 prospectivo. **No implementar S2 antes de nueva decisión**. No cambiar ADR retrospectivamente.

**C-04 (HIGH):** PR #859 solo documentación. Si Workspace/Integraciones carece de ACL por org, no presentar diseño UI como feature activa.

**C-05 (HIGH):** varias rutas Prometeo registradas sin consumer UI. Un registro de tool o endpoint no demuestra ejecución end-to-end.

## 3. Análisis de amenazas y mitigación

| Amenaza | Probabilidad/impacto | Invariante | Test obligatorio |
|---|---|---|---|
| Cross-tenant u org en misma tenancy | Alta/crítica | Actor/runtime/resource/Org resueltos por backend | 2 tenants × 2 org; API/MCP 404 homogéneo |
| Confused deputy por token global | Media/crítica | Scopes de delegación ≤ usuario y conexión | actor sin permiso + conexión privilegiada = deny |
| Prompt injection de terceros | Alta/alta | Datos externos nunca Policy/Approval | Instrucción maliciosa no cambia decision |
| SSRF, redirect/DNS rebinding | Media/crítica | Egress allowlisted con resolución segura | metadata/private hosts/redirect rechazados |
| Secrets/PII en chat/UI/logs | Media/crítica | Secret refs opacos y proyección mínima | secret scan, log snapshot, UI test |
| Sync o write duplicado | Alta/alta | durable claim y fingerprint | reintentos 10x y crash recovery |
| Revocación no efectiva | Media/crítica | status ACTIVE requerido en cada invocación | token válido + conexión revocada = deny |
| Pago/Evidence aprobado por IA | Baja/crítica | autoridad dominio + Human Approval | llamada MCP sin aprobación no muta |

## 4. Revisión de consistencia SDD

- Constitución I/II: spec antes de código, tests derivados → cumple el borrador; requiere aprobación de child specs.
- Constitución IV/V/VI/VII: Payment Governance, AuditLog, RBAC y multi-tenancy → especificados como controles obligatorios.
- Constitución X: API único backend de negocio → adaptadores MCP sólo transporte, consistente.
- `SDD_GOVERNANCE`: flujo spec/plan/tasks/analyze/checklist y separación de estados → archivos propuestos, pendiente ejecutar validador.
- `SOURCE_OF_TRUTH`: código, CI, producción y documento no son la misma evidencia → estado no certificado.
- ADR-042 Trust: Policy/Approval externos al adaptador → consistente.
- ADR-025: conflicto deliberadamente abierto para S2, **bloquea implementación externa**.

## 5. Decisiones necesarias

| ID | Decisión concreta | Recomendación | Gate |
|---|---|---|---|
| D1 | Resolver dos ADR-042 | Mantener Universal Connector en ADR-042 y mover grafo propuesto a ADR-044 con acta y backlinks | S0 |
| D2 | MCP Server read-only interno | Autorizar derivar una child spec sin autorizar S2 | S1 |
| D3 | MCP Client externo vs ADR-025 | Amendment con caso real, Policy/egress y owner explícitos | S2 |
| D4 | Arquitectura de herramienta | Tool Registry F2 + Universal Connector Trust; no nuevo policy engine | S0 |
| D5 | Organización/permisos | ACL derivada del backend, no del selector UI | S4 |
| D6 | UI host | Adaptación opcional con fallback, validar cada host | S3 |
| D7 | Fecha real de deploy y estados de Connector | Reconstruir CI/commit/prod; no reetiquetar VERIFIED por merge | S0 |
| D8 | Primera tool | Resumen autorizado de proyecto, lectura solamente | S1 |

## 6. Límites de verificación

Esta revisión **sí** comprobó archivos y metadatos de GitHub citados por ruta/PR; **no** comprobó si sus tests pasan ahora, cómo está su despliegue Railway ni la conexión real de usuarios. Ningún `APPROVED`, `IMPLEMENTED` ni `VERIFIED` de child spec deriva de este informe. Siguiente acción verificable: auditoría S0 con commit SHA de `main` y recibos de pipeline/runtime; después aprobación de S1.
