# Kit de calidad SEMSE — fase 3 (validador ES/EN y spec autenticado multirol)

**Fecha:** 2026-10-21 · **Rama:** `claude/semse-kit-fase3-validadores`, apilada sobre `claude/replica-skill-repo-bpdobu` (PR #1020, fases 1–2) · **CI de GitHub:** bloqueado a nivel de cuenta desde el 2026-10-20 (ver comentario en #1020). Toda la evidencia de este reporte es local.

## Resumen

- **`scripts/quality/validate-critical-i18n.ts`** (`pnpm quality:i18n`): lee como texto el diccionario central (`apps/web/lib/language-context.tsx`) y los 11 catálogos `COPY` de página. Son 12 catálogos con 1373 claves por idioma. Comprueba:
  - paridad de claves, valores vacíos y placeholders (`{x}`, `{{x}}`, `%s`, `${x}`);
  - forma y parámetros de las funciones de plural o interpolación;
  - texto en español dentro de valores en inglés;
  - mensajes críticos idénticos en ES y EN (aviso);
  - claves `t("…")` inexistentes y prefijos dinámicos sin claves;
  - texto traducido guardado en el estado de React (aviso).

  Las excepciones van en `scripts/quality/i18n-allowlist.json`, cada una con su motivo (hay 2). Estado actual: **0 errores y 14 avisos**.
- **`tests/unit/validate-critical-i18n.test.ts`**: 10 tests, uno por regla con fixtures, más el repo real con 0 errores. Corre en `pnpm test:unit`.
- **`tests/e2e-semse/authenticated-es-en.spec.ts`** (`pnpm test:e2e:semse:es-en`):
  - OPS_ADMIN, cliente y profesional pasan por ES → EN mediante el selector real → recarga, en el panel y en una ruta por rol. En cada paso: sin claves crudas, sin texto del otro idioma, `<html lang>` y preferencia guardada sincronizados, y sin 5xx en la BFF.
  - Aislamiento: dos clientes sintéticos de organizaciones distintas. El dueño crea y lee su trabajo; el intruso recibe 403/404 y no lo ve en su lista.
  - Cuentas por `SEMSE_E2E_*`. Se niega a escribir fuera de localhost sin `SEMSE_E2E_ALLOW_REMOTE=1`.
- **`docs/semse-kit/local-stack.md`**: receta reproducible del stack local (PostgreSQL 16 y Redis sin Docker, API y web en modo producción, cuentas sintéticas).
- Actualizados: `test-matrix.md` (estado y hallazgos KIT-F3-01..04), el README del kit, `semse-functional-test`, `semse-release-gate`, `package.json` (2 scripts) y el contrato del kit.

## Checklist final

- ✅ Validador ES/EN con tests y repo en 0 errores.
- ✅ Spec autenticado: 4/4 en stack local con web en modo producción.
- ✅ Hallazgos reales documentados con evidencia y sin corregir en este PR (requieren decisión RBAC o cambios de producto).
- ✅ Sin dependencias nuevas, sin cambios de runtime, sin workflows, sin tocar Railway.
- ❌ El spec no corre en CI (el job `e2e` sólo ejecuta `tests/e2e`). Conectarlo es la fase 4 y requiere autorización.
- ❌ Preview de Railway (fase 5): pendiente de autorización.

## Evidencia

| Comando (desde `project-manager-app/`) | Resultado |
|---|---|
| `pnpm quality:i18n` | 12 catálogos, 1373 claves es; 0 errores, 14 avisos (2 `critical-identical`, 12 `translated-text-in-state`) |
| `node --experimental-strip-types --test tests/unit/semse-kit-contract.test.mjs tests/unit/validate-critical-i18n.test.ts tests/unit/semse-codex-skill-parity.test.mjs tests/unit/skill-router-*.test.mjs tests/unit/operational-panels-i18n.test.ts tests/unit/contributor-i18n-keys.test.ts` | 81 pass, 0 fail |
| `pnpm test:unit` (tras `pnpm build:api`) | 1588 tests: 1570 pass, 11 todo, 1 fail (`browser-governance: isUrlSafe`, que necesita DNS real; ya fallaba igual antes de este cambio) |
| `npx tsc --noEmit --strict --moduleResolution bundler …` sobre los 3 archivos TS nuevos | sin errores |
| Spec en stack local (web en modo producción, `next build` + `server.js` standalone, cuentas sintéticas) | 4 passed; anotación `known-defect` para KIT-F3-01 en el caso OPS_ADMIN |
| Spec en stack local (web en `next dev`, cuentas demo) | ver KIT-F3-04: los 401 por el límite de `/v1/auth/token` hacen fallar los casos; es un problema del modo dev, no reproducido en modo producción |

## Hallazgos

Detalle y evidencia en `docs/semse-kit/test-matrix.md`.

- **KIT-F3-01 (S2):** el SSE de Mission Control devuelve 403 a todos los roles, porque al handler le falta metadata RBAC. La BFF lo muestra como 503.
- **KIT-F3-02 (S3):** varias rutas BFF convierten un 401/403/429 de la API en 503 "runtime not configured".
- **KIT-F3-03 (S3):** texto traducido guardado en el estado de React (12 sitios). Visto en vivo con un error en español dentro de la vista EN.
- **KIT-F3-04 (por comprobar):** límite de `/v1/auth/token` con caché por ruta en `next dev`; queda por revisar el valor de `RATE_LIMIT_LIMIT` en Railway.
- **Positivos:** la web en producción rechaza las sesiones demo, y el aislamiento entre organizaciones en trabajos responde 403/404.

## Siguientes pasos

1. Restablecer GitHub Actions y conseguir CI verde en #1020 y en este PR.
2. Decidir el permiso del SSE de Mission Control (KIT-F3-01) con `semse-rbac-permissions` y `semseproject`.
3. Corregir KIT-F3-02 y KIT-F3-03 en PRs pequeños; el validador ya marca los 12 sitios de KIT-F3-03.
4. Ampliar el spec: intruso profesional (`pro_b`), proyectos, evidencia y pagos.
5. Fases 4 y 5, sólo con autorización.
