# Plan — BO-10 task-allocations
- Base: main tras BO-07. Aditivo: tabla `TaskAllocation`; no toca `JobTask`.
- Servicio y controladores junto a cuadrillas (módulo `organizations`).
- Todo tras `SEMSE_TASK_ALLOCATION_ENABLED` (apagado → 404).
- Rollback: apagar el flag; la tabla puede quedar sin uso.
