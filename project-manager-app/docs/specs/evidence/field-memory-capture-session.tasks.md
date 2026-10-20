---
type: tasks
feature: "field-memory-capture-session"
domain: "evidence"
plan: "docs/specs/evidence/field-memory-capture-session.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/field-memory-capture-session"
date: "2026-10-11"
---

# Tasks: CaptureSession CAP-0 / CAP-1

## Fase 0 — Gobierno y permisos
- [x] T-001 Aprobación del contrato CAP-0 y definición de derechos por defecto (2026-10-11); investigación de OWASP, Prisma y COLMAP registrada.
- [ ] T-002 Completar estado final PR #870/#871, smoke de dos orgs y verificar sin drift.
- [ ] T-003 Verificar modo de signed GET, secreto, retención y restauración de volúmenes; rollout shadow/enforce de spec ya APPROVED.
- [ ] T-004 Reconciliar Evidence policy con usuario supervisor, cliente, pro y organización no asignada.
- [ ] T-005 Registrar decisiones abiertas en checklist y revisar SPEC_INDEX.

## Fase 1 — Tests y contratos
- [ ] T-010 Tests rojos para actor externo/misma tenant otra Org/revocación/IDs contradictorios.
- [ ] T-011 Tests rojos para sesión sin fotos, attach a otro proyecto, Evidence sin bytes y firma caducada.
- [ ] T-012 Tests idempotencia/reintento y respuesta 409 sin duplicar outbox.
- [ ] T-013 Contratos Zod + Event Catalog y provenance/hashes sin datos inventados.

## Fase 2 — Datos y API
- [ ] T-020 Prisma schema aditivo + migración forward only / índices / FK.
- [ ] T-021 Postgres real: atomicidad, concurrencia, tenant y actor permissions.
- [ ] T-022 Servicio/repository CAP-1 con `EvidenceRepository` dueño de fuente.
- [ ] T-023 API/BFF autenticada y paginada, auditoría, pruebas HTTP contra bearer real.
- [ ] T-024 Outbox eventos create/attach/submit con correlation y replay seguros.

## Fase 3 — UI/móvil
- [ ] T-030 Reutilizar Workspace y worker/evidence con contexto visible.
- [ ] T-031 Subir bytes primero → registrar Evidence → attach sesión, con errores visibles.
- [ ] T-032 Ver fotografías originales solo con autorización/URL corta.
- [ ] T-033 Manejar sin imágenes, off-line, reintentos, errores y revocaciones.

## Fase 4 — Release y verificación
- [ ] T-040 Code/test/typecheck/lint/spec:validate:strict y spec:index.
- [ ] T-041 CI y revisión de seguridad → merge SHA.
- [ ] T-042 Deploy migración y services, flag OFF.
- [ ] T-043 Canary interno autentificado con dos organizaciones, sin fugas.
- [ ] T-044 Restauración probada de originales, métricas y rollback.
- [ ] T-045 Actualizar `production_evidence`, flags, estados y reportes; NO marcar VERIFIED antes de validarlo.


## Fase 0B — Hallazgos P0 de custodia (auditoría 2026-10-13)
- [ ] T-006 Leer estado real de snapshots Railway: backup del volumen API COMPLETED, referencia/fecha/retención; nunca pulsar Restore de semse-API para un drill.
- [ ] T-007 Ejecutar preflight REAL en contenedor API: SEMSE_STORAGE_ROOT en volumen /data y negar fallback /tmp en producción. Registrar provenance de SHA deploy/mount.
- [ ] T-008 Diseñar e implementar barrera de escrituras/snapshot coherente para original + Evidence/Postgres. **PARTIAL**: control plane durable implementado; staging multiinstancia con freeze/fencing/thaw y export/restore sintético ya verificado. Producción sigue sin freeze: el canary OPEN-only se prepara en PR #1014 y requiere CI/revisión independiente antes de activarse.
  - [x] T-008a Estado durable `OPEN → DRAINING → FROZEN → OPEN`, admission ledger y fencing por epoch/ACTIVE tickets bajo PostgreSQL row lock.
  - [x] T-008b Mutaciones administrativas completas siguen **staging-only** con permiso dedicado `ops:storage-write-gate:manage` exclusivo de `OPS_ADMIN`. PR #1014 añade solo canary productivo OPEN-only: `observe`/`provision`, sin valor productivo que habilite drain/freeze/thaw/recovery; la capa baja de transición también rechaza producción.
  - [x] T-008c Idempotencia durable serializada bajo el mismo gate lock, atestación fresca de writer coverage por ciclo y `window-closed` obligatoriamente posterior a `FROZEN` para `THAW`.
  - [x] T-008d Recovery explícito de operación ACTIVE a `RECOVERED_FENCED` solo en `DRAINING`, con `terminationEvidenceDigest`; ningún TTL/reloj libera tickets zombie.
  - [x] T-008e Pruebas PostgreSQL reales de control plane, carrera de reintentos concurrentes, recovery/fencing, migración, RBAC, API Integration y E2E. Head de implementación `45e4ac6c21ec3005c0873c3b2427efdf50355163` pasó CI/API Integration/Autonomy/Operación Asistida/ResourceScope antes de esta actualización documental; el SHA final debe revalidarse.
  - [x] T-008f Staging real completado con 2 APIs + Postgres + Redis + runner y storage sintético: writer en vuelo, freeze bloqueado con ACTIVE, recovery `RECOVERED_FENCED`, 503 bajo FROZEN, thaw seguro, Signed GET 403/200 y export/restore sintético con SHA-256 coincidente. Evidencia: #954, runs `T008CLOSE20261019B` y `T008RESTORE20261019A`.
  - [ ] T-008g Completar inventario exhaustivo de writers sobre originales/multipart/Evidence/Browser Agent/cron/operator y demostrar provenance de todas las instancias; un writer no instrumentado invalida FROZEN.
  - [ ] T-008h Merge + deploy desde `main` manteniendo `SEMSE_STORAGE_WRITE_GATE_MODE` OFF/no configurado en producción; verificar SHA, migración, health, logs y canary sin provocar freeze productivo.
  - [ ] T-008i Ventana productiva aprobada: freeze auditable real de todos los writers, inventarios/Evidence consistentes, export/restore aislado y thaw explícito. Solo entonces evaluar VERIFIED.
