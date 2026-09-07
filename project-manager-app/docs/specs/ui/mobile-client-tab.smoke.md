---
type: smoke-runbook
feature: "Mobile Client Tab — Fase 2 de apps/mobile"
spec: "docs/specs/ui/mobile-client-tab.spec.md"
covers_tasks: ["T-064", "T-065"]
date: "2026-09-06"
executor: "usuario (en device/simulador real, cuenta CLIENT real)"
---

# Smoke runbook — Mobile Client Tab (Fase 2)

Cierra **T-064** (smoke funcional real) y **T-065** (smoke negativo de dinero)
de `mobile-client-tab.tasks.md`. No se puede automatizar: requiere un device
o simulador real con una cuenta `CLIENT` de verdad y un job con datos.
`tsc --noEmit` / jest **no cuentan** como este paso.

## 0. Prerrequisitos

- [ ] Build EAS `preview` instalado en el device:
  - **Android:** APK del build `preview` (lanzado 2026-09-06 desde `main`
    `88171003`). Descargar el `.apk` de
    `https://expo.dev/accounts/semseproject.com/projects/semse-mobile/builds`
    y sideload (`adb install <archivo>.apk` o abrir el link en el device).
  - **iOS:** build `preview` del 2026-09-06 (internal distribution) —
    instalar vía el link de EAS con el UDID del device ya registrado, o
    correr en simulador con el `.app`/`.tar.gz` del build.
- [ ] El build apunta a **producción**: `eas.json` → perfil `preview` →
  `EXPO_PUBLIC_SEMSE_API_BASE_URL=https://api.semseproject.com`. No hace
  falta configurar nada en el device.
- [ ] Credenciales de una cuenta con rol **`CLIENT`** en producción.
- [ ] Esa cuenta tiene **al menos un job** con: ≥1 bid pendiente, ≥1
  milestone en estado `submitted`, y algo de evidencia subida por el
  profesional. Si no hay datos así, prepararlos desde `apps/web`
  (`app.semseproject.com`) con esa misma cuenta antes de empezar.
- [ ] Idealmente un segundo job ya `completed` para poder probar el rating
  (P4). Si no existe, se puede omitir P4 y anotarlo.

## 1. Smoke funcional (T-064)

Ejecutar en orden. Marcar cada paso y anotar cualquier desvío.

| # | Paso | Esperado | OK |
|---|------|----------|----|
| 1 | Abrir la app, login con la cuenta CLIENT | Entra y **rutea al tab de Cliente** (no al de Worker, no al placeholder "La app de Cliente todavía se está construyendo") | ☐ |
| 2 | Tab **Jobs** | Lista los jobs propios del cliente con su estado visible; estados `loading`→`ready`, o `empty` si no hay jobs | ☐ |
| 3 | Tocar un job | Abre el detalle: datos del job + **bids recibidos** + **milestones** + **evidencia** (solo lectura, sin botón de capturar) | ☐ |
| 4 | Sobre un bid pendiente, tocar **Aceptar** (P2) | `POST /v1/bids/:bidId/accept` OK; el job pasa a `reserved`/`accepted`; la UI refleja el cambio | ☐ |
| 5 | Sobre un milestone `submitted`, tocar **Aprobar** (P3) | `POST /v1/milestones/:milestoneId/approve` OK; el milestone pasa a `approved` en la UI | ☐ |
| 6 | En un job `completed`, abrir el formulario de **rating** y enviarlo (P4) | `POST /v1/ratings` OK; queda registrada la calificación; reintentar no duplica visualmente | ☐ |
| 7 | Pull-to-refresh en la lista y en el detalle | Recarga sin crash; datos consistentes | ☐ |
| 8 | Forzar un error (modo avión → abrir una pantalla de datos) | Estado `error` legible, no pantalla en blanco ni crash; al volver la red, recupera | ☐ |
| 9 | Push de milestone: con la app en background, que el profesional haga `submit` de un milestone (o dispararlo desde web) | Llega push de `milestone.submitted`. *(Nota: los push de **bids** NO llegan por diseño — es un gap de backend documentado en spec §2, no un fallo de este smoke.)* | ☐ |

## 2. Smoke negativo — dinero (T-065)

El spec es `risk: high` justamente porque accept/approve destraban flujos de
escrow indirectamente. Confirmar que **desde la app de Cliente no hay forma
de mover dinero**:

- [ ] No existe ningún botón/pantalla/acción para **fondear escrow**
  (`/v1/jobs/:jobId/escrow/fund`).
- [ ] No existe ningún botón/pantalla/acción para **depositar**
  (`/v1/projects/:projectId/escrow/deposit`).
- [ ] No existe ningún botón/pantalla/acción para **liberar/release**
  (`/v1/milestones/:milestoneId/escrow/release`) — aprobar un milestone
  **no** debe ofrecer "y liberar el pago" en el mismo gesto.
- [ ] No hay pantalla de **rechazar milestone** ni "pedir cambios" (el rol
  CLIENT no tiene `milestones:reject` — spec §2).
- [ ] No hay acceso a **publicar job**, **marketplace/buscar profesionales**,
  **disputes**, ni **finanzas/invoices** desde ningún tab del Cliente.

## 3. Evidencia a adjuntar

- [ ] Grabación de pantalla o capturas de los pasos 1–6.
- [ ] Nota de qué device/OS y qué build (ID de EAS) se usó.
- [ ] Guardar en `docs/reportes/2026-09-06_mobile_client_fase2_smoke.md`.

## 4. Cierre (tras un smoke en verde)

En `docs/specs/ui/mobile-client-tab.spec.md`:

- `deploy_status: DEPLOYED` (el build `preview` probado en device es el
  equivalente a deploy para esta superficie sin backend propio)
- `activation_status: ACTIVE`
- `status: VERIFIED`
- `production_evidence: [ ... ]` — link al reporte / grabación
- `last_verified: "2026-09-06"` (o la fecha real del run)

En `docs/specs/ui/mobile-client-tab.tasks.md`: marcar T-064..T-067 y el
"Criterio de Done". Correr `pnpm spec:index`.

Si el smoke **falla**: no promover a `production`, abrir el bug con el paso
que rompió, y dejar el spec como está (`IMPLEMENTED`, no `VERIFIED`).
