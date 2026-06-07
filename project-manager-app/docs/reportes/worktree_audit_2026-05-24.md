# Auditoria controlada del worktree

**Fecha:** 2026-05-24
**Repo Git top-level:** `/home/yoni/labsemse`
**App auditada:** `/home/yoni/labsemse/project-manager-app`
**Rama al iniciar:** `feat/spec-driven-development-hardening`
**Rama de auditoria local:** `chore/audit-leftover-worktree-2026-05-24`

## Resumen ejecutivo

El PR SDD quedo separado y publicado desde `feat/spec-driven-development-hardening`.
El worktree restante no pertenece al SDD hardening. Contiene cinco frentes distintos:

- ejemplos de entorno (`.env.example`);
- pagina/ruta Angular para brechas Prometeo;
- endurecimiento parcial del webhook WhatsApp;
- cambio Prisma de `PaymentEscrow.status` a enum;
- archivos untracked externos/prototipo.

No se borro trabajo. No se hizo deploy. No se crearon migraciones Prisma. La rama de auditoria es local y no debe abrir PR hasta que el PR SDD este mergeado o esta rama sea rebasada contra `main`.

## Estado de ramas

- `feat/spec-driven-development-hardening` contiene el commit SDD `b5e2a2e`.
- PR SDD: `https://github.com/Samuelcastella/project-manager-app/pull/28`
- `chore/audit-leftover-worktree-2026-05-24` conserva los cambios pendientes para auditoria.

## Archivos modificados

| Archivo | Categoria | Riesgo | Recomendacion |
|---|---|---:|---|
| `.env.example` | Env / comunicaciones / runtime | low | keep en rama separada `chore/env-example-cleanup`; revisar nombres y placeholders |
| `apps/api/.env.example` | Env API / storage / LLM / communications | medium | keep en rama separada; normalizar placeholders de keys |
| `apps/angular/src/app/app.routes.ts` | Angular / Prometeo | medium | move to separate branch `feat/angular-prometeo-gaps` |
| `apps/angular/src/app/layout/app-shell.component.ts` | Angular / navegacion | medium | move with Angular route |
| `apps/api/src/modules/communications/communications.controller.ts` | WhatsApp webhook HMAC | high | move to `fix/communications-whatsapp-webhook-signature` with tests |
| `apps/api/src/modules/communications/communications.module.ts` | DI WhatsApp adapter | medium | move with communications fix |
| `apps/api/src/modules/communications/providers/whatsapp-cloud.adapter.ts` | HMAC validation | high | keep only with tests and spec update |
| `packages/db/prisma/schema.prisma` | Prisma schema / escrow | critical | needs review; do not merge without migration and code reconciliation |

## Archivos untracked

| Archivo/directorio | Observacion | Recomendacion |
|---|---|---|
| `hermes-agent-main/` | Proyecto externo completo, 67M, 2947 archivos | discard from this repo or move fuera de `/home/yoni/labsemse`; no agregar |
| `project-manager-app/apps/angular/src/app/features/ops/prometeo-gaps.page.ts` | Pagina Angular standalone, 402 lineas | keep only en branch Angular/Prometeo si esa app sigue activa |
| `temas_ausentes_prometeo.html` | Prototipo HTML de 149 lineas para la pagina Prometeo | move to docs/prototype or discard si la pagina Angular lo reemplaza |

## Clasificacion por categoria

### A. Cambios SDD ya esperados

No quedan cambios SDD sin commitear en el worktree. Los archivos SDD pertenecen al commit `b5e2a2e` y al PR #28:

- `docs/specs/templates/semse-spec-template.md`
- `scripts/spec-lib.mjs`
- `scripts/spec-validate.mjs`
- `scripts/spec-index.mjs`
- `scripts/spec-coverage.mjs`
- `package.json` con scripts `spec:*` y `railway:preflight`
- `docs/SDD_GOVERNANCE.md`
- `docs/SPEC_INDEX.md`
- `docs/specs/README.md`
- `.github/workflows/ci.yml`
- `.github/pull_request_template.md`
- `docs/reportes/spec_driven_development_hardening_2026-05-24.md`

### B. Cambios previos no relacionados

- `.env.example`
- `apps/api/.env.example`
- Angular route/shell
- communications controller/module/adapter
- `packages/db/prisma/schema.prisma`

### C. Archivos untracked utiles

- `apps/angular/src/app/features/ops/prometeo-gaps.page.ts`
- `temas_ausentes_prometeo.html` si se quiere preservar como prototipo fuente.

### D. Archivos untracked basura/cache/build

- No se detectaron caches/build generados pequeños dentro de `project-manager-app`.
- `hermes-agent-main/` no es basura tecnica, pero es un proyecto externo completo y no pertenece al repo SEMSE.

