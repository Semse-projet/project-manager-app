---
type: checklist
feature: "jev-decision-layer"
spec: "docs/specs/prometeo/jev-decision-layer.spec.md"
version: "2.0"
date: "2026-09-24"
---

# Checklist: Jev Decision Layer

## Seguridad / gobernanza
- [x] Jev no decide autorización, identidad, permisos, dinero, escrow, borrados, contratos, cumplimiento, secretos ni acceso admin (registro cerrado + test).
- [x] La capa no importa módulos sensibles (test de imports).
- [x] Gate `human_required` de pagos en chat intacto; Jev no puede rebajar un ESCALATE de dinero.
- [x] `JEV_AI_API_KEY` solo server-side (v1.3).
- [x] POST con resultado incierto no se reintenta; 429 respeta `Retry-After` (v1.3).
- [x] Flags OFF por defecto; nada se activa al mergear.

## Robustez
- [x] Fallback en: flags off, fuera de canary, no configurado, caído, timeout, formato inválido, baja confianza, invariante violada.
- [x] Fallos de telemetría no rompen la respuesta.

## Datos
- [x] Migración versionada, aplicada en Postgres real, sin drift.
- [x] Telemetría sin input crudo; `outcome` aislado por tenant.

## Entrega
- [x] Tests, typecheck, build, lint.
- [ ] CI verde en el PR.
- [ ] API real de Jev + activación canary (pendientes, decisión humana).
