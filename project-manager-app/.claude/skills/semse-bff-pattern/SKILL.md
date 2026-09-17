---
name: semse-bff-pattern
description: The web BFF (backend-for-frontend) pattern — every web→API call goes through apps/web/app/api/semse/[module]/route.ts, never directly from a client component. Use when adding a new API call from the web app, or wiring a new feature to the NestJS API.
---

# SEMSE web BFF pattern

## The rule

`CLAUDE.md` states it as an absolute: "All web→API calls go through `/app/api/semse/[module]/route.ts` — never direct from client." In practice this means a Next.js route handler under `apps/web/app/api/semse/<module>/...` proxies the real request to the NestJS API, and a client-side function wraps `fetch("/api/semse/...")` for components to call — components never construct a URL to the NestJS API themselves.

## The real shape of a BFF route

Every route handler in `apps/web/app/api/semse/**/route.ts` follows the same skeleton, built on shared helpers in `apps/web/app/api/semse/_server.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const body = await req.json() as Record<string, unknown>;
    const data = await fetchSemseDataForRequest("/v1/labor/timer/start", req, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: "web-labor-timer-start", data }, { status: 201 });
  } catch (e) { return handleServerError(e); }
}
```

`_server.ts` also carries `resolveLocalDevRuntimeConfig()` — the local-dev identity fallback (see `semse-rbac-permissions` skill) — and `AccessTokenBootstrapper`, which handles the `SEMSE_BOOTSTRAP_TOKEN` exchange so route handlers don't each reimplement auth plumbing.

Always check for an existing route under the target module's directory before writing a new one — most CRUD shapes (list/get/create/update/delete against one NestJS endpoint) already have a near-identical sibling to copy.

## Client-side: it's not actually one file

`CLAUDE.md` says "API functions live in `/app/semse-api.ts`" — **this is only true for part of the app.** There are currently 4 separate client wrapper files, each owning a different module's fetch calls:

- `apps/web/app/semse-api.ts` — the original/largest one, most modules.
- `apps/web/app/(app)/labor-api.ts` — Labor Engine / tracker (`startTimer`, etc.).
- `apps/web/app/lib/buildops-api.ts` — BuildOps module.
- `apps/web/app/lib/semse-tools-api.ts` — the Tools/Estimator surface.

**Before adding a new client-side API function, check whether the target module already has its own `-api.ts` file** (grep `apps/web/app -iname "*-api.ts"`) rather than assuming everything belongs in `semse-api.ts`. Adding to the wrong file doesn't break anything functionally, but perpetuates the fragmentation and makes the next person's grep miss it.

## Notas para futuros agentes / hallazgos abiertos

- La divergencia entre lo que dice `CLAUDE.md` ("API functions live in `/app/semse-api.ts`") y la realidad (4 archivos) no está corregida en la documentación todavía — esta skill es la única referencia actualizada por ahora. Si alguien quiere, valdría actualizar el `CLAUDE.md` del monorepo para reflejar los 4 archivos reales, pero no se tocó en esta sesión para no reabrir un archivo de gobierno sin que el usuario lo pidiera.
- No se investigó si BuildOps o Tools tienen su propio patrón de BFF route ligeramente distinto al de Labor — si tocás esos módulos, no asumas que `_server.ts`'s helpers cubren el 100% de sus casos sin confirmarlo primero.
- `AccessTokenBootstrapper` no se auditó en profundidad en esta sesión — se documenta acá solo como el punto de partida correcto si aparece un bug de token/bootstrap en el BFF.