### E. Posibles secretos o archivos sensibles

No se detectaron secretos reales en los diffs revisados. Los campos nuevos de WhatsApp/API aparecen vacios o como placeholders.

Riesgo a normalizar:

- `OPENAI_API_KEY=sk-...` y valores similares deberian mantenerse como placeholder obvio o vacio.
- `AUTH_SECRET=your_secret_here_min_32_chars` es placeholder.
- `WHATSAPP_CLOUD_ACCESS_TOKEN=`, `WHATSAPP_CLOUD_VERIFY_TOKEN=` y `WHATSAPP_APP_SECRET=` estan vacios.

No imprimir valores reales si aparecen en una futura revision.

### F. Cambios que requieren investigacion

- Prisma `PaymentEscrow.status` pasa de `String @default("active")` a `EscrowStatus @default(ACTIVE)`.
- No existe migracion nueva para convertir la columna de texto a enum.
- Codigo existente sigue escribiendo `status: "active"` en `payments.repository.ts` y `seed.ts`.
- Specs de payments/escrow usan estados distintos (`pending`, `funded`, `held`, etc.), por lo que el enum propuesto no parece alineado con el contrato actual.

Riesgo: critical. No mergear asi.

## Hallazgos por frente

### Env examples

Cambios observados:

- Root `.env.example` agrega `OLLAMA_HEALTH_TIMEOUT_MS`, variables `SEMSE_COMMUNICATIONS_*`, `WHATSAPP_CLOUD_*`, `WHATSAPP_APP_SECRET` y `SEMSE_POLL_MS`.
- `apps/api/.env.example` agrega URLs base, demo mode, storage local, autonomy runtime settings, DeepSeek/Kimi base/model defaults y variables WhatsApp.

Recomendacion:

- Mantener, pero en rama propia `chore/env-example-cleanup`.
- Normalizar nombres entre docs y codigo: `docs/specs/integration-map.md` menciona `WHATSAPP_VERIFY_TOKEN`; el codigo usa `WHATSAPP_CLOUD_VERIFY_TOKEN`.
- No usar valores reales en `.env.example`.

### Angular / Prometeo

Cambios observados:

- Nueva ruta `/admin/prometeo`.
- Navegacion agrega "Brechas Prometeo".
- Nueva pagina standalone `PrometeoGapsPageComponent`.
- `temas_ausentes_prometeo.html` parece el prototipo HTML origen de esa pagina.

Estado:

- `apps/angular` existe como paquete del workspace, con `ng build`, pero no forma parte del `railway:preflight` ni del build principal API/Web.
- Debe tratarse como frente separado hasta confirmar si Angular es app activa o legacy.

Recomendacion:

- Si Angular sigue activa: rama `feat/angular-prometeo-gaps`.
- Si Angular es legacy: mover la idea a Next/Web o archivar el HTML como documento/prototipo.

### Comunicaciones / WhatsApp

Cambios observados:

- Se inyecta `WhatsAppCloudAdapter` en `CommunicationsController`.
- `POST /v1/communications/webhooks/whatsapp` valida `X-Hub-Signature-256`.
- `WhatsAppCloudAdapter` agrega `validateSignature()` con HMAC SHA-256 y `timingSafeEqual`.
- `apps/api/src/main.ts` ya arranca Nest con `{ rawBody: true }`, por lo que la validacion puede recibir raw body.

Specs:

- `docs/specs/api/communications.spec.md` ya declara el gap: `POST /webhooks/whatsapp` no valida `X-Hub-Signature-256`.
- `docs/specs/integration-map.md` tambien exige validar `X-Hub-Signature-256`.

Riesgos:

- No hay test especifico para la firma WhatsApp.
- Debe cubrir: live mode sin firma, live mode firma invalida, live mode firma valida, mock mode no bloquea.
- Revisar naming de variables `WHATSAPP_VERIFY_TOKEN` vs `WHATSAPP_CLOUD_VERIFY_TOKEN`.

Recomendacion:

- Rama `fix/communications-whatsapp-webhook-signature`.
- Agregar tests antes de merge.
- Actualizar spec/gap si se cierra.

### Prisma

Cambios observados:

- Nuevo enum `EscrowStatus { ACTIVE, PENDING_SETTLEMENT, CLOSED, CANCELLED }`.
- `PaymentEscrow.status` cambia de `String @default("active")` a `EscrowStatus @default(ACTIVE)`.

Riesgos:

- No hay migracion nueva.
- La migracion inicial creo `PaymentEscrow.status` como `TEXT DEFAULT 'active'`.
- `payments.repository.ts` y `seed.ts` siguen usando `"active"`.
- Es probable que `prisma generate` o runtime fallen cuando el schema enum se materialice sin reconciliar codigo/datos/migracion.

