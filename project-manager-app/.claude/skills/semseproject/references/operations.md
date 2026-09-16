# Operaciones: datos, pagos, eventos, seguridad, despliegue

Referencia del skill `semseproject`. Marcas de taxonomía según `SKILL.md` §1. Ante conflicto
con `SKILL.md` §1–§12, `SKILL.md` gana.

---

## Clasificación de datos (resuelve H-05)

Taxonomía mínima de `DataClass` (referenciada desde `SKILL.md` §3):

público · interno · confidencial · personal · financiero · credencial/secreto · salud o
categoría regulada (si aplica) · evidencia contractual · dato de seguridad crítica.

**MUST**: cada capacidad y cada conector declara qué `DataClass` toca (Capability Registry,
`prometeo-and-agents.md`). Reglas mínimas por clase — almacenamiento, transmisión,
inferencia por IA, logging, exportación y retención se definen por clase, no globalmente;
como mínimo: `credencial/secreto` **MUST NOT** aparecer en logs, prompts ni transcripts
nunca (ver "Secretos en logs" más abajo); `financiero` y `personal` **MUST** pasar por el
routing de privacidad si la operación es `privacyCritical`.

## Privacidad `local-only` — enforcement (resuelve H-06)

**MUST**: el Model Router recibe una política de privacidad no modificable por el modelo y
devuelve una `PolicyDecision` verificable (`SKILL.md` §5), no una elección libre del LLM.
Toda ruta declara proveedor, región, retención, entrenamiento, subprocesadores y modalidad.
**MUST NOT**: activar un fallback cloud silenciosamente cuando la petición es
`local-only`/`privacyCritical`. Si no existe ruta compatible, el resultado es bloqueo
explícito con razón y alternativa segura — **prueba negativa obligatoria**: con el proveedor
local caído, una solicitud `local-only` debe fallar cerrado y generar un `AuditEvent` de
bloqueo (`SKILL.md` §7), no degradar a cloud.

## Tenant/org, jerarquía de recursos (resuelve M-01)

**MUST**: toda consulta/comando/evento/cache/clave de idempotencia incluye contexto de
tenant explícito. **MUST NOT**: resolver referencias ambiguas de `projectId`/`farmId`/
worksite "adivinando" el tenant — denegar (mitiga R-02, ver `SKILL.md` §5).
**PROPOSED**: definir formalmente si un usuario puede pertenecer a varias organizaciones,
herencia de permisos entre proyecto/farm/worksite y reglas de cross-tenant access antes de
construir features que las asuman.

## Idempotencia (resuelve M-02)

**MUST**: toda operación mutante que pueda reintentarse (pagos, creación de recursos vía
worker, webhooks) define `idempotencyKey`, `scope`, TTL, fingerprint de parámetros y
comportamiento ante reutilización con parámetros distintos (conflicto explícito, no
sobre-escritura silenciosa).

## Niveles de verificación (resuelve M-03)

Clasificar toda `Verification` (`SKILL.md` §3) en uno de estos niveles, y declarar cuál es
obligatorio según el `riskLevel` de la acción (`SKILL.md` §10):

sintáctica · técnica · de autorización · de persistencia · de efecto externo · de resultado
de negocio · humana.

**MUST**: acciones `critical` (pago, borrado masivo, cambio de identidad/permisos) requieren
verificación de resultado de negocio, y el verificador **SHOULD** ser independiente del
executor cuando sea viable (p. ej. un job de reconciliación separado del endpoint que inició
el pago).

---

## Deletes y acciones destructivas

**MUST NOT**: borrar durable business state de inmediato por defecto, salvo obligación legal
o política de privacidad aprobada explícitamente (resuelve A-05 — la regla de no-borrado
convive con derechos de supresión; la excepción legal debe documentarse, no asumirse).

Patrón obligatorio:

```
request deletion → permission check (SKILL.md §5) → impact preview
→ explicit confirmation → soft delete/archive → recovery window
→ final purge policy (si aplica, por clase de dato — ver "Clasificación de datos")
```

**MUST**: el audit trail mínimo no desaparece con el recurso operativo. Borrados masivos
requieren política reforzada — doble control y `riskLevel=critical` (`SKILL.md` §6/§10).

---

## Payments / financial governance (resuelve H-09)

**MUST**: los modelos no deciden unilateralmente mover dinero. Separar:

recomendación/analysis (puede ser `ModelInference`) → eligibility evaluation → business
authorization (Approval Gate, `SKILL.md` §6) → provider execution → ledger/reconciliation.

**MUST**: definir y mantener:

- Un **ledger canónico** (una sola fuente de verdad del estado financiero — no el estado de
  Stripe ni el de la UI por separado).
- Estados financieros formales (p. ej. `PENDING` → `AUTHORIZED` → `CAPTURED` →
  `RELEASED`/`REFUNDED`/`DISPUTED` — mapear contra el FSM real del dominio Payments antes de
  asumir estos nombres).
