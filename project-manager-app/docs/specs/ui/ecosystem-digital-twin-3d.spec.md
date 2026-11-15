---
id: "ui.ecosystem-digital-twin-3d"
title: "Ecosystem Digital Twin 3D para SEMSE Consciousness"
domain: "ui"
sdd_version: "2.0"
version: "1.1"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
verification_scope: "local:13-directed-unit-pass;8-e2e-pass-with-controlled-403;web-build-typecheck-eslint-pass;v7-visual-and-static-builder-typecheck-build-smoke-pass;node22-ci-local-equivalent-pass;no-remote-ci-or-production-validation"
feature_flags: []
production_evidence: []
related_files:
  - apps/web/components/semse/digital-twin/SemseDigitalTwin.tsx
  - apps/web/components/semse/digital-twin/SemseDigitalTwin3D.tsx
  - apps/web/components/semse/digital-twin/SemseDigitalTwinScene.ts
  - apps/web/components/semse/digital-twin/SemseDigitalTwin2D.tsx
  - apps/web/components/semse/digital-twin/SemseDigitalTwinList.tsx
  - apps/web/components/semse/digital-twin/SemseDigitalTwinControls.tsx
  - apps/web/lib/digital-twin/view-model.ts
  - apps/web/lib/digital-twin/consciousness-adapter.ts
  - apps/web/lib/digital-twin/topology-adapter.ts
  - apps/web/lib/digital-twin/layout.ts
  - apps/web/lib/digital-twin/flows.ts
  - apps/web/lib/data/semse-consciousness-topology.ts
  - apps/web/components/semse/semse-consciousness-map.tsx
  - apps/web/app/(app)/admin/consciousness/page.tsx
  - apps/web/app/semse-consciousness-map/page.tsx
  - preview/static/package.json
  - preview/static/package-lock.json
  - preview/static/tsconfig.json
  - preview/static/vite.config.mjs
  - preview/static/scripts/sync-sources.mjs
  - artifacts/evidence/digital-twin/v7-validacion.md
  - artifacts/evidence/digital-twin/v7-ci-local.md
  - artifacts/evidence/digital-twin/v7-ci-e2e-report.json
  - artifacts/evidence/digital-twin/v7-pr-draft.md
related_tests:
  - tests/unit/semse-digital-twin-view-model.test.ts
  - tests/unit/semse-digital-twin-layout.test.ts
  - tests/unit/semse-digital-twin-flows.test.ts
  - tests/e2e-semse/semse-digital-twin.spec.ts
related_endpoints:
  - "GET /api/semse/ops/consciousness"
  - "GET /v1/ops/consciousness/index"
related_events: []
related_agents: []
last_verified: "2026-11-15"
date: "2026-11-15"
author: "Kimi"
spec_index: "docs/SPEC_INDEX.md"
---

# Spec: Ecosystem Digital Twin 3D para SEMSE Consciousness

> Autorización de alcance: el owner autorizó continuar el incremento el
> 2026-11-15. Esta aprobación cubre especificación, frontend, pruebas y
> verificación local. No autoriza merge, deploy, activación, Omniverse ni un
> backend de grafo operativo. Código, CI, merge, deploy y activación permanecen
> como estados independientes.

## 1. Problema y resultado

**Para quién:** operadores y administradores autorizados de SEMSE Consciousness.

**Problema:** el mapa histórico presenta siete cortex y valores aleatorios de
salud/energía que pueden confundirse con telemetría. Su canvas 2D no ofrece una
representación espacial de la arquitectura ni una alternativa equivalente de
teclado. La página admin ya consulta Consciousness, pero no relaciona esa
respuesta con la topología del ecosistema.

**Resultado esperado:** una vista de sólo lectura que permita entender los
módulos y relaciones en 3D, 2D y lista; reproducir tres flujos de valor; buscar,
seleccionar y inspeccionar módulos; y distinguir siempre topología estática,
madurez de registro y observación runtime. Ningún valor ausente se inventa.

## 2. Alcance

### Incluido

- Adaptador de los 33 nodos históricos a la taxonomía oficial de nueve dominios,
  conservando IDs, nombres, descripciones, entradas y salidas.
- Modelo compartido para las tres vistas, con aristas válidas y layout
  determinista derivado de IDs estables.
