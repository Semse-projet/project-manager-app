# Reporte — Jev Decision Layer: cierre de Wave 0

- **Fecha:** 2026-09-24
- **Rama:** `claude/google-docs-link-f39dr2` (reiniciada desde `main@86aa5c4` tras el merge de #669)
- **Spec:** `docs/specs/prometeo/jev-decision-layer.spec.md` v1.1 §9
- **Origen:** handoff actualizado (§33–60, expansión de Jev al ecosistema)

## Por qué solo Wave 0

El handoff §57 exige cerrar cada wave con tests, **métricas de shadow** y
fallback verificado antes de empezar la siguiente. Las métricas de shadow
requieren la API real de Jev (no documentada) y una activación humana en
shadow. Por eso esta entrega completa la plataforma central (§34) y deja las
Waves 1–5 bloqueadas explícitamente.

## Módulos tocados

`apps/api/src/modules/ai-models/decision/*` (núcleo),
`ai-models.controller.ts` (router), `vision/vision-library.{service,controller}.ts`
(gate), `packages/db/prisma` (telemetría), `apps/api/scripts/jev-eval.mjs`.

## Decisiones / contratos nuevos

- `DecisionRequest` / `DecisionResult` (§34), `RiskSignals`, `FeaturePolicy` (rango de cautela y acciones de certeza por feature).
- Modo `shadow | live` por feature; el Vision Gate pasa a **shadow por defecto**.

## Invariantes

Registro con 8 invariantes (7 ejecutables + 1 estructural), cada una con su test:
- `MONEY_NO_DOWNGRADE`, `PERMISSION_DENIAL_NO_DOWNGRADE`, `IDENTITY_FAILURE_NO_DOWNGRADE`, `LEGAL_COMPLIANCE_NO_DOWNGRADE`, `SAFETY_CRITICAL_NO_DOWNGRADE`
- `IRREVERSIBLE_REQUIRES_DETERMINISTIC_AUTH`, `LOW_CONFIDENCE_NOT_CERTAINTY`
- `PROVIDER_FAILURE_FALLS_BACK` (estructural)

Cambios de comportamiento de los pilotos:
- **Router:** la regla ad-hoc de dinero se reemplazó por `MONEY_NO_DOWNGRADE`, que ahora también bloquea que Jev baje de ESCALATE a ASK_USER.
- **Gate:** Jev ya no puede aceptar un match `uncertain`.

## Flags

Nuevos (todos OFF / shadow por defecto):
- `SEMSE_JEV_VISION_GATE_MODE`
- `SEMSE_JEV_CANARY_USER_IDS`, `SEMSE_JEV_CANARY_ROLES`, `SEMSE_JEV_CANARY_PERCENT`
- `SEMSE_JEV_BREAKER_THRESHOLD`, `SEMSE_JEV_BREAKER_COOLDOWN_MS`

`SEMSE_JEV_AGENT_ROUTER_MODE` acepta además `live`.

## Migración y telemetría

- Migración aditiva `20260924210000_jev_decision_event_wave0` (§55).
- Toda la cadena de migraciones se aplica en Postgres local sin drift.

## Evaluación (harness §56)

Línea base determinista sobre las fixtures etiquetadas:
- **Router:** 0.864 de accuracy.
- **Vision Gate:** 0.929 de accuracy.

Con un Jev adversarial (siempre la acción más permisiva), el harness bloquea y cuenta todos los intentos inseguros:
- 3 de 3 en casos de dinero.
- 12 de 12 en casos de baja confianza.

## Estado shadow/canary

Código listo; nada activado. Para empezar a medir:
1. Conectar la API real de Jev (`jev.provider.ts`) y correr `pnpm --filter @semse/api jev:eval`.
2. En Railway: `SEMSE_JEV_ENABLED=true` + la feature en `true`, modo `shadow`, canary por `SEMSE_JEV_CANARY_ROLES=OPS_ADMIN` o por tenant interno.
3. Revisar `JevDecisionEvent` (agreement, invariantsViolated, fallbacks, p95) antes de pasar a `live`.

## Riesgos abiertos

- La API real de Jev sigue sin documentarse.
- El breaker es en memoria, por instancia.
- Volumen de filas en Vision con el gate activo: conviene usar canary.
- No existe dashboard; por ahora hay que consultar `JevDecisionEvent` con SQL.

## Siguiente wave

Wave 1 (Evidence Triage + Change Order Triage), solo después de revisar datos de shadow de Wave 0.
