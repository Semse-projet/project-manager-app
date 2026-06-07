# packages/ui

Design system compartido de SEMSEproject.

## Objetivo

Ser la capa unica de componentes reutilizables para `apps/web`.

## Contenido inicial

- `StatusBadge`
- `StatCard`
- `JobCard`
- `AgentChatPanel`
- `AppShell`

## Regla

Componente reusable nuevo:

- entra primero aqui;
- no pega a APIs;
- no define logica de negocio;
- consume contratos y view models ya resueltos.

## Uso

Este paquete expone componentes React puros y layout compartido.

La logica de datos, fetch y autorizacion sigue viviendo en la app o en servicios
canonicos.
