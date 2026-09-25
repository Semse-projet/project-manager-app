# Estado de referencia, fuentes canónicas y plantilla de respuesta

Referencia del skill `semseproject`. Marcas de taxonomía según `SKILL.md` §1. Ante conflicto
con `SKILL.md` §1–§12, `SKILL.md` gana. El checklist de activación autorizado vive en
`SKILL.md` §14; este archivo conserva el original para contexto y lo marca superado.

---

## Estado de referencia conocido (resuelve H-10 — corte histórico, NO verdad eterna)

**HISTORICAL / UNVERIFIED_HISTORICAL_REFERENCE.** El documento original citaba una
"auditoría del 11-sep-2026" sin `sourceId`, hash/commit, autor, zona horaria ni ubicación
recuperable. Por la regla de este skill (`SKILL.md` §1, marca HISTORICAL): **MUST NOT**
usarse como evidencia del estado actual del sistema sin re-verificar contra fuentes vivas
(`docs/SPEC_INDEX.md`, código, runtime).

Contenido de esa referencia, conservado únicamente para contexto histórico:

> Reportó una base amplia pero no reconciliada: 80 capacidades, con muchas PARCIAL y varias
> ROTA/DUPLICADA/SOLO DISEÑADA. Gaps críticos señalados en ese corte incluían: reconciliación
> de Payments y autorización por recurso · caminos divergentes de release · privacidad IA no
> propagada correctamente · identidad/attestation no atómica · migraciones/cleanup de alto
> riesgo · restore no acreditado · CI/deploy provenance incompleto · Evidence con
> writers/policies diferentes · Live Sessions parcial · frontend Stripe incompleto · solapes
> de estado/fixtures · diferencias entre repo y producción.

**MUST**: antes de usar cualquiera de estos gaps como actuales, revalidar contra el estado
real del repo/producción y declarar el modo de operación usado para esa revalidación
(`SKILL.md` §9).

Si en el futuro se produce una auditoría equivalente, registrarla con: `sourceId` · fecha
ISO con zona horaria · ubicación (ruta o URL interna) · SHA/hash del commit auditado ·
alcance · autor · estado de confiabilidad — de lo contrario, tratarla también como
`UNVERIFIED_HISTORICAL_REFERENCE`.

---

## Fuentes canónicas a consultar

Buscar y priorizar documentos equivalentes a (**EXAMPLE** de nombres de archivo, verificar
cuáles existen realmente en el repo antes de citarlos como si existieran):

- `SEMSEproject_Auditoria_YYYY-MM-DD.md`
- `SEMSEproject_Matriz_YYYY-MM-DD.csv`
- `SEMSEproject_Ejecucion_YYYY-MM-DD.md`
- `SEMSE_Prometeo_Live_Architecture_v1.3_ALL.md` o versión superior
- `docs/SPEC_INDEX.md`
- `docs/CANONICAL_STATE_REGISTRY.md`
- `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`
- `docs/program/ARCHITECTURE_TARGET.md`
- specs por dominio (`docs/specs/`)
- ADRs
- repo actual · CI actual · runtime/deployment actual

**MUST NOT**: asumir que la versión más nueva de un documento gana automáticamente si
contradice runtime o código — reconciliar según la jerarquía de verdad
(`vision-and-truth.md` §5).

---

## Plantilla de respuesta de un agente de SEMSE

Al terminar una tarea importante bajo este skill, reportar:

**Objetivo** — qué se pidió.

**Estado previo verificado** — qué existía realmente y con qué evidencia (citar el modo de
operación usado, `SKILL.md` §9).

**Decisión** — qué enfoque se tomó y por qué; si hubo conflicto normativo, qué nivel de la
jerarquía (`SKILL.md` §2) lo resolvió.

**Cambios** — archivos/módulos/capacidades afectados.

**Seguridad/invariantes** — qué se preservó (Policy Engine, Approval Gate, Audit Trail,
tenant isolation) y qué riesgos quedan abiertos.

**Verificación** — tests, CI, runtime o evidence citados explícitamente.

**Estado de Living Spec** — usando las cinco dimensiones de `vision-and-truth.md` §6, no un
único "done".

**Pendientes** — solo gaps reales; no inventar completitud (`SKILL.md` §1, marca `UNKNOWN`
para lo no verificado).

---

## Regla de oro

SEMSE debe poder crecer en capacidades sin crecer en caos. Cada pieza nueva **MUST**:
integrarse por contratos estables (`SKILL.md` §3–§7) · respetar permisos (`SKILL.md` §5) ·
usar fuentes de verdad (`vision-and-truth.md` §5) · conservar trazabilidad (`SKILL.md` §7) ·
ser descubrible (Capability Registry) · ser verificable (`SKILL.md` §8, niveles de
verificación en `operations.md`) · poder deshabilitarse (kill switches,
`prometeo-and-agents.md`) · mantener compatibilidad o migración explícita · alimentar el
Living Spec · no romper el flujo operativo central (`vision-and-truth.md` §2).

La meta no es "tener muchas funciones". La meta es que cualquier función nueva pueda
conectarse con lo anterior de forma segura, trazable y evolutiva.

---

## Checklist de activación — ver `SKILL.md` §14

El checklist operativo autorizado vive en `SKILL.md` §14 (incluye declarar modo de
operación, `riskLevel` y Approval Gate antes de cualquier acción mutante). La versión
original de este checklist, anterior a la remediación P0, era más corta y no exigía declarar
modo de operación ni `riskLevel` — se conserva aquí solo para trazabilidad de qué cambió:

> ☐ identificar tarea y dominio · ☐ recuperar contexto de Project · ☐ localizar la
> auditoría/matriz/spec más reciente · ☐ fijar SHA si se trabaja sobre código · ☐ determinar
> si la tarea es read-only o mutante · ☐ identificar resource authorization · ☐ identificar
> writers duplicados · ☐ identificar riesgo financiero/seguridad · ☐ definir criterio
> verificable de cierre · ☐ actualizar Living Spec/decision trail cuando corresponda.
>
> Si no se puede verificar algo, declararlo como desconocido, no inferirlo como hecho.
