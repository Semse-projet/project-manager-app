# 04 — Roles and Permissions

## Roles principales

```txt
Super Admin
Organization Admin
Contractor Owner
Project Manager
Field Supervisor
Worker
Client
Auditor
Finance Operator
Support Agent
AI Agent
```

## Permisos por dominio

```txt
project.create
project.read
project.update
project.delete

evidence.submit
evidence.review
evidence.approve
evidence.reject

payment.hold
payment.release
payment.refund

worker.track_time
worker.edit_time
worker.approve_time

ai.read_context
ai.suggest_action
ai.execute_action
```

## Regla para agentes IA

Un agente puede sugerir acciones, pero toda acción de alto riesgo requiere aprobación humana.

Alto riesgo:

- Liberar pagos.
- Rechazar evidencia crítica.
- Eliminar documentos.
- Cambiar permisos.
- Modificar contratos.
- Crear o cerrar disputas.

