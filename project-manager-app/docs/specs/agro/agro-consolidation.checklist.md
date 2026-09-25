# Checklist de entrega — Consolidación Semse Agro

## Seguridad y datos
- [x] Toda ruta nueva tiene `@RequirePermissions` + política de finca
- [x] Quien no es miembro → 404 (no se revela la existencia de la finca); miembro sin permiso → 403
- [x] Sin auto-verificación; capacidades profesionales solo por roles profesionales
- [x] Evidencia validada contra la misma finca
- [x] Relaciones de incidencia validadas contra la misma finca (sin IDOR entre fincas)
- [x] Sin secretos ni `.env` en el diff
- [x] `DEMO_AGRO` sin cambios

## Datos
- [x] Migración 100% aditiva, sin DROP ni cambios de columnas existentes
- [x] Seed idempotente
- [x] `prisma migrate diff` sin drift frente al schema
- [ ] `prisma migrate deploy` en Railway (deploy normal desde `main`)

## Calidad
- [x] Build API + typecheck web + eslint de los archivos tocados
- [x] Tests unitarios nuevos + suites Agro/Prometeo existentes sin regresiones
- [x] Integración HTTP contra Postgres real
- [x] UI en navegador: estados de carga, vacío, error, sin permiso y éxito; viewport móvil
- [ ] CI verde en el PR
- [ ] Activación en producción: no inferida del merge ni del deploy (activation_status INACTIVE)
