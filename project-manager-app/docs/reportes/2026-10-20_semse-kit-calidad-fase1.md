# Kit de calidad SEMSE — fase 1 (auditoría de replica-skill y cuatro skills propias)

**Fecha:** 2026-10-20 · **Rama:** `claude/replica-skill-repo-bpdobu` · **Base:** `main` @ `06dfd7b`

## Resumen

Se auditó el pack externo `Jakeschincariol/replica-skill` (MIT, commit `77c9436`, 11 skills y 6 herramientas Python) y se integraron sus mejores capacidades como **cuatro skills propias de SEMSE**, sin instalar el pack, sin reemplazar ninguna skill existente y sin tocar código de runtime:

- `semse-recon`: reconocimiento funcional de una plataforma de referencia y reseñas enlazadas (`reviews.py`).
- `semse-parity-audit`: matriz existe/falta/mejorar con evidencia (`parity.py`, `imgdiff.py`).
- `semse-functional-test`: pruebas por rol × ES/EN × organización y bugs S1–S4 sobre el Playwright existente.
- `semse-release-gate`: veredicto de PR con evidencia y contraste WCAG de la paleta real (`contrast.py`, más un exportador propio `semse-tokens.mjs`).

Documentación en `docs/semse-kit/`: README con procedencia y lo adoptado o descartado, reglas de seguridad, matriz de pruebas y línea base de contraste.

## Checklist final

- ✅ Pack auditado completo: instrucciones, scripts y dependencias. Sólo biblioteca estándar, sin red.
- ✅ Versión exacta fijada (`77c9436fb3d18c3d58169efb8caf4fe906b0dc51`) y licencia MIT junto al código adaptado.
- ✅ 4 `SKILL.md` con responsabilidades, límites, entradas, salidas y criterios de aprobación, que delegan en `semse-business-flow-e2e`, `semse-synthetic-test-data`, `semse-ci-pr-workflow`, `semse-railway-release-verification`, `semse-spec-kit-flow` y `semse-audit-remediation`.
- ✅ 4 descriptores Codex, catálogo (27 → 31), auditoría de cobertura y `CLAUDE.md` raíz actualizados.
- ✅ Metadatos `routing:` con `excludes`; los casos de enrutado de referencia siguen pasando.
- ✅ Test de contrato `tests/unit/semse-kit-contract.test.mjs`.
- ❌ Fase 3 (validador de i18n crítico y spec Playwright autenticado ES/EN): fuera de este PR.
- ❌ Fase 4 (workflow de GitHub Actions): fuera de este PR; requiere autorización expresa (regla NUNCA de CI/CD).
- ❌ Fase 5 (preview de Railway): fuera de este PR; requiere autorización.

## Evidencia

| Comando (desde `project-manager-app/`) | Resultado |
|---|---|
| `node --experimental-strip-types --test tests/unit/semse-kit-contract.test.mjs tests/unit/semse-codex-skill-parity.test.mjs tests/unit/semse-skill-pack-contract.test.mjs tests/unit/skill-router-*.test.mjs` | 57 pass, 0 fail |
| `python3 -I -m unittest discover -s scripts/tests` en las 3 skills con herramientas | 39 tests upstream OK |
| `pnpm skill:route:report` | 31 skills descubiertas, sin avisos |
| `pnpm skill:route -- "<tarea>"` para 7 tareas de muestra | cada tarea del kit → su skill. Railway, tracker y tokens → su skill de siempre como principal |
| `semse-tokens.mjs` + `contrast.py` sobre la paleta real | oscuro: 5/20 pares por debajo de AA; claro: 8/20 (ver `docs/semse-kit/contrast-baseline.md`) |

## Hallazgo

La paleta actual no cumple WCAG AA en varios pares. Los más visibles son el texto blanco de `.btn-primary` en tema oscuro (3.68:1), `.btn-accent` en ambos temas, `faint` y el borde de inputs (`border2`, ≈1.5:1). No se corrigió aquí: es un cambio de diseño que debe mover juntos `colors.ts`, `globals.css` (4 bloques) y el tema móvil (`semse-design-tokens`).

## Siguientes pasos

1. Revisión humana y merge de este PR en borrador.
2. Fase 3 en un PR separado: `scripts/quality/validate-critical-i18n.ts` sobre `apps/web/lib/language-context.tsx` y `tests/e2e-semse/authenticated-es-en.spec.ts` con los actores de `docs/semse-kit/test-matrix.md`.
3. Decidir la corrección de la línea base de contraste (diseño).
4. Fases 4 y 5 sólo con autorización expresa.
