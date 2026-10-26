# S0b — Revisión de límite transaccional y custodia de AuditLog
**SEMSE · 2026-10-26 · Documento técnico, NO IMPLEMENTADO**  
**Dependencia:** [S0b: integridad y concurrencia](2026-10-26_s0b-allocation-atomicity-cross-crew-contract.md) · BO-10 DRAFT · PR #1027 DRAFT.  
**Gates:** no cambiar código hasta SDD aprobado; pruebas locales antes de review; CI manual reservado para el último control pre-merge.

## 1. Hechos comprobados en `main`

| Origen | Observación y consecuencia |
|---|---|
| `apps/api/src/modules/organizations/task-allocations.service.ts` | `assign()` escribe en bucle `TaskAllocation` y llama `record()` por destinatario después de cada escritura; no hay transacción única visible. |
| `apps/api/src/infrastructure/audit/audit.service.ts` | `append()` ejecuta `actorContextService.ensureActorContext()` y después `this.prisma.auditLog.create()`, con Prisma inyectado; no acepta cliente `tx`. |
| `apps/api/src/infrastructure/persistence/actor-context.service.ts` | `ensureActorContext()` ejecuta `tenant.upsert`, `org.upsert` y `user.upsert`; para User sintético construye email `<userId>@semse.local`. Dispone de cachés de identificadores, no comprueba autoridad empresarial. |
| `packages/db/prisma/schema.prisma` | `TaskAllocation` usa `@@unique([taskId,userId])` y no declara relaciones FK explícitas para tenant/org/crew/task; índices no demuestran por sí solos ownership cruzado. |
| `packages/db/prisma/schema.prisma` | `AuditLog` almacena tenant y actor con FK, pero **no tiene columna `orgId`**; `afterJson` puede contener contexto y `requestId`. |

**Alcance de esta conclusión:** inspección de fuentes, no prueba SQL, explotación, auditoría forense ni runtime. Es un análisis para evitar que un parche S0b introduzca regresión de identidad.

## 2. Riesgo adicional S0-F11: creación auxiliar en ruta sensible

Para el caso de uso de asignación de trabajadores, la auditoría debe **reflejar**
una acción autorizada sobre recursos existentes, nunca auto-crear la identidad
o la empresa por `ensureActorContext`.

Si un actor/resource id inexistente llegara hasta una llamada a `AuditService.append`,
`ensureActorContext()` puede crear registros auxiliares. Los guards de
aplicación ya buscan mitigar entradas inválidas, pero no se debe
dependender de eso como única protección cuando se refactorice
la transacción. Aun si se rechaza el lote luego, un upsert de contexto
fuera del `tx` podría persistir registros independientes.

**Invariante propuesto:** en toda mutación S0b, verificar `Tenant`,
`Org`, `User`, `Membership WORKER ACTIVE` y `Crew` por lecturas
autoritativas; *ninguna* llamada a `ensureActorContext` dentro o fuera
de una transacción de este dominio para inventar IDs ausentes. En caso
de contexto inválido, FAIL CLOSED sin `TaskAllocation`, auditoría de éxito
ni nuevas filas sintéticas. No cambiar globalmente `ActorContextService`
sin prueba del worker/bootstrap y política existente.

## 3. Mecanismo recomendado (propuesta pendiente de aprobación)

No basta con `await prisma.$transaction(async (tx)=> { assign...; await audit.append(...) })`,
porque `AuditService.append` usa `this.prisma` ajeno al cliente
`tx`, y también ejecuta `ensureActorContext`. Se necesita un
límite atómico compartido con auditoría y, cuando aplique, outbox.

### Contrato de servicio transaccional, sin implementar

```text
assignBatch(actor, crew, task, users, requestId):
  authenticate live actor and validate request shape
  db.transaction(tx):
    assert real tenant, org, actor and authorized membership
    assert actor capability as manager OR effective WORKER supervisor
    assert active crew belongs to same tenant/org
    assert task belongs to org and, if Crew-origin, to that crew
    assert every unique user has ACTIVE crew membership and WORKER membership
    assert grant/session revocation did not win before protected commit
    for each unique user:
      assert no foreign-crew allocation may be returned or reopened
      create / idempotent-return / same-crew controlled reopen with CAS
      write audit in SAME tx for each actual state transition only
      write catalogued outbox in SAME tx if BO-10 contract requires it
    return sanitized DTOs scoped to tenant/org/crew
  commit; only then send success response
```

`audit.appendInTransaction(tx, trustedAuthorizedContext, entry)`
es nombre de ejemplo, **no API que exista hoy**. Debe:
- reutilizar la serialización/semántica oficial de AuditService sin
  cambiar su contrato global;
- escribir mediante `tx.auditLog.create` y el outbox del mismo `tx`
  cuando esté ratificado por Event Catalog;
- preservar tenant/org, requestId, actor real, before/after saneados;
  impedir crear `User`, `Org` o `Tenant` por acción del audit;
