# docs/specs/ — Specs Formales SEMSE OS

Este directorio contiene los contratos ejecutables del sistema.
Son la fuente de verdad que gobierna el código.

**Template para nuevos specs:** `docs/specs/templates/semse-spec-template.md`
**Template Spec Kit:** `.specify/templates/overrides/semse-spec.md`
**Kit ecosistema SDD/SSD:** `docs/specs/SEMSE_ECOSYSTEM_SDD_KIT_2026-06-28.md`
**Índice completo:** `docs/SPEC_INDEX.md`
**Protocolo SDD:** `docs/SDD_GOVERNANCE.md`
**Validación:** `pnpm spec:preflight`

## Estructura

```
specs/
├── api/     ← Contratos de endpoints REST (input/output/errores/FSM/efectos)
├── fsm/     ← Máquinas de estado formales por entidad
├── ui/      ← Flujos de usuario por rol (client/pro/admin)
├── agents/  ← Arquitectura de agentes SEMSE
├── tools/   ← Specs ProTools por fase del Master Plan
└── archive/ ← Specs deprecated (no eliminar)
```

## Estado actual

Estado al 2026-06-09:

- `44` specs formales en `docs/specs`.
- `pnpm spec:preflight` pasa con `0` errores y `0` warnings.
- `communications` ya está `VERIFIED` por la cobertura de firma HMAC del webhook de WhatsApp.
- `field-ops`, `matching`, `reservations` y `jobs` ya están `VERIFIED` con pruebas de controller/RBAC y contratos de transición.
- No quedan specs marcados como `MISSING` en la matriz generada.
- Las fases futuras del Master Plan ProTools ya tienen specs `APPROVED` como contrato implementable.
- El trabajo pendiente ya no es crear archivos faltantes, sino implementar los bloques `PENDING` del Master Plan y elevar specs high/critical a `VERIFIED` con pruebas controller/RBAC/e2e suficientes.

## Specs prioritarios

| Spec | Estado | Prioridad |
|------|--------|-----------|
| `api/milestones.spec.md` | VERIFIED | Critico — mantener sincronizado con FSM y tests |
| `api/jobs.spec.md` | VERIFIED | Alto — marketplace/job lifecycle |
| `api/evidence.spec.md` | VERIFIED | Critico — evidencia y revision |
| `api/payments.spec.md` | VERIFIED | Critico — escrow/payments |
| `api/agents.spec.md` | APPROVED | Alto — runtime de agentes |
| `api/change-orders.spec.md` | VERIFIED | Alto — cambios de alcance y payment readiness |
| `api/field-ops.spec.md` | VERIFIED | Alto — tracker, worklogs y campo |
| `api/matching.spec.md` | VERIFIED | Alto — matching explicable |
| `api/reservations.spec.md` | VERIFIED | Alto — hold/accept/release/expire |
| `api/readiness.spec.md` | VERIFIED | Critico — readiness real para Railway y dependencias |
| `ui/work-os-navigation-decision-intelligence.spec.md` | APPROVED | Alto — navegacion Work OS y decision intelligence |

La matriz generada en `docs/SPEC_INDEX.md` es la fuente de verdad para el estado completo. Esta tabla solo resume specs prioritarios para trabajo activo.

Para crear un spec: usar `/speckit.specify` con template `semse-spec.md`.

## Validación ejecutable

Los specs se validan desde la raíz del monorepo:

```bash
pnpm spec:validate
pnpm spec:coverage
pnpm spec:preflight
```

`spec:validate` verifica estructura mínima, estados válidos y referencias declaradas.
`spec:validate:strict` activa el estándar completo de metadata canónica para migraciones o PRs que quieran cerrar todos los gaps.
