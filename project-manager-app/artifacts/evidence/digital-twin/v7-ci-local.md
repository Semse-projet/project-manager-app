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

No se encontraron definiciones de GitHub Actions en el SHA autorizado. Por ello se ejecutaron directamente los scripts y comandos de validación del workspace. El estado `ci_status` del spec permanece `NOT_RUN`: estas pruebas locales no deben confundirse con un check remoto terminal.

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

## Límites y estados

- No se repitió la suite unitaria global de 1.616 tests; su limitación previa permanece documentada y no se atribuye al gemelo.
- No se ejecutó CI remoto, merge, deploy, publicación, Railway ni activación.
- El PR **#1157** se abrió posteriormente con autorización y permanece `OPEN`, sin merge: https://github.com/Semse-projet/project-manager-app/pull/1157.
- CI local equivalente: `PASS`.
- CI remoto/plataforma: `NOT_RUN`.
- Merge: `UNMERGED`.
- Deploy: `NOT_DEPLOYED`.
- Activación: `INACTIVE`.
- Migración: `NOT_APPLICABLE`.
- Evidencia de producción: ninguna; `production_evidence=[]`.
