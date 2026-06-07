# Informe Maestro SEMSE

> Nota histórica: este informe describe un estado previo a la consolidación final de `project-manager-app/` en `/home/yoni/labsemse/project-manager-app` y previo al reordenamiento documental posterior de `labsemse`.

- Fecha: 2026-04-04 21:00:51 EDT
- Workspace analizado: `/home/yoni/app semse/project-manager-app`
- Estado del worktree: `237` entradas modificadas/no rastreadas
- Autor del registro: Codex

## 1. Resumen ejecutivo

El proyecto activo y canónico para la app es el monorepo:

- `/home/yoni/app semse/project-manager-app`

No conviene usar como base principal:

- `/home/yoni/labsemse/src` porque el propio repositorio lo define como UI transitoria
- ramas archivadas, satélites o MVPs congelados

La situación real no es de un solo problema, sino de tres capas superpuestas:

1. Un monorepo canónico moderno (`apps/web`, `apps/api`, `packages/*`)
2. Un producto legado que todavía conserva tests E2E y artefactos del root estático
3. Un worktree muy sucio, con muchos cambios simultáneos y varias piezas todavía en transición

Conclusión:

- La app web canónica compila bien
- Los tests unitarios del root pasan
- Los tests E2E legados del root pasan
- La integración nueva de conocimiento desde `infclaude` quedó aterrizada en la UI
- El mayor riesgo actual no es un error puntual de compilación, sino la falta de consolidación arquitectónica del repositorio

## 2. Qué encontré

### 2.1 Proyecto canónico

El README raíz de `labsemse` indica que el tronco canónico es:

- `app semse/project-manager-app`

Y dentro de ese tronco:

- `apps/web` = frontend canónico
- `apps/api` = backend canónico
- `packages/*` = contratos, agentes, UI, DB, etc.

### 2.2 Estado del repositorio

Encontré un worktree muy cargado:

- `237` archivos/entradas modificadas o no rastreadas
- mezcla de cambios viejos, nuevos y estructurales
- coexistencia de código moderno y legado

Esto implica:

- no se puede asumir que todo lo que existe fue validado de extremo a extremo
- hay riesgo alto de duplicación de lógica
- hay riesgo medio-alto de rutas rotas, imports viejos y documentación desalineada

### 2.3 Estado de la app web

La app `apps/web` sí estaba en condiciones de ejecutarse localmente, pero inicialmente tenía problemas de compilación del monorepo.

Problemas encontrados y resueltos:

- faltaba `lucide-react` en `apps/web/package.json`
- varias rutas API tenían imports duplicados de `fetchSemseDataForRequest`
- varias rutas API llamaban `fetchSemseDataForRequest` sin pasar `request`
- `globals.css` tenía un warning por el orden de `@import`

Resultado actual:

- `npm run build:web` pasa

### 2.4 Estado de pruebas

Pruebas verificadas:

- `npm run test:unit` pasa
- `npm run test:e2e` pasa

Observación importante:

- la suite E2E actual no prueba `apps/web`
- la suite E2E actual apunta al producto legado del root estático (`app.js`, `logic.mjs`, `style.css`, `python3 -m http.server`)

Eso significa:

- las pruebas verdes no garantizan cobertura real del frontend canónico
- hoy existe una falsa sensación de cobertura si se interpreta esa suite como validación de `apps/web`

### 2.5 Integración de `infclaude`

Se revisó la carpeta:

- `/home/yoni/infclaude/claurst-main`

Lo útil de ese material no era copiar código, sino extraer patrones:

- permisos por herramienta
- coordinación multiagente
- memoria consolidada
- planeación separada del loop principal
- inyección de contexto por superficie
- extensibilidad por plugins/skills
- telemetría y control operacional

Eso ya quedó aterrizado en:

- `packages/agents/src/infclaude.ts`
- `packages/agents/src/index.ts`
- `apps/web/app/cortex/semse-cortex-console.tsx`
- `apps/web/app/dashboard/dashboard-client.tsx`
- `apps/web/app/jobs/new/page.tsx`

Resultado funcional:

- `Cortex` ahora usa lógica derivada de `infclaude`
- `Dashboard` muestra un brief operacional
- `jobs/new` muestra guía de calidad del draft y próximas acciones

### 2.6 Estado del backend / API

