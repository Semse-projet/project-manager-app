# BuildOpsProjectHealthPanel SSE

**Fecha:** 2026-05-17  
**Estado:** ✅ Cerrado  
**Tests:** 78/78 · TypeScript 0 errores

---

## Resumen

`/buildops/projects/[id]` ahora refresca `BuildOpsProjectHealthPanel` automáticamente cuando llegan eventos SSE relevantes para ese proyecto. Completa la reactividad en los tres niveles del ciclo monetizable.

---

## Mapa de reactividad completo post-cierre

```
Milestone level   → MilestoneGovernancePanel     (evidence + change-order events)
Change order level → ChangeOrderImpactCard        (change-order events)
Project level     → BuildOpsProjectHealthPanel    (change-order + signal events)
```

---

## Página conectada

**`/buildops/projects/[projectId]/page.tsx`**

```ts
const [healthRefreshKey, setHealthRefreshKey] = useState(0);

useBuildOpsSSE({
  onEvent: (evt) => {
    const HEALTH_EVENTS = ["change-order:updated", "change-order:applied", "operational-signal:created"];
    if (!HEALTH_EVENTS.includes(evt.type)) return;
    const evtProjectId = evt.buildOpsProjectId;
    if (evtProjectId && evtProjectId !== projectId) return;
    setHealthRefreshKey((k) => k + 1);
  },
  enabled: !!projectId && projectId !== "loading",
});

<BuildOpsProjectHealthPanel
  key={`health-${project.id}-${healthRefreshKey}`}
  projectId={project.id}
/>
```

---

## Eventos escuchados

| Evento | Condición de refresh |
|--------|---------------------|
| `change-order:updated` | `event.buildOpsProjectId === projectId` |
| `change-order:applied` | `event.buildOpsProjectId === projectId` |
| `operational-signal:created` | `event.buildOpsProjectId === projectId` |

Si `buildOpsProjectId` no está en el payload (evento sin proyecto específico), se ignora — no hay refresh innecesario.

---

## Componente refrescado

`BuildOpsProjectHealthPanel` re-monta cuando `healthRefreshKey` cambia (patrón `key={...}`).  
El panel re-fetch `GET /api/semse/buildops/projects/:id/health` automáticamente.

---

## Qué cambia en el panel tras refresh

| Campo | Cuando cambia |
|-------|--------------|
| `openChangeCandidates` | Tras apply-to-buildops (baja) o submit CO (sube) |
| `openSignals` | Tras operational-signal:created |
| `criticalSignals` | Depende de severity del signal |
| `nextBestAction` | Recalculado por el endpoint |
| `riskLevel` | Actualizado desde AlgorithmRun |

---

## Validaciones

```
change-order:applied → healthRefreshKey++ → panel re-fetch ✅
change-order:updated → mismo flujo ✅
operational-signal:created → mismo flujo ✅
evento sin buildOpsProjectId → ignorado ✅
evento de otro proyecto → ignorado ✅
SSE falla → panel sigue con refresh manual ✅
enabled=false cuando projectId=loading → no conecta SSE ✅
78/78 tests ✅
Web TypeScript 0 errores ✅
```

---

## Riesgos pendientes

1. Si el evento de change order no incluye `buildOpsProjectId` (CO sin proyecto asociado) el panel no refresca automáticamente — necesita refresh manual.
2. Sin indicador visual "Actualizado" — el refresh es silencioso.
3. `operational-signal:updated` y `operational-signal:resolved` no se emiten aún — solo `:created`. Se puede añadir en `OperationalSignalsService.acknowledge/resolve`.

---

## Próximo paso recomendado

```
Evidence CRUD avanzado:
  - previews de imágenes
  - historial de cambios de evidencia
  - audit trail visual
  - reemplazos con trazabilidad
```
