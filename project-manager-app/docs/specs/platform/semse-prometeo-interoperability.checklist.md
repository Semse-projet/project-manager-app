---
type: checklist
feature: "SEMSE Prometeo Universal Connector interoperability program"
spec: "docs/specs/platform/semse-prometeo-interoperability.spec.md"
version: "2.0"
date: "2026-10-15"
---

# Checklist — consolidación de SEMSE, Prometeo y MCP

> Lista de comprobación separada por **gates de documentación**, **implementación de cada slice** y **producción**. No marcar «hecho» con base en intención, título de PR o documentos históricos.

## A. Programa documental S0

- [x] Identidad acordada: SEMSE = ecosistema; Prometeo = copiloto; Universal Connector = trust boundary; MCP = protocolo; MCP Apps = UI opcional.
- [x] Backends de negocio y owners permanecen canónicos; sin segundo policy engine.
- [x] Fuente `SDD_GOVERNANCE.md` leída y estados separados.
- [x] PR #797 ubicado como fusionado; metadata Universal Connector contradictoria anotada.
- [x] PR #859 ubicado como únicamente documental.
- [x] ADR-025 identifica opción C (MCP externo aplazado) y requiere reevaluación formal.
- [x] Colisión ADR-042 registrada como impedimento.
- [ ] Capturar HEAD SHA exacto y matrices contra código actual, CI y Railway.
- [ ] Reparar identificadores ADR-042 con backlinks y referencia en índice, sin reescribir historial.
- [ ] Verificar Universal Connector en CI y runtime; actualizar metadata sólo con evidencia.
- [ ] Auditar Prometeo Orchestration/Copilot y Tool Registry F2 para evitar duplicaciones.
- [ ] Confirmar permisos multi-org F10/ADR-040 antes de permitir administración por organización.
- [ ] Documentar decisión de owner para S1 read-only y revisión de ADR-025 para S2.
- [ ] Generar `docs/SPEC_INDEX.md` con `pnpm spec:index`, pasar `pnpm spec:validate:strict`.
- [ ] Obtener revisión de seguridad/arquitectura y aprobación explícita del SDD padre.
- [ ] Derivar children con plan, tasks, analyze, checklist y contratos/riesgos por slice.

## B. Contratos y seguridad antes de implementar child spec

- [ ] Tool manifest tiene nombre versionado, esquema Zod y clasificación read/write.
- [ ] Roles/permisos exactos por endpoint; actor, tenant, org, ownership por backend.
- [ ] Ningún ID de org/tenant provisto por cliente se trata como autoridad.
- [ ] Policy/Approval no son implementados en MCP ni delegados al LLM.
- [ ] Conexión ACTIVE y scopes/capability precisos antes de cada ejecución.
- [ ] Delegación humana → agente: no transitiva, acotada por propósito/expiry/recurso.
- [ ] OAuth/consentimiento por proveedor, secretos opacos en backend y revocación real.
- [ ] Rate limits y límites de costo/registros, kill switch y seguimiento.
- [ ] Rechazo de SSRF/IP privada/metadata/redirect/DNS rebinding en S2.
- [ ] UI sandbox/CSP y fallback textual en S3, compatibilidad host confirmada.
- [ ] READ_ONLY de S1 bloquea completamente escrituras y acciones económicas.
- [ ] Datos externos etiquetados no confiables, nunca Policy.
- [ ] Migraciones sólo si child las requiere, expand/contract, checksum y rollback.
- [ ] Eventos/outbox e idempotency durable cuando cambie estado.

## C. Matriz de pruebas con resultado verificable

- [ ] Autenticación ausente/expirada, sesión revocada y permiso faltante rechazados.
- [ ] Tenant A→B denegado antes de invocar servicio de negocio.
- [ ] Org A→B del mismo tenant denegado; usuario multi-membership conserva scopes correctos.
- [ ] Proyecto inexistente/ajeno no revela existencia ni contenido.
- [ ] Conexión SUSPENDED/DEGRADED/REVOKED bloqueada incluso con token del host activo.
- [ ] Attempt write/delete/sync/execute en read-only = rechazo y cero mutación.
- [ ] Payload prompt-injection no altera permisos ni aprobación.
- [ ] Secret scan/log/output y evidencia sin PII/credenciales.
- [ ] Egress deniega URL no permitida, localhost, metadata y redirect sospechoso.
- [ ] Reintento 10 veces = una sola escritura cuando S5 exista; key/fingerprint mismatch = conflicto.
- [ ] Aprobación humana obligatoria y auditable para S5; ninguna release escrow implícita.
- [ ] MCP Apps degradan a texto de forma funcional cuando host no soporta UI.
- [ ] Correlation/decision/audit refs rastrean acción autorizada de extremo a extremo.

## D. Entrega independiente por slice

- [ ] Spec hija `APPROVED`, owner y review sign-off explícitos.
- [ ] Tests rojos antes de implementar; sin mocks en caminos productivos.
- [ ] Dirigidos, regresión, build/typecheck/lint, spec validator y coverage ejecutados.
- [ ] PR y comentarios resueltos; CI terminal PASS contra último head SHA.
- [ ] Merge y SHA comprobados de forma independiente.
- [ ] Railway cada servicio afectado en deploy terminal; health/readiness reales.
- [ ] Canary de alcance limitado con login auténtico y permisos multi-tenant/org.
- [ ] Logs/metrics/SLO y señales de rollback; feature flag por conexión/tenant.
- [ ] Rollback o pausa demostrados; no volver a endpoint legacy desprotegido.
- [ ] `production_evidence`, `last_verified` y `CANONICAL_STATE_REGISTRY.md` actualizados sin inventar recibos.
- [ ] Sólo tras cadena completa: `status: VERIFIED` para el alcance aprobado.

## E. No hacer todavía

- No modificar código productivo ni habilitar MCP externo sin resolver ADR-025.
- No declarar certificadas las interfaces de Workspace por el PR #859.
- No conectar proveedores CRM/ERP arbitrarios ni importar datos de otras empresas sin policy.
- No autorizar pagos, escrow, firmas o cambios de Evidence por interfaz/LLM.
- No afirmar que todos los hosts ChatGPT/Claude soportan MCP Apps.
- No reemplazar módulo existente por otra implementación solo porque el nuevo protocolo sea popular.

**Resultado del PR documental:** paquete REVIEW apto para revisión arquitectónica; no equivale a `APPROVED`, `IMPLEMENTED` ni `VERIFIED`.