No se hizo todavía una auditoría profunda completa de `apps/api`, pero sí encontré señales de transición fuerte:

- módulos nuevos y policy files
- cambios estructurales amplios
- múltiples archivos `M`, `A`, `AM`, `MM`, `??`

Lectura pragmática:

- el backend está en evolución activa
- no se debe asumir estabilidad completa solo porque `apps/web` compile
- hace falta una fase específica de validación del API

## 3. Problemas resueltos en esta sesión

### Web / build

- se identificó el frontend canónico correcto
- se levantó la app localmente
- se corrigió la dependencia faltante `lucide-react`
- se corrigieron rutas API con imports y llamadas rotas
- se dejó `build:web` en verde

### Calidad / pruebas

- se validó `test:unit`
- se habilitó Playwright instalando Chromium
- se validó `test:e2e`

### Producto / lógica

- se integró una capa de conocimiento basada en `infclaude`
- se conectó esa lógica a `Cortex`, `Dashboard` y `jobs/new`

## 4. Riesgos vigentes

### Riesgo 1: Worktree excesivamente sucio

Severidad: alta

Síntoma:

- demasiados cambios simultáneos en frontend, backend, docs, schemas y scripts

Impacto:

- complica saber qué está validado y qué no
- aumenta el riesgo de mezclar trabajo estable con experimentos

### Riesgo 2: Cobertura E2E desalineada con la app canónica

Severidad: alta

Síntoma:

- Playwright prueba el producto legado del root, no `apps/web`

Impacto:

- el frontend nuevo puede romperse sin que la suite actual lo detecte

### Riesgo 3: Transición arquitectónica incompleta

Severidad: media-alta

Síntoma:

- conviven root legacy, app web canónica y capas transitorias

Impacto:

- duplicación funcional
- confusión operativa
- dificultad para incorporar cambios con seguridad

### Riesgo 4: Backend sin auditoría integral de build/test en esta sesión

Severidad: media

Síntoma:

- se corrigieron endpoints web proxy, pero no se completó auditoría profunda de `apps/api`

Impacto:

- posible deuda oculta en controladores, servicios, políticas o persistencia

## 5. Estado objetivo recomendado

El objetivo no debe ser “seguir agregando cosas” sobre un repositorio mezclado.

El objetivo correcto es:

1. Consolidar la app canónica
2. Separar explícitamente el legado
3. Mover cobertura y validación al frontend/backend reales
4. Reducir el worktree a bloques coherentes verificables

## 6. Plan de acción maestro

### Fase 1: Congelación y mapa de realidad

Objetivo:

- entender exactamente qué partes son canónicas, transitorias, legacy o experimentales

Acciones:

- inventario de carpetas activas vs legacy
- clasificación de cambios del worktree por dominio
- lista de archivos críticos por capa: web, api, schemas, db, agents

Resultado esperado:

- mapa operativo del repo
- backlog realista de consolidación

### Fase 2: Validación del backend canónico

Objetivo:

- asegurar que `apps/api` y sus contratos están sanos

Acciones:

- correr build/test del API
- revisar módulos críticos: jobs, disputes, milestones, payments, agents, auth, field-ops
- validar consistencia con `packages/schemas`

Resultado esperado:

- API verificable
- lista corta de fallos reales del backend

### Fase 3: Rehacer la cobertura E2E para `apps/web`

Objetivo:

- dejar de depender de E2E del producto legado como señal principal

Acciones:

- crear nueva suite Playwright para `apps/web`
- cubrir rutas canónicas: dashboard, jobs/new, jobs/[jobId], cortex, field-ops, login
- mantener la suite legacy como compatibilidad temporal o archivarla explícitamente

Resultado esperado:

- cobertura útil sobre la app real

### Fase 4: Consolidación de legado

Objetivo:

- evitar que el root legacy siga confundiendo decisiones

Acciones:

- marcar explícitamente qué queda soportado
- archivar o aislar la app estática del root
- documentar qué scripts siguen vigentes y cuáles ya no mandan

Resultado esperado:

- menos ambigüedad estructural

### Fase 5: Integración profunda de `infclaude`

Objetivo:

- pasar de hints UI a capacidad operativa reutilizable

Acciones:

- extender lógica a backend/API
- crear memoria operativa por tenant/job/dispute
- usar señales para routing, recomendaciones y runbooks

