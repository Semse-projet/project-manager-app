# Rehabilitación Runtime Web + API

Fecha: 2026-04-08
Ruta canónica usada: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Resolver todos los bloqueos que impedían seguir con validación real del frontend:

1. `next dev` caía con `Bus error`;
2. el App Router abortaba por conflicto de slugs;
3. el web arrancaba sin backend configurado;
4. el API necesitaba ejecutarse fuera del sandbox para hablar con Postgres local;
5. faltaba validar que el flujo `web -> api` y una ruta protegida respondieran.

## Hallazgos clave

### 1. Ruta canónica real

El monorepo operativo no era la ruta histórica usada en reportes previos, sino:

- `/home/yoni/labsemse/project-manager-app`

Toda la rehabilitación de runtime se hizo ahí.

### 2. Causa real del `Bus error`

El crash no era de React ni de Next Router.

Se aisló al binding nativo:

- `@next/swc-linux-x64-gnu`

Prueba directa:

- cargar ese paquete con `node -e "require(...)"` devolvía `code 135`

Conclusión:

- el runtime local de `next` estaba rompiendo en SWC nativo.

## Correcciones aplicadas

### 1. Fallback a SWC WASM

Cambios:

- instalado `@next/swc-wasm-nodejs@15.5.12`
- actualizado `/home/yoni/labsemse/project-manager-app/apps/web/next.config.ts`
  - `experimental.useWasmBinary = true`

### 2. Parche local del loader de Next

Archivos tocados:

- `/home/yoni/labsemse/project-manager-app/node_modules/next/dist/build/swc/index.js`
- `/home/yoni/labsemse/project-manager-app/node_modules/next/dist/esm/build/swc/index.js`

Motivo:

- el loader WASM estaba intentando importar `@next/swc-wasm-nodejs` como directorio mediante `file://.../@next/swc-wasm-nodejs`
- en este entorno eso no resolvía el `main`

Corrección:

- se forzó import explícito a `@next/swc-wasm-nodejs/wasm.js`

### 3. Se quitó del path el binding nativo que crasheaba

Acción:

- `node_modules/@next/swc-linux-x64-gnu` se renombró a respaldo:
  - `swc-linux-x64-gnu.disabled`

Motivo:

- impedir que Next vuelva a cargar el binding que disparaba `Bus error`

### 4. Conflicto de App Router corregido

Problema:

- Next abortaba por slugs diferentes en el mismo nivel:
  - `[correlationId]`
  - `[runId]`

Corrección:

- se unificó la estructura en:
  - `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/ops/agent-runtime/[id]/route.ts`
  - `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/ops/agent-runtime/[id]/retry/route.ts`
  - `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/ops/agent-runtime/[id]/requeue/route.ts`

Las URLs externas no cambiaron.

## Arranque operativo conseguido

### API

Comando efectivo:

- `HOST=127.0.0.1 PORT=4000 node apps/api/dist/main.js`

Resultado:

- Nest arrancó correctamente
- Prisma conectó a Postgres
- `GET /v1/health` respondió `ok`

### Web

Comando efectivo:

- `cd /home/yoni/labsemse/project-manager-app/apps/web && SEMSE_API_BASE_URL=http://127.0.0.1:4000 SEMSE_TENANT_ID=tnt_demo SEMSE_ORG_ID=org_api_smoke_ops SEMSE_USER_ID=usr_dev SEMSE_ROLES=OPS_ADMIN NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true ../../node_modules/.bin/next dev --hostname 127.0.0.1 --port 3002`

Resultado:

- Next 15 arrancó en `http://127.0.0.1:3002`

## Validaciones reales

### 1. Proxy web contra API

Petición:

- `GET /api/semse/jobs`

Resultado:

- `200 OK`
- devolvió jobs reales del tenant `tnt_demo`

### 2. Ruta protegida con sesión

Se generó cookie `semse_session` válida desde:

- `/home/yoni/labsemse/project-manager-app/apps/web/lib/auth.ts`

Petición:

- `GET /client/jobs`

Resultado:

- `200 OK`
- devolvió HTML completo de la pantalla protegida

## Restricciones de entorno que siguen aplicando

- para bindear puertos locales y para conectar el API al Postgres local se necesitó ejecutar fuera del sandbox;
- la rehabilitación de runtime es efectiva para esta máquina, pero incluye un parche local sobre `node_modules/next/dist`.

## Resultado final

Quedaron resueltos los bloqueos que impedían continuar:

- `next dev` ya no cae por `Bus error`
- App Router ya no aborta por conflicto de slugs
- API y web pueden arrancar
- `web -> api` responde
- una ruta protegida responde con sesión válida

## Siguiente paso recomendado

La continuación correcta ahora ya vuelve a ser producto/UI:

1. recorrer las pantallas nuevas con browser real;
2. validar interacciones de `/client/jobs/[jobId]`, `/client/milestones`, `/client/payments`, `/admin/field-ops` y `/worker/tracker`;
3. convertir los fixes de runtime local en un procedimiento reproducible o script de entorno si esta máquina seguirá siendo el entorno principal.
