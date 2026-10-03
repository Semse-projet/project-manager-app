# Remediación de confirmaciones monetarias de Cliente — 2026-07-23

## Alcance

Se cerraron los hallazgos críticos `1.1`, `1.2` y `1.3` de
`docs/AUDIT_REMEDIATION_PLAN.md`:

- fondeo de escrow sin revisión previa;
- liberación de milestones con un solo clic;
- cierre de disputa con resultado implícito y sin confirmación.

## Implementación

### Fondeo

- `/client/jobs/[jobId]` y `/jobs/[jobId]/escrow` reutilizan
  `EscrowFundModal`.
- El primer clic solo abre el diálogo.
- La petición se ejecuta después de revisar monto, moneda, proveedor y método y
  pulsar la confirmación final.

### Liberación

- Se agregó `EscrowReleaseModal`, compartido por la ruta canónica de Cliente y
  las dos superficies heredadas.
- El diálogo muestra milestone, monto y moneda y advierte que la acción mueve
  dinero.
- `EscrowTimeline` ya no modela un callback de mutación asíncrona: solicita la
  liberación al page owner, que abre el diálogo y conserva la llamada a la API
  detrás de la confirmación.
- El timeline ordena una copia de milestones, evitando mutar el prop recibido.

### Disputas y RBAC

- `/jobs/[jobId]` y `/client/disputes` abren `DisputeResolutionModal`.
- CLIENT ve el único acuerdo que el backend autoriza:
  `resolutionType=pro_favor`; el diálogo explica que libera fondos al
  profesional y exige una casilla de aceptación.
- Refund, split y escalamiento continúan reservados a OPS_ADMIN.
- Se agregó `disputes:resolve` a CLIENT para alcanzar el guard del endpoint.
  `assertDisputeResolvable` sigue aplicando ownership y limita CLIENT a
  `pro_favor`; PRO y WORKER no recibieron el permiso.
- `/jobs/*`, antes fuera de los prefijos protegidos, ahora requiere sesión y
  solo permite CLIENT u OPS_ADMIN.

## Verificación

- `node --experimental-strip-types --test tests/unit/client-money-confirmation.test.ts tests/unit/auth.test.ts apps/api/test/disputes-policy.test.ts`
  — 38/38.
- `corepack pnpm --filter @semse/web lint`
  — 0 errores; 54 warnings preexistentes.
- `corepack pnpm --filter @semse/web build`
  — compilación y typecheck correctos; 402 páginas generadas.
- `node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json`
  — typecheck incremental posterior limpio.
- `corepack pnpm --filter @semse/auth build` y
  `corepack pnpm --filter @semse/api build`
  — compilación limpia con el RBAC actualizado.
- `node --test apps/api/test/disputes.controller.test.ts`
  — 1/1.

El atajo raíz `corepack pnpm build:web` no pudo completar su wrapper
`build:packages` porque `workspace-runner.mjs` intenta ejecutar `pnpm` sin
Corepack y el binario no está en `PATH` en este entorno Windows. El build
directo del workspace web sí terminó correctamente.

## Estado operativo

No se hizo push ni deploy. Falta verificación manual en un entorno con sesión
CLIENT y datos de escrow reales para observar la experiencia completa contra
el backend desplegado.
