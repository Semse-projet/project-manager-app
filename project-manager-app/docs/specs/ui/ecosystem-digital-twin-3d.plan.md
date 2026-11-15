---
type: plan
feature: "Ecosystem Digital Twin 3D"
domain: "ui"
spec: "docs/specs/ui/ecosystem-digital-twin-3d.spec.md"
version: "2.0"
status: "APPROVED"
branch: "feat/ecosystem-digital-twin-3d"
date: "2026-11-15"
---

# Plan técnico: Ecosystem Digital Twin 3D

> El branch remoto `feat/ecosystem-digital-twin-3d` y el PR **#1157** ya existen:
> https://github.com/Semse-projet/project-manager-app/pull/1157. Base: `main`;
> SHA head revisado al abrir: `e4689f9400792707a64d91048495652286eadfd2`.
> Implementación, CI, merge, deploy y activación se reportan aparte.

## 1. Snapshot de verdad

- `origin/main` SHA: `7029da63e719b264f7b2bfaff7eb4b716fe167b9`.
- Raíz canónica: `project-manager-app/`; árbol fuente de trabajo:
  `/mnt/agents/output/project-manager-app-source`. La preview ligera se sirve
  por separado desde `/mnt/agents/output/app`.
- SHA desplegado API/Web, servicios y flags: no comprobados; fuera de alcance.
- Estado de migraciones: `NOT_APPLICABLE`; no se toca Prisma.
- Frontend: Next.js 15.5.28, React 19.3, Three.js/@types 0.170.
- Backend: `apps/api` NestJS; BFF actual `/api/semse/ops/consciousness`.
- Drift conocido: la topología usa siete cortex históricos y valores estáticos;
  `MODULE_REGISTRY` del backend es conocimiento estático mantenido manualmente,
  aunque conviva con observación runtime en la misma respuesta.

## 2. Constitution check

- [x] Spec aprobado antes de código producto.
- [x] Permiso y límite existentes declarados; no se añade RBAC.
- [x] Evidence/Payment Governance revisados: sólo rutas visuales, sin comandos.
- [x] Sin mutaciones críticas, eventos ni auditoría nueva.
- [x] Tests preceden implementación y demuestran el gap en rojo.
- [x] Sin secretos ni backend paralelo.
- [x] Código, CI, merge, deploy y activación se medirán por separado.

## 3. Arquitectura y autoridad

- Fuente de verdad de escritura: inalterada; esta feature no escribe.
- Read models: adaptación en memoria, sin persistencia ni caché nueva.
- Topología: `semse-consciousness-topology.ts` conserva IDs y relaciones.
- Madurez: coincidencia explícita con `maturity.byModule`, etiquetada
  `consciousness-registry`, no como salud live.
- Observación: sólo `observation.healthScore` y timestamps alimentan el resumen
  global; no se distribuye ese score artificialmente entre nodos.
- Contratos Zod: no se añade un contrato paralelo; tipos TypeScript locales de
  presentación consumen el shape actual ya usado por admin.
- UI: una composición React comparte snapshot, selección, filtros y playback.
- Three.js: carga dinámica cliente, `InstancedMesh`, `LineSegments`,
  `OrbitControls`, canvas nuevo por montaje y labels DOM proyectadas.
- Worker/queues/agentes/tools/ADR: sin cambios ni ADR requerido para esta vista.

## 4. Datos y migración

- Cambio Prisma, SQL, expand/contract, backfill, pre-deploy y prueba de
  migración: no aplican.
- Compatibilidad durante deploy: aditiva en admin y sustitución visual de la
  ruta histórica; los archivos legacy no se borran en este incremento.
- Rollback: revertir archivos; ninguna reparación de datos.

## 5. Seguridad y política

- Permisos: reutilizar `ops:dashboard:read`; no confiar en el canvas para RBAC.
- Tenant/org/resource scope: enteramente en BFF/API existente.
- Step-up/aprobación/auditoría: no aplica, sin comandos.
- Pagos/evidencia: los nombres de flujos no representan transacciones ni
  autorizan releases, approvals o acciones.
- Abuse cases: suplantar salud live, filtrar respuesta admin en ruta pública,
  XSS por labels y denegación por loops de GPU. Mitigación: fuentes explícitas,
  snapshot estático en ruta histórica, React textContent/DOM seguro y loop finito.

