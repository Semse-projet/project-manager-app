# Vision / Program / Foundation Alignment Audit — 2026-03

## Objetivo

Contrastar:

- vision ejecutiva (`/home/yoni/labsemse/vision/VISION_EXECUTIVE_SUMMARY.md`)
- programa de integracion (`/home/yoni/labsemse/program/INTEGRATION_EXECUTION_STATUS.md`)
- documentacion base del repo (`docs/foundation`, `docs/vision`)

para detectar alineacion real, contradicciones y huecos en:

- job-first
- escrow
- evidence
- disputes
- trust
- ops

## Resumen corto

La direccion general esta alineada.

El repo ya documenta correctamente que:

- `Job` es la entidad canonica de producto
- `Project` sigue como puente tecnico transitorio
- ownership debe resolverse por organizacion
- escrow, evidence y disputes no deben profundizar nuevas dependencias en `projectId`
- `Prometeo` orienta la arquitectura, pero no entra completo al MVP

El problema principal no es de vision.
Es de sincronizacion documental fina.

Hay documentos que ya reflejan el avance reciente del programa, pero otros siguen describiendo un estado mas viejo y dejan dudas operativas en trust, ops y dispute handling.

## Alineaciones fuertes

### 1. Job-first

Alineado entre vision, programa y foundation:

- vision define `Job` como unidad principal del marketplace
- programa refuerza ownership por organizacion y estados canonicamente mas cercanos a `posted/reserved/accepted/inProgress/review/dispute/completed/cancelled`
- foundation repite de forma consistente que `Project` es soporte transitorio

Documentos fuertes:

- `docs/foundation/DOMAIN_MODEL_MVP.md`
- `docs/foundation/JOB_PROJECT_TRANSITION_PLAN.md`
- `docs/foundation/JOB_VS_PROJECT_BOUNDARY.md`

### 2. Ownership por organizacion

Alineado y mejorado recientemente:

- programa confirma `JobReservation.professionalOrgId`, `Contract.clientOrgId` y `Contract.professionalOrgId`
- foundation ya trata usuario como identidad de accion/auditoria, no como ownership canonico

### 3. Vision boundary de Prometeo

Alineado:

- vision ejecutiva y `docs/vision` dejan claro que governance/identity/wallets son capa futura
- foundation no intenta meter esa complejidad en el MVP actual

## Contradicciones o desajustes detectados

### 1. `IMPLEMENTATION_GAPS_VS_VISION.md` estaba parcialmente atrasado respecto al programa

El programa ya reporta:

- rutas job-first de evidence
- mejor expresion de estados de ops
- transicion explicita a ownership por organizacion

Pero el documento de gaps todavia hablaba de evidence demasiado anclado a `projectId` y de trust/ops con menos precision que la que hoy ya existe.

Lectura correcta:

- sigue habiendo herencia `project`-centric
- pero ya hay avances concretos que deben quedar reflejados para no sobredimensionar la brecha

### 2. Gap entre dispute flow basico y policy financiera explicita

La vision exige disputa resoluble y dinero controlado.

Foundation documenta bien que la disputa bloquea cierre final, pero todavia queda poco explicitado en una sola regla operativa que:

- disputa abierta congela releases no obligatorios
- resolucion debe dejar decision sobre fondos
- ops no debe mover estados financieros como si no hubiera disputa activa

Parte de esto ya aparece dispersa, pero no estaba suficientemente consolidado.

### 3. Trust esta bien posicionado como capa explicable, pero aun delgado como dominio operativo

Lo bueno:

- vision lo define bien
- `TRUST_SIGNAL_MODEL.md` evita score-magico y explicita explainability

Lo flojo:

- faltaban invariantes mas claros para separar `trust` de `policy`
- faltaba dejar mejor dicho como `ops` consume trust sin convertirlo en bloqueo automatico

### 4. Ops aparece como capa clave, pero sin suficientes invariantes transversales en foundation

Existe buen material en module map y programa.

Faltaba consolidar reglas como:

- ops puede intervenir, pero no reescribir ownership
- snapshots ops no deben inventar estado canonico alterno
- toda accion manual de ops en disputa, escrow o cierre debe quedar auditada y explicable

## Huecos principales por tema

### Job-first

Hueco actual:

- aun falta una definicion mas ejecutiva y unificada del `happy path` canonico y sus puentes legacy
- la documentacion esta correcta, pero repartida en muchos archivos

### Escrow

Hueco actual:

- falta dejar mas explicita la regla de congelamiento durante disputa
- falta aclarar mejor la relacion entre `fund`, `release`, `refund` y cierre/cancelacion

### Evidence

Hueco actual:

- la vision trata evidence como infraestructura, pero foundation aun no sintetiza del todo un criterio minimo de completitud verificable para review/dispute/trust
- existe `evidence completeness` en vision, pero no una traduccion minima operativa en foundation

### Disputes

Hueco actual:

- hay politica e invariantes, pero falta una vista mas clara del lifecycle minimo de disputa con efecto sobre milestones y escrow

### Trust

Hueco actual:

- falta formalizar mejor la frontera entre:
  - senal explicable
  - score
  - automatizacion ops
  - gating de policy

### Ops

Hueco actual:

- falta reforzar documentalmente que `ops.dashboard` y snapshots son lectura/supervision y no una segunda fuente de verdad del dominio

## Decision documental recomendada

Mantener estas reglas como canon practico inmediato:

1. vision manda sobre herencia tecnica
2. programa manda sobre el orden de ejecucion
3. foundation debe distinguir siempre entre:
   - estado actual
   - puente transicional
   - target canonico
4. ninguna nueva decision debe profundizar `projectId` como centro del producto
5. trust no bloquea por score solo; cualquier bloqueo sale de policy explicita
6. ops puede supervisar e intervenir, pero toda excepcion debe quedar auditada

## Backlog documental recomendado

1. consolidar lifecycle minimo de disputes con efecto financiero
2. formalizar criterio minimo de evidence completeness por milestone
3. definir mejor reglas de sincronizacion entre estado canonico de `Job` y snapshots de ops
4. aclarar frontera formal entre trust score, risk signals y policy gates
5. agregar una vista unica del happy path job-first con legacy bridges permitidos

## Estado despues de esta auditoria

Queda documentado que la alineacion general es buena, pero la deuda real esta en hacer mas explicables los puentes transicionales y las reglas de excepcion en dispute / trust / ops.
