# Reporte — C28/C10 Liens: control de acceso tenant + org + proyecto (Wave A, lotes A2/A3)

**Fecha:** 2026-09-30 · **Base:** main

## Estado
- C28 (gate de waivers): **sigue PARCIAL**. Se cierra una vía de bypass del gate (firma de waivers); la otra vía (release manual sin `evaluate()`) sigue pendiente de ADR-041 (PR #701).
- C10: avance (segundo hueco concreto tras evidence-gateway). Quedan tasks, reservations, ratings, trust, worker-verification por inventariar.

## Hallazgo (verificado en código)
Los 4 controladores de liens eran `@AuthenticatedAccess` ("pending granular lien permissions"): **cualquier usuario autenticado de cualquier tenant/org** podía, e ignorando el `projectId` de la URL:
1. `POST …/waivers/:waiverId/sign`: marcar cualquier waiver como `SIGNED` con una firma arbitraria → despeja el gate `WaiverPaymentGateService` del release de pagos.
2. `POST …/notices/:noticeId/send`: disparar **correo certificado real vía Lob.com** para cualquier notice.
3. Crear calendarios, generar notices, cambiar estado de calendarios y leer calendarios/waivers/notices de cualquier proyecto.

## Cambios
- Nuevo `liens/lien-access.service.ts`: `assertLienAccess` (política pura) + `LienAccessService` (`assertProject/Calendar/Waiver/Notice`).
  - `read`: org cliente, org pro asignada, OPS_ADMIN. `pro`: org pro asignada u OPS_ADMIN (firmar waivers, generar/enviar notices, crear calendarios). `ops`: sólo OPS_ADMIN (transición de estado de calendario, que es de scheduler).
  - Proyecto fuera del tenant → 404; org ajena → 403; waiver/notice/calendar deben pertenecer al proyecto del path (404 si no).
- Los 3 controladores aplican el chequeo antes de cualquier lectura/escritura. Sin migraciones; sin cambio de formato de respuesta.

## Tests
- Nuevo `test/lien-access.test.ts` (7): política por modo, fail-closed con orgId vacío, 404/403, recursos de otro proyecto, firma/envío/estado denegados **sin llegar al servicio**, caminos permitidos.
- 5 tests existentes adaptados a las nuevas firmas (fake allow-all del acceso; intención intacta).
- API unit: 2568 tests, 2531 pass, 0 fail; tsc, lint, nest build OK.

## Decisiones / riesgos
- Suposición de negocio: el firmante de waivers y remitente de notices es la org profesional asignada (reclamante del lien); el cliente sólo lee. Confirmar con producto.
- Cambio de comportamiento: clientes y usuarios de otras orgs ya no pueden firmar/enviar; OPS_ADMIN sí.
- Pendiente: permisos RBAC granulares para liens (hoy se usa ownership + OPS_ADMIN) y el token de `sign-url` (base64 del id, no firmado).
- `WaiverPaymentGateService` no se tocó.
