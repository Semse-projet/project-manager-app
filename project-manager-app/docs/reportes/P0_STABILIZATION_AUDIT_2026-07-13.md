# Gate de Estabilización P0 — Auditoría y correcciones (2026-07-13)

Rama: `agent/p0-stabilization` · SHA base: `9d1580b` (main, incluye PI-01 #302)

Este informe documenta la reproducción, causa raíz, corrección y prueba de los
8 hallazgos del Gate P0 previo a continuar F1 Event Backbone.

## Matriz de hallazgos

| # | Hallazgo | Evidencia reproducida | Severidad | Causa raíz | Corrección | Prueba | Riesgo residual |
|---|----------|----------------------|-----------|------------|------------|--------|-----------------|
| A | PII en landing pública ("4064 Hal's circle Tallahassee Florida") | HTML SSR de prod re-verificado 2026-07-13: hoy ya sanitizado (`Tallahassee Florida`, `Pensacola fl`); el avistamiento ocurrió mientras Railway servía un SHA anterior a #295 | P0 | (1) Lag main↔Railway: deploy se dispara por push sin esperar CI ni verificar SHA; (2) sanitización solo en API, sin defensa en web; (3) fallback de displayName usaba el **email** del usuario (`professional-credential.service.ts`) | Sanitizador movido a `@semse/schemas` (fuente única), re-aplicado como defensa en profundidad en `lib/public-landing.ts`, BFF `worker-openings` y `/pro/[slug]` (HTML + metadata); fallback de nombre público nunca es email/teléfono; cobertura de `Apt/Unit/Suite` añadida | `tests/unit/public-sanitizer.test.ts` (16 casos, incluye la dirección del incidente) | Datos ya almacenados con PII en campos privados no se tocan (correcto); testimonios con PII exótica no cubierta por regex |
| B | MXN en superficie pública tras #297 | `POST /v1/intelligence/public/budget/suggest` en prod devolvió `"currency":"MXN"` el 2026-07-13 (verificado en vivo) | P0 | `budget-intelligence.service.ts` hardcodeaba `currency: "MXN"` y narrativa "MXN"; ese payload alimenta el wizard público de la landing (`landing-intake.tsx`) | `PUBLIC_MARKET_CURRENCY = "USD"` en `@semse/schemas` + formateador central `formatPublicMoney[Range]` usado por landing-intake, featured-jobs-feed y pricing-estimator; el chat Prometeo usa `suggestion.currency` en vez de MXN literal | `tests/unit/public-surfaces-market.test.ts` escanea superficies públicas y falla si reaparece `MXN`/`es-MX` | Montos históricos capturados como MXN se re-etiquetan USD (los datos de prod actuales ya son mercado Florida); `es-MX` en fechas de paneles internos autenticados queda fuera de alcance |
| C | 6 clientes Prisma sin modelo (`changeOrder`, `drawRequest`, `evidenceLog`, `evidencePhoto`, `tradeMetric`, `weatherAlert`) | `pnpm audit:prisma-usage` los reporta con archivo:línea | P1 (no P0: código inalcanzable) | Commits "bloque-Z" y "bloque-AB-AC" añadieron servicios/controladores que **nunca se registraron en ningún módulo NestJS** (verificado: 0 referencias en `*.module.ts` en todo el historial), sin modelos ni SQL | Clasificación: implementación futura inerte (ver sección C abajo). Sin rutas montadas no puede haber 500. Documentados en `scripts/prisma-contract-baseline.json` (lista que solo puede encogerse); el paso de CI pasó de `continue-on-error` a **bloqueante** | `tests/unit/prisma-contract-audit.test.ts` (8 casos con fixtures) + auditor verde en el repo | Si alguien registra esos módulos sin crear los modelos, el auditor bloquea el PR |
| D | Dependabot: "labels could not be found: npm" | PR #299; `gh label list` confirma que ni `npm` ni `github-actions` existen | P2 | `.github/dependabot.yml` refería 2 etiquetas inexistentes | Ambas eliminadas; queda `dependencies` (existe) | YAML validado; próxima corrida de Dependabot sin advertencia | — |
| E | Node 22 en CI vs Node 20 en Docker | `ci.yml` node-version 22; `Dockerfile.{api,web,worker}` node:20 | P1 | Sin fuente de verdad: CI validaba con un runtime distinto al desplegado | Canónico **Node 22 LTS** (CI ya validaba todo el pipeline en 22; Next 15.5/NestJS 11/Prisma lo soportan): `.nvmrc=22`, `engines.node>=22`, Dockerfiles a `node:22-alpine`/`node:22-slim`; guard `scripts/check-toolchain-alignment.mjs` (`pnpm check:toolchain`) en CI y `verify:workspace` | `pnpm check:toolchain` verde; build de imagen validado | Local del desarrollador puede ir en Node 24 (engines es piso, no techo); el guard protege CI/Docker |
| F | Deploy a Railway sin gate de CI | `railway-deploy.yml` con `on: push: branches [main]`, independiente de `ci.yml` | P0 | Cualquier push a main desplegaba aunque CI fallara; en `workflow_run` `GITHUB_SHA` ni siquiera es el SHA evaluado | `railway-deploy.yml` ahora se dispara con `workflow_run` de CI: exige `conclusion == success` y `head_branch == main`, y despliega **exactamente** `workflow_run.head_sha` (`DEPLOY_SHA`) en los 4 servicios; `workflow_dispatch` restringido a main; health-check verifica que el deployment del SHA exacto llegue a SUCCESS; rollback documentado en el workflow | YAML validado; el gate se demuestra en el primer merge a main | `workflow_dispatch` manual sigue pudiendo desplegar main sin esperar CI (decisión operativa consciente, requiere acción humana explícita) |
| G | Sin auditoría automática de drift Prisma | — | P1 | El index signature de PrismaService (`[delegate: string]: any`) deja pasar accessors fantasma con tests verdes | PI-01 (#302) ya trajo `verify-prisma-runtime-contract.mjs`; este gate lo endurece: ignora comentarios y strings, detecta `?.`, reporta archivo:línea, acepta `--root` para fixtures, alias `pnpm audit:prisma-usage`, integrado en `verify:workspace` y **bloqueante** en CI; no requiere DB (nivel 3 opcional) | 8 tests unitarios con fixtures (modelo válido, inexistente, comentario, string, optional chaining, falso positivo, baseline, migración faltante) | Template literals con menciones textuales podrían dar falso positivo (documentado en el script) |
| H | Verificación bump 65 deps (PR #299) | — | P1 | Bump grande mergeado con CI verde pero sin verificación integral local | Suite completa de Fase 7 ejecutada sobre este branch (que incluye #299): install frozen, generate, migraciones en Postgres efímero, lint, typecheck, unit, coverage, builds API/web, worker check, spec estricto | Resultados en la sección H | Overrides pnpm revisados: pinean transitivos (babel/esbuild/postcss/undici/vite), no anulan los bumps directos de #299 |

## C — Detalle de los 6 modelos Prisma ausentes

Inventario completo de accessors fantasma (los únicos 6 del repo, verificado
con el auditor sobre 132 modelos y 112 accessors):

| Accessor | Archivos (no registrados en ningún módulo) | Clasificación | Decisión |
|----------|--------------------------------------------|---------------|----------|
| `changeOrder` | `evidence/change-order.service.ts`, `evidence/export-bundle.service.ts`, `escrow/escrow-conditions.service.ts`, `compliance/compliance-reporting.service.ts` | Implementación futura inerte | Mantener desactivada; el módulo vivo de change orders usa `changeOrderCandidate` (modelo existente) |
| `drawRequest` | `escrow/draw-request.service.ts`, `escrow/disbursement.service.ts`, `escrow/escrow-conditions.service.ts`, `reporting/burn-rate.service.ts` | Implementación futura inerte | Mantener desactivada; requiere spec (escrow legal Stripe pendiente) |
| `evidenceLog` | `evidence/daily-log.service.ts`, `evidence/daily-log.scheduler.ts`, `evidence/export-bundle.service.ts` | Implementación futura inerte | Mantener desactivada |
| `evidencePhoto` | `evidence/daily-log.service.ts`, `evidence/export-bundle.service.ts`, `evidence/photo.controller.ts` | Implementación futura inerte | Mantener desactivada; evidencia real usa `evidence.repository` |
| `tradeMetric` | `evidence/extended-metrics.service.ts` | Implementación futura inerte | Mantener desactivada |
| `weatherAlert` | `weather/weather-alert.service.ts`, `weather/weather-impact.service.ts` | Implementación futura inerte | Mantener desactivada |

Evidencia de que es código muerto (no "endpoints rotos"):

1. Ningún `*.module.ts` del repo (ni de su historial completo, `git log -S`)
   registra estos controllers/services → NestJS jamás los instancia ni monta
   sus rutas → **imposible** que produzcan 500 en producción.
2. Ninguna migración histórica crea `ChangeOrder`, `DrawRequest`,
   `EvidenceLog`, `EvidencePhoto`, `TradeMetric` ni `WeatherAlert`.
3. Nacieron en commits `bloque-Z` (change order trail + extended metrics) y
   `bloque-AB-AC` (weather) que entregaron archivos sin wiring.

Por eso **no** se crean modelos ni migraciones en este PR (hacerlo sin diseño
de relaciones/índices/tenancy sería la "migración gigante sin contratos" que
el gate prohíbe). Activar cualquiera de estas capacidades requiere spec +
modelos + migración aditiva + registro del módulo en un PR propio; el auditor
bloqueante garantiza que no puede ocurrir a medias. No se devuelve
`501 CAPABILITY_NOT_READY` porque no existe ninguna ruta montada que responder.

`VisionAnalysis` existe en schema y no fue tocado.

## A — Timeline del incidente PII

- PR #295 (sanitización) y #297 (USD) mergeados a main el 2026-07-13.
- El deploy de Railway se dispara por push, pero el avistamiento del usuario
  ocurrió con la web sirviendo un build anterior (el deployment SUCCESS de
  `8702a2b` — que incluye #295/#297 — se completó 2026-07-14T01:47Z).
- Verificación en vivo posterior: HTML SSR de la landing sin direcciones y
  `public/overview` devolviendo ubicaciones a nivel ciudad/estado.
- El dato con la dirección vive en `job.location` (dato real de un job de
  cliente); la corrección es de presentación pública, el dato privado no se
  altera.
- Vector adicional corregido: usuarios sin `displayName` publicaban su email
  como nombre en landing + `/pro/[slug]` (HTML, `<title>` y slug de URL).
- "Profesionales verificados": `verifiedAt` se auto-asigna con ≥3 proyectos
  completados (`professional-credential.service.ts:173`); los perfiles del
  carrusel provienen de datos del tenant (seed/demo incluidos). Etiquetar
  "verificado" según origen de datos queda como seguimiento (no P0).

## Hallazgos adicionales detectados durante el gate

### H1 — Endpoint público exponía emails de usuarios reales (P0, corregido)

`POST /v1/intelligence/public/professionals/preview` (consumido por el wizard
anónimo de la landing) devolvía `email: profile?.email || candidate.email` por
cada candidato, y usaba el email como `displayName` de fallback. Cualquier
visitante anónimo podía cosechar emails de workers reales. Corregido en
`matching.service.ts`: el campo `email` se eliminó del payload público (el
frontend nunca lo renderizaba) y el displayName pasa por `publicDisplayName`.
Misma defensa aplicada a `GET credentials/public/:slug` y a
`topProfessionals` del overview, porque credenciales construidas antes del fix
pueden tener el email **almacenado** como displayName (el fallback
`displayName ?? email` de `professional-credential.service.ts` también se
eliminó en origen).

### H2 — Overrides de pnpm anulaban silenciosamente bumps del PR #299 (corregido)

`pnpm.overrides` pineaba `postcss: 8.5.15` y `vite: 7.3.5` mientras el PR #299
subió `apps/assistant-portal` a `postcss ^8.5.19` y `vite ^7.3.6` — el override
gana y el bump nunca se instalaba. Corregido: overrides actualizados a
`8.5.19`/`7.3.6` y lockfile regenerado (`pnpm install --frozen-lockfile` verde
después). El resto de overrides (`@babel/core`, `esbuild`, `js-yaml`, `multer`,
`piscina`, `undici`, `is-fullwidth-code-point`) no colisiona con ninguna
declaración directa bumpeada.

### H3 — `pnpm lint` está ROJO en main (preexistente, NO corregido aquí)

`pnpm lint` falla en main base con **51 errores en el API** (37 archivos,
`no-unused-vars`) y **18 errores en web** (`no-assign-module-variable`,
`no-unescaped-entities`), verificado con `git stash` sobre el SHA base.
CI **no ejecuta lint** (por eso está verde), así que la deuda se acumuló sin
señal. Los archivos tocados por esta rama lintean limpios (verificado archivo
por archivo, exit 0). Arreglar 69 errores ajenos inflaría este PR; queda como
bloque propio: añadir `pnpm lint` a CI una vez saneado.

### H4 — Nivel 3 del auditor Prisma se omitía silenciosamente en CI (corregido)

`psql` rechaza el parámetro `?schema=public` de las URLs de Prisma, por lo que
el chequeo schema→database se degradaba a advertencia incluso en CI. Corregido
en `verify-prisma-runtime-contract.mjs` (se elimina el parámetro al invocar
psql); validado contra PostgreSQL efímero.

## Validación ejecutada (Fase 7) — resultados

| Comando | Resultado |
|---------|-----------|
| `pnpm install --frozen-lockfile` | ✅ (también tras regenerar lockfile por H2) |
| `pnpm db:generate` | ✅ |
| `prisma migrate deploy` desde DB vacía (PostgreSQL 16 efímero en Docker) | ✅ todas las migraciones aplicadas |
| `pnpm audit:prisma-usage` (+ `--db` contra DB efímera, nivel 3 activo) | ✅ sin drift; solo baseline (6 accessors + 3 Lien*) |
| `pnpm check:toolchain` | ✅ Node 22 / pnpm 10.33.0 alineados |
| `pnpm spec:validate:strict` | ✅ 65 specs, 0 errores, 0 advertencias |
| `pnpm spec:coverage` | ✅ |
| `pnpm test:unit` (raíz) | ✅ 778 pass / 0 fail / 4 skipped (782) — incluye 35 tests nuevos de este gate |
| `pnpm --filter @semse/api test:unit` | ✅ 1832 pass / 0 fail |
| `pnpm test:coverage` | ✅ umbrales cumplidos (Stmts 71.6%, Branches 81.63%) |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ❌ preexistente en main (ver H3); archivos de esta rama: ✅ 0 errores |
| `pnpm build:api` / `pnpm build:web` / `pnpm check:worker` | ✅ |
| `pnpm railway:preflight` | ✅ |
| `pnpm test:e2e` | ✅ |
| `docker build -f Dockerfile.api` (Node 22) | ✅ imagen construida |

No se usaron credenciales de producción en ninguna validación; la DB efímera
es un contenedor local descartable.