- Modos Arquitectura, Flujos de valor y Salud/riesgo.
- Flujos `Intake → Contract`, `Execution → Evidence` y
  `Evidence → Payment → Trust`, con reproducción finita y determinista.
- Escena Three.js bajo demanda, instancing, aristas agrupadas, órbita, zoom,
  selección por `instanceId`, etiquetas DOM y reset de cámara.
- Vista 2D y lista navegables por teclado con los mismos datos y selección.
- Búsqueda, filtro de dominio, detalle del nodo y estados de carga, error,
  degradado, vacío y WebGL no disponible.
- Integración en `/admin/consciousness` reutilizando su fetch manual y en la
  ruta histórica `/semse-consciousness-map` con topología estática.
- Eliminación del intervalo aleatorio de salud en la ruta histórica.
- Pruebas unitarias, E2E local, build y verificación visual local.
- Rediseño visual V7 de la composición existente, sin alterar datos ni flujos.
- Builder estático reproducible en `preview/static`, con lockfile, TypeScript
  estricto y smoke de navegador; sirve la ruta histórica sin workspace pnpm.

### Fuera de alcance

- Adaptador Omniverse o specs en `REVIEW` de grafo unificado/linaje.
- Nuevos endpoints, Prisma, migraciones, eventos de dominio o backend paralelo.
- Telemetría por nodo no presente en la respuesta actual; energía, salud o
  madurez histórica nunca se presentan como runtime.
- Pagos, mutaciones, acciones autónomas, runbooks o cambios de permisos.
- Renombramiento masivo, despliegue, canary de producción o activación.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Operador admin autenticado | `ops:dashboard:read` existente | El que ya aplica `/v1/ops/consciousness/index` | Consultar y explorar el snapshot | Mutar, ejecutar acciones o ampliar scope |
| Visitante de la ruta histórica | Sin nuevo permiso ni nuevo fetch | Sólo definición estática ya pública en esa ruta | Explorar arquitectura estática | Leer Consciousness runtime |

- Tenant boundary: lo mantiene el BFF/API existente; el adaptador no recibe ni
  cambia tenant, organización, credenciales ni headers.
- Ownership/resource policy: sin cambios; no se consultan recursos de dominio.
- Step-up o aprobación humana: no aplica a una lectura sin acciones.
- Datos `privacyCritical`: no se añaden; no se copian secretos ni respuestas a
  almacenamiento persistente.
- Requisitos de auditoría: no hay mutaciones ni auditoría nueva.

## 4. Escenarios y criterios de aceptación

### P1 — Explorar arquitectura canónica

```gherkin
DADO un snapshot de topología estática
CUANDO el operador abre Ecosystem Digital Twin
ENTONCES ve los 33 módulos agrupados por dominio canónico y sus relaciones
Y puede alternar 3D, 2D y lista sin perder selección, búsqueda ni filtro
Y SEMSE Agro puede aparecer como dominio sin módulos históricos, sin inventar uno
```

Criterios:

- Cada ID histórico aparece exactamente una vez y tiene un dominio canónico.
- Toda arista referencia nodos existentes; el layout es idéntico entre llamadas.
- La ruta histórica no ejecuta aleatoriedad ni etiqueta datos como live.

### P1 — Componer Consciousness sin fabricar telemetría

```gherkin
DADO una respuesta Consciousness con registro de madurez y observación global
CUANDO se construye el view model
ENTONCES la salud global conserva valor y observedAt de observation
Y una madurez coincidente se etiqueta como registro estático del backend
Y un módulo sin medición runtime conserva runtimeHealth=null y observedAt=null
Y los módulos de madurez sin correspondencia se reportan como no mapeados
```

Casos borde:

- [x] Respuesta parcial, vacía o con módulos desconocidos: topología sigue
  disponible, valores ausentes quedan `null` y la degradación es visible. Una
  fuente nula en la ruta estática no consultada no se etiqueta como degradada.
- [x] Error/forbidden del BFF existente: la página conserva su error y los datos
  previos; la ruta estática no intenta el fetch admin.
- [x] Sin aislamiento nuevo que probar: no se añade acceso tenant/org ni datos
  financieros; E2E usa la sesión admin existente y un 403 controlado del BFF.

### P1 — Reproducir flujos y seleccionar

