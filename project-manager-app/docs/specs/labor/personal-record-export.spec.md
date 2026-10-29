---
id: "labor.personal-record-export"
title: "F1 — Exportación íntegra y continuidad del registro personal"
domain: "labor"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-24"
---

# F1 — Exportación y continuidad del registro personal (SDD 2.0)

> **DRAFT / NO IMPLEMENTAR**: slice técnico derivado del programa `labor.worker-independence-growth-program` (PR documental #1035, todavía no fusionado). Coordinar con [EPIC #935](https://github.com/Semse-projet/project-manager-app/issues/935) y [S1/#933](https://github.com/Semse-projet/project-manager-app/issues/933). Ninguna aprobación legal o de uso con empleados reales se infiere de este borrador. Contrato de API PROVISIONAL, pendiente de autoridad y naming review.

## 1. Problema, alcance y resultado

**Para quién:** persona que registra tiempo por cuenta propia, con o sin empresa usuaria de SEMSE, y que puede trabajar para varias organizaciones a lo largo del tiempo.

**Problema AS-IS (lectura de `main` 2026-10-24):**
- `RegistrosTab.tsx` consulta `fetchLaborEntries({ range, limit: 500 })`, también en `range: all`. CSV toma solo esas filas; no es historial íntegro ni backup.
- `GET /v1/labor/entries` no expone cursor/offset. `LaborEngineRepository.listTimeEntries` acepta un `offset` interno pero no está conectado a la API y ordena solo por `startedAt`; no hay contrato público de paginación determinista.
- `trackerUi.exportEntriesCsv` incluye filas locales `pending_sync` sin columna de estado/sync; no neutraliza contenido potencialmente ejecutable por apps de spreadsheets cuando empieza con `= + - @`.
- `FreeProject` archivado se oculta de `listFreeProjects`; su label puede perderse en un reporte/CSV histórico (#933).
- `TimeEntry` posee `createdBy` y `tenantId` y un `orgId` obligatorio; el endpoint usa `tenantId` de sesión. **No se ha demostrado que una persona mantenga acceso a todos sus datos al cambiar de tenant o al quedarse sin Membership.** Esto no se arregla simplemente ampliando a `userId` sin ResourceScope.

**Resultado exigido del programa:** la persona obtiene acceso y exportación íntegra de sus propios registros, con procedencia, período, zonas horarias e integridad verificable, sin exponer datos de empleadores/clientes ni transferir historial a una nueva empresa.

### División obligatoria para no prometer portabilidad inexistente

- **F1A — Exportación exhaustiva con acceso ya autorizado al tenant** (slice menor y primero): resolver API/CSV incompleto, archivados y estado offline. No pretende resolver por sí solo cambio de tenant o ausencia total de Org.
- **F1B — Continuidad personal entre pertenencias/tenants** (siguiente slice, BLOQUEADO hasta decisión de Identity + Security): acceso a datos personales históricos únicamente de identidad global `User`, bajo un modelo de autoridad verificable que no permita consultas transversales por un usuario que antes compartía tenant con otra persona.
- **F1C — Evidencia multimedia privada** separada, con custodia y derechos de terceros; *no* se incluye en exportación de horas F1A, y no se convierte CSV en backup de fotos.

### Incluido en F1A (propuesto)

- Inventario y reutilización de `TimeEntry`, FreeProject, revisión y estado local; exportación íntegra de intervalos propios autorizados, no exportación de compañeros.
- Contrato con corte consistente/snapshot declarado, orden estable `startedAt DESC, id DESC`, páginas sin duplicados/faltantes, tamaño y cuotas razonables.
- Metadatos `exportedAt`, `range`, `timezone`, `syncStatus`, `recordCount`, `source`; UTC bruto conservado; nombre histórico de FreeProject bajo permiso.
- Neutralización CSV/formula injection y diferenciación de descarga de vista vs exportación exhaustiva.
- Acceso al historial propio aunque cambie de Org dentro del mismo contexto **solo si lo habilita la autoridad existente**; pruebas antes de afirmar disponibilidad.
- Seguridad, pruebas offline, accesibilidad y textos críticos ES/EN.

### Fuera de alcance F1A

- Migrar tenant/Org por nombre del patrón, dar acceso a la compañía o supervisor, exportar contenidos de terceros, salarios privados, GPS por defecto, fotos, SSN o contratos.
- Alterar `TimeEntry.createdBy`, duplicar el reloj, cambiar lógica de pagos, reconocer W-2/1099, payroll, overtime, escrow o Documenso.
- Confirmar jurídicamente autenticidad/valor probatorio por descargar un CSV.
- Cambios de schema/datos hasta demostrar su necesidad y aprobar un plan additivo.

## 2. Actores, permisos y recurso

| Actor | Permiso/scope propuestos | Permitido | Denegado |
|---|---|---|---|
| User A (dueño) | Sesión autenticada + `createdBy = A` y autoridad real para tenant fuente | Exportar solo sus `TimeEntry` y metadatos FreeProject propios | Datos privados de B o agregados empresa |
| User B (mismo tenant) | Sus propias filas | Su historial | Datos de A (BOLA) |
| User C (otro tenant) | Su propio scope | Su historial | A y B |
| Supervisor o empresa | Grants de Job/Org existentes, **no** autoridad sobre `personal` | Solo datos organizacionales ya autorizados por contratos vigentes | Exportación del historial personal de trabajadores |
| OPS_ADMIN | No override implícito de `createdBy` personal | Solo procedimiento excepcional autorizado y registrado, si se especifica | Exportación personal ajena general |
| User con Membership suspendida o sin Org | Decisión F1B pendiente | Recuperación propia como objetivo de producto | Elevar roles o escanear tenants por identificador |

**Reglas críticas:**
- El backend deriva identidad/tenancy de sesión verificada y política de propiedad, nunca de `createdBy`/ `tenantId` enviado por cliente.
- `tenantId` por sí solo no autoriza. Una identidad global no habilita enumeración de registros de todos los tenants.
- No modificar el `createdBy`, ID, tiempo ni `purpose` al generar exportación.
- No publicar ni compartir automáticamente con empresa al aceptar BO-05, entrar a Org, convertir FreeProject o crear Job.
- Si un tenant se suspende, revoca o borra, retención, acceso personal y continuidad quedan sujetos a política legal y arquitectura F1B, no a un bypass de auth.
- Histórico personal/cuenta frente a obra empresarial: una anotación personal no autoriza copiar evidencias, fotos o datos del cliente.
- Logs muestran IDs opacos/código resultado, no ubicaciones, notas, nombres ni coordenadas; reportes privados marcados `privacyCritical`.

## 3. Escenarios y aceptación

### P0-01: 500+ registros, exportación exhaustiva

```gherkin
DADO A autenticado con 1,201 TimeEntry propios dentro del período elegido
Y registros con el mismo startedAt pero diferentes id
CUANDO solicita la exportación íntegra
ENTONCES recibe las 1,201 entradas autorizadas exactamente una vez y ordenadas de forma determinista
Y los totales se reconcilian con el conjunto completo del período
Y la exportación reporta fecha de corte, timezone, fuente y número total
```

### P0-02: mismo tenant, dueños distintos

```gherkin
DADO A y B en el mismo tenant y C en un tenant distinto
CUANDO A consulta/exporta su historial
ENTONCES ninguna fila de B/C ni ubicación, notas o tarifa ajena aparece
Y la API no acepta parámetros tenantId/createdBy para ampliar scope
```

### P0-03: offline / CSV de vista

```gherkin
DADO A con entrada pendiente en cola local offline
CUANDO descarga CSV de vista
ENTONCES esa entrada se etiqueta explicitamente PENDING_LOCAL y no verificada
Y la exportación exhaustiva del servidor incluye solo filas persistidas
Y reconciliar después no duplica la entrada por clientEventId
```

### P0-04: archivado y zona horaria

```gherkin
DADO un proyecto personal archivado con jornada que cruza medianoche o DST
CUANDO A exporta los registros del período
ENTONCES el nombre histórico autorizado se conserva y UTC no cambia
Y las fechas locales se calculan o etiquetan con zona IANA explícita
Y archivar/restaurar no edita horas, estado de sincronización ni autor
```

### P0-05: CSV seguro

```gherkin
DADO notas/proyecto/ubicación con contenido que empieza con =, +, -, @ o prefijos de control/espacio
CUANDO A descarga el CSV y lo abre en un programa de hojas de cálculo
ENTONCES los campos se tratan como texto, sin ejecutar fórmulas
Y comas, comillas, saltos de línea y Unicode se conservan sin corrupción
```

### P0-06: revocación y continuidad, prueba de carácter bloqueante

```gherkin
DADO A que generó entradas personales mientras pertenecía a Org X
CUANDO su Membership en X se suspende y opera en Org Y o deja de estar afiliado
ENTONCES ningún actor en Y obtiene acceso retrospectivo a entradas de X
Y el acceso recuperable por A se considera REQUIRES_ARCHITECTURE_DECISION hasta F1B
Y jamás se lo simula con un token o tenantId sin verificar
```

### Criterios atómicos

- **AC-01** GET actual y CSV de vista se distinguen de la exportación íntegra; sin etiquetas «Todo el historial» cuando hay truncamiento.
- **AC-02** backend valida token, `createdBy` y policy del recurso por página/snapshot; B y C jamás reciben filas A, tampoco por URLs directas.
- **AC-03** paginación con clave compuesta o snapshot consistente, tolera colisiones de fecha e inserción concurrente; guarda prueba de totalidad del corte.
- **AC-04** ZIP/CSV descargable sin filtrado peligroso de JSON/numerics/secretos; texto protegido contra formula injection.
- **AC-05** flujo web y móvil diferencia `persisted` / `pending_local` / `failed_sync`; CSV no se presenta como backup.
- **AC-06** método seguro para recuperar nombres de FreeProject archivados conforme S1/#933, nunca labels de otro dueño.
- **AC-07** hora UTC, timezone IANA, DST, overnight, descansos registrados y precisión de segundos probados.
- **AC-08** descargas auditan autor/alcance, límites de uso, errores neutros, sin fuga de PII en logs.
- **AC-09** cuenta sin empresa usuaria y cambio de Org tienen tests; cross-tenant portability sin resolver bloquea declarar cumplimiento de objetivo F1B.
- **AC-10** `TimeEntry` sigue canónico; `clientEventId` idempotente; ningún cambio a otras políticas BO-05/08/12.

## 4. API/UI propuestos, NO aprobados

**Decisión por formalizar:** paginación reutilizable de `GET /v1/labor/entries` o endpoint nuevo de exportación personal; comparar con el S1/#933 para evitar dos implementaciones.

Contrato candidato de exportación: `GET /v1/labor/entries/export?from=<ISO>&to=<ISO>&timezone=<IANA>&format=csv` con sesión del dueño autenticada, SIN `tenantId` ni `createdBy` de query.

```yaml
auth: required
scope: own TimeEntry rows in active, authorized source tenant only (F1A)
parameters:
  from: ISO8601 UTC bounded range
  to: ISO8601 UTC bounded range
  timezone: IANA validated
  format: csv
response: streamed attachment with explicit cut/provenance metadata
errors:
  400: rango o zona inválida
  401: sesión ausente
  403: permiso faltante en ámbito autenticado
  404: recurso ajeno o sin acceso, neutral
  409: corte de datos inconsistente; reintento seguro
  429: exportaciones frecuentes
effects:
  domain_events: none before EVENT_CATALOG review
  payment_governance: none
  audit_log: own export requested/completed/failed (catalog-backed)
```

**Open API questions:** GET de exportación vs job asíncrono (tamaño), consistent snapshot DB, forma de conteo y auditoría atómica, signed download, streaming y expiración. No fijar ruta/costos sin decidir.

**UI:** `/worker/tracker → Registros / Reportes` conserva pestañas y reloj, muestra «CSV de vista (N filas cargadas)» vs «Exportar mis registros completos (con fecha de corte)» si la segunda existe. Estados `loading/empty/ready/forbidden/degraded/error`, filtro ES/EN sin perder datos, sin GPS involuntario.

**Prometeo:** únicamente asesoría sobre registros autorizados y límites; no comparte reportes ni certifica horas, no inicia descarga a terceros.

## 5. Fuente de datos, migración, idempotencia y eventos

- Fuente de escritura canónica: `Labor Engine/TimeEntry`, `FreeProject` personal como contexto, nunca `TrackerSession` duplicado (ADR-029).
- Inventario `TimeEntry(tenantId, orgId, createdBy, ...)` y `FreeProject(tenantId, createdBy, status)`.
- F1A intenta **sin migración** si la lectura/streaming puede operar sobre indices existentes. Si faltan índices, proponer migración expand/contract en otro commit y validar drift/checksum.
- Auditoría del evento solo tras confirmar nombres en `docs/foundation/EVENT_CATALOG.md`; nada se autoriza por el texto de este spec.
- Exportación consistente con snapshot (no prometerlo con simple offset); orden estable `startedAt DESC, id DESC` y prueba de concurrencia.
- Offline no tiene autoridad de backend: filas pendientes van separadas y nunca se confunden con confirmación de servidor.
- Retención y borrado según Legal/Privacy; download CSV no cambia recursos ni autoría.

## 6. Dependencias bloqueantes y autoridad

| ID | Bloqueo | Responsable |
|---|---|---|
| F1-D01 | Identidad sin Org y accesibilidad al propio histórico tras suspensión | Identity/Auth + owner |
| F1-D02 | Portabilidad histórica entre tenants vs `tenantId` y `orgId` obligatorios | Security/Architecture/Privacy |
| F1-D03 | Exportador compartido con #933 S1 y semántica «Todo» | Product/Labor |
| F1-D04 | Retención, acceso histórico, datos/confidencialidad de obras | Legal/Privacy |
| F1-D05 | Snapshot consistente, cuotas y almacenamiento de exports | Architecture/Operations |
| F1-D06 | Auditoría existente y neutralización CSV compatible | Security |
| F1-D07 | Interpretación de resúmenes financieros vs evidencia de horas | Legal/Payroll |
| F1-D08 | Pruebas de autenticación multiusuario, identidad no-empleada y varios tenants | QA/Security |

**Gate que impide aprobación global:** aún falta elección de arquitectura de F1B. F1A solo puede aprobarse con nombre/alcance explícitos que no simulen continuidad universal.

## 7. Plan de entrega, verificación, rollback

1. Inventario definitivo de API/bases/tenants/sesiones, estado de #933 y PRs solapados.
2. Resolver requisitos F1-D01–D08 que afecten el slice elegido y aprobación expresa del contrato específico.
3. Tests negativos A/B mismo tenant, C distinto; >500, offline, archivado, CSV formula injection, timezone, concurrencia.
4. Implementar mínimo sobre Labor Engine/FreeProject, sin nuevo tracker ni permisos genéricos.
5. Revisión Security/Privacy independiente y prueba de rollback; staging sintético y ES/EN autenticado.
6. **CI al final**: `pnpm spec:index`, `pnpm spec:validate:strict`, pruebas unitarias/integración, typecheck/build y checks terminales antes de valorar merge.
7. Merge/despliegue/activación únicamente con autorización separada, SHA/evidencias verificables y canary.

**Estado de esta propuesta:** DRAFT, tests NOT_RUN, code NOT_STARTED, merge UNMERGED, deploy NOT_DEPLOYED, activation INACTIVE.
