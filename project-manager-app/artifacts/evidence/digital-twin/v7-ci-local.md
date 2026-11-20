# Validaciones CI locales — SEMSE Digital Twin V7

**Fecha:** 2026-11-15  
**Autorización inicial:** ejecutar validaciones CI, sin crear PR, fusionar, desplegar ni activar; posteriormente se autorizó branch y PR, manteniendo prohibidos merge, deploy y activación.  
**Resultado:** `PASS` para el conjunto dirigido y los builds aplicables.  
**Tipo de evidencia:** CI local equivalente; no es una ejecución remota de GitHub Actions.

## Entorno

- Node.js `22.23.5`, alineado con `engines.node >=22.0.0`.
- pnpm `10.33.0`, instalación con `--frozen-lockfile`.
- Chromium del sistema para E2E, sin reintentos (`SEMSE_PR973_E2E_QA=1`).
- Workspace temporal construido desde el árbol V7 actual.

En el SHA base autorizado no se localizaron las definiciones de GitHub Actions durante la preparación local, por lo que primero se ejecutaron directamente los scripts y comandos del workspace. Al abrir el PR sí se activaron checks remotos reales; sus resultados terminales se registran más abajo. Tras las correcciones verificadas, el CI local equivalente y el remoto son `PASS`, y el estado agregado actual del spec es `ci_status=PASS`.

## Resultados

| Validación | Resultado | Detalle |
|---|---|---|
| Instalación workspace | PASS | Lockfile congelado, 21 proyectos workspace |
| Build de paquetes internos | PASS | Schemas, tokens, shared, auth, knowledge, forge, agents, autonomy, tools, SDK y product-events |
| Unitarios dirigidos | PASS | 13/13; 0 fallos, omitidos o TODO |
| TypeScript Web | PASS | `tsc -p tsconfig.json --noEmit`, sin errores |
| ESLint Web | PASS | 0 errores; 39 advertencias preexistentes en archivos ajenos al gemelo |
| Build Web Next.js | PASS | Compilación, tipos y 422 páginas estáticas generadas |
| Builder estático — instalación | PASS | `npm ci`, 47 paquetes, 0 vulnerabilidades reportadas |
| Builder estático — TypeScript | PASS | Strict, sin emisión |
| Builder estático — build | PASS | Vite, 1.758 módulos transformados |
| E2E Digital Twin | PASS | 8/8, 0 flaky, 0 inesperados, 35,3 s, sin reintentos |

Reporte estructurado E2E: [`v7-ci-e2e-report.json`](v7-ci-e2e-report.json).

## Cobertura E2E final

1. Render 3D de 33 instancias, reposo, teclado y reset.
2. Equivalencia 2D/lista, búsqueda, filtro, selección y estado vacío.
3. Reproducción finita y repetición de los tres flujos.
4. Reduced motion sin impulso SMIL.
5. Fallback ante WebGL ausente.
6. Pérdida de contexto, recuperación y unmount sin canvas residual.
7. Desktop/móvil, resize, targets táctiles y etiquetas dentro del canvas.
8. Integración admin con fixture controlado, madurez de registro, salud global y 403 controlado.

El fixture y `local-digital-twin-test-only` son exclusivamente datos de prueba local; no son credenciales ni evidencia de producción.

## Incidencias de ejecución resueltas

- El primer intento unitario con Node 20 no aceptó `--experimental-strip-types`. Se instaló Node 22 y la ejecución válida terminó 13/13.
- Las dos primeras ejecuciones E2E terminaron 7/8 por 404 de `icon-192.png`, `icon-512.png` y `sw.js`. Esos archivos están referenciados por el layout/registrador PWA y existen en el SHA autorizado, pero faltaban en la copia parcial.
- Se restauraron los tres archivos exactos desde `7029da63e719b264f7b2bfaff7eb4b716fe167b9`, se reinició el servidor para reconocer los nuevos assets públicos y la suite final pasó 8/8 sin reintentos. No se modificó código de producto para eludir el fallo.
- El build estático conserva las advertencias no bloqueantes ya registradas: directivas `use client` ignoradas por Rollup y chunk diferido de Three.js de 512,37 KB.

## CI remoto posterior en PR #1157

Se corrigieron dos causas sin desactivar gates:

1. El índice SDD se regeneró en orden lexicográfico canónico; el gate documental pasó.
2. Con el `tsconfig.json` remoto exacto se reprodujeron nueve errores `TS5097` en imports `.ts` del gemelo. Se añadió `allowImportingTsExtensions: true`, conservando `strict` y `noEmit`. El archivo remoto quedó verificado byte a byte con blob `7a6362a7c6fc8c987e9b9327ffd6fd9e7a34e2cc`.

El archivo `apps/worker/src/main.mjs` existe con el mismo blob en base y head; su ausencia inicial en la réplica era un artefacto de copia parcial, no un fallo del producto. Tras restaurarlo sólo en la réplica, `spec:preflight` local completo terminó con código `0`, incluidos builds, Prisma generate, typechecks API/Web/móvil y sintaxis del worker. Los 13 unitarios dirigidos volvieron a pasar.

Checks terminales observados sobre el head `e2d70e2b0ff38cb97581f96d0d0c81b8b74f565c`:

| Check remoto | Resultado | Evidencia |
|---|---|---|
| `quality-gates` | `success` | [Job 132862985067](https://github.com/Semse-projet/project-manager-app/actions/runs/43730937465/job/132862985067) |
| `unit-coverage` | `success` | [Job 132862984790](https://github.com/Semse-projet/project-manager-app/actions/runs/43730937465/job/132862984790) |
| `e2e` | `success` | [Job 132865928080](https://github.com/Semse-projet/project-manager-app/actions/runs/43730937465/job/132865928080) |
| CodeQL Python | `success` | [Job 132862598338](https://github.com/Semse-projet/project-manager-app/actions/runs/43730814072/job/132862598338) |
| CodeQL JavaScript/TypeScript | `success` | [Job 132862598526](https://github.com/Semse-projet/project-manager-app/actions/runs/43730814072/job/132862598526) |
| `pr973-authenticated-qa` | `skipped` | [Job 132865929117](https://github.com/Semse-projet/project-manager-app/actions/runs/43730937465/job/132865929117); workflow exclusivo del PR #973 |

El resultado agregado remoto es `PASS`. Dentro de `quality-gates` pasaron SDD, Prisma, toolchain, `Spec preflight`, unitarios globales y `Verify workspace`.

## Límites y estados

- No se repitió la suite unitaria global de 1.616 tests; su limitación previa permanece documentada y no se atribuye al gemelo.
- Las validaciones anteriores fueron locales. Al abrir el PR se ejecutó CI remoto real, registrado en la sección siguiente.
- No se ejecutó merge, deploy, publicación, Railway ni activación.
- El PR **#1157** se abrió posteriormente con autorización y permanece `OPEN`, sin merge: https://github.com/Semse-projet/project-manager-app/pull/1157.
- CI local equivalente: `PASS`.
- CI remoto/plataforma: `PASS`; `quality-gates`, `unit-coverage`, E2E y CodeQL pasaron; QA #973 fue omitida por alcance.
- Merge: `UNMERGED`.
- Deploy: `NOT_DEPLOYED`.
- Activación: `INACTIVE`.
- Migración: `NOT_APPLICABLE`.
- Evidencia de producción: ninguna; `production_evidence=[]`.
