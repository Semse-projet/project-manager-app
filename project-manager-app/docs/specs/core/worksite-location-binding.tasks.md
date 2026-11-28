# Tasks — OPEN-18

| ID | Tarea | Gate | Estado |
|---|---|---|---|
| W-01 | Spec DRAFT con contrato, migración, compatibilidad, pruebas y rollback | aprobación del propietario | hecho 2026-11-20 |
| W-02 | Plan, tasks y checklist; spec a APPROVED v0.2 | spec:validate:strict | hecho |
| W-03 | Tests antes del código: unitarios AC-01…AC-10 y PostgreSQL PG-01…PG-04 | unit + integración | hecho |
| W-04 | Esquema + migración aditiva + CHECK; sin deriva propia en `migrate diff` | prisma validate + PG | hecho |
| W-05 | Regla de sitio compartida, gestión de ubicación y vínculos, evaluación con `site`, lista de sitios | build + unit | hecho |
| W-06 | AC-08: consumo de la decisión al iniciar `proximity_auto` (transacción) | unit + PG-03 | hecho |
| W-07 | Clientes web y móvil: `geofence-sites`, `site` en el evento y `geofenceEventId` al iniciar | unit web + jest móvil | hecho: #1172 fusionado (`main@384859ff`); falta probarlo en staging y en dispositivos |
| W-08 | CI verde, revisión y merge con autorización | humano | hecho: #1168 (`bc127c90`) y #1172 (`384859ff`), fusionados por el propietario |
| W-09 | Migración y flag en staging aislado (no producción) | autorización del propietario | migración y flags hechos en staging; falta sembrar los datos (pendiente de coordenadas y correos) |
| W-10 | Gate 5: llegada real a una obra verificada en el Motorola y en ambos iPhone | dispositivo físico | pendiente |
| W-11 | v0.3: AC-11 (solo Org de la sesión) y AC-12…AC-14 (clientes), a partir de la revisión de #1172 | unit API + web + jest móvil | en curso (rama `claude/open18-followup`) |
