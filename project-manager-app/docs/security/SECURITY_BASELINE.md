# Security Baseline

## Application
- TypeScript strict + input validation con Zod en todas las fronteras.
- RBAC por tenant/org/role, deny-by-default.
- Cookies `HttpOnly`, `Secure`, `SameSite=Lax`.
- CSRF token en mutaciones web.
- Rate limit por IP + user + tenant.
- Sanitización y límites de upload (tipo, tamaño, recuento).

## Data
- Cifrado at-rest en DB y bucket.
- TLS en tránsito.
- Auditoría append-only para acciones sensibles.
- Política de retención por tipo de dato (PII, evidencia, logs).

## Infrastructure
- Secret manager (no secretos en repo).
- Escaneo de dependencias y SAST en CI.
- Backups automáticos y pruebas de restore.

## Payments / Webhooks
- Verificación de firma de webhook.
- Idempotency keys en operaciones monetarias.
- Reconciliación diaria de transacciones.
