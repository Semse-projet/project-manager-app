# Checklist: Ecosystem Digital Twin 3D

## Gobierno y alcance

- [x] Spec `ui.ecosystem-digital-twin-3d` aprobado para el incremento autorizado.
- [x] Plan, tasks y análisis coherentes con la constitución.
- [x] Spec incluido en el índice generado por tooling canónico.
- [x] Sin Omniverse, grafo operativo, mutaciones, pagos o backend nuevo.
- [x] Sin migraciones, variables, secretos, Railway o pipeline de producción.

## Integridad de datos

- [x] Los 33 IDs históricos aparecen exactamente una vez.
- [x] Cada nodo tiene uno de los nueve dominios canónicos.
- [x] Toda arista y todo paso de flujo referencia nodos válidos.
- [x] Layout determinista, finito y sin `Math.random()`.
- [x] `runtimeHealth` y `observedAt` permanecen nulos sin observación por nodo.
- [x] Madurez del registro y salud global observada tienen fuentes distintas.
- [x] Módulos de madurez desconocidos quedan visibles como no mapeados.
- [x] La ruta histórica no consulta admin ni genera salud aleatoria.
- [x] La ruta estática sin fuente no anuncia degradación no intentada.

## Experiencia y accesibilidad

- [x] Arquitectura, flujos y salud/riesgo funcionan.
- [x] 3D, 2D y lista comparten datos, selección, búsqueda y filtro.
- [x] Los tres flujos se reproducen una vez y se pueden reiniciar/cancelar.
- [x] Clic/tap, Enter/Espacio, Escape y flechas tienen comportamiento definido.
- [x] Reduced motion elimina el impulso animado.
- [x] WebGL ausente/perdido ofrece alternativa sin pantalla en blanco.
- [x] Loading, empty, degraded y error son comprensibles.
- [x] Desktop y móvil no presentan overflow ni controles muertos.
- [x] Controles móviles verificados a 44 px y etiquetas dentro del canvas.

## Runtime y rendimiento

- [x] Instancing para módulos y batch para aristas.
- [x] DPR limitado y render bajo demanda en reposo.
- [x] Resize y cámara reset funcionan.
- [x] Unmount cancela RAF y elimina listeners/labels/canvas.
- [x] Geometrías, materiales, controles y renderer se disponen; no hay texturas.

## Evidencia

- [x] Tests rojos ejecutados antes de implementación.
- [x] 13 tests unitarios dirigidos verdes después.
- [x] Build/typecheck/lint ejecutados y verdes.
- [x] 8 E2E locales y consola revisados; admin incluye 403 controlado.
- [x] Capturas desktop/móvil inspeccionadas visualmente.
- [x] Capturas V7 propias y reporte `v7-validacion.md` conservados.
- [x] Builder estático validado con `npm ci`, TypeScript estricto, build y smoke.
- [x] CI local equivalente Node 22 verde, incluidos build Web y 8/8 E2E sin retries;
  reporte `v7-ci-local.md` y JSON estructurado conservados.
- [x] Advertencias `use client`/chunk Three.js registradas como no bloqueantes.
- [x] Strict/index/index-check/coverage full-repo originales ejecutados y verdes.
- [x] Strict/coverage del spec V7 aislado verdes; índice canónico de 219 filas
  preservado sin presentar la copia parcial como nueva validación full-repo.
- [x] Paquete principal auditado sin secretos ni cambios funcionales fuera de alcance.
- [x] Diff remoto completo revisado contra `main`: 40 archivos autorizados, sin
  secretos, capturas, assets PWA, Prisma ni archivos de Railway.
- [x] PR **#1157** abierto con base `main`, head `feat/ecosystem-digital-twin-3d`
  y SHA revisado `e4689f9400792707a64d91048495652286eadfd2`:
  https://github.com/Semse-projet/project-manager-app/pull/1157. Sin merge.
- [x] Limitación de suite global documentada sin atribuirla a tests del gemelo.

## Estados de entrega

- Código: `COMPLETE` local, validado en el clon de trabajo.
- Preview V7: `STATUS_COMMITTED`, ID `1656593`, `bigVersion=7`,
  `CHANGE_SIGNAL_CHANGED`; no equivale a publicación, deploy ni activación.
  La confirmación disponible es de guardado y validación local, no una
  confirmación visual remota del usuario.
- CI local equivalente y `spec:preflight`: `PASS`; CI remoto/plataforma: `PASS`
  sobre `e2d70e2b0ff38cb97581f96d0d0c81b8b74f565c`. `quality-gates`,
  `unit-coverage`, E2E y CodeQL: `PASS`; QA autenticada #973: `skipped` por alcance.
- PR: **#1157** `OPEN`, sin merge; URL registrada en este paquete y en las evidencias.
- Merge: `UNMERGED`.
- Deploy: `NOT_DEPLOYED`.
- Activación: `INACTIVE`.
- Migración: `NOT_APPLICABLE`.
- Producción: `production_evidence=[]`; `last_verified=2026-11-15` sólo registra
  la validación local y no promueve el spec a `VERIFIED`.
