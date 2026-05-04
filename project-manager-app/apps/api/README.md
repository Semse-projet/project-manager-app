# apps/api

Backend principal en NestJS + Fastify adapter.

Responsabilidades:
- API REST versionada (`/v1`).
- Validación de entradas con Zod/Pipes.
- RBAC/ABAC y auditoría.
- Integraciones con pagos, storage y colas.

Módulos iniciales sugeridos:
- auth
- jobs
- bids
- projects
- milestones
- evidence
- disputes
- ops
- agents
