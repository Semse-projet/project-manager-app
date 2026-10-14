# Plan P0 — Agro ASR SSRF

1. Tests primero: actualizar expectativas T-054 y añadir checks de rechazo de URLs, ausencia de llamadas provider y no fetch.
2. Modificar resolveText para rechazar AUDIO con fileUrl sin proof-of-custody, manteniendo text manual.
3. Hacer fail-closed en HttpUrlStorageReader legacy para que no pueda descargar URLs.
4. No cambiar el provider de Contributor Program, Evidence FSM, Prisma, Worker o Railway.
5. Validar pnpm spec:index:check, pnpm spec:validate:strict, build API y cobertura/CI en el commit correcto.
6. Revisar impacto de degradación ASR AUDIO y solicitar aprobación de merge. Implementar P1 de vinculación de custodia en otro PR.

Rollback de P0 no debe devolver fetch arbitrario; priorizar forward-fix o desactivar ASR.
