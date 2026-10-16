---
type: tasks
feature: "S1 SEMSE MCP project read"
domain: "platform"
plan: "docs/specs/platform/semse-mcp-project-read.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/sdd-semse-prometeo-connector-consolidation-20261015"
date: "2026-10-15"
---

# S1 Tareas — MCP Server de lectura de proyecto

## Autorización del propietario (15-oct-2026)

- [x] Aprobado `SEC-S1-01`: OAuth vinculado a SEMSE, scopes mínimos y revocación; **no implementado**.
- [x] Aprobado `SEC-S1-02`: cero creación de Tenant/Org/User o mutación por lectura MCP; **no implementado**.
- [x] Aprobado `SEC-S1-03`: aislamiento tenant/org/membership/recurso cada invocación; **no implementado**.
- [ ] Resolver D1–D7 y aceptar formalmente ADR-045 con revisión de seguridad antes de pasar S1 a APPROVED.
- [ ] Ejecutar pruebas autenticadas reales para los tres invariantes y registrar evidencia de no-mutación, revocación e isolation.

## SDD y permisos
- [ ] S1-001 Resolver decisiones D1–D7 del child spec y obtener `APPROVED`.
- [ ] S1-002 Reconciliar ADRs y verificar `main`, CI, Railway y estado de Universal Connector.
- [ ] S1-003 Auditar `authContext`, token issuer/audience, membership y auto-upsert de actor.
- [ ] S1-004 Fijar entrada, salida, errores MCP y esquema Zod; registrar `sourceRef/auditRef` reales.
- [ ] S1-005 Mantener `SPEC_INDEX` generado y `pnpm spec:validate:strict` PASS.

## Test-driven antes de código
- [ ] S1-010 Fixtures de 2 tenants y 2 orgs mismo tenant.
- [ ] S1-011 Actor propio lee; tenant distinto 404/no leak; org ajena niega.
- [ ] S1-012 Membership revocada/rol cambiado con token vigente rechaza.
- [ ] S1-013 Credenciales inválidas, expiradas, audience incorrecta, identidad falsa y `authContext` manipulado rechazan.
- [ ] S1-014 GET sin aprovisionamiento de usuario/org/tenant por la invocación MCP.
- [ ] S1-015 Query soft-delete; ProjectRecord allowlist sin PII/org privado/finanzas.
- [ ] S1-016 Flags OFF, conexión suspendida/revocada, rate-limit, error de red, logging/audit.
- [ ] S1-017 Todas las variantes write/delete/sync no ejecutan.

## Implementación, solo luego de aprobación
- [ ] S1-020 Tool versionada en registry + adapter thin + transporte MCP con host elegido.
- [ ] S1-021 Reusar proyectos y resource ownership, contexto del actor derivado de sesión confiable.
- [ ] S1-022 Sanitizar payload/respuestas/errores; correlation y audit referenciado.
- [ ] S1-023 Implementar flags/contención y límites; no habilitar por defecto.

## Entrega y operaciones
- [ ] S1-030 Typecheck/build/lint/tests + SDD strict + spec:index + CI PASS.
- [ ] S1-031 PR de código propio, aprobación seguridad, merge SHA.
- [ ] S1-032 Railway terminal, health, prueba autenticada cross-tenant/org, auditar registros.
- [ ] S1-033 Canary allowlisted, rollback real y evidencia; actualizar spec a VERIFIED solo si corresponde.
