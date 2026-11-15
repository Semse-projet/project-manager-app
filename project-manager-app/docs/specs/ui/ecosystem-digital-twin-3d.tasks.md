---
type: tasks
feature: "Ecosystem Digital Twin 3D"
domain: "ui"
plan: "docs/specs/ui/ecosystem-digital-twin-3d.plan.md"
version: "2.0"
status: "PR_OPEN_REMOTE_CI_FAIL"
branch: "feat/ecosystem-digital-twin-3d"
date: "2026-11-15"
---

# Tareas: Ecosystem Digital Twin 3D

`[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.
Branch y PR **#1157** existen; el PR sigue abierto y sin merge:
https://github.com/Semse-projet/project-manager-app/pull/1157.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar alcance autorizado, spec `APPROVED` y SHA de main.
- [x] [T-002] Registrar que producción, flags y migraciones no fueron tocados.
- [x] [T-003] Completar spec, plan, análisis y checklist.
- [x] [T-004] Registrar tres fuentes primarias y decisiones.
- [x] [T-005] Ejecutar indexador canónico para enlazar el spec.

## Fase 1 — Tests y contratos

- [x] [T-010] Escribir tests rojos de adaptación, fuentes y valores ausentes.
- [x] [T-011] [P] Escribir tests rojos de layout determinista y aristas válidas.
- [x] [T-012] [P] Escribir tests rojos de paths y playback finito.
- [x] [T-013] Ejecutar tests y conservar evidencia del fallo por módulos ausentes.

## Fase 2 — Modelo de presentación

- [x] [T-020] Implementar tipos, nueve dominios y mapeo explícito de 33 IDs.
- [x] [T-021] Implementar adaptador de topología y aristas derivadas.
- [x] [T-022] Implementar composición Consciousness con madurez de registro,
  observación global, módulos desconocidos y `null` runtime por nodo.
- [x] [T-023] Implementar layout estable y flujos sin aleatoriedad.
- [x] [T-024] Pasar 13 tests unitarios del modelo.

## Fase 3 — UI

- [x] [T-030] Implementar escena Three.js bajo demanda y lifecycle completo.
- [x] [T-031] Implementar controles, detalle, búsqueda, filtros y playback.
- [x] [T-032] Implementar vistas 2D/lista, teclado y reduced motion.
- [x] [T-033] Implementar estados empty/degraded/error/WebGL y responsive.
- [x] [T-034] Integrar admin con el fetch existente y ruta histórica estática.
- [x] [T-035] Eliminar salud aleatoria del componente histórico migrado.

## Fase 4 — Verificación local

- [x] [T-040] Tests unitarios dirigidos verdes: 13/13.
- [x] [T-041] E2E de modos, selección, búsqueda, flujos, fallback y 403: 8/8.
- [x] [T-042] Build/typecheck/lint y revisión de consola.
- [x] [T-043] `pnpm spec:validate:strict`: 219 specs, 0 errores, 0 advertencias.
- [x] [T-044] `pnpm spec:index`, `spec:index:check` y `spec:coverage` ejecutados.
- [x] [T-045] Capturas desktop/móvil y revisión visual real.
- [x] [T-046] Actualizar metadata sólo al estado local demostrado.
- [x] [T-047] Rediseñar V7 sin cambiar view model, datos, callbacks ni accesibilidad.
- [x] [T-048] Crear builder `preview/static` con lockfile, sincronización acotada,
  typecheck estricto y build Vite; validar `npm ci`, typecheck, build y smoke.
- [x] [T-049] Inspeccionar capturas V7 desktop/móvil y crear
  `artifacts/evidence/digital-twin/v7-validacion.md`.
- [x] [T-049A] Guardar preview V7 `1656593` con `STATUS_COMMITTED` y
  `CHANGE_SIGNAL_CHANGED`; no registrarlo como publicación o deploy.
- [x] [T-049B] Validar spec V7 aislado con strict/coverage y conservar índice
  canónico de 219 filas; documentar la copia persistente parcial.

## Fase 5 — PR, CI y merge (PR abierto; merge no autorizado)

- [x] [T-050] Revisar diff remoto completo contra `main`: 40 archivos dentro del
  alcance, sin secretos, capturas, assets PWA, Prisma ni archivos de Railway.
- [x] [T-050B] Crear `v7-pr-draft.md` y auditar 28 archivos principales sin
  secretos, `.env`, `workspace:*` en builder ni `Math.random()` en código.
- [x] [T-050A] Ejecutar CI local equivalente V7 con Node 22: paquetes, 13 unitarios,
  TypeScript, ESLint, build Web, builder estático y 8 E2E sin reintentos verdes.
- [x] [T-050C] Abrir PR **#1157** con base `main` y head
  `feat/ecosystem-digital-twin-3d`; SHA revisado al abrir:
  `e4689f9400792707a64d91048495652286eadfd2`. URL:
  https://github.com/Semse-projet/project-manager-app/pull/1157.
- [x] [T-051] Registrar CI remoto terminal: `ci_status=FAIL` por `quality-gates`;
  `unit-coverage` y CodeQL verdes, E2E/QA remotos `skipped`. No se atribuye la causa
  al gemelo sin revisar el log del job.
- [ ] [T-052] Fusionar sólo con confirmación explícita y registrar SHA.

## Fase 6 — Deploy y activación (no autorizado)

- [ ] [T-060] Verificar pre-deploy y deployment terminal.
- [ ] [T-061] Ejecutar smoke autenticado y comprobar límites existentes.
- [ ] [T-062] Activar canary sólo con gate separado.
- [ ] [T-063] Registrar evidencia de producción; `last_verified` actual sólo
  representa la verificación local de 2026-11-15.

## Criterio de Done del incremento local

- [x] Código y pruebas locales completos, sin afirmar CI/merge/deploy/activación.
- [x] 3D, 2D y lista verificados en navegador; fallback y reduced motion también.
- [x] Ningún valor estático se etiqueta como telemetría runtime.
- [x] Preview V7 guardada con ID `1656593` y confirmación `STATUS_COMMITTED`;
  no equivale a publicación, deploy ni activación.
- [x] Builder reproducible y evidencias propias de V7 incorporados al árbol fuente.
- [x] Migración `NOT_APPLICABLE`; Omniverse y grafo operativo permanecen fuera.

## Limitación de suite global documentada

La ejecución completa contabilizó 1.616 tests: 1.586 verdes, 5 omitidos, 11 TODO
y 14 fallos. Trece archivos requieren `apps/api/dist` no generado y uno es un
TODO ya declarado. El build API independiente quedó bloqueado por errores
TypeScript en módulos fuera del diff; no se modificó backend ni Prisma para
ocultar esa limitación.
