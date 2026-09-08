# LiveSession — Fase 4 (verificación local) cerrada

**Fecha:** 2026-09-08
**Rama:** `feat/prometeo-live-sessions` @ `9d7a8310` (worktree `Desktop/ls-b-wt`)
**Spec:** `docs/specs/prometeo/live-sessions.spec.md`
**Alcance de la sesión:** correr y registrar la Fase 4 del plan (T-040..T-045).
Sin cambios de código de producto — sólo verificación + bookkeeping SDD.

## Bloqueo de entorno resuelto antes de verificar

El worktree tenía ~35 junctions `@semse/*` corruptas repartidas por
`node_modules/` raíz, `apps/*/node_modules/@semse/*` y
`packages/*/node_modules/@semse/*`: `fs.realpathSync` devolvía
`UNKNOWN: unknown error, stat` y `pnpm install --frozen-lockfile` moría con el
mismo error al intentar abrirlas. Causa probable: un `pnpm install` interrumpido
de la sesión anterior (mezcla de proceso nativo + contexto MSYS) dejó los
reparse points a medio escribir.

Reparación: borrar cada junction con `[System.IO.Directory]::Delete()` y
recrearla con `New-Item -ItemType Junction` apuntando a `packages/<name>`.
(`cmd /c rmdir` / `mklink` vía bash mangla la ruta a `\C:\...`; no usar.)
Tras la reparación, `pnpm build:packages` pasa limpio y todo resuelve.

## Resultados Fase 4

| Tarea | Comando | Resultado |
|---|---|---|
| T-040 | `node --test apps/api/test/live-sessions.service.test.ts` | **20/20** — ownership 404, idempotencia, version conflict, FSM (happy path + aristas ilegales), media-token gate (estado/expiración/participante), barrido `CANCELLED`/`FAILED`, webhook edge inválido, addParticipant |
| T-040 | `node --test tests/unit/live-session-schema.test.ts` | **12/12** — FSM contra `STATE_MACHINES.md`, targets de acción, schemas Zod + `liveSessionEventSchema` |
| T-041 | `tsc --noEmit` (apps/mobile) | **limpio** |
| T-041 | `jest` (apps/mobile) | **46 suites / 218 tests verde** (incl. `LiveSessionScreen.test.tsx` 5/5); sin flakies este run |
| T-041 | `pnpm build:packages` | **verde** (post-reparación de junctions) |
| T-042 | `npx expo export --platform android --platform ios` | **OK** — Android 1228 módulos, iOS 1240; HBC 3.4 MB c/u; 44 assets |
| T-043 | `pnpm spec:validate:strict` | **120 specs, 0 errores / 0 warnings** |
| T-044 | `pnpm spec:coverage` + `pnpm spec:index` | verde; `SPEC_INDEX.md` regenerado |
| T-045 | edición de frontmatter del spec | ver abajo |

### No corrido

- **Regresión API/web `build` completa** — la CI del repo sigue caída (matriz
  de implementación §9). Se registra como verificación local en T-052 al abrir
  el PR; no se declara "PASS" de pipeline.
- **`prisma migrate diff` contra un Postgres real** — es paso de deploy (Fase 6,
  T-060). La paridad de `migration.sql` ya se verificó offline (T-021).

## Cambios de frontmatter (T-045)

`docs/specs/prometeo/live-sessions.spec.md`:

- `status: APPROVED → IMPLEMENTED`
- `code_status: IN_PROGRESS → COMPLETE`
- `migration_status: NOT_APPLICABLE → PENDING` (migración escrita, sin aplicar)
- `ci_status`: **sigue `NOT_RUN`** — lo cierra T-052
- `related_files` / `related_tests` / `related_endpoints` / `related_events` poblados
- `last_verified: 2026-09-08`

`docs/specs/prometeo/live-sessions.tasks.md`: `status: PENDING → IN_PROGRESS`,
Fase 4 marcada `[x]` con evidencia.

## Estado y siguiente paso

Fases 1–4 cerradas. **Fase 5 (PR, CI, merge)** es lo siguiente:

- **T-050/T-051** — revisar diff + secretos (sin `LIVEKIT_*` en el árbol) y
  abrir el PR desde `feat/prometeo-live-sessions`. Decidir el split PR-1/PR-2
  del plan §10 (modelo+FSM+servicio sin LiveKit/móvil vs. LiveKit+webhook+móvil)
  o PR único si el revert es cómodo.
- **Bloqueo operativo:** el token de `gh` en esta máquina está expirado
  (`gh auth status` → "token is invalid") — hay que re-autenticar
  (`gh auth login -h github.com`) antes de poder abrir el PR o `git push`.

Fase 6 sigue gateada por la **acción humana** `LIVEKIT_URL` / `LIVEKIT_API_KEY`
/ `LIVEKIT_API_SECRET` en Railway (bloquea sólo la capa de media y el canary,
no el merge).
