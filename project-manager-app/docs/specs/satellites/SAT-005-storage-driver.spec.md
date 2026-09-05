---
id: "satellites.storage-driver"
title: "SAT-005 — StorageDriver abstraction for /v1/uploads + semse-storage satellite"
domain: "evidence"
sdd_version: "2.0"
version: "2.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "STORAGE_DRIVER (propuesto — no existe hoy)"
production_evidence: []
related_files:
  - apps/api/src/infrastructure/storage/storage.service.ts
  - apps/api/src/infrastructure/storage/storage.module.ts
  - apps/api/src/infrastructure/storage/storage-key.ts
  - apps/api/src/infrastructure/storage/uploads.controller.ts
related_tests:
  - apps/api/test/uploads.controller.test.ts
related_endpoints:
  - v1/uploads/plan
  - v1/uploads/files/*
related_events: []
related_agents: []
last_verified: "2026-08-17"
---

# Spec: StorageDriver abstraction for `/v1/uploads` + `semse-storage` satellite

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## Bloqueado por decisión de producto

**No se mueve a `APPROVED` en esta revisión.** El diseño técnico (interfaz,
selección por env var, modo espejo) puede especificarse sin ambigüedad, pero
construirlo depende de una decisión de producto/ingeniería que no se resuelve
leyendo este repositorio:

> ¿Vale la pena introducir una segunda abstracción de almacenamiento
> (`StorageDriver` + satélite externo `semse-storage`) antes de terminar la
> que ya existe a medias dentro del propio `StorageService`
> (`apps/api/src/infrastructure/storage/storage.service.ts:38`,
> `STORAGE_PROVIDER=local|s3|r2`, con `s3`/`r2` sin implementar — ver
> `healthCheck()` líneas 133-142, que devuelve `writable: false` y "not
> implemented" para cualquier valor distinto de `local`)?

Razones concretas por las que esto no es una decisión técnica:

- El propio plan maestro de satélites (`docs/specs/satellites/README.md`
  §2, fila `semse-storage`) registra **dos copias divergentes sin
  reconciliar** del satélite (`~/semse-storage` y `~/labsemse/semse-storage`),
  ninguna de las cuales vive en este repositorio, tiene CI, o es verificable
  desde aquí. No hay evidencia de que el satélite exista en un estado
  ejecutable hoy.
- Ningún otro satélite del programa (SAT-002/003/004/006/008) pasó de
  `DRAFT` — sólo SAT-001 (tokens/SDK) está `APPROVED` y parcialmente
  construido. Priorizar SAT-005 antes que cualquiera de esos, o en su lugar,
  es una decisión de secuenciación de producto.
- Completar `STORAGE_PROVIDER=s3|r2` (código ya scaffolded, cero satélites
  externos, cero coordinación de proceso adicional) es una alternativa
  directamente competidora dentro del alcance de este mismo spec, y la
  elección entre ambas rutas cambia el resultado esperado de la sección 1.

Mientras esta pregunta no tenga respuesta, este spec se mantiene como
**contrato de referencia** completo y sin ambigüedad técnica, listo para
pasar a `APPROVED` en cuanto la decisión de producto se tome — pero no se
implementa (Artículo I de la constitución: sin spec `APPROVED` no hay
código).

## 1. Problema y resultado

**Para quién:** operación (`semse-core`), específicamente cualquier flujo que
dependa de `/v1/uploads` sin conectividad al backend de almacenamiento
configurado en producción — desarrollo offline del pipeline de visión,
respaldo de evidencia crítica en disputas (`evidence` es dominio `risk:
critical` en `SPEC_INDEX.md`).

**Problema (verificado contra código, 2026-08-17):** `/v1/uploads` no tiene
ninguna abstracción de almacenamiento hoy. `StorageService`
(`apps/api/src/infrastructure/storage/storage.service.ts`) es una clase
concreta con lectura/escritura de filesystem local hardcodeada
(`createReadStream`, `createWriteStream`, `fs/promises`). El campo
`provider` (`STORAGE_PROVIDER=local|s3|r2`, línea 38) es cosmético: cualquier
valor distinto de `local` sólo produce un warning
(`"Non-local storage provider not yet supported — falling back to local"`,
línea 52) y `healthCheck()` reporta `writable: false` para `s3`/`r2`. No
existe ninguna interfaz `StorageDriver`, ningún segundo backend, y ningún
código en el monorepo referencia `semse-storage` fuera de este spec y
`tests/unit/api-readiness.test.ts` (que sólo usa el string
`"/tmp/semse-storage"` como *default path* de un stub de test — no es
integración real).

**Resultado esperado (si se aprueba):** `apps/api` puede seleccionar, por
variable de entorno resuelta en el arranque del proceso (nunca desde datos de
request), qué implementación de `StorageDriver` sirve `/v1/uploads` —
incluyendo un modo espejo que escribe en dos backends a la vez — sin cambiar
ningún contrato HTTP existente ni el comportamiento de las claves
tenant-scoped ya validadas por `storage-key.ts`.

## 2. Alcance

### Incluido

- Interfaz `StorageDriver` (`put`/`get`/`delete`/`health`) extraída del
  `StorageService` actual, con `LocalFsDriver` como implementación por
  defecto que preserva el comportamiento actual byte a byte (tests de
  caracterización antes del refactor — ver §9).
- Selección de driver vía `STORAGE_DRIVER=local|semse-storage|mirror`
  (nuevo env var; no existe hoy). `local` reemplaza al actual único camino;
  `semse-storage` y `mirror` quedan definidos por contrato pero su
  implementación está bloqueada por la sección "Bloqueado por decisión de
  producto".
- Reglas de seguridad del driver: todo driver reutiliza
  `normalizeStorageKey`/`buildTenantStorageKey`/`isTenantScopedStorageKey`
  (`storage-key.ts`) sin duplicar la validación de traversal — un driver
  nuevo no puede definir su propia normalización de claves.

### Fuera de alcance

- Migración de objetos históricos entre backends.
- Replicación bidireccional automática (el modo `mirror` es
  primario+espejo, no sincronización continua en ambos sentidos).
- Cifrado adicional del contenido almacenado — hereda el que ya exista en el
  backend elegido, no se agrega uno nuevo aquí.
- Implementar `STORAGE_PROVIDER=s3|r2` — es la alternativa competidora
  mencionada arriba, no parte de este spec.
- Cualquier trabajo del lado del propio `semse-storage` (proceso satélite) —
  vive fuera de este repositorio; este spec sólo define el contrato del lado
  SEMSE, consistente con SAT-000 §1.2.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Cliente/Pro autenticado | `evidence:write` (ya existe, `uploads.controller.ts:157,191`) | clave con prefijo `tenants/<tenantId>/...` derivado del contexto de sesión, nunca de `x-tenant-id` (comentario explícito en `uploads.controller.ts:171-174`) | Subir/leer archivos de su propio tenant | Elegir el driver de almacenamiento — es config de despliegue, no de request |
| `OPS_ADMIN` | ninguno nuevo | proceso completo (env var) | Cambiar `STORAGE_DRIVER` en el entorno de despliegue | Cambiar el driver en caliente por request/tenant — no existe ese eje |
| Público (sin sesión) | `@Public()` en `GET /v1/uploads/files/*` (ya existe, `uploads.controller.ts:236`) | lectura de clave conocida (UUID en la ruta, difícil de enumerar) | Leer un archivo si conoce la clave exacta | Listar claves, escribir, ni inferir el driver activo desde la respuesta |

- **Tenant boundary:** sin cambios — se conserva el mecanismo actual de
  `storage-key.ts` en todos los drivers.
- **Ownership/resource policy:** sin cambios.
- **Step-up o aprobación humana:** ninguno para lectura/escritura de
  archivos; cambiar `STORAGE_DRIVER` es un cambio de configuración de
  despliegue, no una acción de producto — no pasa por un endpoint HTTP.
- **Datos `privacyCritical`:** evidencia de disputas hereda su clasificación
  actual; el driver no cambia qué datos son sensibles, sólo dónde se guardan
  los bytes.
- **Requisitos de auditoría:** el cambio de `STORAGE_DRIVER` en producción no
  genera un `AuditLog` de dominio (es config de infraestructura, igual que
  `STORAGE_PROVIDER` hoy) — se audita por el proceso de deploy (Railway),
  no por este spec.

## 4. Escenarios y criterios de aceptación

### P1 — Comportamiento actual preservado bajo `STORAGE_DRIVER=local`

```gherkin
DADO STORAGE_DRIVER=local (o sin definir, mismo default de hoy)
CUANDO un cliente sube y luego lee un archivo vía /v1/uploads
ENTONCES el comportamiento es bit-idéntico al StorageService actual
Y ningún test de uploads.controller.test.ts cambia de resultado
```

### P2 — Modo espejo (bloqueado, contrato de referencia)

```gherkin
DADO STORAGE_DRIVER=mirror con un driver semse-storage configurado
CUANDO se sube un archivo
ENTONCES se escribe en el driver primario y en el espejo
Y una lectura posterior sirve desde el primario
Y pnpm storage:verify reporta 0 divergencias de hash entre ambos
```

Casos borde:

- [ ] Clave con traversal (`../`, backslash, control chars) — ya rechazada
      hoy por `normalizeStorageKey` (`storage-key.ts:6-24`); ningún driver
      nuevo puede saltarse esta validación.
- [ ] Driver secundario caído en modo `mirror` — la escritura al primario no
      debe fallar por eso (semántica exacta a definir antes de `APPROVED`:
      ¿se reintenta el espejo en background o se descarta la escritura
      fallida con alerta?).
- [ ] `STORAGE_DRIVER` con valor no reconocido al arrancar — el proceso debe
      fallar el healthcheck de arranque, no degradar silenciosamente a
      `local` (a diferencia del comportamiento actual de `STORAGE_PROVIDER`
      inválido, que sólo loguea un warning — comportamiento a corregir, no a
      heredar).

## 5. Contratos

### API — sin cambios de superficie

`GET /v1/uploads/plan` y `PUT|GET /v1/uploads/files/*` conservan exactamente
su contrato actual (`uploads.controller.ts`). Este spec no agrega ni cambia
endpoints — el driver es un detalle de infraestructura detrás de
`StorageService`.

### Interfaz interna — `StorageDriver`

```ts
interface StorageDriver {
  put(key: string, stream: Readable, meta: { contentType: string }): Promise<{ key: string; sizeBytes: number; createdAt: string }>;
  get(key: string): Readable; // NotFoundException si no existe, igual que hoy
  delete(key: string): Promise<void>;
  health(): Promise<{ ok: boolean; detail: string; freeBytes?: number }>;
}
```

`normalizeStorageKey` se aplica **antes** de que la clave llegue a
`put`/`get`/`delete` — ningún driver recibe una clave sin normalizar.

### Seguridad — por qué esto no es una superficie SSRF

El borrador anterior de este spec afirmaba heredar "el fix SSRF multi-nivel
(PR #112-#115)". Verificado: no existe tal PR en este repositorio ni
mecanismo de SSRF asociado a `apps/api/src/infrastructure/storage/`. Lo que
sí existe y aplica es protección de **path traversal** (`storage-key.ts`),
no SSRF — son categorías distintas y el borrador las mezclaba. La única
protección SSRF real y verificada en el monorepo vive en
`apps/vision-service/app/services/image_loader.py` (fix documentado en
`docs/AUDIT_REMEDIATION_PLAN.md` ítem 0.11) y protege la descarga de
imágenes por URL en el pipeline de visión — un componente distinto, no el
almacenamiento.

El driver `semse-storage` (si se construye) **no introduce riesgo SSRF
clásico** porque su destino (`SEMSE_STORAGE_URL` o path de volumen) es
config de despliegue fijada por ops, nunca un valor derivado de la request
del cliente — ningún actor externo controla a qué URL/volumen escribe el
driver. La obligación de seguridad real es: `SEMSE_STORAGE_URL` sólo se lee
de `process.env` en el arranque del proceso, nunca de headers/body/query.

## 6. FSM, eventos y reconstrucción

No aplica — sin transición de estado de dominio, sin evento nuevo. La subida
de evidencia sigue emitiendo `evidence.uploaded.v1` exactamente igual
(`apps/api/src/modules/evidence/evidence.repository.ts:135`), sin importar
el driver activo.

## 7. Datos y migración

No aplica — sin modelo Prisma nuevo. El driver no persiste metadata propia;
la referencia a la clave sigue viviendo donde ya vive hoy (registros de
evidencia, etc.).

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** `health()` por driver expuesto al healthcheck existente
  de la API; sin SLO nuevo hasta que exista un driver real que medir.
- **Feature flags:** `STORAGE_DRIVER` en sí funciona como su propio kill
  switch — volver a `local` desconecta cualquier driver alternativo sin
  deploy de código, sólo cambio de env var.
- **Plan de canary:** no aplica mientras el código no exista.
- **Evidencia de producción requerida (antes de `VERIFIED`, no de
  `APPROVED`):** modo `mirror` corriendo 48h en Railway sin divergencia de
  hashes (`pnpm storage:verify`), evidencia pegada en `docs/reportes/`.
- **Señal de rollback:** volver `STORAGE_DRIVER=local` no debe perder ningún
  objeto ya escrito al backend primario en modo `mirror`.
- **Owner operativo:** `semse-core`.

### Anillos de verificación (SAT-000 §2)

- **Anillo 1 — Contrato:** suite de contrato del driver corriendo contra
  `LocalFsDriver` y cualquier driver nuevo con los mismos casos
  (put/get/delete/health, archivo grande multipart, traversal rechazado).
- **Anillo 2:** N/A — satélite pasivo, sin SDK propio consumido por SEMSE.
- **Anillo 3 — E2E local:** pipeline de visión E2E completo con
  `STORAGE_DRIVER=semse-storage` (o el driver que se construya) en local.
- **Anillo 4 — Smoke en Railway:** modo `mirror` 48h sin divergencia de
  hashes; evidencia en `docs/reportes/`.
- **Rollback verificado:** volver a `STORAGE_DRIVER=local` no pierde ningún
  objeto subido en modo `mirror`.

## 9. Tests requeridos

- [ ] Tests de caracterización del `StorageService` actual **antes** del
      refactor a `LocalFsDriver` (congelar comportamiento byte a byte).
- [ ] Contrato `StorageDriver` corrido contra `LocalFsDriver` (put/get/delete
      /health, archivo grande, traversal rechazado) — reemplaza/extiende
      `apps/api/test/uploads.controller.test.ts`.
- [ ] Permiso denegado: sin cambios de superficie de permisos, pero
      confirmar que `evidence:write`/`@Public()` en `getFile` no cambian.
- [ ] `STORAGE_DRIVER` inválido al arrancar → falla el healthcheck de
      arranque (caso borde nuevo, hoy no existe para `STORAGE_PROVIDER`).
- [ ] Migración: no aplica (sin modelo Prisma).
- [ ] Canary/smoke autenticado en producción antes de `VERIFIED`.

## 10. Mapa de implementación

### API

- `apps/api/src/infrastructure/storage/storage.service.ts` — extraer
  `StorageDriver` + `LocalFsDriver`, conservar `StorageService` como
  fachada que delega al driver activo.
- `apps/api/src/infrastructure/storage/storage.module.ts` — proveedor de
  driver seleccionado por `STORAGE_DRIVER`.
- `apps/api/src/infrastructure/storage/storage-key.ts` — sin cambios
  (reutilizado por todos los drivers).
- `apps/api/src/infrastructure/storage/uploads.controller.ts` — sin
  cambios de contrato.

### Tests

- `apps/api/test/uploads.controller.test.ts` — extendido con casos de
  caracterización + contrato de driver.

## 11. Investigación externa

No aplica — el diseño reutiliza patrones 100% internos (`storage-key.ts`,
convención `STORAGE_PROVIDER` ya existente). No se investigaron proveedores
externos porque la decisión bloqueante (arriba) determina si esto se
construye.

## 12. Gates de cierre

- [ ] Decisión de producto documentada (ver "Bloqueado por decisión de
      producto") — **prerrequisito de `APPROVED`, no completado aquí**.
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado (N/A — sin
      migración de datos)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