Resultado esperado:

- `infclaude` como capa operativa real, no solo visual

## 7. Cómo voy a abordar la situación

Mi enfoque recomendado, en orden, es este:

1. Auditar y estabilizar `apps/api`
2. Diseñar y migrar los E2E hacia `apps/web`
3. Separar formalmente legado vs canónico
4. Profundizar la lógica de `infclaude` en backend y flujos de negocio

Razón:

- hoy el build de web ya está sano
- lo siguiente más valioso no es más UI
- lo siguiente más valioso es confianza técnica: backend validado + tests correctos + fronteras claras

## 8. Recomendación final

No recomiendo seguir agregando funcionalidad grande sin antes hacer Fase 2 y Fase 3.

La plataforma ya tiene suficiente volumen como para que el principal problema deje de ser “falta una feature” y pase a ser:

- qué parte manda
- qué parte está validada
- qué parte es deuda de transición

## 9. Registro de verificación realizado

Verificaciones completadas en esta sesión:

- frontend canónico identificado
- dev server levantado
- integración `infclaude` incorporada
- `npm run build:web` OK
- `npm run test:unit` OK
- `npm run test:e2e` OK

## 10. Próxima acción recomendada

Siguiente paso operativo recomendado:

- iniciar Fase 2: auditoría completa de `apps/api` con build, tests y correcciones hasta dejar backend canónico estable

## 11. Actualización de auditoría backend

Actualización agregada el 2026-04-04 durante la Fase 2.

### 11.1 Resultado real de `apps/api`

Hallazgos confirmados:

- `apps/api` no tiene tests reales configurados
- el script `npm run test --workspace @semse/api` estaba roto porque apunta a `jest` pero `jest` no está instalado
- `apps/api/dist` sí se genera, por lo que el build Nest transpila
- pero `npx tsc -p apps/api/tsconfig.json --noEmit` falla con un bloque grande de errores de tipos

Conclusión:

- el API no está tipológicamente sano aunque Nest lo transpile
- hoy existe una diferencia entre “build genera JS” y “source TypeScript consistente”

### 11.2 Causa raíz principal

La mayoría de los errores no son de NestJS ni de configuración del compilador.

La causa raíz dominante es:

- drift entre `apps/api/src/modules/agents/tools/*` y el modelo actual de Prisma en `packages/db/prisma/schema.prisma`

Se detectaron estos patrones:

1. Enums Prisma en mayúsculas vs código en minúsculas
2. Campos que ya no existen en Prisma:
   - `budget`
   - `contractId` en `Dispute`
   - `disputeType`
   - `type` en `Evidence`
   - varios includes/selects viejos sobre `payments`, `job`, `milestones`
3. Filtros escritos contra relaciones o campos ya cambiados:
   - `clientUserId` usado dentro de `job` donde el schema actual modela ownership de otra forma
   - `tenantId` aplicado en modelos donde ya no existe como filtro directo
4. JSON inputs que no están casteados al tipo Prisma correcto

### 11.3 Bloques de error identificados

Bloques principales:

- `modules/agents/memory/agent-memory.service.ts`
  - parcialmente corregido en esta sesión
  - problema: enums `AgentMemoryType` y `AgentMemoryImportance`

- `modules/agents/tools/client/approval-tools.ts`
  - ownership checks y comparaciones `Decimal`

- `modules/agents/tools/marketplace/search-tools.ts`
  - usa `budget` donde el schema actual tiene `budgetMin` / `budgetMax`

- `modules/agents/tools/ops/dispute-tools.ts`
  - modelado antiguo de disputes/contract status

- `modules/agents/tools/professional/contract-tools.ts`
  - asumía relations e includes que no coinciden con el schema actual

- `modules/agents/tools/orchestration/delegate-tools.ts`
  - JSON input/output sin adaptar a tipos Prisma

- `modules/agents/tools/executor.ts`
  - error menor de tipo interno; parcialmente corregido

### 11.4 Estado después de las primeras correcciones

Correcciones aplicadas:

- se corrigió el tipo de pausa de `ask_for_clarification`
- se corrigió el bloque de memoria de agentes para mapear enums internos ↔ enums Prisma

Resultado:

- desapareció el bloque de errores de `agent-memory.service.ts`
- el resto del problema quedó más concentrado y visible

