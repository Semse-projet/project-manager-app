---
type: checklist
feature: "S1 SEMSE MCP project read"
spec: "docs/specs/platform/semse-mcp-project-read.spec.md"
version: "2.0"
date: "2026-10-15"
---

# Checklist de aceptación S1 — MCP Project Read

## Aprobación
- [ ] Spec + plan + tasks cerrados y aprobados por owner.
- [ ] ADR-025 aclarada para que publicar un MCP Server no conceda MCP Client externo.
- [ ] Contratos MCP, transporte, OAuth/audience/sesión, errores, límites y retiro definidos.
- [ ] Tool no inventa `title/summary`, D1–D7 resueltas.

## Autorización P0
- [ ] Usuario con `projects:read` y ownership real pasa.
- [ ] Usuario sin permiso denegado aunque use conector privilegiado.
- [ ] Tenant diferente / org diferente mismo tenant denegados.
- [ ] Token no vencido pero membresía revocada denegado.
- [ ] Headers arbitrarios y authContext forjado no conceden identidad.
- [ ] Project de Job eliminado denegado.
- [ ] Ningún GET MCP crea nueva identidad/organización.
- [ ] No salida de secretos, PII, otras org ni finanzas.
- [ ] 100% de métodos fuera de lectura bloqueados.
- [ ] Logs/audit real, contenido redacted, sourceRef y correlation trazables.

## Calidad/entrega
- [ ] Tests unit/API/MCP/end-to-end autenticados con 2 tenants/2 org.
- [ ] `pnpm spec:validate:strict` y `pnpm spec:index:check` verdes.
- [ ] Build/typecheck/lint/CI PASS en HEAD final.
- [ ] SHA merge/despliegues Railway separados; flag OFF por defecto.
- [ ] Canary autenticado real y negativa cross-tenant comprobada.
- [ ] Rollback probado y evidencia ligada al SHA.
- [ ] No declarar VERIFIED antes de CI, merge, deploy, activación y smoke.
