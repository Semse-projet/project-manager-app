# Checklist — OPEN-18

- [x] Con el flag apagado, el contrato anterior no cambia (AC-01; unit).
- [x] Una obra sin ubicación verificada nunca da AUTO_START_ALLOWED (AC-02; política + servicio).
- [x] Solo un pin manual o una captura en sitio, con fecha y autor, cuentan como verificadas (AC-03).
- [x] Un solo vínculo ACTIVE por objetivo, garantizado en la base (AC-04; PG-01).
- [x] Sin alcance → IGNORE, sin oráculo de existencia: tenant, Org, WORKER ACTIVE, Job asignado, proyecto propio (AC-05).
- [x] ResourceScope en la gestión de vínculos de Jobs; proyecto libre solo de su creador (Q1).
- [x] El servidor no guarda coordenadas de la persona; la auditoría no lleva coordenadas.
- [x] `proximity_auto` exige una decisión vigente, del mismo sitio y no consumida; se consume una sola vez (AC-08; PG-03).
- [x] Membresía revocada o vínculo terminado invalidan las decisiones pendientes (AC-10).
- [x] Eventos registrados en `EVENT_CATALOG.md`.
- [x] Migración aditiva, sin backfill; `TimeEntry` intacto; rollback documentado.
- [ ] Clientes adaptados antes de encender el flag (W-07).
- [ ] CI verde y revisión independiente.
- [ ] Staging aislado con autorización (W-09).
- [ ] Gate 5 en el Motorola y en ambos iPhone (W-10).
