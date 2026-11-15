# Plan de implementación — Gemelo digital 3D del ecosistema SEMSE

## Metadata

```yaml
plan_id: ui.ecosystem-digital-twin-3d.plan
spec_id: ui.ecosystem-digital-twin-3d
version: "1.3"
status: IMPLEMENTED_PR_OPEN
created_at: "2026-11-15"
updated_at: "2026-11-15"
implementation_mode: existing-code-redesign-v7
preview_saved_id: "1656593"
preview_status: STATUS_COMMITTED
ci_local_status: PASS
remote_pr: 1157
merge_status: UNMERGED
```

## 1. Objetivo de entrega

Actualizar el mapa histórico de Consciousness para presentar los 33 módulos
históricos como módulos del ecosistema, distribuidos en nueve dominios
canónicos, con una escena 3D legible y alternativas equivalentes 2D/lista.
La lectura de datos debe distinguir topología estática, madurez de registro y
salud global observada sin inventar telemetría por nodo.

El incremento se integra en `/admin/consciousness` y en la ruta pública
histórica `/semse-consciousness-map`, conservando el límite de seguridad de la
ruta admin y reutilizando el BFF existente. No modifica el contrato upstream.

La iteración V7 aplica el rediseño visual elegido sobre la implementación
actual. No vuelve a definir requisitos ni abre una feature nueva: conserva los
contratos, datos, rutas y pruebas del incremento ya validado.

## 2. Decisiones de implementación

1. **Un solo view model.** La escena, el SVG y la lista consumen exactamente el
   mismo snapshot. Ninguna vista recalcula salud ni traduce estados por su
   cuenta.
2. **Adaptación explícita.** El catálogo histórico conserva sus IDs y mapea cada
   módulo a un dominio canónico. La metadata arquitectónica no se presenta como
   una medición runtime.
3. **Render directo de Three.js.** Se utiliza `InstancedMesh` para nodos,
   `LineSegments` para aristas y raycasting por `instanceId`; no se introduce
   React Three Fiber ni una segunda fuente de estado.
4. **Layout determinista.** Los dominios ocupan centros fijos en una retícula
   3×3 y los módulos se distribuyen con un PRNG sembrado. No hay
   `Math.random()` en la lógica del gemelo.
5. **Progreso bajo demanda.** El canvas renderiza al interactuar, cambiar datos,
   reproducir un flujo o redimensionar. No mantiene un loop ambiental en reposo.
6. **Fallback real.** Ausencia/pérdida de WebGL o preferencia de movimiento
   reducido deja disponible una vista funcional; no deja una pantalla vacía.
7. **Preview separada de producción.** La entrega navegable usa una variante
   estática del mismo view model y no requiere API, autenticación ni secretos.
8. **Builder reproducible.** `preview/static` sincroniza las fuentes canónicas,
   fija versiones y ejecuta typecheck/build propios, sin `workspace:*`.

## 3. Fases ejecutadas

### Fase 0 — Gobierno y alcance

- Crear spec, plan, tasks, analysis y checklist.
- Mantener estados separados: código, CI, merge, deploy, activación y migración.
- Confirmar que no hay requisito Prisma, migración, mutación o deployment.
- Actualizar el índice SDD con una única entrada del gemelo.

### Fase 1 — Contratos y pruebas previas

- Definir contratos de nodos, aristas, dominios, flujos, selección y playback.
- Escribir primero pruebas para cobertura de 33 IDs, aristas válidas, nulos de
  runtime, respuesta parcial, layout determinista y final de flujos.
- Fijar tres flujos: `intake_to_contract`, `execution_to_evidence` y
  `evidence_to_payment`.

### Fase 2 — View model y adaptadores

- Añadir `view-model.ts`, `topology-adapter.ts`, `consciousness-adapter.ts`,
  `layout.ts` y `flows.ts`.
- Mantener `runtimeHealth` y `observedAt` en `null` sin medición por nodo.
- Etiquetar madurez histórica como `consciousness-registry`.
- Añadir aristas derivadas `value_flow` sin alterar las aristas históricas.
- No degradar nodos por una fuente nula en la ruta estática no consultada.

### Fase 3 — Escena y controles

- Implementar instancing, etiquetas DOM proyectadas, órbita, zoom, raycasting,
  foco y reset.
- Implementar playback finito de 650 ms por segmento y repetición explícita.
- Añadir búsqueda, filtro de dominio, vistas equivalentes, inspector y textos de
  procedencia.
- Garantizar targets móviles de al menos 44 px y foco visible.

### Fase 4 — Integración

