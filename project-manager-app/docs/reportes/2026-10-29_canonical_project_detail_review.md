# Detalle de proyecto canónico — preparación local

Fecha: 2026-10-29. Base revisada: `origin/main` en `a7620f24`.

## Problema y cambio

El fallback del detalle cliente ya consultaba el proyecto canónico y su trabajo,
pero buscaba `description`, `trade` y `budget` en la respuesta del trabajo.
El contrato `jobRecordSchema` publica `scope`, `category`, `budgetMin` y
`budgetMax`. Esto dejaba descripción y presupuesto vacíos aunque la API
devolviera esos datos.

El mapper `buildCanonicalProjectView` concentra esa adaptación: usa `scope`
como descripción, `category` como oficio y `budgetMax ?? budgetMin` como
presupuesto. Conserva cero y deja el presupuesto en `null` si falta el trabajo.
La ruta BFF ya estaba en la base y no necesita duplicarse.

Alcance autorizado: remediación de la UI cliente bajo el spec APPROVED
`docs/specs/ui/client-flows-remediation.spec.md`. No cambia consultas de dominio,
autorización, esquema de datos ni transiciones operativas.

## Verificación local

- Cinco regresiones del mapper: PASS.
- Validación estricta SDD: 205 specs, 0 errores, 0 warnings.
- Validación SDD contra `origin/main`: PASS. Índice: 205 specs válidos.
  Cobertura del plan de auditoría: 173/173 ítems mapeados, 0 errores.
- Lint de toda la web: PASS, 0 errores y 37 warnings en archivos no modificados.
- TypeScript de toda la web (`tsc --noEmit --incremental false`): PASS.
- Build web: compilación PASS, tipos PASS y 424/424 páginas generadas.
  Resultado terminal FAIL al empaquetar `standalone`: Windows rechaza la
  creación de enlaces simbólicos (`EPERM`, syscall `symlink`). No se declara
  build global verde ni paquete desplegable. Repetir en CI Linux o en un
  entorno Windows con los permisos de enlaces simbólicos correspondientes.

Las dependencias se instalaron desde el lockfile en este worktree con:

```powershell
corepack pnpm --filter @semse/web... install --frozen-lockfile --ignore-scripts --node-linker=isolated --config.shamefully-hoist=true --package-import-method=hardlink --config.confirmModulesPurge=false
corepack pnpm --filter @semse/web... --if-present run build
corepack pnpm --filter @semse/web exec tsc --noEmit --incremental false
corepack pnpm --filter @semse/web lint
node --experimental-strip-types --test tests/unit/canonical-project-view.test.ts
node scripts/spec-validate.mjs --strict
```

El modo aislado se indicó solo para esta instalación local, evitando instalar
los paquetes ajenos a la web; `.npmrc` y `pnpm-lock.yaml` no se modificaron.
Se conservó el hoisting de dependencias transitivas que usa el repo para resolver
`framer-motion` y los tipos de React. Sin ello, el modo aislado estricto encuentra
imports preexistentes que no están declarados directamente por sus consumidores.

## Entrega y límites

Este informe registra el corte de preparación local anterior a la publicación
del PR en borrador; el estado remoto posterior se consulta en GitHub. No se ejecutaron
recorridos autenticados de navegador ni se validó producción. Las pruebas
generales de usabilidad no constituyen una regresión específica del mapper;
la evidencia focal está en `tests/unit/canonical-project-view.test.ts`.
El script de PostgreSQL y los artefactos generados se conservan en el checkout
original, fuera de esta entrega.

Rollback: revertir los commits del mapper y su integración en la página;
no requiere rollback de datos.

## Propuesta de PR

Título: `fix(web): map canonical project detail from the job API contract`

El detalle de un proyecto canónico muestra ahora la descripción, categoría y
presupuesto que devuelve la API del trabajo. Se extrae el mapper a una función
con cinco regresiones, conservando presupuesto cero y datos ausentes.

Checks locales aprobados: regresiones, lint, TypeScript y SDD. El build supera
compilación y generación de páginas, pero su empaquetado standalone falla por
permisos de enlaces simbólicos de Windows. Falta build terminal y revisión en
CI antes de considerar la entrega lista para merge.