```gherkin
DADO un flujo de valor ordenado
CUANDO el operador pulsa Reproducir
ENTONCES se resalta el camino completo y un impulso lo recorre una sola vez
Y con reduced motion se muestra el estado final sin animación
Y cada par consecutivo tiene una arista derivada válida
```

- Clic/tap y Enter/Espacio seleccionan el mismo nodo.
- Escape limpia selección; flechas recorren nodos cuando el canvas tiene foco.
- Reproducir de nuevo reinicia desde el origen; cambiar de flujo cancela el
  playback anterior. Desmontar cancela frames y libera recursos.

### P2 — Degradación y accesibilidad

- Sin WebGL o si falla su creación, se ofrece 2D/lista sin pantalla en blanco.
- `prefers-reduced-motion` desactiva impulso animado y transiciones no esenciales.
- La escena ociosa renderiza bajo demanda; no mantiene un loop ambiental.
- Controles tienen nombres accesibles, foco visible y objetivos táctiles.
- Desktop y móvil no producen overflow horizontal de la página.

## 5. Contratos

### API — sin API nueva

```yaml
existing_read:
  bff: GET /api/semse/ops/consciousness
  upstream: GET /v1/ops/consciousness/index
  auth: existing
  permissions: [ops:dashboard:read]
changes: none
effects:
  writes: none
  audit_log: unchanged
  domain_event: none
  payment_governance: none
```

### Modelo de vista

```yaml
DigitalTwinNode:
  id: string
  label: string
  canonicalDomain: nine-domain-id
  executionLayer: experience-platform|semse-core|ecosystem-orchestrator|domain-capability|semse-ai|mission-control
  criticality: low|medium|high|critical
  maturity: number|null
  maturitySource: not-available|consciousness-registry
  runtimeHealth: null
  status: observed|unobserved|degraded
  sources: [static-topology, consciousness-registry?, consciousness-observation?]
  observedAt: string|null
DigitalTwinSnapshot:
  nodes: DigitalTwinNode[]
  edges: DigitalTwinEdge[]
  flows: DigitalTwinFlow[]
  globalHealth: number|null
  generatedAt: string|null
  observedAt: string|null
  topologySource: static-definition
  degradedSources: string[]
  unmappedMaturityModules: string[]
```

### UI

```yaml
surfaces:
  - /admin/consciousness
  - /semse-consciousness-map
states: [loading, empty, ready, degraded, error, webgl-unavailable]
required_behavior:
  - same view model for 3D, 2D and list
  - no fake live values
  - finite flow playback
  - keyboard and reduced-motion support
```

### Agente/Prometeo

No aplica: no se añaden tools, prompts, agentes, citas ni acciones.

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno de dominio. Playback es estado efímero local
  `idle → playing → complete`, no un estado operativo de SEMSE.
- Invariantes: se conservan ownership, RBAC y autoridad de módulos.
- Eventos declarados/productor/consumidores/outbox/replay/DLQ: ninguno nuevo.
- Reconstrucción: el snapshot se recalcula en memoria desde topología y la
  respuesta existente; no se persiste ni se usa como fuente de verdad.

## 7. Datos y migración

- Modelos Prisma, migración, expand/contract, backfill y drift: no aplican.
- Compatibilidad: IDs y rutas existentes se conservan; componentes históricos no
  usados por la nueva composición permanecen disponibles para rollback.
- Rollback de código: revertir los archivos del incremento restaura el mapa 2D y
  retira la sección admin sin afectar datos ni API.
- Rollback/forward-fix de datos: no aplica.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: sin telemetría nueva. Presupuesto local: 33 instancias, aristas
  agrupadas, DPR máximo 1.75 y ausencia de frames continuos en reposo.
- Logs/traces: los existentes del BFF; el cliente no registra respuestas.
- Health/readiness: sin cambios.
- Feature flags/allowlists: ninguno; sección de lectura dentro de páginas ya
  existentes. La activación de producción requeriría gate posterior separado.
- Plan de canary y evidencia de producción: no autorizados en este incremento.
- Preview estática V7: guardada con ID `1656593`, `bigVersion=7` y
  `STATUS_COMMITTED`. Es una preview local guardada, no publicación ni deploy.
  El visor dinámico fallaba en `npm install` por dependencias `workspace:*`;
  `preview/static` usa versiones fijadas propias y no consulta API ni `.env`.
