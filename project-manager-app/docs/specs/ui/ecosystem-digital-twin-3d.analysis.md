---
type: analysis
feature: "Ecosystem Digital Twin 3D"
spec: "docs/specs/ui/ecosystem-digital-twin-3d.spec.md"
plan: "docs/specs/ui/ecosystem-digital-twin-3d.plan.md"
tasks: "docs/specs/ui/ecosystem-digital-twin-3d.tasks.md"
date: "2026-11-15"
status: "PASS_LOCAL_VALIDATION"
---

# Análisis spec ↔ plan ↔ tareas ↔ constitución

## Resultado

El incremento local está implementado y verificado dentro de la autorización. No
se reinterpreta como permiso de PR, merge, CI adicional, Railway, despliegue o
activación. `code_status=COMPLETE` describe únicamente el código local; CI,
merge, deploy y activación conservan estados independientes.

## Trazabilidad

| Requisito | Plan | Tests/evidencia |
|---|---|---|
| 33 IDs, nueve dominios, sin rename masivo | T-020/T-021 | view-model: cobertura y dominios válidos |
| Aristas y paths válidos | T-021/T-023 | flows: referencias y pares consecutivos |
| Layout reproducible | T-023 | layout: igualdad, finitud y separación |
| Datos ausentes siguen ausentes | T-022 | view-model: nulos, fuentes y desconocidos |
| Fuente estática no consultada no degrada | T-022 | unit nulo + captura sin banner de degradación |
| 3D + alternativas equivalentes | T-030…T-033 | E2E de selección, teclado, búsqueda y filtros |
| Playback finito/reduced motion | T-031/T-032 | unit de estado + E2E de los tres flujos |
| Sin WebGL/pantalla en blanco | T-030/T-033 | E2E con WebGL denegado y contexto perdido |
| Responsive y accesibilidad táctil | T-033/T-045 | 375/768/1024/1440, 44 px y etiquetas dentro del canvas |
| Error BFF sin perder snapshot previo | T-033/T-041 | E2E admin con 403 controlado |
| Sin cambios backend/datos | Fases B y C | diff limitado a Web/docs/tests/config TS/preview estática |
| Rediseño V7 sin regresión funcional | T-047…T-049A | capturas V7 + smoke desktop/móvil/iframe |
| Preview reproducible sin `workspace:*` | T-048 | `npm ci`, typecheck estricto, build Vite y smoke: PASS |
| Sin salud aleatoria legacy | T-034/T-035 | búsqueda estática y E2E de estabilidad |

## Evidencia de validación local

- 13/13 pruebas unitarias dirigidas del modelo, layout y flujos: `PASS`.
- TypeScript estricto del frontend y ESLint de archivos modificados: `PASS`.
- Build de producción Web: `PASS`, 422 páginas estáticas generadas.
- 8/8 escenarios E2E en Chromium: `PASS`; el escenario admin también comprueba
  un 403 controlado sin retirar el gemelo ya visible.
- Revisión visual de capturas desktop, móvil 3D y móvil lista: `PASS` después de
  corregir contraste, color por instancia, aviso de fuente nula y encuadre móvil.
- Suite unitaria completa: 1.616 tests; 1.586 `PASS`, 5 omitidos y 11 TODO. Los
  14 contabilizados como fallo son 13 archivos que importan `apps/api/dist` no
  generado y un TODO ya declarado. El intento de build API terminó con errores
  TypeScript existentes en módulos no modificados; no se cambió backend para
  eludirlos. Esta limitación no sustituye ni invalida los tests dirigidos verdes.

### Rediseño y builder V7

- Validación funcional V7 desktop, móvil e iframe local: `PASS`; 33 nodos,
  3D/2D/lista, búsqueda, filtro, flujo y reset sin errores de consola, 404,
  llamadas API ni overflow horizontal.
- Capturas `v7-desktop.png` y `v7-mobile.png` inspeccionadas visualmente.
- Builder `preview/static`: `npm ci`, TypeScript estricto y build Vite `PASS`;
  smoke final `PASS` con HTTP 200, 33 nodos, tres vistas y búsqueda efectiva.
- Advertencias no bloqueantes: directivas `use client` ignoradas por Rollup y
  chunk Three.js diferido de 512,37 KB. No se elevan a fallo ni se ocultan.
- Strict/coverage del spec V7 aislado: `PASS`, 1 spec, 0 errores/advertencias y
  referencias completas. El índice canónico conserva 219 filas con una entrada
  del gemelo; la copia persistente parcial no admite una nueva validación global.
- Detalle completo: `artifacts/evidence/digital-twin/v7-validacion.md`.
- CI local equivalente posterior con Node 22: `PASS` para paquetes, 13 unitarios,
  TypeScript Web, ESLint (0 errores/39 advertencias ajenas), build Web de 422
  páginas, builder estático y 8/8 E2E sin reintentos. Evidencia:
  `artifacts/evidence/digital-twin/v7-ci-local.md` y reporte JSON asociado.
- Borrador local de PR y auditoría de paquete: `v7-pr-draft.md`; no hay branch
  remoto, push, PR ni merge. El diff Git completo sigue siendo un gate previo.

## Decisiones y no inferencias

- `maturity.byModule` proviene de `MODULE_REGISTRY`, mantenido manualmente: se
  etiqueta como registro, no como observación live.
- `observation.healthScore` se mantiene global; no se copia a nodos.
- La ruta histórica recibe sólo topología estática y no ejecuta el BFF admin.
- Agro puede no tener nodos históricos; se muestra el dominio sin inventar un
  módulo ni reasignar uno de otro vertical.
- Las aristas necesarias sólo para conectar pasos de un flujo se marcan
  `derived: true`; no se presentan como sinapsis observadas.
- `last_verified=2026-11-15` registra verificación local. `production_evidence`
  permanece vacío y no se promueve el spec a `VERIFIED`.
- Guardar una versión de preview no se registra como deploy/publicación. V7
  recibió `STATUS_COMMITTED`, ID `1656593`, `bigVersion=7` y
  `CHANGE_SIGNAL_CHANGED`; CI, merge, deploy y activación permanecen sin cambios.
- La entrega estática responde al fallo comprobado del visor dinámico:
  `npm install` rechazaba `workspace:*` antes de Docker. El builder tiene
  manifiesto y lockfile propios, sin consultar API ni leer `.env`.
- Las comprobaciones fueron locales; no se afirma confirmación visual remota del
  usuario ni disponibilidad de producción.

## Riesgos cerrados y límites restantes

- La recuperación completa del monorepo y el build Web se resolvieron sobre el
  SHA autorizado `7029da63e719b264f7b2bfaff7eb4b716fe167b9`.
- WebGL ausente, pérdida de contexto, unmount y remount fueron ejercitados en
  Chromium con software WebGL; no se afirma cobertura de todos los dispositivos.
- No hay smoke autenticado de producción, CI remoto, merge, deploy ni activación.
  El CI local equivalente no altera `ci_status=NOT_RUN`.
