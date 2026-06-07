# Swagger OpenAPI - 2026-04-08

## Objetivo

Cerrar el gap de documentación navegable de la API NestJS sin rehacer hoy todos los DTOs del backend.

La meta de esta fase fue:

1. exponer documentación viva de la API actual;
2. validar que funcione sobre Fastify en runtime real;
3. no romper el bucle de build, lint y tests ya endurecido.

## Cambios realizados

### 1. Integración de Swagger en bootstrap

Se actualizó `apps/api/src/main.ts` para:

- importar `DocumentBuilder` y `SwaggerModule`
- construir un documento OpenAPI de la API SEMSE
- exponer:
  - `/v1/docs`
  - `/v1/docs-json`

También se dejó log explícito de bootstrap con:

- `docsPath`
- `docsJsonPath`

### 2. Dependencias de integración Fastify

Se actualizó `apps/api/package.json` agregando:

- `@nestjs/swagger`
- `@fastify/static`

`@fastify/static` fue necesario porque `@nestjs/swagger` sobre Fastify lo requiere como peer dependency para servir correctamente la UI.

## Validación local

Matriz verde:

```bash
npm install --workspaces
npm run lint --workspace @semse/api
npm run test:unit --workspace @semse/api
npm run build:api
```

Verificación runtime:

```bash
HOST=127.0.0.1 PORT=4110 AUTH_SECRET=semse_local_secret_123456789012345 node apps/api/dist/main.js
curl -i http://127.0.0.1:4110/v1/docs-json
curl -I http://127.0.0.1:4110/v1/docs
```

Resultado:

- `GET /v1/docs-json` respondió `200 OK`
- `GET /v1/docs` respondió `200 OK`
- la documentación quedó expuesta con seguridad HTTP activa
- el JSON OpenAPI ya enumera los endpoints reales del backend actual

## Incidencias encontradas

### 1. Falso arranque fallido por puertos ocupados

Durante la validación runtime hubo varios `EADDRINUSE` en:

- `4102`
- `4105`
- `4106`

Eso no era un fallo de Swagger ni del bootstrap de la API, sino puertos ya ocupados por procesos previos del entorno local.

### 2. Peer dependency faltante

El primer intento de integrar Swagger no era suficiente porque faltaba `@fastify/static`.

El build seguía pasando, pero la integración Fastify quedaba incompleta para runtime. Se corrigió en esta misma fase.

## Alcance real

Esta fase resuelve:

- documentación navegable viva
- JSON OpenAPI exportable
- exploración rápida de los endpoints existentes

Esta fase no resuelve todavía:

- `@ApiProperty` detallado en todos los payloads
- DTOs documentados de forma exhaustiva
- descripciones finas por endpoint con `@ApiOperation`

Eso puede hacerse en una segunda pasada si conviene elevar calidad de contrato, pero ya no estamos en `sin documentación`.

## Resultado

- SEMSE API ya tiene Swagger funcional
- `/v1/docs` y `/v1/docs-json` existen y responden
- la integración quedó compatible con Fastify
- build, lint y tests del API siguieron verdes
