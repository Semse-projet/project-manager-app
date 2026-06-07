# Supabase → NestJS API Migration Notes

**Fecha:** 2026-04-27

## Estado

La migración de Supabase a NestJS + Prisma está **100% completada**.
El monorepo `project-manager-app` es completamente libre de Supabase.

## Lo que había en src/

`src/lib/supabase.ts` creaba un cliente Supabase directo con `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

Los hooks del Vite app llamaban a **Supabase Edge Functions** directamente desde el navegador:

| Hook legacy | Edge Function | Equivalente actual |
|---|---|---|
| `useJobs.ts` | `jobs-api` | `GET /v1/jobs` + BFF `/api/semse/jobs` |
| `useEscrows.ts` | `escrows-api` | `GET /v1/payments/escrow` + BFF `/api/semse/escrow` |
| `useEvidenceRecords.ts` | N/A directo | `GET /v1/evidence` + BFF `/api/semse/evidence` |
| `useAgentDashboard.ts` | `agent-dashboard-api` | `GET /v1/ops/dashboard` |
| `useAgentNotifications.ts` | `agent-notifications-api` | `GET /v1/notifications` |
| `useAssistantProfile.ts` | `assistant-profile-api` | `GET /v1/users/me/profile` |

## Patrón antiguo (NO usar)

```ts
// src/lib/supabase.ts — LEGACY
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Llamada directa desde componente
const { data } = await supabase.from('jobs').select('*').eq('clientId', userId);
```

## Patrón actual (canónico)

```ts
// apps/web — BFF route → NestJS API → Prisma → DB
// apps/web/app/api/semse/jobs/route.ts
const res = await fetch(`${process.env.SEMSE_API_BASE_URL}/v1/jobs`, {
  headers: buildIdentityHeaders(identity)
});
```

## Reglas para cualquier código nuevo

1. **Nunca** importar `@supabase/supabase-js` en `apps/web` o componentes.
2. **Siempre** pasar por BFF route (`app/api/semse/`) → NestJS API.
3. **Auth** es JWT server-side, no Supabase Auth client-side.
4. **Storage** usa el módulo `apps/api/src/infrastructure/storage`, no Supabase Storage.
5. **Realtime** si se necesita: usar WebSockets/SSE desde el API propio, no Supabase Realtime.
