# Sprint 02 Security Backlog

## Objetivo

Cerrar ownership y autorizacion por recurso en agregados vecinos de `projects`.

## Backlog

### Payments

- revisar `payments.service.ts`
- revisar `payments.repository.ts`
- asegurar ownership por recurso en releases y financial reads
- agregar smoke de denegacion si falta

### Milestones

- revisar submit/approve/reject
- confirmar ownership por org
- verificar que milestones no puedan mutarse fuera del recurso valido

### Evidence

- revisar lectura y escritura
- asegurar que `uploadedBy` no sustituye ownership del recurso

### Disputes

- revisar open/assign/resolve
- proteger lectura de disputas por ownership real
- revisar impacto de disputa activa en lifecycle

### Auth Bootstrap

- dejar claro donde termina `request-context`
- evitar nuevas decisiones de seguridad apoyadas solo en headers

## Criterio de Cierre

- ningun agregado sensible autoriza solo por `tenantId`
- permissions y ownership quedan explicitos
- existe al menos smoke o prueba de denegacion por agregado tocado