Recomendacion:

- No incluir en ningun PR mixto.
- Crear rama `fix/prisma-escrow-status-reconciliation`.
- Definir contrato de estados primero: payments spec vs buildops/travel status.
- Crear migracion aditiva/controlada solo con autorizacion.

### Prometeo.html

Busqueda ejecutada:

```bash
rg -n "Prometeo\\.html|prometeo\\.html|temas_ausentes_prometeo|prometeo-gaps" /home/yoni/labsemse
```

Resultado:

- No se encontro referencia a `Prometeo.html` literal.
- Se encontro referencia al nuevo componente `prometeo-gaps.page.ts` desde `app.routes.ts`.
- `temas_ausentes_prometeo.html` no esta referenciado por codigo; parece prototipo independiente.

Recomendacion:

- Si se conserva, moverlo a `docs/reportes/prompts/` o `docs/design/`.
- Si la pagina Angular lo reemplaza, descartarlo con confirmacion.

## Estrategia de ramas recomendada

Orden recomendado:

1. Mantener PR #28 como PR SDD limpio.
2. No empujar `chore/audit-leftover-worktree-2026-05-24` todavia.
3. Cuando PR #28 se mergee, rebasar la rama de auditoria contra `main`.
4. Separar frentes:

```text
chore/env-example-cleanup
fix/communications-whatsapp-webhook-signature
fix/prisma-escrow-status-reconciliation
feat/angular-prometeo-gaps
chore/external-hermes-folder-cleanup
```

## Comandos ejecutados

```bash
git status --short
git branch --show-current
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
git rev-parse --show-toplevel
git diff -- .env.example apps/api/.env.example
git diff -- apps/angular/src/app/app.routes.ts apps/angular/src/app/layout/app-shell.component.ts
git diff -- apps/api/src/modules/communications/communications.controller.ts apps/api/src/modules/communications/communications.module.ts apps/api/src/modules/communications/providers/whatsapp-cloud.adapter.ts
git diff -- packages/db/prisma/schema.prisma
rg -n "Prometeo\\.html|prometeo\\.html|temas_ausentes_prometeo|prometeo-gaps" /home/yoni/labsemse
rg -n "rawBody|bodyLimit|addContentTypeParser|fastifyRawBody|x-hub-signature" apps/api/src apps/api/test
find packages/db/prisma -maxdepth 3 -type f
du -sh /home/yoni/labsemse/hermes-agent-main /home/yoni/labsemse/temas_ausentes_prometeo.html
find /home/yoni/labsemse/hermes-agent-main -type f | wc -l
wc -l /home/yoni/labsemse/temas_ausentes_prometeo.html /home/yoni/labsemse/project-manager-app/apps/angular/src/app/features/ops/prometeo-gaps.page.ts
git switch -c chore/audit-leftover-worktree-2026-05-24
```

## Validaciones ejecutadas

```bash
pnpm spec:preflight
pnpm typecheck
pnpm test:unit
git diff --check
```

Resultados:

- `pnpm spec:preflight`: OK, con los mismos 21 warnings esperados de metadata canonica faltante.
- `pnpm typecheck`: OK.
- `pnpm test:unit`: OK, 14 tests.
- `git diff --check`: OK.

## Comandos exactos para limpiar despues de decidir

Mantener auditoria y descartar proyecto externo del repo, sin borrar:

```bash
mv /home/yoni/labsemse/hermes-agent-main /home/yoni/hermes-agent-main
```

Conservar prototipo Prometeo como documento:

```bash
mkdir -p /home/yoni/labsemse/project-manager-app/docs/design/prometeo
mv /home/yoni/labsemse/temas_ausentes_prometeo.html /home/yoni/labsemse/project-manager-app/docs/design/prometeo/temas_ausentes_prometeo.html
```

Separar frente Prisma antes de tocarlo:

```bash
git switch -c fix/prisma-escrow-status-reconciliation
```

Separar frente WhatsApp:

```bash
git switch -c fix/communications-whatsapp-webhook-signature
```

Separar frente Angular:

```bash
git switch -c feat/angular-prometeo-gaps
```

Descartar un archivo solo despues de confirmacion explicita:

```bash
git restore -- packages/db/prisma/schema.prisma
```

Eliminar untracked solo despues de confirmacion explicita:

```bash
git clean -n
```

Usar `git clean -n` primero. No usar `git clean -fd` sin confirmacion.

## Criterio final

El SDD esta limpio y separado. Los cambios restantes son utiles potencialmente, pero no deben viajar juntos. El unico cambio de riesgo critical es Prisma; comunicaciones es high hasta que tenga tests; Angular/Prometeo es medium por estatus de app no confirmado; env examples son low/medium y pueden limpiarse por separado.
