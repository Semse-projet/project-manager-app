---
type: checklist
feature: "field-memory-capture-session"
spec: "docs/specs/evidence/field-memory-capture-session.spec.md"
version: "2.0"
date: "2026-10-11"
---

# Checklist de aprobación: Field Memory CAP-0

## Decisiones que requieren aprobación del propietario
- [ ] Derechos de capturar imágenes en obra del GC/empleador y consentimiento de personas visibles.
- [ ] Política de retención, exportación y borrado legal: ¿cuánto se conservan originales y quién autoriza?
- [ ] Alcance de organizaciones: ¿cliente puede ver originales del profesional? ¿en qué estados?
- [ ] Responsable de revisar una captura antes del sheetrock (no confundir SUBMITTED con VERIFIED).
- [ ] Actuación cuando una sesión se captura sin red y se sincroniza días después.

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
