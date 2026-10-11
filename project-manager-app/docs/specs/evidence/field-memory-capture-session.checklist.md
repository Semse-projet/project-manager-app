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

## Decisiones que requieren aprobación del propietario
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
- [ ] Spec APPROVED antes de iniciar código, semse-spec:index y strict verdes.
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