- `idempotencyKey` en toda operación (ver arriba).
- Límites por monto, tenant, usuario y periodo.
- Segregación de funciones (quien aprueba no es quien ejecuta cuando `riskLevel=critical`).
- Doble aprobación para RC5/RC6-clase de cambios (ver `semse-audit-remediation` skill).
- Reconciliación periódica contra el proveedor (Stripe u otro).
- Manejo explícito de webhook duplicado o tardío (idempotencia por `eventId` del proveedor).
- Compensaciones (cómo se revierte un pago mal liberado).
- Freeze/kill switch financiero (nivel `execution` o superior, ver kill switches en
  `prometeo-and-agents.md`).
- Auditoría de cambios de beneficiario/cuenta — siempre `riskLevel=critical`.

**MUST NOT**: usar "escrow" en sentido jurídico sin validación legal. Tratar la
implementación de marketplace como orquestación de pagos protegidos por hitos, salvo
estructura legal explícita que lo autorice.

---

## Evidence-first execution

Evidence no es un archivo adjunto decorativo. Debe poder representar: qué se esperaba · qué
se observó · quién lo produjo · cuándo · procedencia · aceptación/rechazo · reemplazo ·
hashes/metadatos · relación con milestone · análisis IA separado de aprobación humana.

**MUST NOT**: una inferencia visual (IA) aprueba automáticamente un hito sensible ni libera
un pago — eso requiere `Approval` (`SKILL.md` §6/§8).

**Cadena de custodia mínima (resuelve R-05)**: hash del artefacto · metadatos de captura
(dispositivo, actor, timestamp de una fuente confiable) · historial de reemplazos (nunca
sobrescribir en el mismo registro) · acceso restringido por `DataClass` · verificación de
integridad antes de usarla para liberar un milestone.

---

## Eventos y consistencia (resuelve H-07 y A-04)

Dirección preferida (**MUST** cuando el bounded context lo requiera):

```
business state + outbox row (misma transacción)
→ dispatcher → queue/event → idempotent consumers → DLQ / retries / observability
```

`DomainEvent` mínimo (`SKILL.md` §3): `eventId`, `eventType`, `schemaVersion`, `aggregateId`,
`aggregateVersion`, `occurredAt`, `causationId`, `correlationId`, `producer`, `tenantId`,
`payload` versionado.

**MUST**: al menos-once delivery, idempotencia del consumidor, orden garantizado por
`aggregateId` (no orden global), replay seguro y procedimiento de reconciliación para
mensajes fuera de secuencia o duplicados. **SHOULD**: límite de reintentos con DLQ y alerta,
no reintento infinito.

**MUST NOT**: usar hooks best-effort para reemplazar garantías transaccionales críticas.

**"Cambio durable importante" (resuelve A-04)**: todo cambio durable que otro bounded
context consuma, que alimente auditoría, o que afecte reconciliación financiera, emite
evento. Un cambio que no lo haga **MUST** justificar explícitamente por qué no afecta a
ninguno de esos tres criterios — la ausencia de evento no puede ser la opción por defecto
sin esa justificación.

---

## UX objetivo

Prometeo puede ser la interfaz universal principal; las pantallas estructuradas siguen
siendo necesarias (**PROPOSED**). Mapa núcleo de diseño actual (**EXAMPLE**): Prometeo ·
Home/Mission Control · Project · Approvals Inbox · Activity Center · Connector Hub ·
Prometeo Access Center. Superficies adicionales: Engineering Hub · Agents & Automations ·
Model Center · Capabilities Registry · Living Spec · Security Center.

**SHOULD**: cada capacidad nueva declara dónde se invoca conversacionalmente, en qué
pantalla puede verse/controlarse, y dónde se audita su resultado — evitar funciones
huérfanas que existan pero nadie descubra.

---

## Seguridad y privacidad (marco general)

**MUST NOT**: confiar en prompts como única barrera de seguridad (ver clasificación de
controles en `prometeo-and-agents.md` → Action Kernel).

**MUST**: deny-by-default · least privilege · resource authorization (`SKILL.md` §5) ·
tenant/org isolation · privacy propagation · secrets vault · audit inmutable o
tamper-evident (`SKILL.md` §7) · approval gates (`SKILL.md` §6) · scoped connectors ·
sandbox · network policy · rate limits · kill switches (`prometeo-and-agents.md`) · incident
trace.

**MUST**: las restricciones de privacidad sobreviven model overrides y fallbacks (ver
"Privacidad `local-only`" arriba).

### Secretos en logs, errores, trazas y evidencia (resuelve M-10)

**MUST NOT**: secretos en prompts/transcripts, stack traces, payloads logueados,
screenshots, memory dumps, DLQ, backups ni herramientas de observabilidad. **MUST**:
redacción centralizada por `DataClass`, pruebas automáticas de secret leakage en CI cuando
exista el tooling, acceso restringido a los pocos lugares donde un secreto pueda aparecer
por necesidad operativa, TTL corto para cualquier dato sensible retenido, y procedimiento de
rotación documentado ante una exposición confirmada.

