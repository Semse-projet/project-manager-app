# SEMSE Legacy Inventory

## Purpose
This document records legacy, transitional, and historical SEMSE sources that exist outside the canonical monorepo. These sources should not be treated as active code. They are reference material for selective rescue only.

## Canonical Active Trunk
- `project-manager-app/` is the canonical active development root.
- Legacy folders outside `project-manager-app/` must not be committed as active application code without selective review.

## Legacy Sources

### `app/`
Classification: transitional Vite/React app.

Potential value:
- Client flows: `app/src/pages/client/*`
- Internal developer flows: `app/src/pages/dev/*`
- Domain screens: `Dashboard.tsx`, `FieldOps.tsx`, `Trabajos.tsx`, `Evidencias.tsx`, `Disputas.tsx`
- Role state: `app/src/hooks/useRoleStore.ts`
- Mock data: `app/src/data/*` only as UX/test seed material

Recommended action:
- Do not version as an independent active app.
- Rescue selectively into `project-manager-app/apps/web/` or `project-manager-app/packages/ui/`.

### `archive/`
Classification: historical archive, not active source.

Do not commit wholesale because it contains:
- zip/tarball artifacts
- pptx/html historical artifacts
- old dist/build outputs
- legacy Supabase snapshots
- prototypes and demos

Potential value:
- `archive/legacy-src/src/lib/marketplace.ts`
- `archive/legacy-src/src/lib/escrows.ts`
- `archive/legacy-src/src/lib/ai.ts`
- `archive/legacy-src/src/pages/*` only for UX/domain-flow reference
- `archive/legacy-supabase/functions/ai-chat/index.ts`
- `archive/prototypes/semse-agent-runtime/docs/SEMSE_AGENT_RUNTIME.md`
- `archive/sql/supabase_schema.sql`

Recommended action:
- Keep as historical reference only.
- Rescue selectively into the canonical monorepo only after review.

## Suggested Rescue Map

| Legacy source | Potential canonical target | Notes |
|---|---|---|
| `app/src/pages/client/*` | `project-manager-app/apps/web/app/(app)/` or client routes | Client UX flows |
| `app/src/pages/dev/*` | `project-manager-app/apps/web/app/dev/` | Internal/dev portal flows |
| `app/src/pages/FieldOps.tsx` | `project-manager-app/apps/web/app/field-ops/` or `packages/ui` | Field operations UX |
| `app/src/pages/Evidencias.tsx` | `project-manager-app/apps/web/app/field-ops/` or evidence routes | Evidence workflow |
| `app/src/hooks/useRoleStore.ts` | `project-manager-app/packages/shared/` or web local state | Role switching |
| `archive/legacy-src/src/lib/marketplace.ts` | `project-manager-app/packages/agents/` or app helper | AI context aggregation |
| `archive/legacy-src/src/lib/escrows.ts` | `project-manager-app/apps/api/` and `packages/schemas/` | Escrow/milestone normalization |
| `archive/legacy-src/src/lib/ai.ts` | `project-manager-app/packages/agents/` or web assistant config | Agent catalog/config |
| `archive/legacy-supabase/functions/ai-chat/index.ts` | `project-manager-app/apps/api/` or `packages/agents/` | Multi-provider chat orchestration reference |
| `archive/prototypes/semse-agent-runtime/docs/SEMSE_AGENT_RUNTIME.md` | `project-manager-app/docs/architecture/` or `docs/history/` | Runtime blueprint |
| `archive/sql/supabase_schema.sql` | `project-manager-app/docs/history/` | Historical schema reference only |

## Non-Active / History Only

Keep these out of the active code path:
- `app/src/components/ui/*` unless a component has unique SEMSE-specific logic
- `app/src/data/*` except as mocks/test seeds
- Most of `archive/legacy-src/src/pages/*` unless a flow is missing in the canonical app
- `archive/legacy-supabase/functions/*` except `ai-chat/index.ts`
- `archive/sql/supabase_schema.sql` as reference, not source of truth
- zip, tar.gz, dist, build, pptx, docx, png artifacts

## Remaining External Blocks

### `semse-mobile-app/`
Classification: potential future mobile module, not ready for active versioning.

Current issues:
- Large size: ~298M
- Contains `node_modules/`
- Contains `dist/`
- Contains `.env.local`
- Has useful architecture material in `canon/`, `docs/`, and `SEMSE_MOBILE_INTEGRATION_AUDIT.md`

Potential value:
- Mobile adaptation blueprint
- Mobile surfaces documentation
- UX or screen patterns for future SEMSE mobile experience

Recommended action:
- Do not commit wholesale.
- Before any future versioning, remove or ignore `node_modules/`, `dist/`, and `.env.local`.
- Rescue only selected docs, architecture notes, or UX patterns into the canonical monorepo.

### `semse/`
Classification: auxiliary tooling / possible internal CLI.

Potential value:
- `semse/node/src/*`
- `semse/python/semse_py/*`
- `semse/README.md`
- Could become an internal automation or agent CLI package.

Current issues:
- Contains generated artifacts such as `node/dist/` and `python/__pycache__/`.

Recommended action:
- Review more finely before adoption.
- If adopted, migrate into `project-manager-app/packages/*` or `apps/api` as official tooling.
- If not adopted, keep documented as historical auxiliary tooling.

### `semse-storage/`
Classification: local storage / uploaded-data residue.

Current issues:
- Contains multipart JSON-like storage data.
- Not source code.
- Should not be versioned as active repo content.

Recommended action:
- Do not commit.
- Keep out of Git.
- Archive outside the repo if the data must be preserved.
- Document only as historical local storage residue.

## Final Active/Legacy Boundary

- Active trunk: `project-manager-app/`
- Historical/quarantine sources:
  - `app/`
  - `archive/`
  - `app semse/`
  - `semse-mobile-app/`
  - `semse/`
  - `semse-storage/`

Rules:
- Do not import legacy folders wholesale.
- Rescue one concept at a time.
- Every rescue must target the canonical monorepo.
- No secrets, `node_modules`, builds, storage, zips, tarballs, or generated artifacts.

## Rules for Future Rescue

1. Never import legacy folders wholesale.
2. Rescue one feature or concept at a time.
3. Compare against existing `project-manager-app/` implementation first.
4. Prefer canonical targets:
   - `apps/web/` for UI/routes
   - `apps/api/` for backend/runtime behavior
   - `packages/agents/` for AI orchestration
   - `packages/schemas/` for shared domain types
   - `docs/history/` for historical reference
   - `docs/architecture/` for reusable architecture blueprints
5. Every rescue must have a focused commit.
6. No secrets, builds, node_modules, archives, or generated artifacts.
