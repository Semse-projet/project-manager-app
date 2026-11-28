# Alertas de plazo de lien: el aviso al PRO ya se envía

**Fecha:** 2026-11-11 · **Rama:** `feat/lien-deadline-alert-notifications` · **Spec:** `tools.lien-rights-management` (m2.1, APPROVED) · **Decisión:** D-LIEN (dueño, 2026-11-11), registrada como PD-10 en `docs/specs/ui/audit-product-decisions.spec.md`

## Qué faltaba

El scheduler de plazos de lien transicionaba `LienCalendar` (30, 7 y 3 días) y generaba los notices, pero el "push + email al PRO" de la spec era un TODO: nadie recibía el aviso. Faltaba decidir el destinatario, porque el proyecto apunta a una organización (`assignedProOrgId`), no a un usuario.

## Decisión D-LIEN

Reciben el aviso **todos los miembros `ACTIVE` con rol `PRO` de la organización asignada**, dentro del tenant del proyecto y con usuario activo.

## Cambio

- `NotificationsService.notifyUsers(...)`: notificación directa a usuarios concretos por el mismo canal que los eventos (in-app + SSE, push, WhatsApp si está habilitado). `handleEvent` reutiliza el mismo envío; su comportamiento no cambia.
- `LienAlertsScheduler`: tras cada transición resuelve los destinatarios y envía la notificación `lien_deadline_alert` y un email (`EmailService`). A 3 días el texto es "Último aviso" e indica que los notices ya se generaron.
- Best-effort: sin destinatarios o con fallo de envío, la transición se mantiene, el job no falla y queda en el log.
- `LiensModule` importa `NotificationsModule` y provee `EmailService`. Sin migraciones.

## Verificación

- `apps/api/test/lien-deadline-alert-notifications.test.ts`: 4/4 (filtro exacto de destinatarios, notificación y email por miembro, último aviso con notices, sin transición no hay aviso, deduplicación, fallos tolerados). Control negativo: con el scheduler de `main` fallan los 4.
- Suites de liens y notificaciones existentes en verde (`lien-alerts-scheduler-integration` 2, `bloque-u-liens-automation` 19, `liens-integration` 13, `notifications` 40, `buildops-notifications.service` 11).
- `tsc --noEmit` y eslint sin errores. Suite completa de la API: ver el PR.

## Pendiente

- **Activación (dueño):** `LIEN_ALERTS_ENABLED=true` en semse-worker. Hasta entonces el chequeo horario no corre.
- El email depende de que la API tenga un proveedor utilizable (Resend con dominio verificado o Gmail); si no, solo llega la notificación in-app/push y el log lo indica (`emailsSent: 0`).
- Web y móvil no tienen todavía una navegación específica para `lien_deadline_alert`: la notificación se muestra, pero no abre el calendario de liens.
