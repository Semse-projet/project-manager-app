---
id: "platform.admin-integration-trust-status"
title: "Admin Integration Trust Status"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/admin/admin-integrations.service.ts
  - apps/api/src/modules/admin/admin.controller.ts
  - apps/web/app/(app)/admin/settings/page.tsx
  - packages/schemas/src/admin-settings.schema.ts
related_tests:
  - apps/api/test/admin-integrations-status.test.ts
related_endpoints:
  - GET /v1/admin/integrations/status
  - POST /v1/admin/integrations/:integrationId/verify
related_events: []
related_agents: []
last_verified: "2026-09-25"
---

# Spec: Admin Integration Trust Status

## 1. Problema y resultado

**Para quién:** Administración SEMSE con permiso operativo.

**Problema:** Los interruptores de integraciones se presentan como si probaran
que el proveedor externo está configurado. Un modo simulado o una preferencia
guardada puede confundirse con una conexión real.

**Resultado esperado:** Administración distingue, sin recibir secretos, entre
`UNCONFIGURED`, `SIMULATION`, `CONFIGURED_UNVERIFIED`, `VERIFIED` y `ERROR`, y
puede ejecutar una comprobación explícita, de solo lectura, contra el proveedor.

## 2. Alcance

### Incluido

- Estado honesto para OpenAI, GitHub, WhatsApp Cloud, Stripe y Dropbox Sign.
- Separación entre habilitación tenant y configuración del servidor.
- Prueba de conexión de solo lectura, con timeout y mensaje sanitizado.
- Persistencia del último resultado y fecha en `TenantSettings.settingsJson`.
- Corrección documental de las variables WhatsApp Cloud.

### Fuera de alcance

- Capturar, revelar o rotar secretos desde la UI.
- Crear cuentas, enviar mensajes, cobrar, firmar o publicar durante la prueba.
- Declarar una integración activa solo por tener variables presentes.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| OPS_ADMIN | `ops:dashboard:read` | Tenant de sesión | Leer estados | Leer valores secretos |
| OPS_ADMIN | `ops:dashboard:write` | Tenant de sesión | Probar y registrar resultado | Ejecutar una acción de negocio |

- Tenant boundary: los resultados se guardan en `TenantSettings` del tenant de sesión.
- Datos `privacyCritical`: credenciales quedan exclusivamente en variables del servidor.
- Auditoría: la persistencia usa `tenant.settings.updated` existente.

## 4. Escenarios y criterios de aceptación

### P1 — Ver estado sin afirmaciones falsas

```gherkin
DADO un proveedor sin credenciales, en modo simulado o con credenciales no probadas
CUANDO OPS_ADMIN abre Integraciones
ENTONCES ve el estado exacto y las variables faltantes por nombre
Y nunca recibe valores de variables ni secretos
```

### P1 — Probar conexión

```gherkin
DADO una integración completamente configurada
CUANDO OPS_ADMIN pulsa Probar conexión
ENTONCES SEMSE ejecuta una lectura inocua con timeout
Y registra VERIFIED o ERROR con fecha y mensaje sanitizado
```

Casos borde:

- [x] Configuración incompleta invalida un resultado histórico.
- [x] Modo simulado nunca se muestra como envío u operación real.
- [x] Error del proveedor no incluye cuerpo, token o credencial en la respuesta.

## 5. Contratos

### API — `GET /v1/admin/integrations/status`

```yaml
auth: required
permissions: [ops:dashboard:read]
effects:
  audit_log: none
  domain_event: none
  sse: none
  payment_governance: none
```

### API — `POST /v1/admin/integrations/:integrationId/verify`

```yaml
auth: required
permissions: [ops:dashboard:write]
input_schema: integrationId enum
output_schema: AdminIntegrationStatus
errors:
  400: unknown integration id
effects:
  audit_log: tenant.settings.updated
  domain_event: none
  sse: none
  payment_governance: none
```

### UI

```yaml
surfaces: [/admin/settings?section=integrations]
states: [loading, ready, degraded, error]
required_behavior:
  - toggles mean enabled-for-tenant, never configured
  - status, missing variable names and last check are visible
  - test button is disabled for unconfigured or simulation states
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno de negocio.
- Invariantes: no se modifican pagos, evidencia o lifecycle.
- Eventos/outbox/replay: no aplican.

## 7. Datos y migración

- Modelos Prisma: sin cambios.
- Migración: no aplica; se amplía JSON validado de `TenantSettings`.
- Compatibilidad: defaults aceptan filas antiguas sin `checks`.
- Rollback: revertir código; los campos JSON adicionales son ignorables.

## 8. Observabilidad, despliegue y activación

- Logs: solo proveedor y resultado; nunca payload o credencial.
- Health: no se añade dependencia externa al readiness general.
- Evidencia requerida: respuesta autenticada, UI y logs sin secretos.
- Rollback: 5xx en settings, fuga de secretos o pruebas con efecto externo.

## 9. Tests requeridos

- [x] Derivación de los cinco estados.
- [x] Configuración incompleta prevalece sobre chequeo histórico.
- [ ] Build API y Web.
- [ ] Smoke autenticado en producción.

## 10. Mapa de implementación

- API: módulo `admin` canónico.
- Web: BFF `apps/web/app/api/semse/admin/integrations/**` y Settings.
- Schemas: `packages/schemas/src/admin-settings.schema.ts`.
- DB/Worker: sin cambios.

## 11. Investigación externa

- OpenAI `GET /v1/models`, GitHub `GET /user`, Meta Graph lectura del número,
  Stripe balance retrieval y Dropbox Sign `GET /account` son lecturas oficiales.
- Aplicado ahora: comprobaciones de autenticación sin acción de negocio.
- Backlog: OAuth administrado y rotación segura de credenciales.

## 12. Gates de cierre

- [x] Spec indexado y validación estricta verde.
- [ ] Tests y builds verdes.
- [ ] CI, merge, deploy y activación registrados por separado.
- [ ] Producción comprobada antes de `VERIFIED`.
