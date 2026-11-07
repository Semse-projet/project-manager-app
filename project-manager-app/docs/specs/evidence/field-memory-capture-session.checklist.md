---
type: checklist
feature: "field-memory-capture-session"
spec: "docs/specs/evidence/field-memory-capture-session.spec.md"
version: "2.0"
date: "2026-10-11"
---

# Checklist de aprobación: Field Memory CAP-0

## Decisiones aprobadas por el propietario (2026-10-11)

- [x] Reglas conservadoras definidas: no capturar sin permiso de obra, lectura bajo Evidence policy, supervisor con membership, no auto-aprobación ni acceso externo por defecto.
- [x] Retención requiere política por proyecto; sin ella no hay publicación ni purga automática; legal hold preserva originales.
- [x] Sincronización offline no incluida en CAP-1 hasta disponer de protección e idempotencia verificables.

## Decisiones de producto aprobadas (control operativo todavía requerido)
- [x] Derechos: autorización explícita de obra/GC y tratamiento de personas visibles; fallar cerrado si no constan.
- [x] Retención: configurable por derechos del proyecto; sin valor vigente se bloquea la publicación y purga automática; no asumir período legal universal.
- [x] Acceso: cliente y PRO asignado sólo si Evidence policy y rightsPolicyRef lo permiten; terceros denegados por defecto.
- [x] Revisor: supervisor/inspector o representante del cliente explícitamente autorizado; SUBMITTED no es VERIFIED.
- [x] Offline: excluido de CAP-1; no sincronización ni asociación sin revalidación online.

## Requisitos y seguridad
- [ ] Tenant, org, job, project y milestone coherentes y autorizados en cada endpoint.
- [ ] Foto registrada en Evidence con bytes reales, checksum, Provenance y permisos; jamás objeto URL del navegador como evidencia.
- [ ] Original inmutable; derivados independientes; estados CLAIMED no autorizan perforación.
- [ ] Signed read en enforce con secreto, TTL, acceso por recurso/org y pruebas de móvil/vision.
- [ ] Al revocar membership se deniegan manifest/miniaturas/descargas.
- [ ] No rutas BFF con fallback a identidad de servicio para usuario anónimo.

## Datos/eventos/rollout
- [ ] API contract, Zod schemas, índices únicos y FK revisados.
- [ ] Transacción + outbox atómico, idem-key y replay/correlación.
- [ ] Prisma migración aditiva, checksum, estrategia forward-fix y rollback sin destruir originales.
- [ ] Snapshot de prod y prueba de restore de volumen/backup documentados.
- [ ] Feature flag OFF, allowlist y canary con 2 tenants y 2 organizaciones.
- [ ] Investigación de tres fuentes primarias y decisiones aplicado/backlog/descartado registrada.

## Entrega
- [ ] Spec APPROVED y `spec:index:check`/`spec:validate:strict` deben aprobar CI del **head actual**; el contrato está aprobado y el índice fue regenerado, pero este gate requiere CI terminal.
- [ ] Tests red/green, build, lint, auth E2E y CI verde.
- [ ] PR merge y SHA, deploy, canary y activación con evidencia separada.
- [ ] No marcar VERIFIED por un simple Railway SUCCESS.

## Evidencia y dinero
- [x] Especificación prohíbe tratar evidencias, fotos, panoramas, modelos 3D o resultados IA como aprobación automática.
- [x] Contrato establece que no hay efectos de release en Payment Governance; código no implementado.

## Documentación
- [ ] Al implementar endpoints/eventos nuevos actualizar `docs/architecture/SEMSE_API_SURFACE_V1.md` y `docs/foundation/EVENT_CATALOG.md` con nombres `capture_session.*.v1` antes del merge de código.
- [x] Se citan ADR-028, ADR-022 y tres fuentes primarias; el spec index refleja APPROVED.
- [x] Analyze SDD: reconciliación del boundary Evidence, catálogo aggregate.action, permisos, idempotencia y propiedad original; sin nuevas entidades en runtime.
- [ ] Analizar diff de implementación y cobertura E2E real antes de activar.

**Referencia de autorización CAP-0:** https://github.com/Semse-projet/project-manager-app/pull/872#issuecomment-6114318002 — no constituye firma legal del GC ni consentimiento de personas visibles.


## Gate P0 T-008 — Write-quiescence & recovery, 2026-10-15 (issue #954)

