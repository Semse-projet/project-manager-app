# Plan — BO-11 daily-reports
- Base: main tras BO-07. Aditivo: tabla `DailyReport`; no toca `TimeEntry` ni `JobTask`.
- Módulo propio `daily-reports`, sin dependencia de BO-08/BO-10.
- Todo tras `SEMSE_DAILY_REPORTS_ENABLED` (apagado → 404).
- Rollback: apagar el flag; la tabla puede quedar sin uso.