## 6. Eventos, idempotencia y reconstrucción

- Sin productores, outbox, consumers, replay ni DLQ.
- Playback: token de ejecución local; reiniciar/cambiar flujo/desmontar cancela
  el frame anterior. No representa eventos de negocio.
- Rebuild: funciones puras reconstruyen snapshot y layout de forma determinista.

## 7. Estrategia de implementación

### Fase A — SDD, tests y contratos

1. Recuperar manifiestos, documentación y tooling del SHA confirmado.
2. Escribir tests de cobertura de IDs/dominios, nulos, fuentes, aristas, flujos
   y layout; ejecutarlos antes de crear implementación.
3. Crear tipos y funciones puras mínimas para hacer verdes los tests.

### Fase B — Datos y dominio

- No aplica a persistencia. El adaptador vive en presentación y no implementa
  reglas de Payment, Evidence, Trust ni otros módulos dueños.

### Fase C — UI

1. Construir layout de nueve dominios y paths derivados de flujos.
2. Implementar Three.js con recursos rastreados, resize, selección y fallback.
3. Implementar 2D/lista y controles; todos consumen las mismas props.
4. Integrar admin y ruta histórica; retirar el intervalo aleatorio.
5. Aplicar el rediseño V7 conservando props, callbacks, selectores accesibles,
   datos y playback.
6. Añadir `preview/static` como envoltorio reproducible de los mismos componentes,
   sin Next, API, Docker ni dependencias `workspace:*`.

### Fase D — Verificación local

- Tests unitarios dirigidos y regresión relacionada.
- `next build`/typecheck/lint según disponibilidad del workspace completo.
- Spec validate/index/coverage con scripts canónicos.
- Servidor local, E2E, capturas desktop/móvil y revisión visual manual.
- Comprobar consola, selección, playback, reduced motion y fallback.
- Ejecutar `npm ci`, `npm run typecheck`, `npm run build` y smoke de navegador
  en `preview/static`; conservar reporte y capturas específicas de V7.
- Guardar preview V7 como estado separado de publicación y producción.
- Ejecutar CI local equivalente con Node 22 y conservar reporte estructurado E2E;
  no promover `ci_status` sin un check remoto terminal.

### Fase E — Integración y Fase F — Producción

- PR **#1157** abierto y diff remoto completo revisado. CI remoto terminal:
  `FAIL` por `quality-gates`; `unit-coverage` y CodeQL pasaron, E2E/QA se omitieron.
  Merge, Railway, canary y activación quedan no autorizados; el PR sigue `UNMERGED`.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Confundir registro estático con runtime | Media | Alto | Fuentes/nulos en modelo y textos visibles | Cualquier label live sin observación |
| Fuga GPU/listeners en StrictMode | Media | Medio | Canvas por montaje, disposables y cancelación | Canvas/frame tras desmontar |
| Coste de render o batería | Media | Medio | Instancing, batch, DPR tope y render bajo demanda | RAF continuo en reposo |
| Inaccesibilidad del canvas | Media | Alto | 2D/lista, teclado, foco y reduced motion | Flujo sólo posible con puntero |
| Workspace incompleto impide build | Media | Medio | Recuperar lock/packages/scripts; reportar bloqueo real | No declarar build sin evidencia |
| Visor dinámico instala con npm y rechaza `workspace:*` | Alta | Medio | Entrega estática con manifiesto/lock propios y fuentes sincronizadas | No reintroducir workspaces en `preview/static` |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| InstancedMesh/raycast r170 | Three.js docs | Una malla instanciada y `instanceId`; colores actualizados explícitamente |
| Disposal/render on demand | Three.js manual | Registrar recursos y renderizar por cambios |
| Context loss/reduced motion | MDN | Fallback accesible, restauración y animación finita opcional |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados.
- [x] Migración no aplicable y rollback definidos.
- [x] Tests ordenados antes del código.
- [x] Sin flag/canary en este incremento; gate de producción separado.
- [x] Evidencia local/CI/merge/deploy/activación diferenciada.
- [x] Scope reversible; dependencias del builder fijadas y auditadas localmente.
