---
type: plan
feature: "document-sharing-grants"
domain: "prometeo"
spec: "docs/specs/prometeo/document-sharing-grants.spec.md"
version: "2.0"
status: "DRAFT"
branch: "integration/p0-prometeo-main-reconcile-20261017"
date: "2026-10-18"
---

# Plan técnico: Prometeo Document Sharing Grants P0 #974

> Prerrequisito pendiente: el spec sigue REVIEW; este plan **no** permite fusionar, migrar producción ni activar la función.

## 1. Snapshot de verdad

- Rama y código examinado: PR #987, HEAD `0e64c68a95389025d780c1eeb07b496a06e6aa65` al inicio de esta documentación. Confirmar HEAD y main antes de promover.
- Producción API/Web SHA: **no verificado en esta revisión**. No inferir deploy desde CI.
- Esquema en producción y migraciones: **no verificados**; la migración nueva se ha probado en PostgreSQL efímero de CI, no en producción.
- Configuración de staging: el entorno T008 es una carga distinta y **no está autorizado para reutilizarse**.
- CI: verificar runs finales del HEAD, no usar un run verde de SHA anterior.
- Flags/allowlists: no se autoriza activación sin mecanismo y revisión explícita. `public_training` heredado no constituye permiso.

## 2. Constitution check

- [ ] Aprobación humana del spec y ADR propuesto, incluida decisión de permisos cross-org.
- [x] Tenant/org/ownership documentados; [x] AuditLog en transacciones; [x] tests negativos escritos.
- [ ] Verificación independiente de Evidence/Payment Governance, RAG y no-egress.
- [ ] Análisis de seguridad independiente y staging terminal.
- [x] Código/CI/merge/deploy/activación se distinguen; no se permite autoproclamación.

## 3. Arquitectura y autoridad

- Fuente de verdad: PostgreSQL `PrometeoDocument` + `PrometeoDocumentGrant`, actor autenticado, participación actual en un proyecto/job vivo, políticas ResourceScope.
- Lectura: filtros SQL **antes** de paginar, buscar chunks o componer citas/contexto; tenant exacto, organización, grant activo y proyecto coincidente.
- Escritura: propietario explícito u OPS_ADMIN del tenant; grant/revoke + AuditLog serializables e idempotencia/concurrencia P2002/P2034.
- Módulos: `prometeo.controller/service/repository/access.policy/document-grant.service`, agente Copilot, Evidence Review, embedding/model router, Prisma.
- API: `POST /v1/prometeo/documents/:id/shares`, `DELETE /v1/prometeo/documents/:id/shares/:recipientOrgId`; ningún `projectId` aportado por cliente otorga acceso.
- Agentes: la falta de actor validado falla cerrada; Project Copilot exige hilo del mismo tenant, usuario, agente y proyecto.
- Decisión arquitectónica pendiente: [ADR-046](../../architecture/ADR-046-prometeo-document-grants-private-model-routing.md). No delegar el permiso a etiquetas de visibilidad.

## 4. Datos y migración (expand/contract)

1. **Preflight no destructivo**: hacer inventario de docs con `projectId`, `tenantId` y `orgId` nulos o históricos, comprobar claves duplicadas y leer migraciones activas; obtener backup y SHA/provenance. El índice compuesto `UNIQUE(id,tenantId,projectId)` afecta tabla existente y puede bloquear escrituras mientras se crea en producción; dimensionar timeout, tamaño y ventana.
2. **Expand SQL**: aplicar `20261017213000_prometeo_document_grants` una sola vez en DB staging aislada con Prisma migrations y checksum; crea tabla grant sin backfill, índices, clave única del documento y FK `(documentId,tenantId,projectId)` → `PrometeoDocument` con `ON DELETE CASCADE ON UPDATE RESTRICT`.
3. **Compatibilidad hacia atrás**: la aplicación antigua no escribe grants; la tabla nueva es aditiva, pero **la FK restringe cambios de tenant/proyecto de documentos que tengan grants** incluso si ejecuta código viejo. No permitir despliegues mixtos que dependan de reassociación sin procedimiento validado. Desactivar las rutas de compartición hasta probar aplicación+DB compatible; no asumir que revertir imagen restaura cambios de asociación bloqueados.
4. **Reasociación**: prohibida en S1 para docs con grants. Procedimiento futuro requiere consentimiento vigente, autorización, revocación auditada y operación transaccional deliberada. No eliminar/recrear grants automáticamente para sortear la FK.
5. **Rollback**: primero cerrar endpoints de compartir/revocar y revertir a app anterior, conservar esquema/grants/audit como datos append-only mientras sea seguro; **no ejecutar migración down destructiva ni borrar claves/tabla**. Si una versión anterior falla ante la FK, detener el rollout y hacer forward-fix revisado, no quitar constraint sin decisión/backup. Ensayar app rollback, no rollback de datos, en staging.
6. **Canary**: tenants sintéticos A/B y organización de otro tenant; conferir denegación antes de compartir, concesión limitada, revocación inmediata, concurrencia, FK cross-tenant/cross-project, audit-failure rollback y ningún envío de embeddings/LLM privados a nube.
7. **Promoción**: únicamente después de revisión humana, spec APPROVED + ADR aceptado, CI actual PASS, restore/backup ensayado, aceptación staging y plan de reversión trazable.

