# Client Surfaces

## Identidad

La superficie `client` es el panel de orquestacion del comprador. Su trabajo es decidir, aprobar, pagar y supervisar.

## Proposito

- Publicar trabajos.
- Comparar propuestas.
- Aprobar hitos y entregables.
- Revisar pagos, documentos y disputas.

## Principios no negociables

- El cliente nunca debe operar sobre estados ambiguos.
- Cada vista debe derivar de contratos canonicos de `jobs`, `projects`, `milestones`, `payments` o `disputes`.
- Las pantallas de decision deben poder explicar su fuente de verdad.

## Estado actual

- Las pantallas siguen en `mock/adapt`.
- Siguiente bloque recomendado despues de `worker`: `ClientDashboard`, `ClientMisTrabajos`, `ClientProyectoActivo`, `ClientPagos`.
