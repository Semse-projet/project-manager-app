# @semse/mobile

Expo (React Native, TypeScript, SDK 57) native app for SEMSE — one app, one login,
navigation branches by the authenticated user's role (`RoleGate.tsx`, mirroring how
`apps/web/app/(app)/{admin,client,worker}` already branches under one authenticated
shell). Being built out in phases; see the plan for the full roadmap.

**Worker tab is the most built-out one.** Its core is **background geolocation for
the Time Tracker's proximity check-in** — when a worker gets near a Job or FreeProject
site, the app prompts (or auto-starts) the Labor Engine timer, even while backgrounded
or the app is fully closed on Android. This is the mobile half of the feature shipped
on web in `apps/web/app/(app)/worker/tracker/useProximityCheckIn.ts` (see also
`apps/api/src/integrations/geo-distance.ts` and `google-maps.ts`). Around that: log in,
see/toggle the active timer, toggle proximity tracking, set the `ask`/`auto`/`off`
preference (shared with web via `UserProfile.proximityCheckInMode`), browse assigned
Jobs and submit bids (`Jobs`/`Bids` tabs), and capture photo evidence against a job
(`EvidenceCapture`, camera or gallery via `expo-image-picker`). Push notifications
(Expo push tokens, registered/unregistered alongside login/logout — see
`src/notifications/pushRegistration.ts`) deliver the same events the web app already
gets in-app. The bottom bar stays at 4 tabs (Timer/Jobs/Bids/More) by moving
everything used less-than-daily behind **More** (`WorkerMoreStackNavigator`):
FreeProjects, Disputes (list/detail, open a new one, attach evidence), Incidents
(report + list, safety/damage/delay/material/other with severity), Travel
(list/detail), and Settings. No manual time-entry form, no reports yet.

