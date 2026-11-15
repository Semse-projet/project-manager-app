# Registro de PR — SEMSE Digital Twin V7

**Estado:** `OPEN`, sin merge.  
**PR:** **#1157** — https://github.com/Semse-projet/project-manager-app/pull/1157  
**Base:** `main` en `Semse-projet/project-manager-app`.  
**Head:** `feat/ecosystem-digital-twin-3d`.  
**SHA base autorizado:** `7029da63e719b264f7b2bfaff7eb4b716fe167b9`.  
**SHA head revisado al abrir:** `e4689f9400792707a64d91048495652286eadfd2`.  
**Título:** `feat(web): añadir gemelo digital 3D accesible de SEMSE`

## Resumen

- Añade una vista de sólo lectura del ecosistema con los 33 módulos históricos y la taxonomía canónica de nueve dominios.
- Comparte un único view model entre las vistas 3D, 2D y lista, con selección, búsqueda, filtros, inspección y tres flujos de valor finitos.
- Integra la vista en `/admin/consciousness` mediante el BFF existente y en `/semse-consciousness-map` con topología estática.
- Distingue topología, madurez de registro y observación global; no fabrica salud runtime por nodo ni convierte valores históricos en telemetría.
- Aplica el rediseño visual V7 sin cambiar los contratos funcionales ni los selectores accesibles.
- Incorpora `preview/static` como builder independiente y reproducible para la entrega navegable, sin Next.js, Docker, API ni protocolos `workspace:*`.

## Integridad y límites

- `runtimeHealth` y `observedAt` permanecen `null` cuando no existe medición por nodo.
- `maturity.byModule` se etiqueta `consciousness-registry`; `observation.healthScore` permanece global.
- Una fuente nula en la ruta estática no consultada no produce degradación falsa.
- SEMSE Agro puede permanecer sin módulos históricos; no se inventa un nodo.
- Sin endpoints nuevos, mutaciones, eventos, Prisma, migraciones, pagos, Omniverse ni acciones autónomas.
- `Dockerfile` y `next.config.ts` sólo contienen la excepción condicionada de iframe para preview; las protecciones normales permanecen cuando `SEMSE_PREVIEW_EMBEDDED` no es `true`.
- Los assets PWA `icon-192.png`, `icon-512.png` y `sw.js` fueron restaurados desde el SHA base porque faltaban en la copia parcial; no son una funcionalidad nueva.

## Archivos principales

### Modelo y adaptadores

- `apps/web/lib/digital-twin/`
- `apps/web/lib/data/semse-consciousness-topology.ts`

### UI y escena

- `apps/web/components/semse/digital-twin/`
- `apps/web/components/semse/semse-consciousness-map.tsx`
- `apps/web/app/(app)/admin/consciousness/page.tsx`
- `apps/web/app/semse-consciousness-map/page.tsx`

### Preview y configuración

- `preview/static/`
- `apps/web/next.config.ts`
- `Dockerfile`
- `scripts/workspace-runner.mjs` restaurado desde el SHA base para el tooling existente.

### Pruebas y gobierno

- `tests/unit/semse-digital-twin-*.test.ts`
- `tests/e2e-semse/semse-digital-twin.spec.ts`
- `docs/specs/ui/ecosystem-digital-twin-3d.*`
- `docs/SPEC_INDEX.md`
- `artifacts/evidence/digital-twin/`

## Validación disponible

Ejecutada con Node.js `22.23.5` y pnpm `10.33.0`:

- Build de paquetes internos: `PASS`.
- Unitarios dirigidos: **13/13 PASS**.
- TypeScript Web: `PASS`, sin errores.
- ESLint Web: **0 errores**; 39 advertencias preexistentes fuera del gemelo.
- Build Next.js: `PASS`, 422 páginas estáticas.
- Builder estático: `npm ci`, typecheck estricto y build Vite `PASS`.
- E2E Chromium: **8/8 PASS**, sin reintentos ni resultados flaky.
- Spec V7 aislado: strict/coverage `PASS`, 0 errores y 0 advertencias.

Evidencias:

- [`v7-validacion.md`](v7-validacion.md)
- [`v7-ci-local.md`](v7-ci-local.md)
- [`v7-ci-e2e-report.json`](v7-ci-e2e-report.json)
- Capturas locales `v7-desktop.png` y `v7-mobile.png`, deliberadamente no incluidas en el paquete remoto.

La validación CI es local equivalente. No hay check remoto terminal asociado a este árbol; `ci_status` permanece `NOT_RUN` hasta que exista esa evidencia.

## Preview

- Versión V7: `1656593`.
- Estado de guardado: `STATUS_COMMITTED`.
- Señal: `CHANGE_SIGNAL_CHANGED`.

Una preview guardada no equivale a publicación, deployment o activación. Las capturas y pruebas son locales; no se afirma confirmación visual remota del usuario.

## Riesgos y mitigaciones

| Riesgo | Mitigación incluida |
|---|---|
| Confundir datos estáticos con runtime | Fuentes explícitas, nulos y textos de procedencia |
| Coste GPU o loops ambientales | Instancing, aristas agrupadas, DPR limitado y render bajo demanda |
| Canvas inaccesible | Vistas 2D/lista, teclado, foco, reduced motion y fallback |
| Fugas de recursos | Cancelación de RAF, listeners y disposición completa |
| Instalación del visor dinámico | Builder estático con manifiesto y lockfile propios |
| Assets ausentes en copia parcial | Restauración desde el SHA autorizado y E2E final 8/8 |

Advertencias no bloqueantes: directivas `use client` ignoradas por Rollup y chunk diferido de Three.js de aproximadamente 512,37 KB.

## Rollback

Revertir los archivos del incremento restaura la composición anterior sin reparación de datos ni migraciones. El builder estático y las evidencias son aditivos. La excepción de iframe desaparece al revertir `next.config.ts` y `Dockerfile`; el modo normal nunca la activa implícitamente.

## Revisión de seguridad del paquete local

- 28 archivos de las rutas principales inspeccionados con patrones de secretos: 0 hallazgos.
- Archivos `.env` en `preview/static`: 0.
- Protocolos `workspace:*` en manifiesto/lockfile del builder: 0.
- `Math.random()` en el incremento del gemelo: 0.
- El fixture E2E y `local-digital-twin-test-only` son exclusivamente locales y no representan credenciales de producción.

El diff remoto completo fue revisado contra `main` antes de abrir el PR: 40 archivos dentro del alcance autorizado, sin capturas, assets PWA restaurados, `.env`, Prisma ni archivos de Railway. Esta auditoría no sustituye un CI remoto.

## Gates posteriores — no ejecutados

- [x] Crear branch/commits y abrir PR **#1157** con confirmación explícita; SHA head revisado al abrir: `e4689f9400792707a64d91048495652286eadfd2`.
- [ ] Esperar CI remoto terminal y registrar resultado.
- [ ] Fusionar sólo con autorización específica y registrar SHA de merge.
- [ ] Desplegar mediante un gate separado.
- [ ] Ejecutar smoke autenticado de producción y activación/canary independiente.

**Estados actuales:** código local `COMPLETE`; CI local `PASS`; CI remoto `NOT_RUN`; merge `UNMERGED`; deploy `NOT_DEPLOYED`; activación `INACTIVE`; migración `NOT_APPLICABLE`; `production_evidence=[]`.
