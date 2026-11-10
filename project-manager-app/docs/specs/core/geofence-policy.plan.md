# Plan — BO-09 geofence-policy (servidor)
- Base: main tras BO-13. Aditivo: `LocationPreference` y `GeofenceEvent`; no toca `TimeEntry`.
- Módulo propio `geofence`. La decisión es una función pura; el servicio solo reúne el contexto (preferencia, obra, sesión activa, enfriamiento).
- Todo tras `SEMSE_GEOFENCE_POLICY_ENABLED` (apagado → 404).
- Rollback: apagar el flag; las tablas pueden quedar sin uso.
- NO CERRADO hasta probar en dispositivos iOS y Android.
