# Canary — Consolidación móvil (`apps/mobile`)

- **Spec:** `docs/specs/ui/mobile-product-consolidation.spec.md` §8 (`risk: high`)
- **Tarea:** T-060 (`mobile-product-consolidation.tasks.md`)
- **Ejecuta:** el propietario, en device/simulador **real**, con cuentas reales de cada rol. `tsc`/jest/`expo export` no cuentan.
- **Estado:** ⚠️ PENDIENTE — plantilla; los resultados los completa quien corre el canary.

---

## 0. Build bajo prueba

| Campo | Valor |
|---|---|
| Rama | `feat/semse-product-consolidation-20260906` (PR draft #598) |
| Commit | `22ce0a06` (o superior — anotar el real) |
| API | `https://api.semseproject.com` (prod) |
| Build Android `preview` | `680386ee-ee03-47f3-b18a-52a4827ddb08` — APK: `https://expo.dev/artifacts/eas/NNT-3wR2Ub_IW02zqTbBn20Kb9dRdmPAEk6i4RKX8uo.apk` |
| Build Android `development` | `a8fd23ef-c55c-489d-b733-226a39b58317` (commit `1b51bf9d`) — usar este si se necesita el dev-client / módulos nativos |
| Build iOS | ❌ bloqueado — cuota EAS Free, resetea 2026-10-01 |
| Device/OS usado | _PENDIENTE_ |

Instalar: abrir el link del APK en el teléfono → Instalar → permitir "origen desconocido". Instala encima de cualquier versión previa (mismo `com.semse.mobile`).

## 1. Sesión y cuentas (todos los roles)

| # | Paso | Esperado | Resultado |
|---|------|----------|-----------|
| 1 | Login con cuenta válida | Entra; rutea al tab del rol correcto (Worker/Client/Admin), no a un placeholder | _PEND_ |
| 2 | Cerrar la app y reabrir | Restaura la sesión sin re-login; muestra estado de "restaurando" si tarda | _PEND_ |
| 3 | Logout | Vuelve al login; no quedan datos del usuario anterior visibles | _PEND_ |
| 4 | Login con **otra** cuenta (rol distinto) | Rutea al nuevo rol; **cero** datos de la cuenta anterior (jobs, timer, notificaciones) | _PEND_ |
| 5 | Forzar expiración (dejar la app abierta hasta que el token venza, o revocar sesión desde web) | Cae a login con mensaje legible, no pantalla en blanco ni loop | _PEND_ |
| 6 | Login con credenciales mal | Error legible; no crashea | _PEND_ |
| 7 | Modo avión durante el login | Error de red legible; reintenta al volver la red | _PEND_ |

## 2. Worker

| # | Paso | Esperado | Resultado |
|---|------|----------|-----------|
| W1 | Tab Jobs / Bids | Lista los asignados con estado; estados loading/empty/ready | _PEND_ |
| W2 | Abrir un job → detalle | Datos + acciones del rol | _PEND_ |
| W3 | **Timer**: iniciar contra un job | Corre; se ve el tiempo activo | _PEND_ |
| W4 | **Timer offline**: activar modo avión con el timer corriendo | Sigue contando en local; indica "sin conexión"; NO pierde la sesión local | _PEND_ |
| W5 | Volver la red | Sincroniza el estado; NO duplica; si el backend rechaza, lo muestra (no lo oculta como "ok") | _PEND_ |
| W6 | Timer: **pausar / reanudar** | Transiciones correctas; el total no salta | _PEND_ |
| W7 | Timer: **entrada manual** | Crea la entrada contra la API; aparece en el historial | _PEND_ |
| W8 | Captura de **evidencia** (foto/galería) contra un job | Sube; queda asociada | _PEND_ |
| W9 | **Notificaciones**: con la app en background, disparar un evento de milestone desde web | Llega push de milestone (los de bids NO llegan — gap de backend conocido) | _PEND_ |
| W10 | **Proximidad** (si aplica al build): acercarse a un sitio de job | Prompt / auto-start según preferencia `ask`/`auto`/`off` | _PEND_ |

## 3. Client

| # | Paso | Esperado | Resultado |
|---|------|----------|-----------|
| C1 | Tab Jobs | Lista los jobs propios con estado | _PEND_ |
| C2 | Detalle: bids + milestones + evidencia (solo lectura) | Todo visible; sin botón de capturar evidencia | _PEND_ |
| C3 | **Aceptar** un bid pendiente | `POST /v1/bids/:id/accept` OK; job → reservado/aceptado | _PEND_ |
| C4 | **Aprobar** un milestone `submitted` | `POST /v1/milestones/:id/approve` OK | _PEND_ |
| C5 | **Rating** en un job `completed` | `POST /v1/ratings` OK; no duplica al reintentar | _PEND_ |
| C6 | **Negativo (dinero):** confirmar que NO hay forma de fondear/depositar/liberar escrow, rechazar milestone, ni entrar a marketplace / publicar job / disputes / finanzas | Ninguna de esas acciones alcanzable | _PEND_ |

## 4. Admin (OPS_ADMIN)

| # | Paso | Esperado | Resultado |
|---|------|----------|-----------|
| A1 | Rutea al tab Admin con las tabs Fase 7 (Dashboard, Disputes, Labor, Users, Contractors, Trust, Reputation, Settings) | Todas cargan; datos tenant-wide read-only | _PEND_ |
| A2 | **Dashboard: pull-to-refresh** (nuevo en la consolidación) | Recarga los stats sin crash | _PEND_ |
| A3 | Disputes / Users / Trust / Reputation: abrir detalle | Read-only; sin acciones de mutación (assign/resolve/verify/etc.) | _PEND_ |
| A4 | **Negativo:** confirmar que Admin no puede mutar estado de dominio ni mover dinero desde móvil | Sin acciones de escritura de negocio | _PEND_ |

## 5. Prometeo (todos los roles con acceso)

| # | Paso | Esperado | Resultado |
|---|------|----------|-----------|
| P1 | Abrir la pantalla de Prometeo, mandar un mensaje | Responde vía `POST /v1/ai-models/prometeo/chat`; estados loading/error legibles | _PEND_ |
| P2 | Si propone una acción | Queda como propuesta sujeta a aprobación; NO se ejecuta sola | _PEND_ |
| P3 | Cortar la red a mitad de una respuesta | Error legible; la pantalla no queda colgada | _PEND_ |

## 6. Resiliencia (transversal)

| # | Paso | Esperado | Resultado |
|---|------|----------|-----------|
| R1 | Mandar la app a background 5+ min y volver | Reanuda sin re-login ni crash; refresca datos al foco | _PEND_ |
| R2 | Denegar permisos de cámara/ubicación/notificaciones y luego usar esa función | Explica qué falta y ofrece la acción para concederlo; no crashea | _PEND_ |
| R3 | Recorrer 10+ pantallas seguidas y hacer back | Sin crash, sin fugas de memoria visibles (la app no se pone lenta) | _PEND_ |
| R4 | Rotar el teléfono / cambiar tamaño de fuente del SO | Layout no se rompe | _PEND_ |

## 7. Evidencia

- Grabación de pantalla o capturas de los recorridos críticos (§1, §2 W3–W7, §3, §5).
- Device + versión de OS + ID de build EAS.
- Guardar en `docs/reportes/2026-09-XX_mobile_consolidation_canary.md`.

## 8. Cierre

**Si todos los gates pasan:**
- `mobile-product-consolidation.spec.md`: `deploy_status: DEPLOYED`, `activation_status: ACTIVE`, `status: VERIFIED`, `production_evidence: [<links>]`, `last_verified`.
- `tasks.md`: tildar T-060 y "Criterio de Done"; `status: DONE`.
- Sacar PR #598 de draft.
- (Y en el checkout principal: cerrar PR #596 de Fase 2 Client, que comparte los flujos C1–C6.)

**Si algún gate falla:** no promover; abrir el bug con el paso exacto; el spec queda `IN_PROGRESS`.

**iOS:** repetir §1–§6 en un build iOS cuando la cuota EAS se reponga (2026-10-01) o se suba de plan. El canary no se declara completo con una sola plataforma (spec §8: "validación real en iOS/Android").