**Client tab (Fase 2, `docs/specs/ui/mobile-client-tab.spec.md`)**: see a client's
own jobs, open a job's detail (bids received, milestones, evidence — evidence is
read-only here, the client doesn't capture it), accept a bid, approve a submitted
milestone, and rate the professional once a job is `completed`. Deliberately narrow
by design — job posting, marketplace, disputes and anything that moves money
(escrow fund/deposit/release) are out of scope for this phase, see the spec for why.
One real gap worth knowing: **bid-related push notifications don't fire** —
`bids.service.ts` writes those notifications with `prisma.notification.create()`
directly instead of going through `NotificationsService`, so they never reach
`PushDispatchService` (milestone events do reach push; bids don't). A client finds
out about a new bid by opening the app, not a push — this is a pre-existing backend
gap, not something this phase fixes.

**Admin tab (Fase 7a/7b/7c/7d/7e, `docs/specs/ui/mobile-admin-dashboard.spec.md` /
`mobile-admin-disputes.spec.md` / `mobile-admin-labor-overview.spec.md` /
`mobile-admin-users.spec.md` / `mobile-admin-contractors.spec.md`)**: has a
real `Dashboard` (jobs overview — active/disputed/completed/total counts,
active budget, dispute alerts, derived client-side from `GET /v1/jobs`,
mirroring `apps/web`'s admin dashboard), a `Disputes` tab (tenant-wide list +
detail, read-only — `GET /v1/disputes` already scopes `OPS_ADMIN` to every
org in the tenant server-side, unlike `CLIENT`/`PRO`; no assign/resolve/
archive actions, those mutate a dispute's outcome and need their own spec), a
`Labor` tab (QualityGuard alerts — stale timers, overtime, long entries,
off-site check-ins — plus the team's weekly hours and known cost, read-only
via the purpose-built `GET /v1/labor/admin/overview`, same endpoint
`apps/web`'s `/admin/labor-engine` already uses; `workerId` is shown
truncated, not resolved to a name, and no timer mutation is exposed), a
`Users` tab (tenant-wide directory — email, status, verification, trust
score, risk level, via `GET /v1/users`; no status/verify/profile mutation), a
`Contractors` tab (CRM leads — org-scoped list + stats + create a new lead
via `GET`/`POST /v1/contractor/leads`, both already granted to `OPS_ADMIN`
via `jobs:read`/`jobs:create`; no status change, delete, or estimate/invoice
generation, those are a separate phase — see spec §2. Built against
`contractor.service.ts`'s real `LeadStatus`/`LeadSource` contract rather than
`apps/web`'s Contractors page, whose local types and `trade` field have
drifted from what the backend actually returns/reads), and a `Settings` tab
(logout only). Contractors is labeled 7e, not 7c or 7d, because both were
already claimed by parallel branches when it was built: 7c by Labor and 7d
by Users directory (both merged, PRs #584/#585). The rest of Fase 7 —
finance, disputes management actions, dispute/timer mutations — is still
pending.

## Setup

```bash
cp .env.example .env   # then set EXPO_PUBLIC_SEMSE_API_BASE_URL to a reachable apps/api URL
pnpm install            # from the repo root — this is a pnpm workspace member
pnpm dev:mobile          # or: pnpm --filter @semse/mobile start
pnpm check:mobile        # typecheck (tsc --noEmit)
pnpm --filter @semse/mobile test   # jest-expo + @testing-library/react-native — geo/proximity logic and screens
```

`EXPO_PUBLIC_SEMSE_API_BASE_URL` must be reachable from the **device/simulator**, not
just your machine — `localhost` only works in an iOS simulator talking to a Mac host;
everywhere else (Android emulator, physical device, Expo Go) use your LAN IP or a
tunnel (`expo start --tunnel`).

**This app was built in a sandbox with no Xcode/Android SDK/simulator available** —
`pnpm --filter @semse/mobile check` (`tsc --noEmit`) passes, but nothing here has
been run on an actual simulator or device. Treat the first real run as this app's
first end-to-end test, not a formality.

## Building (EAS)

There is no local simulator loop in this pipeline — `eas.json` defines
`development`/`preview`/`production` profiles, and every build (Android included)
runs on Expo's cloud build service, not locally. **iOS builds have to go through EAS
cloud** since this is a Windows environment and Xcode only runs on macOS — there's no
way to build or sign an iOS app locally here, cloud is not just the convenient option.

```bash
npx eas-cli build --profile development --platform android   # dev client, sideload via link
npx eas-cli build --profile preview --platform all           # internal distribution, both platforms
npx eas-cli build --profile production --platform all         # store-ready
```

First-time setup needs `npx eas-cli init` (creates `expo.extra.eas.projectId` in
`app.json`) and `npx eas-cli credentials` for iOS signing (EAS can generate/manage
these for you — there's no local keychain to pull from anyway).

## Authentication

Talks directly to `apps/api` — there is no BFF layer here (that's a `apps/web`-only
pattern for browser cookie sessions). `POST /v1/auth/login` returns an access +
refresh token pair (`apps/api/src/modules/auth/auth.controller.ts`); `src/api/client.ts`
stores them in `expo-secure-store` and attaches `Authorization: Bearer <token>` to
every request, refreshing once via `POST /v1/auth/refresh` on a 401 before giving up.

## Background location architecture

```
index.ts                          — imports backgroundLocationTask.ts before
                                     registerRootComponent (TaskManager.defineTask
                                     must run at module scope, not inside a component)
src/geo/backgroundLocationTask.ts — the registered task; runs even when the OS
                                     relaunches the app headless for a location update
src/geo/backgroundLocation.ts     — start/stop tracking + permission requests
src/geo/proximityService.ts       — evaluate one location against cached sites;
                                     ask → local notification, auto → POST timer/start
src/geo/siteCache.ts              — AsyncStorage cache of {sites, proximityMode} —
                                     the background task has no React tree to read
                                     state from, so the foreground app persists this
                                     periodically (refreshSites.ts, called on screen focus)
src/geo/cooldownStore.ts          — per-site cooldown (20 min), also persisted since
                                     the task can run in a fresh JS context each time
```

**Known platform limits, not bugs**: iOS does not guarantee background location
delivery to a *force-quit* app the way Android's foreground-service model does —
Apple's OS decides when to wake the app for a significant location change. This is
inherent to iOS, not something fixable in this codebase. Android needs the
persistent foreground-service notification (configured in `app.json` /
`backgroundLocation.ts`) to keep tracking reliably; that notification is not optional.

## Structure

```
src/api/          — client.ts (fetch+token wrapper), auth.ts, labor.ts, profile.ts,
                     jobs.ts, bids.ts, evidence.ts, push.ts, milestones.ts, ratings.ts,
                     disputes.ts, incidents.ts, travel.ts
src/context/       — AuthContext (session state, wires push register/unregister)
src/geo/           — see above
src/notifications/ — local notification presentation, the "Iniciar" action handler,
                      and pushRegistration.ts (Expo push token lifecycle)
src/navigation/    — RootNavigator → RoleGate branches by role into
                      WorkerTabNavigator (real) / ClientTabNavigator (real, Fase 2) /
                      AdminTabNavigator (Dashboard + Disputes + Settings real, Fase
                      7a/7b; rest of Fase 7 pending). WorkerTabNavigator is
                      Timer/Jobs/Bids/More, where WorkerMoreStackNavigator holds
                      FreeProjects/Disputes/Incidents/Travel/Settings.
src/screens/       — LoginScreen, ForgotPasswordScreen, TimerScreen, FreeProjectsScreen,
                      SettingsScreen, worker/{JobsListScreen,JobDetailScreen,BidsScreen,
                      EvidenceScreen,MoreScreen,DisputesScreen,DisputeDetailScreen,
                      IncidentsScreen,TravelScreen,TravelDetailScreen},
                      client/{JobsListScreen,JobDetailScreen,RatingFormScreen,
                      ClientSettingsScreen}, admin/{AdminDashboardScreen,
                      AdminDisputesScreen,AdminDisputeDetailScreen,
                      AdminLaborOverviewScreen,AdminUsersScreen,
                      AdminContractorsScreen,AdminSettingsScreen}
src/components/    — ErrorBoundary, EvidenceCapture, LocationPickerMap, PermissionPrimerModal
```
