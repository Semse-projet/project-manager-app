# Kit de calidad SEMSE

**Estado:** fase 1 entregada en rama (`claude/replica-skill-repo-bpdobu`), pendiente de CI, revisión y merge. **Fecha:** 2026-10-20.

Kit propio de SEMSE para investigar, comparar, probar y validar cambios hechos por personas, Claude, Codex u otros agentes, siempre bajo las reglas de `AGENTS.md` y `semseproject`. Toma las mejores capacidades del pack externo **replica-skill** sin instalar sus 11 skills, sin reemplazar ninguna skill SEMSE existente y sin tocar la aplicación en funcionamiento.

## Las cuatro skills

| Skill | Pregunta que responde | Herramientas | Se apoya en |
|---|---|---|---|
| `semse-recon` | ¿Qué hace la plataforma de referencia (o nuestro módulo) y qué piden sus usuarios? | `reviews.py`, `themes.json` | `semse-spec-kit-flow`, `semse-business-flow-e2e` (mapa F01–F36) |
| `semse-parity-audit` | ¿Qué existe en SEMSE, qué falta y qué conviene mejorar, con evidencia? | `parity.py`, `imgdiff.py` | `IMPLEMENTATION_STATUS_MATRIX.md`, specs |
| `semse-functional-test` | ¿Funcionan los flujos reales por rol, idioma y organización? | Playwright del repo | `semse-business-flow-e2e`, `semse-synthetic-test-data` |
| `semse-release-gate` | ¿Este PR rompe contratos, traducciones, seguridad o accesibilidad? | `contrast.py`, `semse-tokens.mjs` | `semse-ci-pr-workflow`, `semse-railway-release-verification` |

Flujo típico: `semse-recon` → `semse-parity-audit` → spec (`semse-spec-kit-flow`) → implementación por la skill de dominio → `semse-functional-test` → `semse-release-gate` → revisión humana. Cada skill se puede usar por separado.

## Origen y auditoría de replica-skill

- **Fuente:** <https://github.com/Jakeschincariol/replica-skill>, commit `77c9436fb3d18c3d58169efb8caf4fe906b0dc51` (2026-10-03), licencia MIT. Copia de la licencia en cada carpeta `scripts/` que contiene código del pack (`LICENSE.replica-skill`).
- **Auditado:** los 11 `SKILL.md`, plantillas y 6 herramientas Python. Las herramientas usan sólo la biblioteca estándar, no importan módulos de red ni de procesos (`urllib`, `socket`, `http.client`, `subprocess`) y sólo escriben donde se les indica con `--out`. `tests/unit/semse-kit-contract.test.mjs` vuelve a comprobarlo en cada ejecución de `pnpm test:unit`.
- **Adoptado tal cual:** `parity.py`, `imgdiff.py`, `reviews.py` + `themes.json`, `contrast.py`, y sus tests upstream (39 casos) con un `_load.py` adaptado.
- **Adaptado:** método de recon, plan de pruebas, formato de bug y severidad S1–S4, idea de *preflight* que detiene ante cualquier fallo.
- **Descartado, y por qué:**

  | Skill del pack | Motivo |
  |---|---|
  | `replica-architect` | Asume Next.js + Supabase + Vercel y “una sola base de datos”. SEMSE ya tiene arquitectura (NestJS, Prisma, BullMQ, Railway). |
  | `replica-build` | Pasa del recon al código saltándose el spec aprobado (prohibido por `AGENTS.md`). |
  | `replica-backend` | Pagos con Stripe sin escrow ni `paymentGovernance`, y migraciones SQL fuera del flujo Prisma. |
  | `replica-deploy` | Toca DNS, variables de producción y modo live. Choca con la regla NUNCA sobre Railway y CI/CD; ya lo cubre `semse-railway-release-verification`. |
  | `replica-brand`, `replica-launch` (+ `sweep.py`, `listing.py`) | Su propósito es rebautizar una copia y publicarla en tiendas. SEMSE no es una copia. Si algún día se publica la app móvil, `listing.py` se puede reevaluar. |
  | `replica-design` (salvo `contrast.py`) | Los tokens de SEMSE ya tienen dueño (`semse-design-tokens`). |

## Fases

| # | Fase | Estado |
|---|---|---|
| 1 | Auditar replica-skill y fijar versión | **hecho** (este PR) |
| 2 | Crear las cuatro skills con responsabilidades, límites, entradas, salidas y criterios | **hecho** (este PR) |
| 3 | Validadores: `scripts/quality/validate-critical-i18n.ts` (catálogos ES/EN, claves, variables, plurales, mensajes críticos) y `tests/e2e-semse/authenticated-es-en.spec.ts` (OPS_ADMIN, cliente, profesional, aislamiento entre organizaciones) | **pendiente**, PR separado |
| 4 | GitHub Actions: `.github/workflows/semse-kit-validation.yml` en la raíz exterior | **pendiente**, requiere autorización expresa (regla NUNCA de `AGENTS.md` sobre CI/CD) y revisión de costos con `semse-github-operations-cost-guard` |
| 5 | Prueba en un preview de Railway con cuentas y datos de prueba, más revisión independiente | **pendiente**, requiere autorización y `semse-railway-release-verification` |

Este PR no añade dependencias, workflows, rutas, modelos ni cambios de runtime.

## Documentos del kit

- `security-rules.md`: reglas que ninguna skill del kit puede saltarse.
- `test-matrix.md`: matriz roles × idioma × organización para `semse-functional-test`.
- `contrast-baseline.md`: fallos WCAG actuales de la paleta, que sirven de referencia para `semse-release-gate`.
- `recon/` y `parity/` se crean al usar las skills (ver cada `SKILL.md`).

## Comprobar el kit

```bash
cd project-manager-app
node --test tests/unit/semse-kit-contract.test.mjs tests/unit/semse-codex-skill-parity.test.mjs
pnpm skill:route -- "analizar funcionalidades de una plataforma de referencia para BuildOps"
for s in semse-recon semse-parity-audit semse-release-gate; do (cd .claude/skills/$s && python3 -I -m unittest discover -s scripts/tests); done
```
