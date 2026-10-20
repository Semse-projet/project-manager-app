# Tareas — BO-01/03/04 remediación v0.2

**Estado de ejecución:** implementación en #1018; pruebas unitarias, CI y prueba local Redis real registradas. Los ítems combinados siguen vacíos cuando queda alguna condición sin demostrar.

- [x] G0.1 Leer reglas, baseline y hallazgos de #975; conservar contrato de invitación y separar ofertas.
- [x] G0.2 Reconciliar spec/plan/tasks/checklist y corregir la referencia peligrosa a db push.
- [x] G0.3 Aprobación formal del contrato por Samuel el 2026-10-20.
- [ ] G0.4 Verificar en Railway la frontera X-Real-IP/BFF antes de habilitar confianza de ingress. Diseño firmado/Redis implementado; comprobación operacional pendiente.
- [ ] G1.1 Tests rojos: generadores de enlace UI y email usan fragmento, token no aparece en request inicial/query/referrer/telemetría.
- [ ] G1.2 Tests rojos: scrub antes de preview; StrictMode/remount no pierde token; rechazar query legacy y valores ambiguos; recarga exige reabrir enlace.
- [ ] G1.3 Implementar transporte/extracción en memoria y mensajes ES/EN; regresión de preview anónimo y aceptación/registro según flags.
- [ ] G2.1 Tests rojos de usuario multi-org con sesión en empresa distinta de la primera del listado; cero requests al contexto incorrecto.
- [ ] G2.2 Tests de cambio de organización, peticiones fuera de orden y limpieza de enlaces/personas/filas; implementar binding explícito.
- [ ] G2.3 Test de ruta PRO autorizada y WORKER sin permiso; compartir UI sin ampliar middleware de CLIENT.
- [ ] G3.1 Tests rojos BFF: motivo ausente, blanco y >500 → 400 sin llamada upstream; motivo válido enviado sin sustituir.
- [ ] G3.2 Implementar captura/validación de razón real en UI y semse-api; comprobar audit persistido.
- [ ] G4.1 Probar ingress, IP confiable y protección directa API; elegir y documentar rate limiter distribuido.
- [ ] G4.2 Tests anti-spoofing XFF, identidades independientes, límites entre réplicas y caída del store; implementar sin bypass global.
- [ ] G5.1 PostgreSQL sintético: aceptación concurrente/idempotente; otra cuenta/org/tenant; suspendido/revocado no recupera acceso; flag OFF sin efectos.
- [ ] G5.2 Ejecutar build/typecheck/lint/tests y spec:validate:strict en checkout completo; CI SHA actual y revisión independiente.
- [ ] G5.3 Verificar flags/migraciones en entorno autorizado; canary A/B y rollback; registrar evidencia antes de activar.

## Evidencia y pendientes parciales

- G1: utilidad de fragmento/scrub y rechazo legacy/ambiguo probada; UI/correo usan formato fragmento. No se han probado navegador StrictMode, telemetría ni logs históricos; no declarar G1 completo.
- G2/G3: componentes, BFF autenticado, motivo real, contexto y wrapper PRO implementados. Faltan pruebas UI multi-org/carreras y casos BFF de toda la matriz.
- G4.2: Redis real local + dos procesos Nest comprueban cuota atómica, aislamiento de dos identidades firmadas, rutas, XFF no autenticado y caída de store; cold-start corregido con regresión roja→verde. No prueba dos IPs físicas ni ingress Railway, por eso G4.1/G4.2 no cierran el P1 operacional.
- G5.1: aceptación/idempotencia/fallo de auditoría con dobles pasó; PostgreSQL real de owner/ofertas no acredita esta prueba específica de invitaciones.
- G5.2: CI `39385100548` SUCCESS del checkpoint `25cbd26`; revisión independiente y CI del nuevo HEAD requeridos. G5.3 no ejecutado.
