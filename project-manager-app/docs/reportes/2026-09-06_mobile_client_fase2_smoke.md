# Smoke Fase 2 — Mobile Client Tab (`apps/mobile`)

- **Fecha:** 2026-09-06
- **Spec:** `docs/specs/ui/mobile-client-tab.spec.md` (`risk: high`)
- **Tareas cubiertas:** T-064 (smoke funcional real), T-065 (smoke negativo de dinero)
- **Runbook:** `docs/specs/ui/mobile-client-tab.smoke.md`
- **Estado del reporte:** ⚠️ **BORRADOR — pendiente de completar con el run real.**
  Este archivo queda con la estructura y el contexto factual ya cargados;
  los resultados por paso y la evidencia los completa quien corre el smoke.
  El `spec.md` **no** pasa a `VERIFIED` hasta que esta sección esté llena.

---

## 1. Build probado

| Campo | Valor |
|---|---|
| Commit | `88171003` (`origin/main`, HEAD al momento del build) |
| Perfil EAS | `preview` |
| API destino | `https://api.semseproject.com` (prod) |
| Build Android | `167bd926-bd28-4d4f-a6b7-f6d98b7bd05d` — `finished` 2026-09-06 18:10 |
| APK Android | `https://expo.dev/artifacts/eas/A6cSud3ehsaWkNymw627v4Gfve_5v6WYF_EguYG-AcY.apk` |
| Build(s) iOS `preview` | 2026-09-06 (cuenta `semseproject.com` / proyecto `semse-mobile`) |
| Device / OS usado | _PENDIENTE_ |
| Cuenta `CLIENT` usada | _PENDIENTE (no anotar credenciales — solo el rol y, si aplica, el email)_ |

## 2. T-064 — Smoke funcional

Resultado por paso (`OK` / `FALLA` + nota):

| # | Paso | Esperado | Resultado |
|---|------|----------|-----------|
| 1 | Login CLIENT → rutea al tab de Cliente (no Worker, no placeholder) | tab de Cliente | _PENDIENTE_ |
| 2 | Tab **Jobs** lista los jobs propios con estado | lista `ready`/`empty` | _PENDIENTE_ |
| 3 | Abrir un job → detalle: job + bids + milestones + evidencia (solo lectura) | detalle completo | _PENDIENTE_ |
| 4 | **Aceptar** un bid pendiente (P2) | `POST /v1/bids/:bidId/accept` OK, job → `reserved`/`accepted` | _PENDIENTE_ |
| 5 | **Aprobar** un milestone `submitted` (P3) | `POST /v1/milestones/:milestoneId/approve` OK, milestone → `approved` | _PENDIENTE_ |
| 6 | Enviar un **rating** en un job `completed` (P4) | `POST /v1/ratings` OK, sin duplicar al reintentar | _PENDIENTE_ |
| 7 | Pull-to-refresh en lista y detalle | recarga sin crash | _PENDIENTE_ |
| 8 | Modo avión → pantalla de datos | estado `error` legible, recupera al volver la red | _PENDIENTE_ |
| 9 | Push de `milestone.submitted` con app en background | llega push (los de **bids** NO llegan, por diseño — gap de backend, spec §2) | _PENDIENTE_ |

**Veredicto T-064:** _PENDIENTE (PASA / FALLA)_

## 3. T-065 — Smoke negativo (dinero)

`risk: high` — confirmar que desde la app de Cliente **no hay forma de mover dinero**:

- [ ] Sin acción para **fondear escrow** (`/v1/jobs/:jobId/escrow/fund`)
- [ ] Sin acción para **depositar** (`/v1/projects/:projectId/escrow/deposit`)
- [ ] Sin acción para **liberar/release** (`/v1/milestones/:milestoneId/escrow/release`) — aprobar milestone no ofrece "liberar pago" en el mismo gesto
- [ ] Sin pantalla de **rechazar milestone** / "pedir cambios" (rol CLIENT sin `milestones:reject`)
- [ ] Sin acceso a **publicar job**, **marketplace**, **disputes**, **finanzas/invoices** desde ningún tab de Cliente

**Veredicto T-065:** _PENDIENTE (PASA / FALLA)_

## 4. Evidencia

- Grabación / capturas: _PENDIENTE — link o adjunto_
- Notas de desvíos: _PENDIENTE_

## 5. Cierre

Cuando T-064 y T-065 estén en verde con evidencia adjunta:

1. `spec.md`: `deploy_status: DEPLOYED`, `activation_status: ACTIVE`,
   `status: VERIFIED`, `production_evidence: [<links>]`, `last_verified: "2026-09-06"`
2. `tasks.md`: tildar T-064, T-065, T-066, T-067 y todo el "Criterio de Done";
   `status: DONE`
3. `pnpm spec:index`
4. Push de la rama `docs/mobile-client-tab-fase2-close-2026-09-06` + PR

Si algún paso **FALLA**: no promover a `production`, abrir el bug con el paso
que rompió, `spec.md` queda en `IMPLEMENTED`.
