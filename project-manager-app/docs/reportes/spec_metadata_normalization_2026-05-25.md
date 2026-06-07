# Spec Metadata Normalization — 2026-05-25

## Resumen ejecutivo

Se cerraron los 21 warnings historicos de metadata canonica reportados por
`pnpm spec:preflight`. La rama normaliza los 21 specs existentes bajo el formato
SDD canonico y ajusta el validador para respetar listas canonicas vacias (`[]`)
como campos presentes, tal como define `docs/specs/templates/semse-spec-template.md`.

No se modifico logica de negocio, endpoints, Prisma, Angular, comunicaciones,
env examples, Hermes, Prometeo runtime ni React/Next.

## Rama

- Rama: `chore/spec-metadata-normalization`
- Base verificada: `main` en `c33cc6f fix(communications): verify whatsapp webhook signatures (#31)`

## Estado inicial

- `pnpm spec:preflight`: OK con 21 warnings.
- `pnpm spec:validate`: 21 warnings por campos canonicos faltantes.
- `pnpm spec:coverage`: 0/21 specs con `related_tests`, 21 specs sin `related_files`.

## Cambios realizados

### Validador SDD

- `scripts/spec-lib.mjs`
  - Reconoce `related_files`, `related_tests`, `related_endpoints`,
    `related_events` y `related_agents` como metadata presente si el campo existe
    en frontmatter, incluso cuando el valor es `[]`.
  - Esto evita inventar endpoints, eventos o agentes cuando un campo no aplica.

### Specs normalizados

- `docs/specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md`
- `docs/specs/api/buildops.spec.md`
- `docs/specs/api/communications.spec.md`
- `docs/specs/api/consciousness.spec.md`
- `docs/specs/api/contracts.spec.md`
- `docs/specs/api/disputes.spec.md`
- `docs/specs/api/evidence.spec.md`
- `docs/specs/api/intake.spec.md`
- `docs/specs/api/jobs.spec.md`
- `docs/specs/api/milestones.spec.md`
- `docs/specs/api/payments.spec.md`
- `docs/specs/api/prometeo.spec.md`
- `docs/specs/fsm/buildops-lifecycle.spec.md`
- `docs/specs/fsm/escrow-lifecycle.spec.md`
- `docs/specs/fsm/job-lifecycle.spec.md`
- `docs/specs/fsm/milestone-lifecycle.spec.md`
- `docs/specs/tools/fase-1/m1.1-material-pricing.spec.md`
- `docs/specs/ui/admin-flows.spec.md`
- `docs/specs/ui/client-flows.spec.md`
- `docs/specs/ui/intake-flow.spec.md`
- `docs/specs/ui/pro-flows.spec.md`

Cada spec ahora declara metadata canonica:

- `id`
- `title`
- `domain`
- `status`
- `owner`
- `risk`
- `related_files`
- `related_tests`
- `related_endpoints`
- `related_events`
- `related_agents`
- `last_verified`

Las rutas declaradas en `related_files` y `related_tests` apuntan a archivos o
directorios existentes del repo.

## Indice SDD

- `docs/SPEC_INDEX.md` fue regenerado con `pnpm spec:index`.

## Resultados

### Warnings

- Antes: 21 warnings.
- Despues: 0 warnings.

### Validaciones SDD

- `pnpm spec:validate`: OK, 0 errors, 0 warnings.
- `pnpm spec:validate:strict`: OK, 0 errors, 0 warnings.
- `pnpm spec:coverage`: OK.
  - Specs con `related_tests`: 21/21 (100%).
  - Specs sin `related_files`: 0.
  - Specs sin `related_tests`: 0.
  - Specs `VERIFIED`: 0/21.
  - Specs high/critical no `VERIFIED`: 17.
- `pnpm spec:preflight`: OK, 0 warnings.

## Validaciones generales

- `pnpm typecheck`: OK.
- `git diff --check`: OK.
- `pnpm test:unit`: falla por deuda previa de resolucion del root workspace:
  - `@semse/schemas`
  - `@semse/agents`
  - `@semse/knowledge`

El fallo de `pnpm test:unit` no fue introducido por esta rama; coincide con el
caveat ya observado en frentes anteriores.

## Riesgos pendientes

- 17 specs high/critical siguen en estado `APPROVED`, no `VERIFIED`.
- No se marcaron como `VERIFIED` para evitar sobredeclarar cobertura funcional
  sin ejecutar y revisar los tests especificos de cada dominio.
- Recomendacion: activar `spec:validate:strict` en CI despues de mergear esta
  rama; mantener `spec:coverage --fail-on-gaps` como fase posterior, cuando se
  cierre explicitamente la verificacion funcional de specs high/critical.

## Comandos ejecutados

```bash
git switch -c chore/spec-metadata-normalization
pnpm spec:preflight
pnpm spec:validate
pnpm spec:coverage
pnpm spec:validate:strict
pnpm spec:index
pnpm spec:coverage
pnpm spec:preflight
pnpm typecheck
pnpm test:unit
git diff --check
```

## Regla operativa

Los specs historicos ya no deben emitir warnings de metadata canonica. Los
specs nuevos deben partir de `docs/specs/templates/semse-spec-template.md` y
mantener `pnpm spec:validate:strict` en verde.
