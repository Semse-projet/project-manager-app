# Validación local — SEMSE Digital Twin V7

**Fecha:** 2026-11-15  
**Alcance:** rediseño visual de la escena existente, preview estática ligera y builder reproducible.  
**Resultado:** validación funcional y visual local completada. No constituye validación de producción.

## Entrega comprobada

- Rediseño V7 aplicado sin cambiar el modelo de datos, los 33 módulos históricos, los nueve dominios, los flujos ni los contratos de selección y filtrado.
- Vistas equivalentes 3D, 2D y lista; controles accesibles, foco visible, reduced motion y fallback sin WebGL conservados.
- Preview estática sin Next.js, Docker, API, autenticación ni dependencias `workspace:*`.
- Builder reproducible en `preview/static`, con fuentes sincronizadas desde el árbol canónico, versiones fijadas y lockfile propio.
- Versión de preview V7 guardada: **ID `1656593`**, `bigVersion=7`, `STATUS_COMMITTED`, `CHANGE_SIGNAL_CHANGED`. Guardar preview no equivale a publicar ni desplegar.

## Evidencias visuales

- Captura local `v7-desktop.png`.
- Captura local `v7-mobile.png`.

Ambas capturas fueron abiertas e inspeccionadas localmente. Se comprobó la composición general, el contraste, las etiquetas, el inspector y el encuadre móvil. Permanecen fuera del paquete remoto para no añadir binarios; no se afirma confirmación visual del visor remoto por parte del usuario.

## Validación funcional V7

| Comprobación | Resultado |
|---|---|
| Carga desktop | PASS |
| Carga móvil e iframe local | PASS |
| Nodos en escena | PASS — `nodeCount=33` |
| Vistas 3D, 2D y lista | PASS |
| Búsqueda, filtro de dominio y selección | PASS |
| Reproducción de flujo y reset de cámara | PASS |
| Etiquetas móviles dentro del canvas | PASS |
| Overflow horizontal | No detectado |
| Errores de consola | 0 |
| Respuestas 404 | 0 |
| Llamadas API desde la ruta estática | 0 |

Métricas locales de la escena V7: `renderCount=2`, `drawCalls=23`, `triangles=8080`, `dpr=1`. Son mediciones del entorno local, no SLO ni evidencia de producción.

## Builder reproducible

Comandos ejecutados desde `preview/static` con `SEMSE_REPO_ROOT` apuntando al árbol fuente:

```sh
npm ci
npm run typecheck
npm run build
```

Resultados:

- Instalación desde lockfile: **PASS**, 47 paquetes instalados, 0 vulnerabilidades reportadas por npm.
- TypeScript estricto, sin emisión: **PASS**.
- Build Vite: **PASS**, 1.758 módulos transformados.
- Smoke de navegador sobre la salida del builder: **PASS** — HTTP 200, 33 nodos, primer frame 3D, vistas 2D/lista, búsqueda de `Smart Intake` con un resultado y retorno a 3D en viewport móvil.
- Consola del smoke: **0 errores**.
- Overflow horizontal móvil: **no detectado**.

El smoke se repitió con selectores corregidos durante la comprobación; los intentos fallidos fueron errores del script de validación —una lista con nombre accesible inexistente, un contador que sólo aparece en la vista de escena y el término `billing` sin coincidencias—, no fallos del producto. La ejecución final completa quedó verde.

### Advertencias no bloqueantes

- Rollup ignora las directivas `"use client"` de los componentes compartidos; es esperado en este bundle browser-only y no impidió el build ni el smoke.
- El chunk diferido de Three.js ocupa aproximadamente 512,37 KB, ligeramente por encima del umbral de advertencia de 500 KB. Ya está separado mediante carga dinámica.
- npm informó que el script de instalación de `esbuild` no estaba cubierto por su política de `allowScripts`; la compilación y las pruebas posteriores terminaron correctamente.

## Motivo de la entrega estática

El visor dinámico ejecutaba `npm install` antes de Docker y fallaba con `EUNSUPPORTEDPROTOCOL` porque el monorepo contiene dependencias `workspace:*` y requiere pnpm. La entrada estática elimina ese punto de fallo para la preview sin modificar el backend ni convertir la preview en un deployment.

## Validación documental V7

- Spec, plan, tareas, análisis y checklist actualizados para el rediseño, el builder y las evidencias V7.
- Validación estricta aislada del spec del gemelo: **PASS**, 1 spec, 0 errores y 0 advertencias.
- Cobertura del spec aislado: **PASS**, `related_files` y `related_tests` presentes, metadata SDD 2.0 completa.
- `docs/SPEC_INDEX.md` conserva las 218 entradas históricas del SHA autorizado más una única entrada del gemelo: **219 filas**.

El árbol persistente es una copia parcial del monorepo: contiene dos specs y carece de archivos relacionados con `ui.prometeo-mascot-3d`. Por ello, una ejecución global del validador sobre esa copia produce cuatro errores ajenos al gemelo y no se presenta como validación full-repo. El índice generado accidentalmente con sólo dos entradas fue descartado y restaurado desde el SHA autorizado antes de insertar la entrada del gemelo. La ejecución full-repo anterior —219 specs, 0 errores y 0 advertencias— sigue siendo evidencia histórica de la implementación original, no una nueva ejecución global de V7.

## Validación CI local posterior

Con Node 22 se completó una validación CI local equivalente: paquetes internos, 13 unitarios, TypeScript Web, ESLint, build Web de 422 páginas, builder estático y 8/8 E2E sin reintentos, todos verdes. ESLint conserva 39 advertencias preexistentes fuera del gemelo. Consultar [`v7-ci-local.md`](v7-ci-local.md) y [`v7-ci-e2e-report.json`](v7-ci-e2e-report.json). Este resultado no es CI remoto y no cambia `ci_status=NOT_RUN`.

## Registro y revisión de PR

Se actualizó [`v7-pr-draft.md`](v7-pr-draft.md) como registro del PR con alcance, archivos, pruebas, riesgos y rollback. La auditoría de 28 archivos principales no encontró secretos, archivos `.env`, protocolos `workspace:*` en el builder ni `Math.random()` en el código del gemelo.

El diff remoto completo se revisó contra `main` (`7029da63e719b264f7b2bfaff7eb4b716fe167b9`): **40 archivos**, todos dentro del incremento autorizado, sin capturas, assets PWA restaurados, cambios Prisma ni archivos de Railway. Treinta y ocho archivos coinciden byte a byte con la copia local validada; el reporte E2E sólo difiere en el salto de línea final y el lockfile es estructuralmente idéntico.

- PR: **#1157**, `OPEN`, sin merge.
- URL: https://github.com/Semse-projet/project-manager-app/pull/1157
- Base: `main`; head: `feat/ecosystem-digital-twin-3d`.
- SHA head revisado al abrir: `e4689f9400792707a64d91048495652286eadfd2`.

## Estados independientes

- Código local: `COMPLETE`.
- Preview V7: `STATUS_COMMITTED`, ID `1656593`.
- CI: `NOT_RUN`.
- PR: `OPEN`, #1157, sin merge.
- Merge: `UNMERGED`.
- Deploy: `NOT_DEPLOYED`.
- Activación: `INACTIVE`.
- Migración: `NOT_APPLICABLE`.
- Evidencia de producción: ninguna; `production_evidence=[]`.

No se ejecutaron operaciones de Railway, publicación, merge, activación ni cambios de Prisma. Tampoco se copiaron secretos ni archivos `.env` al builder o a las evidencias.
