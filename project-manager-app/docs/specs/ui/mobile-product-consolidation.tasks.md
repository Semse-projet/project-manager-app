---
type: tasks
feature: "Consolidación del producto SEMSE móvil"
domain: "ui"
plan: "docs/specs/ui/mobile-product-consolidation.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/semse-product-consolidation-20260906"
date: "2026-09-06"
---

# Tareas

- [x] T-001: registrar autorización de consolidar sin borrar y crear integración desde main.
- [x] T-002: inspeccionar fuentes, builds EAS y disponibilidad Railway.
- [x] T-003: crear spec, plan, análisis y checklist.
- [x] T-010: pruebas de URL, sesión, concurrencia y errores — `src/api/client.test.ts`
      (98 líneas: URL histórica/canónica, conflicto, origen inválido, normalización,
      refresh concurrente, timeout, 401, 5xx, logout durante refresh) y
      `src/config/environment.test.ts`. `ad7cb6f1`.
- [x] T-011: configuración y cliente autenticado compartidos — `src/config/environment.ts`
      (nuevo) + `src/api/client.ts` reescrito (una sola conexión, var pública
      histórica + canónica, validación de origen/rutas absolutas, timeout).
      `ad7cb6f1`.
- [x] T-012: restauración, cierre de sesión y separación de cuentas —
      `src/context/AuthContext.tsx` (refresh compartido, logout no restaura
      sesión anterior, expiración → AuthProvider) + `src/navigation/RootNavigator.tsx`
      (estados de restauración/recuperación). `ad7cb6f1`.
- [~] T-020: integrar navegación y funciones existentes de todas las fuentes —
      Prometeo (`PrometeoScreen` + `api/prometeo.ts` → `POST /v1/ai-models/prometeo/chat`,
      `ad7cb6f1`) y pull-to-refresh del dashboard Admin (`50045d9e`, portado de
      `Desktop/project-manager-app`) integrados. **Pagos: sin gap** — la superficie
      Worker (`screens/worker/PaymentsScreen`, `PayoutMethodScreen`, `api/payments.ts`,
      `api/payoutMethod.ts`, `config/stripe.ts`) ya vino en `main@88171003` (PRs
      #550/#558). El único otro `PaymentsScreen` está en el spike retirado
      (`project-manager-app-main`, PR #439) con `Authorization: 'Bearer token'`
      hardcodeado — **no se recupera**. `Desktop/project-manager-app`:
      `AdminTabNavigator`/`RoleGate` de ese clon son swaps de placeholder ya
      superados por la Fase 7 completa en `main` — no se portaron.
- [x] T-021: reconciliar temporizador y datos pendientes — `src/timer/localTimer.ts`
      (nuevo), `src/screens/TimerScreen.tsx`, `src/api/labor.ts` (pausa/reanudar/
      entrada manual). Modo local solo ante fallo de red; no acepta sesiones
      remotas imposibles; no da stop por sincronizado sin respuesta. `ad7cb6f1`.
- [~] T-022: verificar sesiones en vivo y límites de Expo Go — **LiveSession
      fuera de alcance de esta pasada**: su modelo vive en `project-manager-app-main`
      (árbol sin Git, 1 GB, marcado como duplicado obsoleto) y el spec §2/§6/§7
      exige contrato propio + migración SQL aditiva + tests de ownership antes
      de suscribir SSE — no se auto-importa. Gate queda abierto; ver
      `docs/consolidation/LIVESESSION_RECOVERY_CONTRACT.md`. Límites Expo Go:
      LiveKit/nativos no se fuerzan dentro de Expo Go (spec §7).
- [~] T-030: trazabilidad iOS/Android y diagnóstico local — IDs de build y
      proyectos EAS registrados en `MOBILE_SOURCE_REGISTER.md`. **Bloqueo externo
      confirmado 2026-09-07:** los commits `2deefd26…`/`cd534762…` de los builds
      EAS recientes están en **otra máquina del propietario, sin pushear**. Se
      recuperan trayendo esa rama a `origin` (o a este clon como remoto) antes
      de poder afirmar paridad con esos builds. Hasta entonces la consolidación
      parte de `main@88171003` + lo verificable en los clones locales de esta
      máquina.
- [x] T-040: suite móvil, TypeScript, exportaciones y SDD — `tsc --noEmit` limpio;
      `spec:validate:strict` 119 specs 0 errores; **suite móvil 45/45 · 213/213**
      (dos corridas) tras `jest.config.js testTimeout 15000` que estabilizó los
      timeouts flaky de `TravelScreen`/`TimerScreen` bajo carga (`50045d9e`);
      **export Metro OK ambos targets** — Android 1233 módulos, iOS 1236 módulos,
      44 assets, bundles `.hbc` 3.3 MB c/u (`expo export --platform android --platform ios`).
- [~] T-041: actualizar fuentes canónicas, roadmap y registro de entrega —
      este archivo y `reportes/MOBILE_CONSOLIDATION_2026-09-07.md` actualizados
      con hallazgos. Pendiente: `ROADMAP.md`, `IMPLEMENTATION_STATUS_MATRIX.md`,
      `docs/SPEC_INDEX.md` (regenerar con `pnpm spec:index`).
- [~] T-050: CI, revisión e integración de GitHub — rama pusheada
      (`feat/semse-product-consolidation-20260906`), **PR draft #598** abierto
      2026-09-07. Falta CI terminal + review.
- [~] T-060: builds desde la misma revisión, instalación y canary en dispositivos.
      **Android**: build `preview` `680386ee-ee03-47f3-b18a-52a4827ddb08` desde
      `22ce0a06` lanzado 2026-09-07. **iOS**: **bloqueado** — la cuota de builds
      iOS del plan Free de EAS se agotó este mes (resetea 2026-10-01); los builds
      iOS `preview` del 2026-09-06 (`2deefd26…`) la consumieron. Opciones: esperar
      al reset, subir de plan, o probar iOS con el build `2deefd26…` existente
      (no es esta revisión). Instalación + canary autenticado por rol: pendiente
      del propietario en device.

Cada marca corresponde a evidencia observada; compilar no cierra T-060.

> **Actualización 2026-09-07 (sesión de continuación).** `ad7cb6f1` cerró
> T-010/T-011/T-012/T-021. Esta sesión añadió `50045d9e` (pull-to-refresh Admin
> + estabilidad de suite), verificó que **pagos no es un gap real** y que
> **LiveSession queda gateado** (contrato aparte). Pendiente para AAAA:
> export Metro, docs canónicas, push/PR/CI, y builds EAS + canary autenticado
> desde esta revisión. Ninguna fuente borrada; ningún cambio pisado.
