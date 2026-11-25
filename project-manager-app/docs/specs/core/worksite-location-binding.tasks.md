# Tasks — OPEN-18

| ID | Tarea | Gate | Estado |
|---|---|---|---|
| W-01 | Spec DRAFT con contrato, migración, compatibilidad, pruebas y rollback | aprobación del propietario | hecho 2026-11-20 |
| W-02 | Plan, tasks y checklist; spec a APPROVED v0.2 | spec:validate:strict | hecho |
| W-03 | Tests antes del código: unitarios AC-01…AC-10 y PostgreSQL PG-01…PG-04 | unit + integración | hecho |
| W-04 | Esquema + migración aditiva + CHECK; sin deriva propia en `migrate diff` | prisma validate + PG | hecho |
| W-05 | Regla de sitio compartida, gestión de ubicación y vínculos, evaluación con `site`, lista de sitios | build + unit | hecho |
| W-06 | AC-08: consumo de la decisión al iniciar `proximity_auto` (transacción) | unit + PG-03 | hecho |
| W-07 | Clientes web y móvil: `geofence-sites`, `site` en el evento y `geofenceEventId` al iniciar | unit web + jest móvil | código hecho (rama `claude/open18-clients`, apilada sobre #1169 y #1168); falta probarlo en staging y en dispositivos |
| W-08 | CI verde, revisión y merge con autorización | humano | pendiente |
| W-09 | Migración y flag en staging aislado (no producción) | autorización del propietario | pendiente |
| W-10 | Gate 5: llegada real a una obra verificada en el Motorola y en ambos iPhone | dispositivo físico | pendiente |
