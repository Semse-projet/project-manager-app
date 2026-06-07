# Operacion Asistida Recovery Checklist

Usar este checklist en drills mensuales y recuperaciones reales.

## Identificacion

- [ ] Fecha registrada.
- [ ] Responsable registrado.
- [ ] Entorno registrado.
- [ ] Tenant afectado registrado.
- [ ] Motivo de activacion registrado.

## Restore

- [ ] Backup full identificado.
- [ ] WAL/rango incremental identificado si aplica.
- [ ] Restore probado primero en entorno aislado.
- [ ] Migraciones Prisma verificadas.
- [ ] Health API verificado.

## Operacion asistida

- [ ] `AgentRun` recupera runs esperados.
- [ ] `operatorContext` existe en runs relevantes.
- [ ] `workspace_memory` existe para workspaces relevantes.
- [ ] Ops runtime filtra por `workspaceId`.
- [ ] Ops runtime filtra por `operatorId`.
- [ ] Ops runtime filtra por `memoryTag`.
- [ ] Trace por `correlationId` muestra runs y memoria contextual.

## Auditoria

- [ ] `AuditLog` explica acciones relevantes.
- [ ] Eventos de dominio explican triggers cuando aplica.
- [ ] No se uso cache como fuente primaria.
- [ ] Backup externo quedo clasificado como recuperacion, no runtime.

## Validacion

- [ ] `npm run drill:operacion-asistida:bcp` ejecutado en modo local.
- [ ] Evidencia JSON del drill local guardada.
- [ ] Interruptor `SEMSE_BCP_DRILL_MODE=api` preparado para API viva.
- [ ] `npm run verify:operacion-asistida:bcp` ejecutado.
- [ ] `npm run smoke:operacion-asistida` ejecutado si habia API/DB viva.
- [ ] Resultado documentado.
- [ ] Brechas convertidas en backlog.

## Cierre

- [ ] RTO cumplido o excepcion documentada.
- [ ] RPO cumplido o excepcion documentada.
- [ ] Owner aprobo cierre.
- [ ] Reporte guardado en la ruta canonica correspondiente.
