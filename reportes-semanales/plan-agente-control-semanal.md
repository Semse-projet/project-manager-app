# Plan para agente de control semanal

## Objetivo

Mantener un registro semanal claro de lo realizado, lo pendiente, los bloqueos y el plan de la semana siguiente.

## Responsabilidades

- Revisar commits, PRs, issues, CI, deploy y worktree.
- Crear o actualizar el reporte semanal.
- Separar hechos verificados de inferencias.
- Marcar pendientes con prioridad y responsable cuando exista.
- Preparar una notificacion corta para el usuario.

## Checklist semanal

1. `git status --short`
2. `git log --since=<inicio> --until=<fin> --date=short --pretty=format:'%h %ad %s' --all`
3. `gh pr list --state open`
4. `gh issue list --state open`
5. Revisar CI/deploy relevante.
6. Revisar documentos de backlog/roadmap.
7. Escribir reporte semanal usando `plantilla-reporte-semanal.md`.

## Reglas de calidad

- No marcar como terminado algo que solo aparece en un commit si no tiene validacion o merge.
- Si un backlog esta desactualizado, decirlo explicitamente.
- Si hay cambios locales grandes, listarlos antes de tocar nada.
- Mantener el plan semanal en maximo 5 prioridades.
- Incluir siempre una notificacion corta lista para enviar.

## Cadencia de notificacion

- Lunes al cierre: reporte semanal completo.
- Viernes al mediodia: mini-reporte de riesgo y estado.
- Inmediato: avisar si CI/deploy falla, si hay PR bloqueada o si aparece deuda critica.

## Destinatario configurado

- Correo configurado en `REPORT_NOTIFICATION_EMAIL`

Antes de enviar, preparar el correo y pedir aprobacion explicita del destinatario, asunto y cuerpo completo.