- no registrar salarios, tokens, datos de contacto, evidencia médica
  ni lista indiscriminada de todos los miembros de la cuadrilla;
- no emitir `task_allocation.assigned` para un retry idempotente que
  no mutó datos; evitar auditorías duplicadas por requests repetidos.

### Orden de locks y concurrencia

Proponer política de orden fijo para locks/tokens por
`tenant -> org -> crew -> task -> allocation`, con validación
de membresía y/o versión del grant en el mismo protocolo
de revocación. `Serializable` con retry acotado para `P2034`
puede ser necesario, pero **no se afirma** que por sí solo resuelva
todas las carreras: diseñar lock/version compartido con el flujo de
revocación y medir. Dos solicitudes simultáneas pueden producir
`P2002` por `@@unique([taskId,userId])`; reconsultar solo
si corresponde a la **misma** crew y tenant/org. De otra crew:
conflicto neutro, jamás DTO ajeno.

La validación externa (email, OAuth, evidencias o firmas) **no se hace
dentro de la transacción DB**. La transacción sólo usa estados
persistidos autoritativos y puede revalidar su `version`.

## 4. Especificación de fallos a inyectar — AUD-01…AUD-08

| ID | Preparación | Validación exigida |
|---|---|---|
| AUD-01 | Actor con `User` o `Org` ausente llega a vía de asignación | 404/401 según caso; **sin** `upsert` nuevo ni audit de éxito. |
| AUD-02 | Segunda inserción del lote falla después de primera escritura | 0 mutaciones y 0 auditorías de éxito. |
| AUD-03 | La llamada a `tx.auditLog.create` falla después de reservar `TaskAllocation` | Rollback íntegro del estado y outbox. |
| AUD-04 | Emisión outbox falla si está habilitada por catálogo | Rollback de todo el lote; no evento fantasma. |
| AUD-05 | Retry del mismo lote con mismas personas en la misma crew | 1 fila por tarea/persona, ningún audit extra para no-op. |
| AUD-06 | Carrera `P2002` same-crew vs foreign-crew | Same-crew retry idempotente condicionado; foreign-crew conflicto neutral sin fuga. |
| AUD-07 | Revocación WORKER o grant compite contra asignación | Contrato de orden confirmado: no hay éxito posterior a revocación ya confirmada; prueba DB real, no mock. |
| AUD-08 | PR manager PRO con `org:crews:manage`, sin owner verificado | Mantiene operaciones *legítimas de gestión* del BO-07/10 vigente, pero no adquiere `org:supervisors:delegate`. |

Incluir integración PostgreSQL con abort/commit real; el mock
`makeWorld()` de los tests actuales no modela rollback,
FK/índices reales ni aislamiento de transacciones. No llamar
`PASS` a tests de diseño o estáticos.

## 5. Riesgos cruzados fuera de S0b

- `ActorContextService` es un servicio **compartido**. La eliminación
  global de `ensureActorContext` podría romper workers o bootstrap;
  hacer cambio encapsulado, respaldado por pruebas y revisión técnica.
- `BusinessAccessFoundation` ya controla acceso efectivo
  por org/tenant en su propia superficie. Reutilizar guardas
  efectivas y no confiar en claims JWT, sin duplicar un motor auth.
- `AuditLog` carece de columna `orgId`. Si la trazabilidad por Org
  exige campo canónico, tramitar aparte una migración aditiva/ADR;
  entretanto incluir sólo `orgId` verificado en JSON autorizado
  **si el esquema actual lo permite**; no inventar evidencia.
- `TaskAllocation` no declara FKs explícitas a `Crew`/`JobTask`.
  El índice único `taskId,userId` garantiza no duplicidad global
  de esa pareja, pero **no** pertenencia a la misma Org/crew.
  Reforzar verificaciones de servicio/DB de forma explícita.
- `SkillExperience.sourceId` referencia una asignación terminada
  en BO-12: la reutilización de la misma `TaskAllocation.id`
  a través de crews/reasignaciones puede enturbiar la procedencia.
  Es razón adicional para NO transferir filas entre crews
  silenciosamente y abrir ADR si se necesita un historial por ciclo.

## 6. Bloqueos y criterio de cierre

- [x] Fuente y esquema revisados sin ejecutar operaciones.
- [x] Riesgo de `ActorContextService` identificado.
- [x] Propuesta de auditoría compartiendo límite `tx` documentada.
- [ ] Ratificación de D-S0B-01…05 y política de identidades sintéticas.
- [ ] BO-10 y SDD correspondiente aprobados antes de código.
- [ ] Pruebas rojas AUD-01…08 + N10…N18.
- [ ] Diseño/fix de audit transaccional, revisión independiente
  y pruebas PostgreSQL completas.
- [ ] CI manual al final, PASS en SHA final, antes de merge.
- [ ] Deploy/staging/canary bajo autorización distinta.

**No se modifican** `AuditService`, `ActorContextService`,
`TaskAllocation`, migrations, eventos, tests ni flags en este PR
documental. No se realizó diagnóstico/re-run de CI.
