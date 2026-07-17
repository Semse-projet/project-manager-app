# SEMSE Forge — Rollback e incidentes

## Activadores

- migración fallida;
- CI degradado;
- autorización rota;
- fuga de datos;
- cambio fuera de scope;
- despliegue no saludable;
- evidencia falsificada;
- costo o iteraciones fuera de límite.

## Acción inmediata

1. Pausar el run.
2. Revocar leases.
3. Bloquear tareas descendientes.
4. Preservar logs, diff, spec digest y outputs.
5. Clasificar severidad.
6. Revertir si existe cambio aplicado.
7. Notificar owner, seguridad y ops.
8. Abrir spec correctivo.

## Regla de datos

Nunca editar una migración ya aplicada. La recuperación se hace con migración compensatoria o restore probado.

## Regla de producción

Forge propone rollback; la ejecución de rollback crítico requiere dual control salvo mecanismo automático previamente aprobado.

## Cierre

Un incidente no se cierra sin:

- causa raíz;
- impacto;
- timeline;
- recuperación;
- pruebas;
- prevención;
- actualización de spec/runbook.