- Sustituir el mapa histórico por el gemelo en la ruta estática.
- Reutilizar la respuesta BFF en `/admin/consciousness`, conservando loading,
  error y autorización existentes.
- Añadir `next/dynamic` con `ssr:false` y lifecycle client-only.
- Condicionar la excepción iframe de preview con `SEMSE_PREVIEW_EMBEDDED=true`;
  el modo normal conserva `frame-ancestors 'none'` y `X-Frame-Options: DENY`.

### Fase 5 — Validación y evidencias

- Ejecutar 13 unitarios dirigidos y ocho escenarios Playwright.
- Ejecutar typecheck estricto, ESLint sin errores y build Web.
- Validar desktop/móvil, reduced motion, WebGL ausente, contexto perdido,
  resize, admin con fixture y 403 controlado.
- Capturar métricas de render y screenshots locales.
- Guardar preview sin declarar deploy, merge o activación.

### Fase 6 — Rediseño visual V7 y empaquetado

- Aplicar lenguaje obsidiana/cian, encabezado editorial, KPIs, panel inspector,
  filtros compactos y leyenda de procedencia.
- Mejorar encuadre responsive y legibilidad de etiquetas sin cambiar los datos.
- Mantener todos los nombres accesibles y callbacks existentes para no romper E2E.
- Generar capturas V7 desktop/móvil y actualizar evidencias textuales.
- Sustituir la entrada de preview dinámica por una entrega estática ligera.
- Crear builder reproducible y lockfile propio; verificar que la salida compilada
  carga, renderiza 33 nodos y conserva vistas, búsqueda y navegación móvil.
- Guardar la versión V7 y registrar su ID sin tratarlo como publicación.

### Fase 7 — CI y revisión remota

- Ejecutar una pasada CI local equivalente con Node 22: paquetes internos,
  unitarios, typecheck, lint, builds y E2E.
- Auditar el paquete antes de cualquier push: sin secretos, `.env`, capturas,
  protocolos `workspace:*` ni artefactos innecesarios.
- Preparar registro de PR y evidencias; cualquier push/PR posterior requiere la
  confirmación del usuario, mientras merge/deploy/activación permanecen fuera de
  alcance.
- Revisar el diff remoto completo contra `main` antes de abrir el PR.
- Abrir el PR real #1157 con base `main` y head `feat/ecosystem-digital-twin-3d`
  tras autorización explícita, sin fusionarlo.
- Corregir el orden del índice SDD reproducido por el gate remoto.
- Reproducir con el `tsconfig` remoto exacto los nueve `TS5097`, habilitar
  `allowImportingTsExtensions` sin reducir `strict`/`noEmit`, y verificar el
  `spec:preflight` completo con código `0`.
- Registrar CI remoto terminal `PASS` sobre `e2d70e2b0ff38cb97581f96d0d0c81b8b74f565c`:
  quality gates, cobertura, E2E y CodeQL verdes; QA #973 omitida por alcance.

## 4. Archivos del incremento

- `apps/web/lib/digital-twin/*`
- `apps/web/components/semse/digital-twin/*`
- `apps/web/components/semse/semse-consciousness-map.tsx`
- `apps/web/app/semse-consciousness-map/page.tsx`
- `apps/web/app/(app)/admin/consciousness/page.tsx`
- `apps/web/next.config.ts`
- `tests/unit/semse-digital-twin-*.test.ts`
- `tests/e2e-semse/semse-digital-twin.spec.ts`
- `preview/static/*`
- `Dockerfile`
- `docs/specs/ui/ecosystem-digital-twin-3d.*`
- `docs/SPEC_INDEX.md`
- `artifacts/evidence/digital-twin/*`

`scripts/workspace-runner.mjs` se restauró desde el SHA autorizado porque el
checkout parcial no lo contenía y el tooling del monorepo lo requiere; no se
introdujo una nueva política de workspace.

## 5. Evidencia y gates posteriores

La validación local terminó con 13/13 unitarios, TypeScript Web, ESLint sin
errores, Next build, builder estático y 8/8 E2E verdes. El detalle está en
`artifacts/evidence/digital-twin/v7-validacion.md` y `v7-ci-local.md`.
El CI remoto posterior también terminó `PASS` sobre el head corregido.

El PR real #1157 está abierto y sin merge en
https://github.com/Semse-projet/project-manager-app/pull/1157. El SHA revisado al
abrirlo fue `e4689f9400792707a64d91048495652286eadfd2`; el head con CI remoto
verde es `e2d70e2b0ff38cb97581f96d0d0c81b8b74f565c`.

Los gates de merge, Railway, publicación, canary y activación no están
autorizados ni ejecutados. No hay evidencia de producción ni migración asociada.
