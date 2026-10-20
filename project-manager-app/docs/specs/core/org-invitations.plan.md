# Plan — BO-01/03/04 remediación v0.2

**Estado:** contrato y plan aprobados por Samuel el 2026-10-20; implementación en #1018. Fases descritas como secuencia de trabajo, con ejecución real y pendientes en tareas/checklist. No repetir decisiones ya ratificadas.

## Fases y dependencias

1. **G0 / gobierno:** reconciliar spec, plan, tareas y checklist; aprobación formal antes de código. No usar CI histórico de #975 como validación de esta remediación.
2. **G1 / token:** inventariar productores UI/correo y consumidores; escribir tests antes de sustituir query por fragmento. Utilidad compartida de formato/extracción, memoria del componente vivo, scrub inmediato y tolerancia a StrictMode. Enlaces query legacy se rechazan y solicitan reenvío; no imprimirlos en errores. No tocar tokens persistidos ni capturar secretos en screenshots.
3. **G2 / organización:** resolver contexto desde sesión autenticada/endpoint existente, mostrar empresa y usar únicamente ese contexto validado. No inventar un endpoint de selección. Si el proyecto no expone contexto suficiente, preparar el contrato mínimo aparte antes de implementar. Limpiar estado y descartar respuestas obsoletas al cambiar de org. Componente de gestión compartido y wrapper `/worker/team` para PRO, respetando middleware/RBAC existente.
4. **G3 / cancelación:** formulario accesible ES/EN con motivo 1–500 caracteres; función semse-api exige argumento; BFF valida y rechaza antes de fetch; API conserva validación y auditoría.
5. **G4 / rate limit:** verificar topología antes de elegir mecanismo. Inventariar ingress real, API accesible directamente, proxy hops, campos confiables y Redis disponible. Selección propuesta: límite distribuido en la primera frontera de confianza verificable, conservando protección directa del API. Si se transmite identidad al API, usar aserción de proxy autenticada, de vida corta y ligada a método/ruta, rechazando la cabecera del cliente. Documentar gestión/rotación del secreto en diseño separado; no crearlo ni cambiar producción en este PR. Evitar confianza global de XFF y contadores locales. Sin prueba de frontera, G4 queda bloqueado, sin deshabilitar controles para avanzar.
6. **G5 / aceptación:** pruebas unitarias, BFF, PostgreSQL y navegador con cuentas sintéticas; CI del SHA actual, revisión independiente y despliegue bajo flags OFF; luego canary separado autorizado.

G1, G2 y G3 pueden implementarse en PRs pequeños después de G0; G4 no debe bloquear su desarrollo independiente. Activación requiere los cuatro controles cerrados.

## Datos, eventos y compatibilidad

No se edita schema ni migración histórica por G1–G3. `OrgInvitation` ya tiene migración versionada; comprobar estado aplicado con migrate status. Usar migrate deploy para migraciones aprobadas; nunca db push/reset en producción. No inventar eventos: conservar catálogo existente y registrar cambios nuevos antes de código. No reactivar invitaciones canceladas o membresías suspendidas durante rollback.

## Observabilidad y rollback

Medir fallos por operación, 429 y errores de entrega sin token ni correo completo en logs. Distinguir errores de infraestructura de invitación inválida en métricas internas, manteniendo mensaje externo neutro. Revertir código y apagar flags bajo autorización operacional; no borrar filas ni restaurar permisos. Rotar enlaces antiguos mediante reenvío; no afirmar borrados logs históricos. Rate limit debe probar aislamiento entre dos IP confiables y dos réplicas antes de cerrar el P1.