Este checklist describe **criterios de aceptación**, no verificaciones ejecutadas. El contrato aprobado CAP-0 permite planificar la barrera, pero la ventana real y el acceso a originales requieren controles independientes.

### Arquitectura y cobertura
- [ ] Censo de servicios, procesos, mounts y writers productivos; incluir StorageService.store/delete, plan y PUT, Browser Agent, Evidence register, multipart create/parts/complete y mutaciones de referencias; identificar rutas fuera del gate.
- [ ] Postgres gate duradero, transición/admision atómica y registro por operación activa; sin fallbacks a memoria o Redis cuando falla autoridad.
- [ ] \`DRAINING\` rechaza escrituras nuevas; un writer en curso no puede publicar después de certificado \`FROZEN\`.
- [ ] Ningún heartbeat vencido permite limpiar \`ACTIVE\` sin probar terminación/fencing del escritor; fallos/restarts bloquean freeze.
- [ ] API/operador administrativo sin acceso público, autorización efectiva + motivo + idempotencia + audit trail, sin secretos en logs.
- [ ] Prohibida activación de freeze con versiones viejas o procesos no instrumentados; rollback documentado sin abrir writes.

### Validación automatizada y staging
- [ ] Tests de carrera admission vs drain y publish vs freeze, dos procesos/réplicas, reintento, DB offline, freeze bloqueado ante active huérfana, thaw explícito y multipart temporal.
- [ ] Evidencia Postgres consistente y sin referencias Evidence creadas durante FROZEN; diferenciar huérfanos históricos/in-flight.
- [ ] Prueba E2E sintética 2 tenants/2 orgs, actor revocado y permisos. Ningún byte de usuario real llega a GitHub Actions.
- [ ] Exact head SHA: TS/lint/unit/integration/e2e/security/CI verdes; SDD index y spec:validate:strict pasan.

### Producción y recuperación
- [ ] Merge autorizado y Railway SHA exacto del nuevo gate verificado: salud, logs, modo OPEN, todas las instancias protegidas.
- [ ] Ventana efectiva FROZEN verificada, zero-active y fuente íntegra, sin suspender servicios no involucrados.
- [ ] BitLocker D: On 100 %, ACL privado y clave recovery fuera de D: confirmados por operador; no publicar clave.
- [ ] Manifest SHA-256 antes/después, exportación fuera de Git + restore aislado con recuento positivo, 0 faltantes/alterados/sobrantes.
- [ ] Evidencia/Postgres en la misma frontera temporal, reconcilia checksum de bytes del servidor, tenant/org y retención.
- [ ] Backup gestionado Railway identificado con fecha/retención y restauración probada en destino aislado; no usar Restore en producción.
- [ ] CAP-1 sigue INACTIVE salvo autorización independiente y cumplimiento del resto de la spec.

**No reportar VERIFIED:** tests de herramienta, preflight local/remoto, BitLocker o Railway SUCCESS no equivalen a congelación de bytes y DB ni a recuperación integral.


## T-008 OPEN-only producción — enmienda SDD en REVIEW (2026-10-25)

**Todos los puntos siguientes siguen sin aprobación de go-live.** Código propuesto y CI verde no sustituyen una decisión del propietario ni revisión independiente.

- [ ] Aprobación expresa del propietario para ampliar §12.6 de solo staging a producción OPEN-only.
- [ ] Revisión independiente de seguridad del P1 sobre colisión de scopes entre staging y producción, con dos ambientes y mismo root.
- [ ] Scope productivo compuesto de RAILWAY_PROJECT_ID + RAILWAY_ENVIRONMENT_ID + SEMSE_STORAGE_ROOT; IDs ausentes o malformados bloquean runtime y control.
- [ ] Controlar migración de scope de staging sin copiar ACTIVE, epoch o coverage desde filas legacy y sin encender un gate nuevo que ignore operaciones en curso.
- [ ] Revisión independiente del P1 sobre contradicción del SDD; actualización de contrato marcada REVIEW hasta que el propietario apruebe.
- [ ] Confirmar en DB efímera que el servicio staging no puede mutar el scope productivo por accidente.
- [ ] Canary productivo solo después de esa aprobación y operador autenticado; ninguna transición DRAINING/FROZEN/THAW/RECOVER autoriza este slice.
- [ ] Registrar CI exacto, revisión/merge SHA, deploy/health y activación como evidencias separadas, sin marcar CAP-1 ni fotos restauradas.
