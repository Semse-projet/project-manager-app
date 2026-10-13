# Checklist — Agro ASR SSRF

## Autorización / custodia
- [ ] Spec aprobada por owner según AGENTS.md.
- [ ] GET ASR no hace HTTP fetch de fileUrl controlada por usuario; ninguna red saliente antes de autorizar.
- [ ] Solo StorageService u objeto custodiado con receipt verificado; key o URL aislada no implica ownership.
- [ ] Verificar actor, rol ACTIVE de finca, permiso, farmId, tenantId, orgId y vínculo asset-farm.
- [ ] Finca sin tenant y archivo legacy sin origen verificable: fallo cerrado, no inferir permisos.
- [ ] Revocación de permisos antes de consumo deniega correctamente.
- [ ] No cruces tenant, org mismo tenant, finca, evidencia, uploader ni sesión.
- [ ] Sin URLs arbitrarias en readers; localhost/metadata/IPv6/redirect/DNS/streams rechazados sin conexión.

## UX y regresión
- [ ] El usuario puede usar texto manual si no existe ASR verificado.
- [ ] No inventar transcripciones ante silencio o error.
- [ ] PHOTO, VIDEO, DOCUMENT y EXTERNAL_URL mantienen comportamiento permitido; EXTERNAL_URL nunca ASR.
- [ ] Presign→PUT→receipt→propuesta→revisión humana probado con archivo real.
- [ ] POST/PATCH e incident/worker-capability revisados para bypass.
- [ ] MIME/bytes, tamaño, duración, cuotas, timeouts y errores de storage controlados.
- [ ] No exponer rutas internas, cookies, firmas o bytes en logs/errores.

## Release
- [ ] Migración Prisma aditiva probada + rollback/forward-fix cuando aplique.
- [ ] Tests primero; CI quality-gates, cobertura y E2E PASS sobre el mismo SHA.
- [ ] pnpm spec:index --check y pnpm spec:validate:strict PASS.
- [ ] Deploy real validado, flags, canary autenticado, observabilidad y rollback comprobados.
- [ ] Actualizar spec a VERIFIED **solo** con evidencia reproducible; cerrar Issue #911 después.