- Evidencia V7: `artifacts/evidence/digital-twin/v7-validacion.md` y capturas
  desktop/móvil del mismo directorio.
- Señal de rollback: error de render no contenido, regresión de acceso o datos
  estáticos presentados como observación runtime.
- Owner operativo: `semse-core` después de un gate de despliegue independiente.

## 9. Tests requeridos

- [x] Unitarios de adaptación, dominios, fuentes y nulos.
- [x] Unitarios de aristas, layout determinista y paths ordenados.
- [x] UI loading/empty/degraded/error y fallback WebGL.
- [x] Selección equivalente 3D/2D/lista, teclado, búsqueda y playback finito.
- [x] Reduced motion, resize, unmount y pérdida de contexto WebGL.
- [x] Build/typecheck/lint dirigido y E2E local con respuesta Consciousness
  controlada en el servidor de prueba; nunca presentada como producción.
- [x] `npm ci`, typecheck estricto, build y smoke del builder estático V7.
- [ ] Canary autenticado de producción: pendiente y fuera de autorización.

## 10. Mapa de implementación

### API

- Ningún archivo nuevo o modificado. Se consumen los endpoints ya existentes.

### Web

- `apps/web/lib/digital-twin/`: contratos puros, adaptadores, layout y flujos.
- `apps/web/components/semse/digital-twin/`: escena, vistas y controles.
- `apps/web/app/(app)/admin/consciousness/page.tsx`: integración con `data`.
- `apps/web/components/semse/semse-consciousness-map.tsx`: migración de ruta
  histórica al mismo componente, sin fetch ni salud aleatoria.

### Preview estática

- `preview/static/`: shim de carga cliente, sincronización acotada de fuentes,
  TypeScript estricto, Vite/Tailwind y lockfile independiente. Reutiliza los
  componentes canónicos y no introduce datos nuevos.

### Worker/Packages/DB

- Sin cambios funcionales; el builder no importa paquetes `workspace:*`.

### Tests

- `tests/unit/semse-digital-twin-*.test.ts`.
- `tests/e2e-semse/semse-digital-twin.spec.ts`.

## 11. Investigación externa

Tres búsquedas/fuentes primarias:

1. Three.js `InstancedMesh`: `setColorAt` requiere actualizar
   `instanceColor.needsUpdate`; raycasting devuelve `instanceId` y no admite
   selección de rango incompleta para este caso.
2. Three.js, “How to dispose of Objects” y “Rendering on Demand”: liberar
   geometrías/materiales/texturas y renderizar cuando cambia el estado.
3. MDN `webglcontextlost`, `webglcontextrestored` y
   `prefers-reduced-motion`: prevenir el comportamiento por defecto en pérdida
   de contexto, permitir restauración y respetar la preferencia de movimiento.

- Aplicado ahora: instancing, raycast por instancia, fallback, render bajo
  demanda, disposición explícita y playback finito.
- Backlog: grafo operativo real y métricas runtime por nodo mediante specs
  aprobadas independientes.
- Descartado: React Three Fiber nuevo, dependencias 3D adicionales, animación
  ambiental infinita y modelos externos para primitivas simples.

## 12. Gates de cierre

- [x] Spec enlazado por `pnpm spec:index`.
- [x] Spec, plan, tasks, análisis y checklist coherentes.
- [x] Tests derivados del spec rojos antes de implementar y verdes después.
- [x] Strict full-repo original verde: 219 specs, 0 errores y 0 advertencias.
- [x] Strict aislado del spec V7 verde: 1 spec, 0 errores y 0 advertencias; la
  copia persistente parcial no se presenta como una nueva validación full-repo.
- [x] Migración `NOT_APPLICABLE` y rollback de código documentado.
- [x] CI local equivalente V7 `PASS` con Node 22; evidencia `v7-ci-local.md`.
- [ ] CI remoto `PASS`: pendiente; `ci_status=NOT_RUN` porque no existe check
  remoto terminal asociado a este árbol.
- [ ] PR fusionado y SHA: pendiente.
- [ ] Deployment `DEPLOYED`: pendiente.
- [ ] Activación/canary: `INACTIVE`, pendiente de gate separado.
- [x] `production_evidence` permanece vacío; `last_verified` registra sólo la
  verificación local de 2026-11-15, no producción.
- [x] No promover a `VERIFIED` sólo por build, tests locales o versión guardada.
