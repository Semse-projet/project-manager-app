# Tareas — Agro ASR SSRF

- [x] S00 Revisar POST/PATCH, reader, intake, StorageService, signed-file access, helper T-053 y AgroFarm.tenantId.
- [x] S01 Redactar DRAFT y criterios contra Issue #911.
- [ ] S02 Aprobar P0 fail-closed, política legacy/tenantless y alcance de ownership.
- [ ] S03 Redactar pruebas unitarias de cero fetch para toda URL arbitraria y casos de procedencia no verificada.
- [ ] S04 Implementar P0 separadamente, sin tocar estados económicos ni añadir un fallback cloud implícito.
- [ ] S05 Auditar todas las rutas que escriben fileUrl (evidence, incident, worker capability y variantes).
- [ ] S06 Inventariar prueba de ownership actual presign→PUT; decidir receipt o assetId con el owner.
- [ ] S07 Formalizar contrato tenant/org/farm/actor/media con DTO Zod, persistencia y migración Prisma aditiva.
- [ ] S08 Escribir pruebas de acceso cruzado, revocación, colisiones y objetos legacy antes del código P1.
- [ ] S09 Implementar P1 y backfill solo de assets verificables; sin URL fetch.
- [ ] S10 Validar re-upload y presentación de mensaje de no verificado en web.
- [ ] S11 Ejecutar pnpm spec:index --check, pnpm spec:validate:strict, workspace, API unit + DB integration + E2E.
- [ ] S12 Merge autorizado, SHA en CI, deploy verificado, smoke auténtico, canary y rollback con evidencia.
- [ ] S13 Actualizar SDD, arquitectura, riesgos y Issue #911; cerrar solo con pruebas productivas.

**Dependencias:** S02 bloquea implementación; S06–S08 preceden P1; S11 precede cualquier merge; S12 antes de VERIFIED.
