# DEC-R1 v0.3 — análisis de consistencia

La aclaración AC-13–15 concreta AC-04/05/10 y la autorización por recurso aprobada. No añade una capacidad nueva. El rol global de la sesión sigue pasando por el guard, y se intersecta con la autoridad efectiva de la organización objetivo; no modifica Org del JWT.

Prueba previa reproduce cuatro fallos: acceso a detalle/miembros por rol de otra Org, listado sobrepermisivo, rol retirado que sigue autorizando y falta de selección limitada de roles. El cambio conserva 404 por tenant/ausencia de membership, 403 por permiso, lectura sin upserts y DTO sin roles internos. Sin migraciones, nuevos roles, eventos o flags. OPS_ADMIN mantiene su excepción de tenant existente.

La autoridad normativa no se modifica. La aprobación DEC-R1 del dueño se conserva y el estado de producción del fundamento v0.2 se distingue de la entrega v0.3. Evidencia, pruebas y límites: `docs/reportes/2026-10-12-dec-r1-target-org-verification.md`.

Pendientes: CI de este PR, full build/SDD strict en checkout completo, integración PostgreSQL/HTTP, identidad worker y canary BFF. No declarar que el health 200 certifica permisos ni que un job sin steps es un test fallido.
