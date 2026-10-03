---
id: "auth.session-revocation-architecture"
title: "Revocación inmediata de access tokens — decisión de arquitectura"
domain: "auth"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/auth/auth.repository.ts
  - apps/api/src/common/auth-token.ts
related_tests:
  - apps/api/test/auth-remediation.test.ts
  - apps/api/test/auth-token.test.ts
related_endpoints:
  - POST /v1/auth/logout
  - POST /v1/auth/refresh
related_events: []
related_agents: []
last_verified: "2026-07-23"
---

# Spec: Revocación inmediata de access tokens

## 1. Alcance

Este contrato aísla `0.3` de `docs/AUDIT_REMEDIATION_PLAN.md`.

No autoriza implementación todavía. El plan registra una decisión explícita
del 2026-07-21: no restaurar el lookup de `AuthSession` en Postgres para cada
request porque produjo timeouts de 15 segundos en Railway.

## 2. Estado actual y riesgo aceptado

- El JWT se valida criptográficamente y está ligado a `sid`.
- Logout y password reset revocan la sesión persistida y bloquean refresh.
- El access token ya emitido no consulta esa revocación y sigue válido hasta
  expirar.
- Login y registro pueden emitir access tokens con TTL de 8 horas.
- No existe hoy un endpoint de cambio de rol activo.

Por tanto, logout/reset tienen revocación diferida para access tokens. Esta
ventana es consciente, pero sigue siendo riesgo crítico sin una decisión de
arquitectura y SLO explícitos.

## 3. Opciones bajo revisión

| Opción | Seguridad | Disponibilidad/coste |
|---|---|---|
| Postgres por request | revocación inmediata | rechazada por incidente de latencia |
| Denylist `sid`/`jti` en Redis con TTL | inmediata mientras Redis responde | exige política ante caída y coherencia multi-región |
| Access token corto + refresh rotatorio | ventana acotada sin lookup por request | más refreshes y no es revocación instantánea |
| Token version por usuario con cache | invalida familias/roles | requiere cache coherente e invalidación fiable |

## 4. Decisiones requeridas

1. Latencia máxima aceptable de revocación para logout, reset y cambio de rol.
2. Store autoritativo de revocación y estrategia multi-región.
3. Comportamiento fail-open o fail-closed si el store no responde.
4. TTL productivo de access tokens normales y privilegiados.
5. Contrato de un futuro cambio de rol activo.
6. Métricas/SLO para latencia y errores de la verificación.

## 5. Criterios para pasar a APPROVED

- La opción elegida no reintroduce el lookup síncrono a Postgres que causó el
  incidente.
- Logout, reset y cambio de rol tienen una ventana documentada y testeable.
- Existe prueba de caída del store de revocación según la política elegida.
- La solución evita ampliar tenant, org o roles al refrescar.
- Hay plan de rollout, observabilidad y rollback.

## 6. Tests futuros obligatorios

- Access token anterior rechazado dentro del SLO de revocación.
- Refresh token revocado no rota.
- Caída de Redis/store sigue la política aprobada.
- Revocación multi-instancia y multi-región.
- Cambio de rol no conserva privilegios del rol anterior.

## 7. Rollback

Hasta aprobar esta spec se mantiene el comportamiento actual documentado. Un
rollback futuro nunca puede restaurar confianza en headers ni reactivar
refresh tokens revocados.
