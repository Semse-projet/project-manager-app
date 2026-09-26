# Admin Integration Trust Status — sesión 2026-09-25

## Alcance

Se reemplazó la afirmación ambigua de “integración configurada” por estados
operativos explícitos para OpenAI, GitHub, WhatsApp Cloud, Stripe y Dropbox Sign.

## Cambios

- Contratos Zod para identificadores, estados y resultados públicos.
- Servicio API con detección de simulación, variables faltantes y probes GET.
- Endpoints Admin protegidos por permisos de lectura/escritura de operaciones.
- BFF y pantalla responsive que separan habilitación tenant de conexión externa.
- Documentación WhatsApp alineada con los nombres usados por producción.

## Seguridad

- No se devuelven valores de variables.
- No se registran cuerpos externos ni credenciales.
- Las pruebas tienen timeout de ocho segundos y no ejecutan acciones de negocio.
- No se modifican Payments, Evidence, FSM ni esquema Prisma.
- `integrations.checks` es propiedad del servidor: `PUT /v1/admin/settings`
  descarta cualquier `checks` recibido y conserva el histórico; sólo
  `AdminService.recordIntegrationCheck` (llamado por el verify) lo escribe.

## Continuación 2026-09-26 (reaplicado sobre `main` `197c338`)

- El parche se aplicó limpio sobre `main` actual; `SPEC_INDEX.md` regenerado
  con `pnpm spec:index` produce la misma fila.
- Defecto corregido en revisión: la página autoguarda el objeto completo de
  ajustes con la copia de `checks` cargada al montar. Tras “Probar conexión”,
  cualquier cambio posterior sobrescribía la verificación recién guardada, y un
  `PUT` manual podía fabricar un estado `VERIFIED`. Se añadieron 3 pruebas de
  regresión (fallan sin el arreglo).
- Validación en checkout limpio: `pnpm typecheck` y `pnpm lint` aprobados,
  `@semse/api` y `web` compilan, `@semse/api test:unit` 2449 aprobadas / 0
  fallidas (admin 8/8), `spec:validate:strict` 139 specs, 0 errores, 0 warnings.

## Validación

- `packages/schemas`: build TypeScript aprobado.
- API modificada: typecheck focalizado aprobado.
- Web modificada: typecheck focalizado aprobado.
- Lint API/Web modificado: aprobado.
- Tests de integración admin: 5/5 aprobados.
- `spec-validate --strict`: 137 specs, 0 errores, 0 warnings.
- Full build local: no concluyente porque el clon de verificación reutilizó
  dependencias compiladas de un checkout anterior; produjo drift en Prisma y
  `@semse/ui` fuera de los archivos modificados. CI limpio es el gate restante.

## Delivery

- Código: COMPLETE sobre `main` `197c338` (PR en borrador).
- CI: NOT_RUN.
- Merge: UNMERGED.
- Deploy: NOT_DEPLOYED.
- Activación: INACTIVE.
