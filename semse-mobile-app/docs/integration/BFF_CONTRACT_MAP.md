# BFF Contract Map

Fecha: 2026-04-23

## Objetivo

Concentrar el mapa de contratos reales entre `semse-mobile-app` y el backend canónico de `project-manager-app`.

## Contratos vivos priorizados

- `jobs.list`
  BFF: `/api/semse/jobs`
  API: `/v1/jobs`
- `jobs.detail`
  BFF: `/api/semse/jobs/:jobId`
  API: `/v1/jobs/:jobId`
- `jobs.payments`
  BFF: `/api/semse/jobs/:jobId/payments`
  API: `/v1/jobs/:jobId/payments`
- `travel.list`
  BFF: `/api/semse/travel`
  API: `/v1/travel`
- `travel.detail`
  BFF: `/api/semse/travel/:travelId`
  API: `/v1/travel/:travelId`
- `travel.expenses`
  BFF: `/api/semse/travel/:travelId/expenses`
  API: `/v1/travel/:travelId/expenses`
- `travel.lodging`
  BFF: `/api/semse/travel/:travelId/lodging`
  API: `/v1/travel/:travelId/lodging`
- `travel.advances`
  BFF: `/api/semse/travel/:travelId/advances`
  API: `/v1/travel/:travelId/advances`
- `users.me`
  BFF: `/api/semse/users/me`
  API: derivado a `/v1/users/:userId` desde el BFF

## Estado

- `travel`, `jobs`, `payments` ya pueden usar contratos reales.
- `profile` depende de una nueva ruta BFF `users/me` para resolver el `userId` del contexto.
- Algunos repositorios todavia completan campos faltantes con defaults de presentacion porque el contrato visible no entrega toda la semantica movil.
