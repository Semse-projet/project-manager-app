# SDD_GOVERNANCE — SEMSEproject
**Versión:** 1.0
**Fecha:** 2026-05-20
**Estado:** APROBADO
**Referencia metodológica:** github/spec-kit + SDD principles

> Este documento define las reglas operativas del Spec-Driven Development en SEMSEproject.
> Es de lectura obligatoria para cualquier agente de IA o desarrollador que trabaje en este proyecto.

---

## 1. El problema que resuelve este documento

SEMSEproject tiene excelentes documentos de visión pero el código y los specs han vivido en paralelo.
El resultado es: dos ORMs, dos bases de datos, un Domain Store en-memoria, 0 tests en la API, y dos frontends compitiendo.

Eso es el resultado del **vibe coding**: codificar por impulso en conversaciones con IA sin que ningún spec governe la ejecución.

Este documento cierra ese ciclo.

---

## 2. Definición de Spec-Driven Development para SEMSE

```
SDD = El spec ES la fuente de verdad.
      El código ES su consecuencia.
      Ningún agente de IA toma decisiones de arquitectura.
      El desarrollador toma decisiones. La IA implementa.
```

**Flujo obligatorio en SEMSEproject:**
```
constitution
    ↓
specify        (¿qué resuelve? ¿para quién? ¿qué principios aplican?)
    ↓
plan           (¿cómo se implementa? ¿qué módulos toca? ¿qué BD?)
    ↓
tasks          (lista ordenada de pasos ejecutables)
    ↓
analyze        (¿el plan es consistente con el spec y la constitución?)
    ↓
implement      (solo aquí se genera código)
    ↓
validate       (tests pasan, spec cumplido, no hay regresiones)
    ↓
report         (ADR si hay decisiones arquitectónicas, SPEC_INDEX actualizado)
```

---

## 3. La regla de oro

> **Ningún feature existe si no está en SPEC_INDEX.md.**
> **Ningún endpoint existe si no tiene spec + test.**
> **Ningún agente de IA genera código hasta que el spec esté en estado APPROVED.**

---

## 4. Formato canónico de un spec en SEMSE

Todo spec en `specs/api/*.spec.md` debe tener esta estructura:

```markdown
# SPEC: [Nombre del Feature]
**Versión:** X.Y
**Dominio:** [Identity | Marketplace | Work Management | Evidence | Payments | Ops | Agents]
**Estado:** [DRAFT | APPROVED | DEPRECATED]
**Depende de:** [otros specs]
**Implementado en:** [ruta del código, cuando exista]
**Tests:** [ruta del test, cuando exista]

## Qué resuelve
[1-3 líneas. El problema de negocio, no la solución técnica.]

## Actores
- [Rol]: [qué puede hacer]

## FSM (si aplica)
[ENTITY]: [ESTADO_A] → [ESTADO_B] → [ESTADO_C | ESTADO_D]
[Condición de transición]

## Contratos de API

### [MÉTODO] [/ruta]
**Input:**
```zod
z.object({
  campo: z.string(),
})
```
**Output:**
```zod
z.object({
  id: z.string(),
  status: z.enum([...]),
})
```
**Errores:**
- `400` — [cuándo]
- `403` — [cuándo]
- `404` — [cuándo]
- `409` — [cuándo]

**Guards:**
- Rol requerido: [client | pro | admin]
- Ownership: [condición]
- Tenant: sí (siempre)

**Efectos:**
- AuditLog: [EVENT_NAME] con [campos]
- SSE: [event_type] si [condición]
- Payment Governance: [impacto si aplica]
- Evidence: [impacto si aplica]
- FSM transition: [qué cambia]

## Tests requeridos
- [ ] [escenario exitoso principal]
- [ ] [escenario de error por permisos]
- [ ] [escenario de error por validación]
- [ ] [escenario de FSM]
- [ ] [escenario de edge case]

## Notas de implementación
[Cualquier consideración técnica importante, pero no el código en sí.]
```

---

## 5. Formato canónico de un spec de FSM

Todo spec en `specs/fsm/*.spec.md`:

```markdown
# FSM SPEC: [Nombre del Flujo]

## Estados
| Estado | Descripción | Quién puede entrar | Reversible |
|---|---|---|---|

## Transiciones
| Desde | Evento | Hacia | Guard | Efectos |
|---|---|---|---|---|

## Diagrama ASCII
[DRAFT] → [SUBMITTED] → [ACTIVE] → [COMPLETED]
                              ↓
                         [DISPUTED] → [RESOLVED]

## Invariantes
- [regla que nunca puede violarse]

## Tests requeridos
- [ ] [transición válida X → Y]
- [ ] [transición inválida bloqueada]
- [ ] [guard de permisos]
```

---

## 6. Reglas para agentes de IA en sesiones de codificación

### Antes de escribir código
```
1. ¿Leíste .specify/memory/constitution.md?
2. ¿El feature está en docs/SPEC_INDEX.md como APPROVED?
3. ¿Existe el spec en specs/api/ o specs/fsm/?
4. ¿El spec define input, output, errores, permisos y efectos?
5. ¿Existe el test file?
```

Si alguna respuesta es NO → primero se completa el spec, luego se codifica.

### Durante la implementación
```
- No agregar features que no estén en el spec
- No cambiar el contrato de API sin actualizar el spec primero
- No mover lógica de dominio a la UI
- No acceder a datos cross-tenant
- Todo cambio de estado crítico emite AuditLog
- Validar permisos en el backend, nunca solo en el frontend
```

