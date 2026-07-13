# Estado de pendientes

Fecha: 2026-06-23.

## Resuelto

- PR #198 mergeada.
- CI de PR #198 en verde.
- CodeQL de PR #198 en verde.
- CI post-merge en `main` en verde.
- Railway Deploy post-merge en verde.
- Production Health Gate post-merge en verde.
- Fallo de `Dependabot Updates` para esbuild investigado: `security_update_not_needed`; no requiere cambio de codigo.

## Sigue pendiente

- Definir politica para `graphify-out`.
- Limpiar ramas remotas antiguas, con confirmacion previa.
- Reconciliar backlog canonico desfasado.
- Decidir si se envia reporte al correo configurado en `REPORT_NOTIFICATION_EMAIL`.

## Bloquea decision del usuario

- Borrar o descartar artefactos `graphify-out` requiere aprobacion, porque hay archivos trackeados y cambios grandes.
- Borrar ramas remotas requiere aprobacion, porque es accion destructiva/remota.
- Enviar correo requiere aprobacion explicita del destinatario, asunto y cuerpo.