### Retención y borrado de transcripts/evidencia (resuelve M-06)

**PROPOSED**: matriz de retención por tipo de dato, finalidad, tenant y jurisdicción,
alineada con `SKILL.md` §7 (retención del AuditEvent) y con Evidence (cadena de custodia).
**MUST**: cuando se ejecute un borrado legal, propagarlo a derivados (caches, índices,
backups) cuando sea legal y técnicamente posible, dejando solo el registro mínimo permitido
por obligación de auditoría.

---

## Producción y despliegues

**MUST NOT**: asumir que `main == production`.

**MUST**: toda afirmación de producción intenta enlazar `repo SHA → build artifact/image →
deployment → config/migrations → runtime behavior`. Un `deployment SUCCESS` no acredita
business correctness (ver jerarquía de verdad en `vision-and-truth.md` §5).

**MUST NOT**: ejecutar migraciones destructivas, dedup o cleanup como efecto colateral
rutinario sin: inventario · backup/restore evidence · rollback/compensation · aprobación ·
observabilidad.

### Migraciones y dual-write (resuelve M-08 y M-09)

**MUST**: plan de migración con patrón expand/contract, compatibilidad temporal entre
versiones de schema, backfill con métricas de progreso, rollback o compensación definidos,
ventana operativa, aprobación y evidencia posterior.

**MUST NOT**: introducir un segundo writer de negocio sin decisión arquitectónica (`DEC-*`).
**MAY**: permitir un writer temporal (dual-write/shadow-write) solo con ownership explícito,
invariantes de reconciliación, métricas de divergencia, fecha de retiro y kill switch — nunca
como estado permanente no documentado.

### Modo offline/degraded (resuelve M-07)

**MUST**: offline solo para operaciones clasificadas explícitamente como seguras offline, con
expiración de autorización, almacenamiento cifrado local, colas locales, claves de
idempotencia generadas offline, y resolución de conflictos definida al reconectar.
**MUST NOT**: ejecutar pagos, deletes o cambios contractuales en modo offline — quedan en
cola bloqueada hasta reconexión y revalidación por el Policy Engine.

---

## Auditoría y reconciliación

Cuando existan varias rutas que mutan la misma entidad:

1. Listar todos los writers.
2. Listar validaciones de cada uno.
3. Listar eventos emitidos.
4. Listar permisos.
5. Listar idempotencia.
6. Listar consumers.
7. Decidir autoridad canónica.
8. Migrar consumidores.
9. Retirar writers duplicados solo después.

**MUST NOT**: eliminar una ruta histórica antes de identificar quién la consume.

---

## Investigación externa

Para hechos técnicos, legales, normativos o de proveedor: preferir fuentes oficiales ·
registrar procedencia · distinguir search result de business fact (`Observation` vs.
`VerifiedFact`, `SKILL.md` §8) · refrescar precio/disponibilidad cerca de la acción ·
minimizar datos sensibles en queries · conservar timestamp para facts volátiles · señalar
conflictos entre fuentes · no inventar cuando una fuente falla (usar `UNKNOWN`, `SKILL.md`
§1, en vez de rellenar con una suposición sin marcarla).

External research is read. Submit/send/purchase/write es una autoridad de acción separada
(pasa por Action Kernel + Policy Engine, no por el resultado de una búsqueda).

---

## Bilingüismo, unidades y campo

SEMSE es bilingüe y mobile-first. **MUST**: manejar explícitamente ES/EN · imperial/métrico ·
zonas horarias · monedas · formatos de fecha/número · direcciones · medidas de campo.
**MUST NOT**: confiar en inferencias silenciosas de unidad cuando una ambigüedad pueda causar
error técnico — guardar unidad con valor siempre.

## Trabajo de campo

Prometeo y Engineering deben estar diseñados para usuarios que trabajan con las manos.
Prioridades UX (**SHOULD**): voz · cámara · inputs mínimos · confirmación de medidas ·
instrucciones claras · operación con una mano · tolerancia a mala red · offline/degraded
mode (ver reglas arriba) · evidencia rápida · explicaciones simples · posibilidad de
profundizar. El sistema **MUST NOT** exigir que un Worker aprenda toda la taxonomía de
funciones — Prometeo descubre capacidades por intención (Capability Registry).

## Datos históricos y aprendizaje

El diferencial de SEMSE no debe depender de que un LLM "sepa más". Valor acumulable
(**EXAMPLE**): historial de proyectos · estimado vs. real · duración estimada vs. real ·
costos · cambios · evidencia · inspecciones · outcomes · reputación · cumplimiento ·
relaciones · pagos · productividad. **MUST**: cualquier aprendizaje/predicción conserva
dataset/source, ventana temporal, población, confidence/limits y posibilidad de explicación
— es una `ModelInference` mientras no cumpla el nivel de verificación requerido para la
decisión que dependa de ella (`SKILL.md` §8).