### 11.5 Recomendación táctica para el backend

No conviene atacar los errores uno por uno sin estrategia.

El orden correcto es:

1. `marketplace/search-tools.ts`
   - porque depende de un cambio simple de presupuesto (`budget` → `budgetMin/budgetMax`)

2. `client/approval-tools.ts`
   - porque mezcla ownership + `Decimal`

3. `ops/dispute-tools.ts`
   - porque requiere alinear la idea de disputa con el schema real

4. `professional/contract-tools.ts`
   - porque es el bloque más grande y más acoplado al schema

5. `orchestration/delegate-tools.ts`
   - porque es principalmente ajuste de tipos JSON

### 11.6 Decisión recomendada

La Fase 2 debe continuar, pero enfocada así:

- primero dejar `npx tsc -p apps/api/tsconfig.json --noEmit` en verde
- después decidir si `nest build` debe seguir como compilación permisiva o si el repo debe endurecer el pipeline
- finalmente crear pruebas reales del API, porque hoy no existen

### 11.7 Estado actual después de la remediación backend

Se completó la remediación de los bloques de tipado más críticos del backend.

Resultado verificado:

- `npx tsc -p apps/api/tsconfig.json --noEmit` ahora pasa en verde

Bloques corregidos en esta continuación:

- `modules/agents/tools/ops/dispute-tools.ts`
  - se realineó la tool al schema real de `Dispute`
  - la disputa ahora se abre contra `projectId` y opcionalmente `milestoneId`
  - se eliminó la lógica inválida que intentaba usar `contractId`, `disputeType` y estado `DISPUTED` en `Contract`
  - la consulta de estado ahora navega por `project -> job -> contract`

- `modules/agents/tools/orchestration/delegate-tools.ts`
  - se corrigió el tipado JSON con `Prisma.InputJsonValue`
  - quedó alineado con el patrón ya usado en otros repositorios internos del módulo de agentes

- `modules/agents/tools/professional/contract-tools.ts`
  - se corrigió el acceso a ownership real del hito vía `project` y `contract`
  - `Evidence` ahora usa los campos correctos del schema: `projectId`, `uploadedById`, `kind`, `metadataJson`
  - el resumen de contrato dejó de asumir relaciones antiguas como `payments`
  - el cálculo de escrow se apoya ahora en `escrow.totalAmount`
  - se corrigió el conteo de hitos para ajustarlo a los estados reales del enum `MilestoneStatus`

### 11.8 Conclusión operativa de la Fase 2

La situación cambió de forma importante:

- antes: `apps/api` compilaba con `nest build`, pero tenía deriva real de tipos y modelo
- ahora: el backend queda consistente al menos a nivel de TypeScript contra el schema actual de Prisma

Esto no significa que el API esté completamente validado.

Pendientes reales:

- `apps/api` sigue sin suite de tests efectiva
- el script `npm run test --workspace @semse/api` sigue sin valor operativo porque `jest` no está instalado/configurado
- todavía falta revisar comportamiento funcional, no solo integridad de tipos

### 11.9 Próximo plan de acción recomendado

El siguiente abordaje correcto es:

1. endurecer validación del backend
   - decidir si `tsc --noEmit` entra como parte oficial del pipeline de CI
   - revisar si `nest build` debe dejar de ocultar deriva de tipos

2. crear cobertura mínima de `apps/api`
   - smoke tests para rutas/módulos críticos
   - validación de tools de agentes más frágiles: disputes, contract summary, delegations

3. cubrir la app canónica con E2E reales
   - hoy los E2E verdes pertenecen al sistema legacy del root, no a `apps/web`

4. separar capas del repo
   - distinguir formalmente qué es canónico, qué es legacy y qué es WIP
   - reducir el riesgo operativo derivado del worktree extremadamente mezclado

### 11.10 Validación operativa añadida a `apps/api`

Se dejó una base de validación real dentro de `apps/api`, porque antes el paquete tenía un `test` roto que apuntaba a `jest` sin tener Jest instalado.

Cambios introducidos:

- en `apps/api/package.json`
  - nuevo script `typecheck`
  - nuevo script `test:smoke`
  - `test` ahora ejecuta `typecheck + smoke`

- en el root `package.json`
  - nuevo script `test:api`

