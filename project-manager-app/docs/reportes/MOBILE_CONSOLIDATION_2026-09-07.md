---
title: "Informe de consolidación móvil SEMSE"
date: "2026-09-07"
status: "IN_PROGRESS"
---

# Resultado

Se estableció `origin/main` como base de integración en el worktree `semse-consolidated`, preservando los checkouts y fuentes previas. La app móvil canónica mantiene Expo SDK 57, el API de Railway y el mismo identificador iOS/Android.

## Cambios verificables

- Cliente móvil con URL canónica, compatibilidad legacy, validación de origen/rutas, timeout, refresh concurrente, logout seguro y sesión expirada.
- Restauración de sesión y estados de recuperación en navegación raíz.
- Prometeo conectado a `POST /v1/ai-models/prometeo/chat` desde una pantalla móvil accesible; acciones propuestas sujetas a aprobación.
- Jest resolviendo paquetes workspace; suite dirigida de configuración/cliente: 22 pruebas verdes.
- TypeScript móvil y `spec:validate:strict` verdes (119 especificaciones, 0 errores, 0 warnings).

## Límites pendientes

- LiveKit/capacidades nativas de `semse-mobile` requieren development build y no se fuerzan dentro de Expo Go.
- Falta ejecutar builds EAS desde esta revisión, instalar en iOS/Android y realizar canary autenticado; no se alteró Railway ni se borró ninguna fuente.

---

# Segunda pasada — 2026-09-07 (sesión de continuación)

## Cambios verificables añadidos

- **`50045d9e`** — `AdminDashboardScreen`: pull-to-refresh conectado
  (`RefreshControl` en el `ScrollView`; el estado `refreshing` y `load(true)`
  ya existían pero no estaban expuestos). Portado de los cambios sin commitear
  de `Desktop/project-manager-app`.
- **`50045d9e`** — `jest.config.js`: `testTimeout: 15000`. Los suites
  `TravelScreen`/`TimerScreen` flakeaban en el default de 5 s bajo carga
  (aislados pasan). Un test colgado sigue fallando a los 15 s.
- **Suite móvil completa ahora 45/45 · 213/213** en dos corridas (antes 44/45).
- `tsc --noEmit` limpio; `spec:validate:strict` 119 specs / 0 errores.

## Hallazgos de inventario (qué NO era un gap)

- **Pagos móvil — sin gap.** La superficie Worker (`screens/worker/PaymentsScreen`,
  `PayoutMethodScreen`, `api/payments.ts`, `api/payoutMethod.ts`, `config/stripe.ts`)
  ya vino en `main@88171003` (PRs #550/#558). El único otro `PaymentsScreen`
  está en el spike retirado (`project-manager-app-main`, PR #439) con
  `Authorization: 'Bearer token'` hardcodeado — **no se recupera**.
- **`Desktop/project-manager-app` (HEAD `34143dc9`, 3 semanas):** de sus ~15
  archivos móviles sin commitear, solo el pull-to-refresh del dashboard Admin
  era una mejora real no presente en `main`. `AdminTabNavigator`/`RoleGate` de
  ese clon son swaps de placeholder ya superados por la Fase 7 completa
  (7a–7h) que entró a `main`. `package.json` de ese clon sube parches de Expo
  SDK 57 (57.0.9→57.0.20) y añade `expo.install.exclude:["react"]` — **cambio
  recomendado pero diferido**: requiere `pnpm install` + regresión completa,
  no se hizo en esta pasada por "no poner en peligro nada".

## Gates que siguen abiertos

| Gate | Estado |
|---|---|
| Export de bundle Metro iOS+Android (T-040) | ✅ OK — Android 1233 mód. / iOS 1236 mód. / 44 assets / `.hbc` 3.3 MB c/u |
| LiveSession (T-022) | gateado — ver `docs/consolidation/LIVESESSION_RECOVERY_CONTRACT.md` |
| Procedencia de `2deefd26…` / `cd534762…` (T-030) | bloqueo externo — commits en ninguna Git accesible |
| Docs canónicas: ROADMAP / IMPLEMENTATION_STATUS_MATRIX / SPEC_INDEX (T-041) | pendiente |
| CI / push / PR (T-050) | rama sin pushear |
| Builds EAS desde esta revisión + canary autenticado (T-060) | pendiente |
| Bump de deps de Expo SDK 57 (patch) | recomendado, diferido |

Ninguna fuente borrada. Ningún cambio local pisado. Sin push ni deploy.