- [ ] T-009 Implementar digest SHA-256 calculado **del lado servidor** con bytes reales e inmutabilidad transaccional Evidence; checksum nullable/legacy sigue UNVERIFIED. Test cambio de contenido y concurrencia.
- [ ] T-009A Evaluar signed GET para originales privados. **PARTIAL**: producción tiene `UPLOADS_SIGNING_SECRET` sellado y `UPLOADS_SIGNED_GET_MODE=shadow` desde deployment `93e9f3c7-3337-4ef5-a061-f2b556e1b7b5`; probe sintético sin archivo real confirmó unsigned shadow → 404 e invalid signature → 403. Falta observar ≥7 días y validar consumidores browser/móvil/Vision/agentes antes de `enforce`; CAP-1 no se activa mientras este gate siga parcial.
- [ ] T-009B Persistir provenance/audit de originales, owner org, derechos y retención/legal hold; derived 3D/360 referencia original por id + SHA y versionado.

## Fase 1B — Pruebas de recuperación y reconciliación reales
- [ ] T-014 Hacer exportación cifrada desde Railway SSH con 2 snapshots SHA antes/después, mismo scope; CLI integrated field-memory-custody-gate requiere ventana sin escrituras y evita PASS ante divergencia.
- [ ] T-015 Leer proyección Evidence desde transacción Postgres consistente, con id/tenantId/projectId/bucketKey/checksum server-side; ejecutar field-memory-evidence-reconcile sobre directorio cifrado; 0 faltantes/duplicados/cross-tenant.
- [ ] T-016 E2E de API/DB HTTP autenticado con Org A cliente, Org A pro, Org B dentro del mismo tenant, supervisor sin membership, usuario revocado y OPS_ADMIN auditado; exigir 401/403/404 coherentes y 0 bytes filtrados.
- [ ] T-017 Verificar restauración en entorno aislado, apertura de foto recuperada con autorización, RPO/RTO, expiración URLs y rollback; no confundir offsite PASS y native backup RESTORE.
- [ ] T-018 Validar manifiestos, reporting y almacenamiento offsite con amenazas symlink, edición concurrente, files faltantes, hashes iguales después de corrupción, fallos SSH, archivo parcial y backup vacío.

## Fase 3B — Usabilidad de campo y transparencia de estados
- [ ] T-034 UX: Captured local, Uploading, Original stored, Evidence registered, Submitted, Human verified, Restored; no mostrar "respaldado" por un simple PUT o snapshot creado.
- [ ] T-035 UI de fallos: errores 409, falta de conectividad, presign caducado, checksum mismatch, retención/consentimiento no autorizado; acceso claro a reintentos con nonce nuevo y salida no destructiva.
- [ ] T-036 Dashboard Ops: Backups CREATED/INSPECTED, Offsite VERIFIED, Railway native UNTESTED, Evidence NOT ATTESTED y bloqueos de activación sin exponer keys.
- [ ] T-037 Aplicar derechos del GC, privacidad de personas fotografiadas, retención por proyecto y legal hold; consentimiento no se infiere de la acción de subir.

## Cierre extendido del producto AAAA (NO asumir completado)
- [ ] T-046 No activar CaptureSession hasta que T-006..T-018 y T-034..T-037 tengan evidencia de aceptación real (no solo CI o deploy SUCCESS).
- [ ] T-047 Antes de GPU/reconstrucción 3D: vincular entrada solo a Evidence original server-verified, consentimiento autorizado, outputs como derivados no económicos y lineage reversible.
- [ ] T-048 Documentar canary 2+ orgs, métricas RPO/RTO, ownership, revocación, restore drill trimestral/periodicidad aprobada y acciones de fallo.
