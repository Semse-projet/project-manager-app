# docs/specs/ — Specs Formales SEMSE OS

Este directorio contiene los contratos ejecutables del sistema.
Son la fuente de verdad que gobierna el código.

**Template para nuevos specs:** `docs/specs/templates/semse-spec-template.md`
**Template Spec Kit:** `.specify/templates/overrides/semse-spec.md`
**Índice completo:** `docs/SPEC_INDEX.md`
**Protocolo SDD:** `docs/SDD_GOVERNANCE.md`
**Validación:** `pnpm spec:preflight`

## Estructura

```
specs/
├── api/     ← Contratos de endpoints REST (input/output/errores/FSM/efectos)
├── fsm/     ← Máquinas de estado formales por entidad
├── ui/      ← Flujos de usuario por rol (client/pro/admin)
└── archive/ ← Specs deprecated (no eliminar)
```

## Estado actual de specs P1

| Spec | Estado | Prioridad |
|------|--------|-----------|
| `api/milestones.spec.md` | 🔴 MISSING | P1 — próximo a crear |
| `api/jobs.spec.md` | 🔴 MISSING | P1 |
| `api/evidence.spec.md` | 🔴 MISSING | P1 |
| `api/payments.spec.md` | 🔴 MISSING | P1 |

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
