# Plan — BO-08 labor-policy
- Base: main tras BO-07. Aditivo: tablas `LaborSchedulePolicy` y `LaborTimeCorrection`; no toca `TimeEntry`.
- Servicio y controladores dentro del módulo `labor-engine`; el cálculo es una función pura.
- Todo tras `SEMSE_LABOR_POLICY_ENABLED` (apagado → 404).
- Rollback: apagar el flag; las tablas nuevas pueden quedar sin uso. Las correcciones ya aprobadas quedan registradas en `TimeEntry.editReason`.
- Activación real bloqueada hasta revisión de Legal/Payroll de OPEN-09.
