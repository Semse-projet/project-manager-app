# Informe de Levantamiento Backend

> Nota histórica: este informe refleja el estado del backend durante la fase inicial de estabilización local. Varias conclusiones operativas fueron superadas por cierres posteriores de migraciones, runtime y consolidación del canónico.

Fecha: 2026-04-04
Proyecto: `project-manager-app`
Ámbito: backend `apps/api` + base local `PostgreSQL`

## 1. Objetivo

Levantar el backend completo en entorno local real, no solo a nivel de compilación.

Esto implicaba:

- levantar PostgreSQL en `localhost:5433`
- alinear la base con el schema actual de Prisma
- sembrar datos base
- ejecutar `test:api` contra el backend real

## 2. Hallazgos iniciales

Situación al empezar:

- `apps/api` ya compilaba y tipaba limpio
- el smoke runner del API existía
- la base local no estaba accesible
- luego, al levantarla, apareció drift de schema en la tabla `User`

Error real detectado:

```text
The column `milestonesApproved` does not exist in the current database.
```

Eso confirmó que el problema no era solo infraestructura faltante, sino una base local desalineada con el schema actual del código.

## 3. Acciones ejecutadas

### 3.1 Infraestructura

Se levantó PostgreSQL con Docker Compose usando:

- `infra/docker/compose.semse-mvp.yml`

Estado confirmado:

- contenedor `semse-postgres`
- puerto `5433`
- estado `healthy`

### 3.2 Base de datos

Se ejecutaron estos pasos:

1. `npm run db:migrate`
2. detección de drift real entre DB y schema
3. `npx prisma migrate reset --force --skip-seed`
4. `npx prisma db push --accept-data-loss`
5. `node --experimental-strip-types prisma/seed.ts`

Motivo del `db push`:

- las migraciones históricas no dejaban la base exactamente en el shape esperado por el cliente Prisma actual
- para desarrollo local, la sincronización directa del schema era la forma correcta de cerrar la deriva

### 3.3 Smoke del API

Se corrigió `apps/api/scripts/smoke.mjs` para que:

- firme JWT válidos cuando `AUTH_SECRET` está configurado
- lea variables desde `packages/db/.env`
- use el comportamiento real del servicio al crear jobs
- siga soportando fallback offline cuando la base no está disponible

## 4. Resultado final

Verificación final ejecutada:

```bash
npm run test:api
```

Resultado:

- pasa correctamente

Salida final:

```text
[api-smoke] starting
[api-smoke] success <job-id>
```

## 5. Estado actual del backend

Estado al cierre:

- PostgreSQL local levantado y sano
- schema local sincronizado con Prisma actual
- seed base aplicado
- `apps/api` compila
- `apps/api` tipa limpio
- `apps/api` pasa smoke test real

## 6. Riesgos y observaciones

Observación importante:

- sigue existiendo una divergencia conceptual entre migraciones versionadas y schema actual
- esa divergencia se resolvió localmente con `db push`, pero merece revisión posterior si se quiere endurecer CI/CD o entornos reproducibles sin intervención manual

## 7. Recomendación siguiente

El siguiente paso sensato ya no es backend básico, sino una de estas dos líneas:

1. endurecer estrategia de migraciones para evitar nuevo drift
2. mover el foco a E2E reales de `apps/web`, que sigue siendo la gran superficie no cerrada

## 8. Conclusión

El backend local quedó levantado de punta a punta.

No solo compila: ahora también ejecuta validación real contra PostgreSQL local con seed y smoke operativo.
