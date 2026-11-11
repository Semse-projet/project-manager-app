# Plan — BO-13 prometeo-business-os
- Base: main tras BO-12. Sin esquema ni migración.
- `BusinessOsToolsService` dentro del módulo de Prometeo; descriptores añadidos al registro existente; casos nuevos en `executeReadTool`.
- Parámetro `@Optional()` en el ejecutor: si falta, las herramientas quedan bloqueadas y el arranque no se rompe.
- Todo tras `SEMSE_PROMETEO_BUSINESS_OS_ENABLED` (apagado → bloqueo auditado).
- Rollback: apagar el flag.
