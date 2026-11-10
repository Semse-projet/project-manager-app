# Agents Smoke Test — Solo API local aislada

Este smoke es una **prueba sintética local** del contrato firmado.
No verifica un Worker BullMQ real, Redis, provisión de identidad,
reclamos en producción ni exactly-once.

## Recorrido protegido
1. Crear run con identidad sintética de test.
2. Reclamar **el runId específico**, obtener `claimToken` en memoria.
3. Confirmar `/start` con `workerId`, `expectedAttempts` y `claimToken`.
4. Enviar `/heartbeat` con la misma capacidad.
5. Completar con la misma capacidad.
6. Verificar `status=completed`.
7. Ejecutar un barrido de recuperación.

El token nunca se imprime ni se recupera del GET del run.
El script falla ante HTTP distinto de 2xx, respuesta inválida o
runId/estado no coincidente. Solo acepta http://localhost o
http://127.0.0.1; la API de test debe ejecutar
`NODE_ENV=test SEMSE_ALLOW_HEADER_IDENTITY=true` de forma explícita.

```bash
SEMSE_API_URL=http://localhost:4000 \
SEMSE_ROLES=OPS_ADMIN,AGENT_RUNNER \
./scripts/agent-flow-smoke.sh
```

Los roles combinados solo representan una sesión **sintética de prueba**
en loopback. No se debe crear un usuario humano con esos roles.
El runtime real requiere una identidad de servicio separada y membresía
`AGENT_RUNNER` activada mediante el procedimiento autorizado
`scripts/ops/ensure-worker-service-membership.mjs` (dry-run primero).
Ese script no modifica la BD sin `--apply`, y nunca debe usarse
sin la aprobación operativa correspondiente.

Pendientes de producción: prueba conjunta API+Worker+Redis+PostgreSQL
en staging, revisión del HEAD exacto, segunda revisión y autorización
DEC-PLATFORM-001 nivel 2. No habilitar el flag de finalización durable
hasta completar sus pruebas.
