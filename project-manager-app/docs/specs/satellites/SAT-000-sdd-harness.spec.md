---
id: "satellites.sdd-harness"
title: "SAT-000 — Proceso SDD + arnés de verificación para integraciones satélite"
type: spec
domain: "agents"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - docs/SDD_GOVERNANCE.md
  - docs/agents/harnesses/SEMSE_ECOSYSTEM_WORK_AGENT_HARNESS_2026-06-28.md
  - docs/specs/autonomy/permanent-loops.spec.md
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-07-12"
---

# Spec: Proceso SDD + arnés de verificación para satélites

## Problem Statement

Las integraciones satélite tocan sistemas **fuera** del monorepo (Lambda de Alexa,
app móvil, graphify, storage local). El SDD y el arnés actuales solo gobiernan código
interno; sin una extensión explícita, las conexiones externas volverían al vibe coding
que `SDD_GOVERNANCE.md` prohíbe.

## Scope

- In scope: flujo SDD aplicado a satélites, definición del arnés de verificación por integración, criterios de promoción DRAFT→APPROVED→VERIFIED.
- Out of scope: el contenido de cada integración (specs SAT-001..008).

## 1. Flujo SDD para satélites (extensión del flujo canónico)

```
constitution → specify → plan → tasks → analyze → implement → validate → report
```

Con estas reglas adicionales:

1. **Un spec por satélite.** Ningún satélite se conecta sin spec en `docs/specs/satellites/` listado en SPEC_INDEX.
2. **El contrato vive en SEMSE.** El spec define el contrato del lado SEMSE (endpoints, scopes, eventos). Los cambios del lado satélite se documentan en la sección "Lado satélite" del spec, pero el monorepo nunca depende de código del satélite.
3. **Asimetría de confianza.** Todo satélite se trata como cliente no confiable: token con scopes mínimos, rate limit, validación Zod en frontera, nunca secretos compartidos más allá del token propio.
4. **`implement` en dos mitades:** primero lado SEMSE (mergeable y testeable solo), después lado satélite. Nunca en el mismo PR.
5. **`validate` exige el arnés completo (§2)** antes de marcar el spec VERIFIED.
6. **`report`:** actualizar `SATELLITES.md`, SPEC_INDEX (`pnpm spec:index`) y ADR si hubo decisión arquitectónica.

## 2. El arnés de verificación (obligatorio por integración)

Hereda del verification loop SPEC-AGT-001 y de los harness docs de `docs/agents/harnesses/`.
Cuatro anillos; una integración pasa el arnés cuando los cuatro están en verde:

### Anillo 1 — Contrato (unit/contract tests, en el monorepo)
- Tests de contrato del endpoint/scope que consume el satélite (request/response Zod).
- Test de autorización: token del satélite **rechazado** fuera de sus scopes (caso negativo obligatorio).
- Test de revocación: token revocado → 401 en toda la superficie.

### Anillo 2 — SDK (en el paquete del SDK)
- Cada método del SDK usado por el satélite tiene test contra un mock del contrato del Anillo 1.
- Versionado semver: romper el contrato exige major bump + entrada en CHANGELOG del SDK.

### Anillo 3 — E2E local
- Script `pnpm sat:e2e -- <satelite>` que levanta API local y ejecuta el flujo real del satélite (o su simulador: p. ej. request firmado tipo Alexa, cliente móvil headless).
- Debe cubrir el happy path completo + 1 fallo de red + 1 token inválido.

### Anillo 4 — Smoke en Railway
- Checklist de smoke contra prod con el token real del satélite (patrón de los smoke tests de sesiones previas).
- Verificación en Observer: el nodo satélite reporta heartbeat (cuando SAT-008 esté activo).
- Evidencia: salida pegada en `docs/reportes/` con fecha.

### Kill switch
Toda integración satélite se registra detrás de un flag `SATELLITE_<NOMBRE>_ENABLED`
(patrón `AUTONOMY_LOOPS_ENABLED` de SPEC-AUT-001). Apagar el flag desconecta el
satélite sin deploy.

## 3. Estados de un satélite

```
DRAFT ──(spec aprobado)──► APPROVED ──(anillos 1-3 verdes)──► CONNECTED-STAGING
   ──(anillo 4 verde + flag ON)──► LIVE ──(flag OFF / token revocado)──► SUSPENDED
   ──(decisión de archivo)──► ARCHIVED
```

`SATELLITES.md` es la fuente de verdad del estado; Observer debe coincidir (SAT-008).

## 4. Acceptance Criteria

- [ ] `docs/specs/satellites/` registrado en SPEC_INDEX.
- [ ] Template de arnés reproducible: cualquier integración nueva puede copiar los 4 anillos.
- [ ] Existe `SATELLITES.md` con la FSM de estados de §3.
- [ ] Flag kill-switch definido y documentado por satélite antes de LIVE.
- [ ] Ninguna integración marcada VERIFIED sin evidencia de anillo 4 en `docs/reportes/`.
