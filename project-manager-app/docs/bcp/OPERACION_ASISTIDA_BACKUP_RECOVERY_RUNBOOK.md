# Operacion Asistida Backup Recovery Runbook

- Estado: activo
- Capa canonica: `backup_recovery`
- Alcance: `operator_identity`, `workspace_memory`, `agent_runtime`, `ephemeral_runtime_state`

## Proposito

Recuperar la capa de operacion asistida cuando un incidente afecta contexto operativo,
memoria de workspace, runtime agentic o trazabilidad de decisiones.

El objetivo no es reactivar caches ni archivos temporales. El objetivo es restaurar la
capacidad de responder estas preguntas:

- que operador o actor tecnico ejecuto la accion;
- sobre que workspace, repo o task opero;
- que `AgentRun` se creo, completo o fallo;
- que memoria contextual quedo persistida;
- que evidencia permite reconstruir la decision.

## Condiciones de activacion

Activar este runbook cuando ocurra cualquiera de estos casos:

- perdida o corrupcion de registros `AgentRun`;
- perdida o corrupcion de `WorkspaceMemoryEntry`;
- inconsistencia entre Ops trace y memoria contextual;
- restauracion de base de datos desde backup;
- incidente donde se requiera reconstruccion narrativa para auditoria.

## Fuentes canonicas

| Fuente | Uso en recuperacion |
|---|---|
| Postgres / Prisma | fuente primaria para `AgentRun`, `WorkspaceMemoryEntry`, `KnowledgeFact`, `AuditLog` |
| `AuditLog` | reconstruccion cronologica y responsable |
| `DomainEvent` | reconstruccion de origen de negocio |
| Ops trace | validacion operacional por `correlationId` |
| `workspace_memory` | resumen contextual por workspace/run/task |
| backup externo | restore, no runtime |

## Procedimiento

1. Congelar escritura operativa si el incidente sigue activo.
2. Registrar hora, responsable, tenant afectado, entorno y sintomas.
3. Identificar el ultimo backup full valido y el rango WAL necesario.
4. Restaurar en entorno aislado antes de tocar el entorno primario.
5. Validar salud base: migraciones Prisma, conteo de tenants, usuarios y entidades criticas.
6. Validar operacion asistida:
   - listar `AgentRun` por tenant;
   - consultar Ops trace por `correlationId` relevante;
   - consultar `GET /v1/knowledge/workspace-memory` por `workspaceId`;
   - comprobar que `operatorContext.operatorId`, `workspaceId`, `repoId` y `taskId` sobreviven.
7. Comparar contra auditoria:
   - `AuditLog` debe explicar creacion, inicio, cierre o fallo de runs;
   - eventos de dominio deben explicar el origen del trigger cuando aplique.
8. Ejecutar smoke si hay API viva:
   - `npm run smoke:operacion-asistida`
9. Ejecutar drill BCP:
   - local sin API: `npm run drill:operacion-asistida:bcp`
   - API viva: `SEMSE_BCP_DRILL_MODE=api SEMSE_API_URL=http://127.0.0.1:4000 npm run drill:operacion-asistida:bcp`
   - API local autogestionada: `npm run drill:operacion-asistida:api-local`
10. Ejecutar verificacion documental:
   - `npm run verify:operacion-asistida:bcp`
11. Ejecutar verificacion local compuesta antes de cerrar el drill:
   - `npm run verify:operacion-asistida:local`
12. Ejecutar verificacion API local cuando exista Postgres/Redis:
   - `npm run verify:operacion-asistida:api-local`
13. Ejecutar gate completo del modulo cuando se quiera cerrar la validacion:
   - `npm run verify:operacion-asistida:module`
14. Cuando el audit legacy este en cero, probar modo store dedicado sin compatibilidad:
   - `npm run verify:operacion-asistida:dedicated-store`
15. Ejecutar revision de riesgo derivada del manifiesto:
   - `npm run review:operacion-asistida:risk`
16. Sincronizar governance y backlog derivado desde la revision de riesgo:
   - `npm run review:operacion-asistida:governance`
17. Ejecutar simulacion de restore aislado sobre la ultima evidencia:
   - `npm run drill:operacion-asistida:restore`
18. Ejecutar restore multi-entorno sobre dos API locales aisladas:
   - `npm run drill:operacion-asistida:restore:multienv`
19. Auditar deuda legacy de `workspace_memory`:
   - `npm run audit:operacion-asistida:workspace-memory-legacy`
20. Documentar resultado en reporte de drill o incidente.

## Criterios de exito

- El sistema responde health con persistencia esperada.
- Ops lista runtime agentic filtrable por `workspaceId`, `operatorId` y `memoryTag`.
- Trace por `correlationId` muestra `operatorContext`.
- Trace por `correlationId` incluye memoria contextual asociada al run.
- La lectura de `workspace_memory` por API devuelve registros esperados.
- La auditoria permite explicar quien hizo que, cuando y bajo que contexto.
- El drill local genera evidencia JSON reproducible sin depender de servicios vivos.
- Cada drill guarda evidencia `latest` y evidencia historica por timestamp.
- `docs/bcp/evidence/manifest.json` conserva ultimo resultado e historial resumido.
- El mismo drill puede cambiar a API usando `SEMSE_BCP_DRILL_MODE=api`.
- El runner `drill:operacion-asistida:api-local` levanta API compilada, espera health Prisma y ejecuta el drill API.
- `verify:operacion-asistida:api-local` ejecuta verificacion documental y drill API local con sesion real.
- `verify:operacion-asistida:dedicated-store` valida el camino canonico de `workspace_memory` sobre `WorkspaceMemoryEntry`.
- `verify:operacion-asistida:module` ejecuta el cierre completo del modulo: verificacion API local, revision de riesgo y restore aislado.
- el reader legacy de `workspace_memory` fue retirado y ya no participa en runtime.
- `review:operacion-asistida:risk` transforma el manifiesto en una revision de riesgo operativa.
- `review:operacion-asistida:governance` aterriza la revision de riesgo en artifacts de governance y backlog.
- `drill:operacion-asistida:restore` valida que la evidencia mas reciente soporte reconstruccion aislada.
- `drill:operacion-asistida:restore:multienv` valida restore sobre dos entornos API etiquetados y con evidencia separada.
- `audit:operacion-asistida:workspace-memory-legacy` mide y, si se solicita, absorbe deuda legacy desde `KnowledgeFact`.

## Criterios de fallo

- Hay runs sin contexto operativo recuperable.
- Hay memoria contextual sin tenant/workspace/run cuando deberia tenerlo.
- Hay auditoria insuficiente para explicar una accion sensible.
- El backup externo es la unica fuente de verdad disponible.
- La recuperacion exige reusar caches o estado efimero como fuente primaria.

## Escalamiento

Escalar a owner de plataforma si:

- el RTO de 4h esta en riesgo;
- el restore aislado no valida integridad;
- hay pagos, disputas o evidencia legal afectados;
- hay diferencia entre auditoria y estado transaccional restaurado.

## Evidencia requerida

Registrar como minimo:

- fecha y hora del incidente o drill;
- entorno;
- tenant afectado;
- snapshot/backup usado;
- rango WAL usado si aplica;
- comandos ejecutados;
- resultado de smokes;
- resultado de checklist;
- brechas y follow-ups.
