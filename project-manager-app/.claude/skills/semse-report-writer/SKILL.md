---
name: semse-report-writer
description: Where and how to write the end-of-session implementation report AGENTS.md requires, and the naming inconsistency in docs/reportes/ (274 files, at least 3 different naming conventions) so a new report doesn't add a 4th. Use at the end of any implementation session per AGENTS.md's "Crear reporte al final de sesiones de implementación" rule.
---

# SEMSE session reports (`docs/reportes/`)

## The rule

`AGENTS.md` SIEMPRE list: "Crear reporte al final de sesiones de implementación." The SDD flow's last step is "Crear reporte en docs/reportes/." This is a real, checked-in requirement, not a suggestion — there are 274 files in `docs/reportes/` as of this writing, so most sessions do comply.

## There is no single enforced naming convention — don't invent a 4th

Inspecting the directory shows at least three coexisting patterns:

- `YYYY-MM-DD_topic_description.md` (e.g. `2026-06-21_bloque-U_lien_automation.md`) — the most common, date-first.
- `topic_description_YYYY-MM-DD.md` (e.g. `spec_metadata_normalization_2026-05-25.md`) — date-last, dashes.
- `topic_description_YYYY_MM_DD.md` (e.g. `worker_verification_unit_tests_2026_06_04.md`) — date-last, **underscores** instead of dashes in the date.

**Pick the date-first pattern (`YYYY-MM-DD_short-topic.md`) for new reports** — it sorts correctly with a plain `ls` and is the most common — but don't be surprised finding or grepping for a report with a different shape, and don't treat an existing report's filename as a strict contract to match exactly.

## What tends to go in one (from reading several real examples)

There's no single required template either, but recurring sections across real reports: a short summary of what changed, a "Checklist final" of concrete done-items (often ✅/❌ bullets), validation evidence (test counts, commands run), and a "Siguientes pasos" section pointing at what a follow-up session should pick up. This mirrors the same shape this repo's PR template asks for (`Resumen`/`Checklist`/`Evidencia`) — reusing that structure for the report body, rather than inventing a new one, keeps it consistent with what reviewers already expect from a PR description.

## Notas para futuros agentes / hallazgos abiertos

- No existe una plantilla `.specify/templates/overrides/semse-report.md` (a diferencia de spec/plan/tasks/checklist, que sí tienen override) — si alguien quiere estandarizar esto de verdad, ese sería el próximo paso natural, no algo que esta skill pueda forzar por sí sola.
- No se auditaron los 274 archivos para confirmar cuál convención es mayoritaria con precisión — la estimación de "la más común es fecha-primero" es una impresión de un `ls` parcial, no un conteo exhaustivo. Si esto importa para una limpieza real, correr un conteo exacto antes de asumir proporciones.
- Esta skill no cubre el contenido técnico del reporte (eso depende de la tarea) — solo dónde va, cómo se llama, y qué estructura general es razonable copiar.