- nuevo runner:
  - `apps/api/scripts/smoke.mjs`

### 11.11 Qué valida ahora el smoke de API

Cuando la base de datos está disponible:

- build del paquete API
- arranque real del servidor Nest/Fastify
- `GET /v1/health`
- creación y listado básico de jobs
- verificación de auditoría para `job.create`

Cuando la base de datos no está disponible:

- detecta la indisponibilidad antes de intentar un smoke HTTP falso
- ejecuta validación offline contra artefactos compilados
- verifica export de `AppModule`
- verifica `HealthController` y su respuesta base

### 11.12 Estado real del entorno al cerrar esta fase

Resultado actual:

- `npm run test:api` pasa
- `apps/api` compila limpio en TypeScript
- el smoke runner detectó que PostgreSQL local no está disponible en `localhost:5433`

Esto significa:

- la validación estructural del API ya existe y funciona
- la validación HTTP completa quedó condicionada a que el entorno local levante la base
- el siguiente cuello de botella ya no está en el código del API, sino en la infraestructura local de desarrollo

### 11.13 Levantamiento real de la base local y cierre del circuito API

En la continuación posterior se completó el levantamiento real del entorno backend.

Pasos ejecutados:

- se levantó `postgres` desde `infra/docker/compose.semse-mvp.yml`
- el contenedor `semse-postgres` quedó saludable en `localhost:5433`
- se ejecutó `npm run db:migrate`
- al validar el API se detectó deriva real entre migraciones y schema actual
- se ejecutó `prisma migrate reset --force --skip-seed`
- se ejecutó `prisma db push --accept-data-loss` para sincronizar la base local con el schema actual
- se ejecutó el seed del repo con `node --experimental-strip-types prisma/seed.ts`
- se ajustó el smoke runner del API para:
  - soportar JWT cuando `AUTH_SECRET` está activo
  - leer configuración desde `packages/db/.env`
  - alinearse al comportamiento real de creación de jobs (`DRAFT`)

Resultado final verificado:

- `npm run test:api` pasa en modo real contra PostgreSQL

Conclusión:

- el backend ya no está solamente compilando; ahora también está validado sobre una base real levantada localmente
- el problema de fondo no era solo ausencia de Postgres, sino deriva entre migraciones históricas y schema actual

### 11.14 Cobertura E2E de la app canónica `apps/web`

Se cerró la otra brecha principal del proyecto: la ausencia de E2E propios para la app canónica.

Cambios añadidos:

- `playwright.web.config.js`
  - suite Playwright separada para `apps/web`
  - arranque coordinado de API (`4000`) y web (`3002`)
  - runtime real habilitado con `SEMSE_API_BASE_URL` y `NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true`

- `tests/e2e-web/semse-web.spec.js`
  - smoke E2E de la landing pública
  - smoke E2E de `dashboard`
  - smoke E2E de `cortex`
  - flujo autenticado de publicación real de un job desde `jobs/new`

- `package.json`
  - nuevo script `test:e2e:web`

Resultado verificado:

- `npm run test:e2e:web` pasa con `3/3`

Implicación:

- los E2E verdes del repo ya no dependen solo del sistema legacy del root
- la app canónica `apps/web` ahora tiene una validación propia, ejecutada contra el backend y PostgreSQL local reales

### 11.15 Reconciliación de migraciones Prisma

Se cerró el riesgo estructural que seguía vivo después de levantar backend y web:

- el historial de migraciones no reconstruía completamente el schema actual de Prisma

Trabajo realizado:

- se generó el diff real entre `prisma/migrations` y `prisma/schema.prisma`
- se creó la migración correctiva:
  - `packages/db/prisma/migrations/20260405021000_reconcile_schema_drift/migration.sql`
- se añadió verificación reproducible:
  - `scripts/db-verify-fresh.sh`
  - script root `db:verify:fresh`

Cobertura de la migración correctiva:

- tablas faltantes de memoria/delegación/planes de agentes
- columnas faltantes en `User`, `Milestone`, `Evidence` y `Contract`
- enums faltantes
- índices y foreign keys faltantes

Resultado verificado:

- `npm run db:verify:fresh` pasa

Implicación:

- un entorno local nuevo ya puede reconstruirse con migraciones + seed sin requerir `db push`
