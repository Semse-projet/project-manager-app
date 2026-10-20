# Checklist — BO-01/03/04 v0.2

## Análisis SDD
- [x] Contrato, plan y tareas cubren token, organización, PRO, cancelación y rate limit.
- [x] Preview público existente reconocido; no se declara nuevo arreglo.
- [x] Se eliminaron db push y exclusión contradictoria de registro ya implementado.
- [x] Se conservan permisos existentes de invitaciones sin importar restricciones de ofertas.
- [ ] Aprobación formal SDD; selección/validación de frontera de rate limit.

## Gates de implementación/entrega
- [ ] Tests rojos registrados antes de cada cambio de negocio.
- [ ] Token fuera de query, logs, storage del navegador y capturas; formato UI/correo coincidente.
- [ ] Scrub previo a requests; StrictMode estable; query legacy rotada, no aceptada silenciosamente.
- [ ] Organización explícita; ninguna selección orgs[0]; requests obsoletos descartados.
- [ ] Ruta accesible para PRO autorizado; backend sigue denegando roles sin permiso.
- [ ] Motivo de cancelación real, validado en BFF/API y auditado.
- [ ] IP confiable sin spoofing; límites compartidos entre réplicas y no globales para todos los clientes BFF.
- [ ] Aislamiento, concurrencia/idempotencia y flag OFF demostrados con PostgreSQL.
- [ ] Registro/email solo bajo flags exigidos y sin devolver token al invitador.
- [ ] spec:validate:strict, typecheck/build/lint/tests y CI del SHA de implementación.
- [ ] Revisión independiente, migraciones reconciliadas y canary sintético antes de activar.

Los checks vacíos son pendientes reales. Una revisión estática no los marca como pruebas ejecutadas.
