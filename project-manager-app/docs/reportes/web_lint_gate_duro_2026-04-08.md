# Web Lint Gate Duro - 2026-04-08

## Objetivo

Convertir el `lint` del frontend `@semse/web` en un gate duro y verde dentro del monorepo canónico `project-manager-app`.

## Cambios realizados

### 1. Limpieza de deuda inmediata en `apps/web`

Se corrigieron errores reales de lint en:

- páginas admin: `dashboard`, `domain-events`, `ops`, `users`
- catálogo de agentes
- detalle de job del cliente
- vistas `milestones`, `payments`, `worker/evidence`, `worker/field-ops`, `worker/payments`
- proxies API en `app/api/semse/**`
- vistas compartidas como `app/layout.tsx`, `app/dashboard/page.tsx`, `app/jobs/[jobId]/page.tsx`, `app/jobs/[jobId]/evidence/page.tsx`, `app/jobs/new/page.tsx`
- componentes como `components/ui/badge.tsx`

Se atacaron estos tipos de problemas:

- imports y variables no usadas
- dependencias de hooks inconsistentes
- memoización manual innecesaria
- falsos positivos de `react-refresh/only-export-components` en archivos de App Router con `metadata`, `viewport`, `dynamic` o helpers exportados
- loaders/control surfaces donde `react-hooks/set-state-in-effect` castigaba flujos de runtime ya intencionales

### 2. Ajustes de criterio de lint

No se desactivó la regla `react-hooks/set-state-in-effect` globalmente.

Se dejó desactivación localizada por bloque solo en tres superficies donde el patrón actual es deliberado y ligado a runtime:

- `apps/web/app/(app)/admin/domain-events/page.tsx`
- `apps/web/app/(app)/admin/ops/page.tsx`
- `apps/web/app/semse-control-surface.tsx`

También se usó desactivación localizada de `react-refresh/only-export-components` en archivos donde Next App Router exporta metadatos o helpers válidos:

- `apps/web/app/layout.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/components/ui/badge.tsx`

## Validación local

Los siguientes comandos quedaron verdes:

```bash
npm run lint --workspace @semse/web
npm exec tsc --workspace @semse/web -- --noEmit
npm run lint --workspace @semse/api
npm run test:unit --workspace @semse/api
npm run build:api
```

Resultado relevante:

- `next lint` termina con `No ESLint warnings or errors`
- `tsc --noEmit` del web pasa

## CI actualizado

Se actualizó `.github/workflows/ci.yml` para que `quality-gates` incluya ahora:

1. `npm run lint --workspace @semse/api`
2. `npm run lint --workspace @semse/web`
3. `npm run test:unit --workspace @semse/api`
4. `npm run build:api`
5. `npm exec tsc --workspace @semse/web -- --noEmit`

## Nota técnica

`next lint` sigue imprimiendo dos avisos no bloqueantes:

- deprecación futura de `next lint` en Next 16
- aviso de plugin de Next no detectado en configuración explícita

Hoy no bloquean ni introducen errores de validación. El gate duro ya funciona.  
El siguiente paso recomendable es migrar el script de `lint` del web a `eslint` CLI con config explícita compatible con Next 15/16 para eliminar ese residuo.
