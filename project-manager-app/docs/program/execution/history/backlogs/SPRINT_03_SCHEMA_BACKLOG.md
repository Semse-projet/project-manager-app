# Sprint 03 Schema Backlog

## Objetivo

Hacer que `packages/schemas` sea el contrato real y verificable entre backend y web.

## Backlog

### Jobs

- revisar `job.schema.ts`
- alinear estados y campos con backend real
- distinguir lenguaje canonico de compatibilidad heredada

### Marketplace

- revisar `marketplace.schema.ts`
- confirmar payloads org-based
- documentar campos opcionales transitorios por usuario

### Projects

- revisar `project.schema.ts`
- confirmar shape real de list/detail/escrow/status update

### Ops

- revisar `ops.schema.ts`
- decidir si los snapshots deben consumirse desde proxy o desde backend directo

### Consumers

- revisar donde `web` sigue declarando tipos locales duplicados
- migrar solo cuando no rompa build/runtime

## Criterio de Cierre

- cada schema importante tiene consumidor claro
- no quedan schemas “aspiracionales” sin correspondencia con runtime
- divergencias quedan documentadas como transicion
