# Configuracion de notificaciones

## Destinatario principal

- Nombre: Samuel Castella
- Correo: variable `REPORT_NOTIFICATION_EMAIL`

## Cadencia

- Reporte semanal completo: lunes al cierre del dia.
- Mini-reporte de riesgo: viernes al mediodia.
- Alertas inmediatas: CI/deploy fallido, PR bloqueada, issue critica o deuda tecnica urgente.

## Formato de correo

Asunto:

`Reporte semanal SEMSE - YYYY-MM-DD a YYYY-MM-DD`

Cuerpo:

1. Resumen ejecutivo.
2. Trabajo completado.
3. Pendientes principales.
4. Bloqueos o riesgos.
5. Plan de la siguiente semana.
6. Acciones que requieren decision.

## Regla de envio

Antes de enviar un correo, el agente debe mostrar el destinatario, asunto y cuerpo completo para aprobacion explicita.