### Después de implementar
```
- Tests deben pasar
- SPEC_INDEX.md debe actualizarse (estado: APPROVED, tests: referenciados)
- Si hubo decisión arquitectónica → crear ADR en docs/adrs/
```

### Ciclo obligatorio de investigación externa y mejora

SEMSEproject adopta un ciclo de mejora continua basado en investigación externa.
No basta con que el código compile: cada módulo, PR, bloque SDD o corte de código listo
debe contrastarse contra prácticas externas antes de considerarse cerrado.

**Regla obligatoria:**

```
Al terminar cada módulo, PR, bloque SDD o corte de código listo:
  1. Ejecutar al menos 3 búsquedas externas independientes.
  2. Registrar las fuentes consultadas.
  3. Extraer ideas de mejora aplicables.
  4. Decidir explícitamente qué se aplica ahora, qué se descarta y qué queda en backlog.
  5. Documentar la decisión en el reporte de sesión/bloque.
```

Las 3 búsquedas no deben ser copias de la misma consulta. Deben cubrir, según el tipo
de cambio:

```
- mejores prácticas técnicas del dominio;
- seguridad, permisos y riesgos operativos;
- patrones de testing, CI/CD, observabilidad o deploy;
- documentación, trazabilidad y experiencia de usuario;
- alternativas de arquitectura usadas por productos o frameworks maduros.
```

**Aplicación práctica:**

```
Módulo terminado      → research loop obligatorio antes de DONE.
PR listo             → research loop obligatorio antes de pedir merge.
Endpoint listo       → research loop si introduce contrato nuevo o riesgo.
Migración lista      → research loop sobre seguridad de migraciones y rollback.
UI lista             → research loop sobre UX/accesibilidad/patrones equivalentes.
Infra/deploy listo   → research loop sobre Railway/Docker/CI/health checks.
```

**No se permite:**

```
- buscar solo para cumplir y no registrar nada;
- aplicar ideas externas sin pasar por spec/plan/tasks;
- cambiar arquitectura por una fuente externa sin ADR;
- convertir una mejora descubierta en scope creep del PR actual.
```

**Formato mínimo en el reporte:**

```markdown
## Investigación externa de mejora

### Búsquedas ejecutadas
1. `[consulta]` — fuente(s): [link]
2. `[consulta]` — fuente(s): [link]
3. `[consulta]` — fuente(s): [link]

### Ideas detectadas
- [idea] — fuente — impacto esperado

### Decisiones
- Aplicado ahora: [qué y por qué]
- Backlog: [qué queda para después]
- Descartado: [qué no aplica y por qué]
```

La regla existe para fortalecer el SDD, no para reemplazarlo. Toda mejora externa
debe aterrizar primero en spec, plan o backlog antes de modificar código.

---

## 7. Diferencia entre vibe coding y SDD en la práctica

**Vibe coding (lo que queremos eliminar):**
```
Yo: "Agrégale al Job la capacidad de tener subcontratistas"
IA: [genera 300 líneas directamente]
    [toca 4 archivos sin spec]
    [no hay test]
    [agrega campo en DB sin migración documentada]
    [puede contradecir el FSM existente]
```

**SDD (lo que queremos):**
```
Yo: "Quiero agregar subcontratistas a un Job"

Flujo:
1. /speckit.specify → spec: qué es un subcontratista, qué puede hacer, qué estados tiene
2. /speckit.plan   → plan: qué tablas toca, qué endpoints, qué FSM cambia, qué agents afecta
3. /speckit.analyze → ¿el plan es consistente con constitution? ¿con ADR-0003?
4. /speckit.tasks  → lista de tareas: migración, endpoint, test, UI
5. /speckit.implement → genera código tarea por tarea
6. validate: tests pasan, SPEC_INDEX actualizado
```

---

## 8. Comandos Spec Kit en Claude Code

Los siguientes comandos están disponibles en sesiones de Claude Code.
Se invocan con `/` como prefijo.

| Comando | Cuándo usarlo |
|---|---|
| `/speckit.constitution` | Para revisar o actualizar la constitución |
| `/speckit.specify` | Al iniciar cualquier feature nuevo |
| `/speckit.plan` | Después de tener el spec aprobado |
| `/speckit.tasks` | Para romper el plan en pasos ejecutables |
| `/speckit.analyze` | Para validar consistencia antes de implementar |
| `/speckit.implement` | Solo después de spec + plan + tasks + analyze |
| `/speckit.checklist` | Para generar checklist de calidad |
| `/speckit.clarify` | Cuando el spec tiene ambigüedades |

---

## 9. Ownership por dominio

| Dominio | Owner sugerido |
|---|---|
| Identity & Auth | Auth Agent |
| Marketplace / Jobs | Marketplace Agent |
| Work Orders / Milestones | Operations Agent |
| Evidence | Evidence Agent |
| Payments / Escrow | Payments Agent |
| Risk / Disputes | Risk Agent |
| Agents / Orchestration | Orchestration Agent |
| Analytics / Audit | Analytics Agent |
| Seguridad | Security Agent |
| DevOps / Infra | DevOps Agent |

---

## 10. Checkpoints de calidad antes de merge

```
[ ] El spec está en SPEC_INDEX.md como APPROVED
[ ] El spec tiene input/output/errors/permissions/effects
[ ] El FSM está documentado (si aplica)
[ ] Los tests existen y pasan
[ ] AuditLog emitido en transiciones críticas
[ ] No hay datos cross-tenant
[ ] RBAC validado en backend
[ ] No hay secretos en el código
[ ] SPEC_INDEX.md actualizado
[ ] Si hubo decisión arquitectónica → ADR creado
```
