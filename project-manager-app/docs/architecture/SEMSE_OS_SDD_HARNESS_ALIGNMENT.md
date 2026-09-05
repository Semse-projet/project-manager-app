# SEMSE OS — Alineación Spec Drive, Spec Kit y Agent Harness

**Estado:** CANONICAL
**Fecha:** 2026-07-19
**Alcance:** gobierno de ingeniería; no cambia runtime ni producción

## Decisión

SEMSE adopta un solo camino de entrega gobernada:

```text
Intención
  -> Spec Kit (.specify)
  -> contrato canónico (docs/specs)
  -> índice y validación (docs/SPEC_INDEX.md + scripts/spec-*.mjs)
  -> Forge SDD (task graph y task packets)
  -> Agent Harness (policy, tools, approvals y evidence)
  -> implementación -> verificación -> propuesta de release -> observación
```

`Spec Drive` es el principio operativo: ninguna mutación funcional comienza sin
un contrato aprobado. `Spec Kit` proporciona el flujo y los templates. `Forge`
convierte el contrato en trabajo acotado. El `Agent Harness` controla quién puede
ejecutarlo, con qué herramientas y bajo qué aprobación.

## Precedencia

| Orden | Artefacto | Autoridad |
| --- | --- | --- |
| 1 | `.specify/memory/constitution.md` | Principios inmutables |
| 2 | `docs/SOURCE_OF_TRUTH.md` | Ownership y canonicidad |
| 3 | `docs/specs/**/*.spec.md` | Contrato funcional/técnico |
| 4 | `docs/SPEC_INDEX.md` | Estado y descubrimiento |
| 5 | `*.plan.md` y `*.tasks.md` junto al spec | Ejecución aprobada |
| 6 | `packages/forge` | Coordinación de ingeniería |
| 7 | `packages/agents` y harnesses de dominio | Ejecución gobernada |
| 8 | `.semse-sdd/` | Kit histórico y material de referencia |

`.semse-sdd/` no crea una segunda fuente de specs. Sus templates y prompts se
conservan como referencia; todo trabajo nuevo se registra bajo `docs/specs/` y
pasa por los validadores `pnpm spec:*`.

## Contrato de handoff

| De | Hacia | Salida obligatoria |
| --- | --- | --- |
| Prometeo/humano | Spec Architect | intake con objetivo, límites y owner |
| Spec Architect | Forge Supervisor | spec APPROVED con digest |
| Forge Supervisor | Builder | task packet con file/tool scope |
| Builder | QA Verifier | diff y evidencia de pruebas |
| QA Verifier | Governance Auditor | verification matrix independiente |
| Governance Auditor | Humano | DecisionPackage y riesgo residual |
| Humano | DevOps Release | aprobación explícita aplicable |

Los permisos efectivos son la intersección de spec, task packet, manifest del
agente, policy del entorno y aprobaciones humanas.

## Relación con SEMSE OS

- Una capability declara estado deseado, dependencias y permisos.
- Governance decide si la operación puede avanzar.
- El runtime adapter ejecuta sin exponer infraestructura al agente.
- Mission Control registra estado observado y evidencia.
- Prometeo coordina intención, pero no hereda permisos de ejecución.

## Golden path

1. Leer Constitución, `SPEC_INDEX`, `SOURCE_OF_TRUTH` e invariantes.
2. Crear o actualizar el spec en `docs/specs/<domain>/`.
3. Ejecutar `pnpm spec:validate:strict`.
4. Obtener aprobación humana para pasar de `DRAFT/REVIEW` a `APPROVED`.
5. Crear plan y tareas desde los templates SEMSE.
6. Generar task packets y aplicar policy/leases con Forge.
7. Implementar en scope; el builder no certifica su propio cambio.
8. Ejecutar validación afectada y producir verification matrix.
9. Actualizar índice, arquitectura, reporte y rollback.
10. Proponer PR/release; producción conserva sus gates humanos.

## Skills de Codex

Las skills ayudan al entorno de desarrollo, pero no amplían el alcance del spec
ni evaden el Agent Harness. Ya están disponibles skills relevantes de GitHub,
Next.js, React, Supabase/Postgres, navegador, Vercel y OpenAI. Skills externas
deben instalarse mediante `skill-installer` y revisarse en una sesión posterior.

