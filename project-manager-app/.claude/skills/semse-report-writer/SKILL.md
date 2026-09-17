---
name: semse-report-writer
description: Where and how to write the end-of-session implementation report AGENTS.md requires. docs/reportes/README.md now fixes the naming convention (YYYY-MM-DD_short-topic.md) for new reports — the 274 pre-existing files with 3 older conventions were deliberately left unrenamed (breaks ~50 cross-references). Use at the end of any implementation session per AGENTS.md's "Crear reporte al final de sesiones de implementación" rule.
---

# SEMSE session reports (`docs/reportes/`)

## The rule

`AGENTS.md` SIEMPRE list: "Crear reporte al final de sesiones de implementación." The SDD flow's last step is "Crear reporte en docs/reportes/." This is a real, checked-in requirement, not a suggestion — there are 274 files in `docs/reportes/` as of this writing, so most sessions do comply.

## The convention for new reports is now written down — `docs/reportes/README.md`

The 274 pre-existing files still have at least three coexisting naming patterns (date-first, date-last-with-dashes, date-last-with-underscores) and were **not** renamed — grepping `docs/reportes/` by filename turned up ~50 cross-references to specific existing report filenames from specs, runbooks, ADRs, and even a code comment (`apps/api/src/infrastructure/forge/forge-lease.service.ts`). Renaming them would break those citations, and this repo's own `README.md` states "no se autoriza un renombramiento masivo" as a contribution rule — so the historical mess stays as-is.

**For new reports, `docs/reportes/README.md` fixes the convention going forward**: `YYYY-MM-DD_short-topic.md`. Read that file for the one-paragraph reasoning; don't re-derive it or propose renaming the old ones again without the user explicitly asking for that larger scope.

## What tends to go in one (from reading several real examples)

There's no single required template either, but recurring sections across real reports: a short summary of what changed, a "Checklist final" of concrete done-items (often ✅/❌ bullets), validation evidence (test counts, commands run), and a "Siguientes pasos" section pointing at what a follow-up session should pick up. This mirrors the same shape this repo's PR template asks for (`Resumen`/`Checklist`/`Evidencia`) — reusing that structure for the report body, rather than inventing a new one, keeps it consistent with what reviewers already expect from a PR description.

## Notas para futuros agentes / hallazgos abiertos

- No existe una plantilla `.specify/templates/overrides/semse-report.md` (a diferencia de spec/plan/tasks/checklist, que sí tienen override) — `docs/reportes/README.md` cubre nombre y estructura sugerida, pero no es un template SDD formal. Si alguien quiere ese nivel de formalidad, sigue siendo el próximo paso natural.
- El rename completo de los 274 archivos existentes se evaluó explícitamente (2026-09-17) y se descartó a pedido del usuario, con el riesgo real ya medido: ~50 citas cruzadas por nombre de archivo desde `docs/specs/**`, runbooks, ADRs y código. Si en el futuro alguien quiere retomarlo, ese conteo de citas es el punto de partida — no hay que re-grepear desde cero, pero sí hay que estar dispuesto a tocar esos ~50 archivos también, no solo renombrar.
- Esta skill no cubre el contenido técnico del reporte (eso depende de la tarea) — solo dónde va, cómo se llama, y qué estructura general es razonable copiar.
