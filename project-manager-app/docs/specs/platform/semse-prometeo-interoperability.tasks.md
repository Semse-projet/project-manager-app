---
type: tasks
feature: "SEMSE Prometeo Universal Connector interoperability program"
domain: "platform"
plan: "docs/specs/platform/semse-prometeo-interoperability.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/sdd-semse-prometeo-connector-consolidation-20261015"
date: "2026-10-15"
---

# Registro de tareas — programa de interoperabilidad

> Convención `[ ]` pendiente; `[x]` evidencia documental completa; `[~]` bloqueada. Sólo S0 está abierto a trabajo documental; **no implementar S1+ hasta child spec APPROVED**. Tareas de PR documental no acreditan ejecución productiva.

## S0 — fuentes y límites de decisión (P0)

- [x] P0-001 Localizar PR #797 (fusionado) y contrato `platform.universal-connector-trust`.
- [x] P0-002 Localizar PR #859 y verificar su carácter documental.
- [x] P0-003 Confirmar opción C de ADR-025 (11-oct-2026).
- [x] P0-004 Detectar dos ADR-042 con decisiones diferentes.
- [x] P0-005 Leer Constitución, SDD Governance 2.0 y plantillas canónicas.
- [ ] P0-006 Reconciliar commit HEAD, rama, índice y evidencias SHA/CI/merge/deploy Railway.
- [ ] P0-007 Auditar código actual del Tool Registry F2: rutas, Policy/Approval y PrometeoToolInvocationAudit.
- [ ] P0-008 Auditar distintos entrypoints Prometeo y UI consumers (ADR-038); producir matriz AS-IS.
- [ ] P0-009 Auditar adapters CRM/ERP, webhooks, REST, GraphQL, administración integraciones y trust-runtime reales.
- [ ] P0-010 Resolver ADR-042 duplicado con renumeración, backlinks e historial.
- [ ] P0-011 Solicitar resolución formal de ADR-025 si se activa S2; mantener opción C mientras tanto.
- [ ] P0-012 Confirmar autoridad por org/ownership y estado Workspace F10/ADR-040.
- [ ] P0-013 Comparar metadata `universal-connector-trust.spec.md` contra merge #797/CI/runtime sin atribuir despliegue ficticio.
- [ ] P0-014 Cerrar conflictos y decisión de arquitectura mínima en acta.

## Preparación de specs hijas (P0)

- [ ] P0-020 Derivar child spec S1 MCP Server read-only (contratos API, esquemas, error semantics, autorización, auditoría).
- [ ] P0-021 Derivar child spec S2 MCP Client externo, bloqueada hasta revisión ADR-025.
- [ ] P0-022 Derivar child spec S3 MCP Apps UI host-compatible y CSP/fallback.
- [ ] P0-023 Derivar child spec S4 Workspace Integraciones org-aware.
- [ ] P0-024 Derivar child spec S5 writes con aprobación, idempotencia y límites, sin pagos.
- [ ] P0-025 Actualizar índice con `pnpm spec:index`; validar `pnpm spec:validate:strict`, sin inventar resultados.
- [ ] P0-026 Obtener aprobación SDD explícita y definir owners por slice.

## S1 — primera integración verificable (después de APPROVED)

- [ ] P1-001 Seleccionar una ruta real `get_project` con permiso de lectura por recurso; fijar esquema Zod y tool manifest.
- [ ] P1-002 Escribir pruebas negativas primero: tenant A/B, org A/B mismo tenant, recurso no compartido, permiso revocado.
- [ ] P1-003 Escribir tests de autenticación, read-only, malformed input, rate limit, error neutro, auditoría y secret redaction.
- [ ] P1-004 Implementar adaptador MCP Server fino hacia API/Tool Registry/Policy sin consultas DB directas.
- [ ] P1-005 Verificar 100% de calls con auditRef/correlation y 0 exposiciones de secretos.
- [ ] P1-006 Ejecutar typecheck, lint, build, tests dirigidos/regresión y spec tooling.
- [ ] P1-007 PR revisado, CI terminal, merge SHA, deploy staging/production con flags OFF.
- [ ] P1-008 Canary autenticado; 2 tenants y 2 org del mismo tenant, revocación, logs/evidence, rollback.
- [ ] P1-009 Actualizar estado SDD real sólo con recibo SHA+CI+deploy+smoke.

## S2 — salida a herramientas externas (bloqueado por ADR-025)

- [~] P2-001 Actualizar decisión ADR-025 para caso concreto y aprobar child spec crítica.
- [ ] P2-002 Elegir un proveedor MCP externo y capability mínima.
- [ ] P2-003 Construir allowlist de egreso, verificación URL/IP/DNS/redirect y secretos opacos.
- [ ] P2-004 Implementar MCP Client como adapter bajo Tool Registry + Universal Connector Trust.
- [ ] P2-005 Pruebas de confused deputy, prompts hostiles, scopes, tokens expirados/revocados, SSRF y audit.
- [ ] P2-006 Canary/rollback y evidencia del proveedor real sin mocks visibles.

## S3 — MCP Apps y UX

- [ ] P3-001 Seleccionar host que soporte MCP Apps; verificar plan/versión real.
- [ ] P3-002 Publicar recurso `ui://` read-only, sandbox/CSP y contratos de interacción; no nuevas business APIs.
- [ ] P3-003 Validar fallback textual sin UI y accesibilidad móvil.
- [ ] P3-004 Validar permisos, org, secretos, errores y aislamiento visual con pruebas autenticadas.
- [ ] P3-005 Registrar evidencia del canary y compatibilidad por host; no anunciar portabilidad universal.

## S4 — Workspace multi-org

- [ ] P4-001 Reusar `Settings → Integraciones` y control plane, evitando nuevo registro de proveedores.
- [ ] P4-002 Aislar contexto org/project de Workspace y revocar acceso al cambiar membresía.
- [ ] P4-003 Definir migración expand/contract sólo si modelo/estado persistido lo exige.
- [ ] P4-004 Tests de ACL, UI/errores, selección de Org, scopes y secretos nunca expuestos.

## S5 — operaciones con efectos

- [ ] P5-001 Seleccionar mutación de bajo riesgo; pagos/escrow/firmas quedan excluidos.
- [ ] P5-002 Human Approval canónico, no autoaprobación de Prometeo.
- [ ] P5-003 Idempotencia duradera por key/fingerprint; replay 10x = una acción; conflicto de key falla.
- [ ] P5-004 Tests concurrentes, compensación y fault injection, métricas, auditoría, kill switches.
- [ ] P5-005 Canary por tenant/capability y reversión comprobada.

## S6 — partner ecosystem (futuro)

- [ ] P6-001 Catálogo/alta de proveedores, acuerdos, cuotas, facturación y compliance en specs separadas.
- [ ] P6-002 Asegurar aislamiento y revocación de conexiones de terceros antes de apertura comercial.

## Cierre y evidencias por slice

- [ ] Spec hija indexada y APPROVED.
- [ ] Tests derivados: seguridad, autorización, datos y UX, green en release SHA.
- [ ] `pnpm spec:validate:strict`, build/typecheck/lint sin regresiones.
- [ ] CI PASS, merge SHA, deployments terminales, health y smoke autenticado documentados separadamente.
- [ ] Activación CANARY/ACTIVE limitada y trazada; rollback ensayado.
- [ ] `production_evidence` y `last_verified` sólo tras observación real.