## 5. Seguridad y política

- Permisos: `knowledge:write`, propietario u OPS_ADMIN, miembro actual del proyecto; ningún permiso cross-org por solo compartir tenant o proyecto.
- Borrado: documento y evidencia de revocación/eliminación auditados en transacción; fallo de auditoría hace rollback; serializable y reintentos acotados.
- Deny: 404 cross-tenant/inexistente, 403 propietario/org no autorizado, 400 entrada inválida, 409 grants históricos inconsistentes.
- Local-only: RAG, chat con herramientas, evidencia y embeddings privados no pueden usar proveedor externo; ausencia de modelo local provoca respuesta no-acción o FTS degradado.
- Datos previos: revisar `public_training` y promoción de conocimiento (#992) separadamente, con consentimiento/redacción/revocación; no publicar por default.

## 6. Eventos, idempotencia y reconstrucción

- AuditLog transaccional: `prometeo.document_share_granted`, `prometeo.document_share_revoked`, `prometeo.document_share_revoked_by_delete`, `prometeo.document_deleted`.
- Grant duplicado → una concesión activa sin duplicar auditoría; P2002/P2034 se reintentan como transacción completa serializable. Revocación sin grant activo no se declara éxito.
- Outbox/consumers/DLQ: **no especificados ni activados** por esta fase; no inferir garantías de replay desde AuditLog.
- Correlación: requestId; no guardar secretos o texto privado de documentos en auditoría.

## 7. Implementación y verificación

- A: tests negativos (org/tenant/proyecto, revocación, concurrencia, delete cascade, 20k proyectos, LLM/embedding egress).
- B: Prisma, FK compuesta y política SQL acotada; servicio transaccional.
- C: HTTP y permisos; API Surface/SDD/ADR; frontend privado por defecto y UX de compartir por aprobación explícita.
- D: `pnpm spec:validate:strict`, `pnpm spec:index --check`, TS, cobertura, tests PostgreSQL y E2E para HEAD exacto.
- E: resolución de review independiente sin autoaprobar, CI terminal, merge por fases/release gate.
- F: staging dedicado, aplicaciones con SHA, migración, canary autenticado, ensayar rollback, solo después despliegue autorizado.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Grants heredados/visibilidad ambigua | Media | Crítico | deny sin consentimiento | cita/contenido cross-org |
| FK RESTRICT rompe update legacy | Media | Alta | preflight y forward-fix revisado | 409/P2003 en reasociación |
| Escritura de auditoría falla | Media | Crítico | transacción serializable, rollback | grant activo sin audit |
| Modelo local ausente | Alta | Medio | FTS/fallback sin acción, nunca nube | tráfico a provider externo |
| CI o staging no disponible | Media | Alto | mantener PR en REVIEW/draft | ausencia de evidencia terminal |

## 9. Investigación

| Fuente | Hallazgo / decisión |
|---|---|
| Prisma schema y migración en PR #987 | composite FK con RESTRICT exige revisión compatibilidad |
| Codex + revisión SDD/ADR del PR #987 | spec sin aprobación y falta de plan/ADR siguen bloqueantes |
| GitHub Actions | runs anteriores no sustituyen CI del HEAD final |

## 10. Gates

- [x] Archivos/migración/rollback documentados.
- [x] Orden de pruebas y estados de error documentados.
- [ ] Spec/ADR aprobación independiente.
- [ ] Inventario de datos y ensayo de staging.
- [ ] CI final, auditoría de egress, evidencia de rollback y autorización de promoción.
