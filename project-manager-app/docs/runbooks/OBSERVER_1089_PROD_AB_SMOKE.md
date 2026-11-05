# Observer #1089 — Smoke autenticado A/B con identidades sintéticas

**Estado:** RUNBOOK + SCRIPT PREPARADOS, **NO EJECUTADOS EN PRODUCCIÓN**.

## Objetivo

Probar de extremo a extremo el **commit productivo actualmente desplegado**, identificado por el SHA exacto que el operador proporciona mediante
`SEMSE_OBSERVER_SMOKE_EXPECTED_SHA` y que debe coincidir con `/v1/health`, usando dos
tenants realmente distintos (A y B), cada uno con usuario `OPS_ADMIN`,
org propia, membresía `ACTIVE` y sesión emitida por `POST /v1/auth/login`.
No copiar/consultar datos de clientes ni fabricar tokens JWT.

El script `scripts/ops/observer-prod-synthetic-smoke.mjs` crea registros
únicos prefijados `test_ohi14_*`, prueba solamente rutas GET de Observer,
revoca sesiones y elimina **usuarios, orgs, perfiles, membresías y sesiones**
exactos. **Conserva dos tenants sintéticos archivados para retener AuditLog**;
no ejecuta un borrado físico del tenant que destruiría la auditoría por cascada.
No modifica roles globales, permisos, flags, servicios de Railway ni migraciones.

## Control previo (obligatorio)

1. Debe ejecutarse **desde el servicio API existente en Railway**, proyecto
   `95ad1b14-d1d9-467d-82d8-5354619ba873`, ambiente
   `production`, servicio `2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770`.
2. El proceso debe disponer de `DATABASE_URL` privado y Node.js 22
   con `@prisma/client`; el script no imprime la URL ni secretos.
3. `/v1/health` debe ser HTTP 200, producción, SHA exacto de la variable
   `SEMSE_OBSERVER_SMOKE_EXPECTED_SHA` (40 caracteres hexadecimales);
   `/v1/ready` debe ser HTTP 200 con `status=ready`.
   Si no, abortar **antes** de escribir.
4. Un operador autorizado debe introducir el opt-in efímero
   `SEMSE_OBSERVER_SMOKE_ACK=YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP`.
   **No** establecerlo como variable persistente de Railway.
5. El script debe encontrarse en el contenedor de API existente.
   Esta rama **no está fusionada ni desplegada**. La conexión ChatGPT
   de Railway actual no ofrece shell/SQL ni Cloud Agent, por lo que esta
   preparación **no provisiona todavía cuentas reales**.

## Uso desde un shell autorizado del API

```sh
# Siempre comienza con preflight de solo lectura:
node scripts/ops/observer-prod-synthetic-smoke.mjs

# Ejecutar UNA vez, y solo con permiso sobre el entorno existente:
SEMSE_OBSERVER_SMOKE_EXPECTED_SHA=SHA_PRODUCTIVO_CONFIRMADO \
SEMSE_OBSERVER_SMOKE_ACK=YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP \
  node scripts/ops/observer-prod-synthetic-smoke.mjs --apply
```

El servicio, ambiente y proyecto se comprueban por IDs exactos mediante
`RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID`,
`RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_PROJECT_ID` y `NODE_ENV`.
`DATABASE_URL` debe usar el PostgreSQL privado `*.railway.internal`;
se rechaza cualquier endpoint público o externo. La vinculación real del
servicio API a esa base debe verificarse operativamente antes del smoke. No ejecutar con un usuario personal
ni cambiar `AUTH_SECRET`, `SEMSE_DEFAULT_TENANT_ID` o políticas RBAC.

## Aserciones

- Dos `Tenant` + dos `Org` + dos `User` + dos `UserProfile` +
  dos `Membership`, en una transacción. Rol OPS_ADMIN **ya existente**
  y nunca creado/alterado por el smoke.
- Login y `/v1/auth/me` verifican tenant, org y rol del token real.
- Con `x-tenant-id`/ `x-org-id` deliberadamente falsos, `/history`
  empieza vacío; `/latest` devuelve el **tenant verdadero del token**,
  nunca el falsificado.
- Segundo `/latest` usa `fromCache=true` de ese tenant; `/history`
  permanece limitado (<=50 guardados; <=10 retornados).
- `/v1/auth/logout` revoca cada sesión y el acceso posterior devuelve 401.
  El 403 con un rol sin permiso sigue acreditado en CI O.HI12/O.HI13;
  esta ejecución usa únicamente dos administradores y no afirma probar 403
  productivo.
- Si el buffer de 128 tenants está lleno y `/latest` devuelve 503,
  el smoke falla **sin expulsar historial de otro tenant**.

## Efecto temporal sobre la caché

Una prueba de `observer/latest` puede ocupar **un bucket en memoria
por tenant sintético**. La eliminación del usuario y la organización
NO invalida esa caché del proceso API, que expirará automáticamente
después de **24 horas sin lecturas** según la política aprobada del #1089.
Por esta razón, el script **rechaza crear un nuevo par de tenants cuando
existen registros de ejecuciones sintéticas de las últimas 24 horas** en
PostgreSQL. Esto limita la huella a como máximo **dos buckets por 24 h**.
No repetir el smoke bajo un SHA distinto para sortear esta barrera.
No se agrega un endpoint nuevo de invalidación o privilegio de caché.

## Limpieza, trazabilidad y falla inesperada

El script elimina en `finally` las identidades ejecutables (usuarios,
organizaciones, sesiones, perfiles y membresías) prefijadas con el
**run ID** generado; **deja los tenants con `status=archived` para preservar
los eventos de auditoría `auth.session.issued/revoked`**. El ID se imprime, pero nunca contraseñas, tokens,
secretos, datos de clientes ni cuerpos JSON. Verifica nombres, emails,
tenantIds y orgIds antes de borrar. `AuthSession` queda eliminada.
Si el proceso se interrumpe violentamente, reintentar la limpieza
con el **run ID exacto**, desde el mismo entorno autorizado:

```sh
SEMSE_OBSERVER_SMOKE_ACK=YES_OBSERVER_1089_SYNTHETIC_WRITE_AND_CLEANUP \
  node scripts/ops/observer-prod-synthetic-smoke.mjs --apply --cleanup=RUN_ID
```

Registrar en GitHub únicamente: SHA/deployment, run ID sintético,
cantidad de aserciones PASS/FAIL, existencia o no de cuentas temporales
tras la limpieza y estados agregados. Si queda una cuenta huérfana,
**no** marcar el smoke PASS; revisar cleanup exacto antes de repetir.
Los tenants archivados no tienen usuarios ni membresías activas: se mantienen
solamente como custodios de auditoría. Cualquier purga física futura requiere
una política de retención aprobada por separado.

**No usar** el registro público `/v1/auth/register`: asigna
`tenant_default` y solo CLIENT/PRO. Tampoco usar los seeds
`pr973-qa-seed-ci.mjs` o `api-authenticated-f01-f02-smoke.mjs`:
están limitados explícitamente a PostgreSQL desechable en CI.

## Gates separados

- No sustituye la revisión retrospectiva del PR #1089.
- No prueba continuidad de memoria tras reinicio/multirréplica ni fuerza
  la saturación del cap 128 creando masivamente tenants.
- No crea nuevos servicios Railway.
- La aprobación de la política de capacidad del propietario ya existe
  en #1089; este runbook no solicita renovarla.
