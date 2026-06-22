# Informe: Spec-Driven Development Hardening

**Fecha:** 2026-05-24
**Rama:** `feat/spec-driven-development-hardening`
**Estado:** implementado con validacion baseline

## Resumen ejecutivo

SEMSEproject ya tenia una base SDD fuerte: constitucion, gobierno, templates, `SPEC_INDEX.md` y specs por dominio. Este hardening agrega una capa ejecutable para que los specs puedan validarse, indexarse y medirse antes de merge o deploy.

El cambio no reescribe logica de negocio. Agrega scripts y documentacion para convertir los specs en contratos verificables.

## Estado inicial

- 21 specs detectados en `docs/specs/**/*.spec.md`.
- La mayoria ya declara `domain` y `status`.
- Ningun spec actual declara todavia la metadata canonica completa `related_files`, `related_tests`, `related_endpoints`, `related_events`, `related_agents` y `last_verified`.
- La cobertura declarada de tests desde metadata es 0/21.

## Cambios realizados

- Se agrego `docs/specs/templates/semse-spec-template.md` como plantilla canonica con metadata YAML.
- Se agrego `scripts/spec-lib.mjs` para leer specs, metadata YAML y metadata heredada.
- Se agrego `scripts/spec-validate.mjs` para validar estructura, estados y referencias declaradas.
- Se agrego `scripts/spec-index.mjs` para generar una matriz `Spec -> Code -> Test` dentro de `docs/SPEC_INDEX.md`.
- Se agrego `scripts/spec-coverage.mjs` para reportar gaps de cobertura SDD.
- Se actualizaron scripts raiz en `package.json`.
- Se actualizo `docs/SDD_GOVERNANCE.md` con reglas de metadata, gates y preflight.
- Se actualizo `docs/specs/README.md` con comandos ejecutables.
- Se actualizo `.github/workflows/ci.yml` para usar pnpm y ejecutar `pnpm spec:preflight` antes de `verify:workspace`.
- Se actualizo `.github/pull_request_template.md` con checklist SDD.

## Scripts agregados

```bash
pnpm spec:validate
pnpm spec:validate:strict
pnpm spec:index
pnpm spec:coverage
pnpm spec:preflight
pnpm railway:preflight
```

`spec:validate` corre en modo baseline para convivir con specs heredados.
`spec:validate:strict` exige la metadata canonica completa.
`railway:preflight` ejecuta `spec:preflight`, `typecheck`, `build:api` y `build:web`.

## Resultado de validaciones iniciales

```text
node ./scripts/spec-validate.mjs
Specs scanned: 21
Mode: baseline
Errors: 0
Warnings: 21
```

```text
node ./scripts/spec-coverage.mjs
Specs: 21
Specs with related_tests: 0/21 (0%)
Specs VERIFIED: 0/21 (0%)
Specs without related_files: 21
Specs without related_tests: 21
High/critical risk specs not VERIFIED: 1
```

`pnpm verify:workspace` no se usa como base de `railway:preflight` porque actualmente ejecuta tests de integracion de `@semse/api` que requieren Postgres local en `127.0.0.1:5433`. Ese fallo corresponde a entorno de test/DB, no a resolucion de paquetes internos ni a build de Railway.

## Resultado de validaciones finales

```text
node --check scripts/spec-lib.mjs
node --check scripts/spec-validate.mjs
node --check scripts/spec-index.mjs
node --check scripts/spec-coverage.mjs
Resultado: OK
```

```text
pnpm spec:preflight
Resultado: OK
Specs scanned: 21
Errors: 0
Warnings: 21
```

```text
pnpm typecheck
Resultado: OK
```

```text
pnpm test:unit
Resultado: OK
14 tests passed
```

```text
pnpm test
Resultado: OK
146 unit tests passed
12 E2E tests passed
```

```text
pnpm railway:preflight
Resultado: OK
Incluye: spec:preflight, typecheck, build:api, build:web
```

Nota: `next build` muestra un warning no bloqueante por `experimental.nodeMiddleware` en `next.config.ts`.

## Riesgos pendientes

- Los specs actuales todavia no tienen metadata canonica completa.
- No hay trazabilidad declarada `Spec -> Code -> Test` en metadata.
- Ningun spec esta en estado `VERIFIED`.
- El spec de arquitectura de agentes se clasifica como `critical` por prioridad P0 y necesita tests/owner/verification explicitos antes de usarlo como gate estricto.

## Regla operativa

Ningun cambio monetizable, endpoint, agente, evento SSE o pantalla critica debe pasar a merge sin trazabilidad `Spec -> Code -> Test`.

Ningun deployment a Railway debe ejecutarse si falla:

```bash
pnpm railway:preflight
```

## Proximos pasos recomendados

1. Migrar primero specs high/critical a metadata canonica completa.
2. Agregar `related_files` y `related_tests` a los specs de Payments, Evidence, BuildOps y Agents.
3. Elevar specs implementados a `IMPLEMENTED` solo cuando el mapa de archivos exista.
4. Elevar specs a `VERIFIED` solo cuando `related_tests` exista y pase en CI.
5. Cerrar gradualmente los warnings actuales y luego mover CI a `pnpm spec:validate:strict`.
