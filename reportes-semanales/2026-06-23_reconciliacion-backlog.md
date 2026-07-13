# Reconciliacion de backlog

Fecha: 2026-06-23.
Repo: `/home/yoni/project-manager-app`.
Backlog fuente: `project-manager-app/docs/constitution/08_SPRINT_BACKLOG.md`.

## Diagnostico

El backlog canonico conserva fecha 2026-03-30 y describe Sprints 2.1 a 2.5 como pendientes. La actividad de junio muestra que muchas capacidades ya fueron implementadas, cambiaron de alcance o se movieron a frentes nuevos. Por eso no conviene editarlo mecanicamente marcando todo como terminado: primero hay que validar estado real por capacidad.

## Estado confirmado

- PR #198 fue mergeada.
- CI de PR #198 paso.
- CodeQL de PR #198 paso.
- Despues del merge a `main`, CI paso.
- Railway Deploy paso.
- Production Health Gate paso.
- No hay issues abiertas reportadas por GitHub en la consulta.
- Dependabot Updates para esbuild fue revisado: el log reporta `security_update_not_needed` porque `esbuild` ya esta en `0.28.1`; no hay accion de codigo pendiente por ese run.

## Pendientes que reemplazan el backlog antiguo

### P0 - Operacion inmediata

- Resolver politica de artefactos `graphify-out`: commitear, ignorar cache o limpiar regenerados.
- Confirmar si el branch local debe volver a `main` despues del merge de #198.

### P1 - Validacion producto

- Validar Vision AI con URLs reales y evidencia real.
- Validar flujo jobs/bids/worker end-to-end.
- Validar pagos/escrow en sandbox o produccion segun entorno disponible.
- Validar que BFF routes nuevas cubren las pantallas activas.

### P1 - Backlog canonico

- Actualizar `08_SPRINT_BACKLOG.md` con una nota de supersesion o una seccion de estado junio 2026.
- Mover tickets historicos cerrados a una seccion `Completado o absorbido`.
- Mantener solo pendientes actuales con prioridad, evidencia y criterio de cierre.

### P2 - Limpieza operacional

- Limpiar ramas remotas antiguas listadas en `BRANCH_AUDIT_REPORT.md` despues de confirmar que Railway no depende de ellas.
- Revisar si GitHub debe activar borrado automatico de ramas mergeadas.
- Definir si `graphify-out/cache/**` debe quedar fuera del control de versiones.

## Decision recomendada sobre `graphify-out`

Recomendacion conservadora:

1. Mantener versionado solo el resultado util para consulta humana o RAG si realmente se consume.
2. No versionar caches de AST regenerables.
3. Si `graphify-out/graph.json` es requerido por el sistema, mantenerlo; si es solo artefacto local pesado, moverlo fuera del repo o documentar generacion.
4. Antes de borrar cualquier archivo trackeado, confirmar consumidores con busqueda de referencias.

## Siguiente cambio recomendado

Crear una seccion al inicio de `08_SPRINT_BACKLOG.md`:

```md
## Nota de estado - 2026-06-23

Este backlog historico fue creado el 2026-03-30 y esta parcialmente supersedido por implementaciones de junio 2026. El estado operativo actual se controla en `reportes-semanales/2026-06-23_reconciliacion-backlog.md` hasta completar la reconciliacion final.
```

Despues, reemplazar gradualmente los tickets antiguos por una tabla de capacidades con estados: `DONE`, `PARTIAL`, `PENDING`, `NEEDS_VALIDATION`.
