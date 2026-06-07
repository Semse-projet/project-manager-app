# Observabilidad API — 2026-04-08

## Objetivo

Cerrar el frente de observabilidad mínima operativa en el backend:

1. logs estructurados JSON;
2. propagación real de `requestId`;
3. métricas Prometheus básicas;
4. validación runtime.

## Repositorio trabajado

- `/home/yoni/labsemse/project-manager-app`

## Cambios implementados

### Contexto por request

Se añadió almacenamiento de contexto por request con `AsyncLocalStorage` en:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/infrastructure/observability/request-context.store.ts`

Contexto propagado:

- `requestId`
- `correlationId` si entra por header
- `method`
- `path`
- `userId`
- `tenantId`
- `orgId`

### Logger JSON

Se creó:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/infrastructure/observability/semse-logger.service.ts`

Ahora el proceso emite líneas JSON para:

- `api_bootstrap_complete`
- `http_request_completed`
- `http_exception`
- `http_unhandled_exception`

### Métricas

Se añadió:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/infrastructure/observability/metrics.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/infrastructure/observability/metrics.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/infrastructure/observability/observability.module.ts`

Endpoint nuevo:

- `GET /v1/metrics`

Formato:

- `text/plain`
- estilo Prometheus

Métricas expuestas:

- `semse_http_requests_total`
- `semse_http_errors_total`
- `semse_http_route_requests_total`
- `semse_http_route_errors_total`
- `semse_http_route_duration_ms_avg`

### Integración transversal

Se tocaron:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/main.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/request-id.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/http-exception.filter.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/infrastructure/prisma/prisma.module.ts`

Quedó activo:

- `x-request-id` en responses;
- hooks de `onRequest` y `onResponse`;
- medición de latencia por request;
- logging JSON por request completada.

## Tests

Nuevo test:

- `/home/yoni/labsemse/project-manager-app/apps/api/test/metrics.service.test.ts`

Suite unitaria actual del API:

- `auth-password.test.ts`
- `auth-token.test.ts`
- `env.schema.test.ts`
- `metrics.service.test.ts`
- `zod-validation.test.ts`

## Verificación ejecutada

### Tests

Ejecutado:

- `npm run test:unit --workspace @semse/api`

Resultado:

- `5/5` pasando

### Build

Ejecutado:

- `npm run build:api`

Resultado:

- `OK`

### Runtime

Se levantó el API compilado con `AUTH_SECRET` y se validó:

- `GET /v1/health`
- `GET /v1/metrics`

Resultados confirmados:

1. `GET /v1/health` devuelve `x-request-id`.
2. `GET /v1/metrics` devuelve métricas Prometheus válidas.
3. Tras ejecutar `health` y luego `metrics`, el endpoint mostró:
   - `semse_http_requests_total 2`
   - métricas por ruta para `/v1/health` y `/v1/metrics`
4. El proceso emitió logs JSON reales como:
   - `http_request_completed`
   - con `requestId`, `method`, `path`, `statusCode`, `durationMs`

## Límite residual

Aunque el request logging y el bootstrap final ya salen en JSON, Nest sigue imprimiendo algunas líneas internas de arranque tipo:

- `[Nest] ... LOG [InstanceLoader] ...`

Eso ocurre antes de que la app tome completamente el control del ciclo de logging.

Conclusión práctica:

- la observabilidad operativa útil ya está resuelta;
- la homogeneidad total del arranque todavía requiere una limpieza adicional del logger interno de Nest.

## Estado después de esta ronda

### Cerrado

- logs JSON por request
- propagación de `requestId`
- endpoint `/v1/metrics`
- counters básicos HTTP
- latencia media por ruta
- pruebas unitarias de la capa de métricas

### Pendiente del bloque general

- correlation id de dominio propagado automáticamente a más capas sin depender de header entrante
- envío a Sentry/APM
- métricas de negocio y del runtime agentic
- quality gates de lint/tsc en CI

## Siguiente paso recomendado

El siguiente frente con mejor retorno ahora es:

1. quality gates en CI (`lint`, `tsc`, `test:unit`)
2. `.env.example` y validación de variables más explícita para DX
3. ampliar cobertura backend por módulos críticos
