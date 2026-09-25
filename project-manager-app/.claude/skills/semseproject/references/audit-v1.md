# Auditoría del skill `semseproject` v1.0.0 (preservada para trazabilidad)

Este documento es el texto de auditoría que acompañaba a la v1.0.0 del skill
`semseproject`, conservado **verbatim** (sin editar) como registro de por qué existen los
contratos de `SKILL.md` §1–§14. Cada hallazgo (`C-*`, `H-*`, `M-*`, `A-*`, `R-*`) está citado
por número desde `SKILL.md` y desde `references/*.md` en el punto donde se resolvió.

**Estado de los hallazgos**: los 5 críticos (C-01–C-05) y la mayoría de los altos (H-01–H-12)
quedaron resueltos por contratos concretos en v2.0.0. Los medios (M-*), ambigüedades (A-*) y
riesgos (R-*) fueron resueltos donde se indica; algunos quedan `PROPOSED` porque requieren una
decisión de producto/legal que este skill no puede tomar unilateralmente (marcados como tal
abajo y en las referencias correspondientes).

No editar este archivo salvo para corregir errores de transcripción — es el registro de
origen, no el documento vivo. El documento vivo es `SKILL.md`.

---

## Estado de esta auditoría

**Actualizado en v2.1.0**: los cuatro hallazgos medios que v2.0.0 dejó `PROPOSED` o
parcialmente resueltos (M-01, M-06, M-11, M-12) ya están resueltos — ver sus entradas abajo.
No queda ningún hallazgo crítico, alto o medio abierto sin resolución o sin marca `PROPOSED`
explícita justificada por requerir una decisión de producto/legal.

## Resumen ejecutivo

El skill establece una dirección sólida en trazabilidad, separación entre diseño y realidad,
autorización, evidencia y control de acciones agentic. Sin embargo, todavía funciona más como
manifiesto arquitectónico que como especificación operativa ejecutable. Las principales
debilidades son:

1. ausencia de un modelo normativo para resolver conflictos entre reglas del propio skill;
2. dependencias críticas mencionadas pero no definidas;
3. falta de contratos mínimos para identidad, tenant, políticas, evidencia, eventos, estados
   y aprobaciones;
4. controles de seguridad descritos como principios, sin requisitos verificables ni
   responsables;
5. ambigüedad sobre qué debe hacer un agente cuando no puede inspeccionar fuentes;
6. riesgo de que "approval", "verification", "audit" y "observed" se interpreten de forma
   inconsistente;
7. referencias históricas y temporales potencialmente inválidas o no verificables;
8. ausencia de gobernanza explícita para cambios del propio skill y del canon.

La prioridad recomendada es convertir el documento en una especificación versionada con
niveles de obligatoriedad, contratos mínimos, matriz de responsabilidades, criterios de
evidencia y procedimientos de excepción. **[Resuelto en v2.0.0 — ver `SKILL.md`.]**

## Hallazgos críticos

**C-01 — No existe una regla de precedencia interna para conflictos entre instrucciones.**
Se define una jerarquía de verdad para hechos del sistema, pero no una jerarquía para
resolver conflictos entre reglas del skill, políticas de seguridad, instrucciones del
usuario, contratos de dominio, configuración de tenant y estado runtime. Riesgo: decisiones
incompatibles (instrucción de usuario vs. aprobación requerida; spec aprobado vs. runtime
deshabilitado; regla global de retención vs. borrado por privacidad; capability declarada vs.
revocada por tenant). **Resuelto: `SKILL.md` §2.**

**C-02 — "Approval Gate" no está definido como contrato operativo.** Falta definir quién
aprueba, si es humana/automática/delegada, qué ve el aprobador, duración/caducidad, alcance
exacto, vínculo con versión del plan, tratamiento de cambios posteriores, doble control para
acciones críticas, revocación, evidencia de la decisión, y qué ocurre si el aprobador no está
disponible. Riesgo: una aprobación genérica reutilizada para otra acción o vuelta obsoleta
tras cambiar monto/destinatario/recurso/parámetros. **Resuelto: `SKILL.md` §6.**

**C-03 — Identidad, autenticación, delegación y attestation no están especificadas.** Se
mencionan principal/actor/rol/identidad/attestation sin modelo de identidad, autenticación,
sesiones, service accounts, impersonación, delegación agente-usuario, representación de
identidad en conectores, rotación/revocación, prueba de posesión, separación
humano/agente, ni límites de autorización delegada. Riesgo: confusión entre "el usuario
pidió", "el agente decidió" y "el sistema ejecutó" en pagos, GitHub, browser use y
multi-tenant. **Resuelto: `SKILL.md` §4.**

**C-04 — La autorización por recurso se exige, pero no existe un contrato mínimo de policy
engine.** Falta el modelo de decisión: entradas obligatorias, resultado, obligaciones,
condiciones, razón de denegación, evaluación fail-closed, caché, consistencia, versionado de
políticas, comportamiento ante caída del policy engine, auditoría de decisiones.
**Resuelto: `SKILL.md` §5.**

**C-05 — No se define qué significa "audit trail immutable o tamper-evident".** Falta
almacenamiento, retención, integridad criptográfica, ordenamiento, reloj, acceso,
exportación, corrección de errores, datos sensibles, separación entre log técnico y registro
probatorio, disponibilidad y recuperación. **Resuelto: `SKILL.md` §7.**

## Hallazgos altos

- **H-01** — mezcla de requisitos obligatorios, objetivos, ejemplos y propuestas sin
  etiquetarlos. **Resuelto: `SKILL.md` §1 (taxonomía MUST/SHOULD/MAY/PROPOSED/EXAMPLE/
  HISTORICAL/UNKNOWN).**
- **H-02** — la jerarquía de verdad no define cómo medir "comportamiento observado y acotado
  en runtime" (entorno, región, tenant, versión/SHA, feature flags, ventana temporal, límites
  de la observación). **Resuelto: `SKILL.md` §7, último párrafo; `vision-and-truth.md` §5.**
- **H-03** — "Estado actual" y "estado de capacidad" no tienen máquina de estados ni
  transiciones válidas; un único campo mezcla dimensiones ortogonales.
  **Resuelto: `vision-and-truth.md` §6 (cinco dimensiones: lifecycle, implementation,
  verification, deployment, runtime).**
- **H-04** — "Capability Registry" carece de contrato de compatibilidad y versionado.
  **Resuelto: `prometeo-and-agents.md`, sección Capability Registry.**
- **H-05** — no se define un catálogo de datos ni clasificación de sensibilidad.
  **Resuelto: `operations.md`, "Clasificación de datos"; `SKILL.md` §3 (DataClass).**
- **H-06** — la privacidad "local-only" no tiene mecanismo de enforcement verificable.
  **Resuelto: `operations.md`, "Privacidad local-only — enforcement".**
- **H-07** — el modelo de eventos no define semántica de entrega ni consistencia.
  **Resuelto: `operations.md`, "Eventos y consistencia".**
- **H-08** — no se define la frontera entre evidencia, observación, afirmación, inferencia y
  decisión. **Resuelto: `SKILL.md` §8.**
- **H-09** — Payments carece de límites de autoridad, ledger canónico y reconciliación
  detallada. **Resuelto: `operations.md`, "Payments / financial governance".**
- **H-10** — la referencia histórica fechada "11-sep-2026" puede ser futura, inválida o no
  verificable. **Resuelto: `reference-state-and-checklist.md`, marcada
  `UNVERIFIED_HISTORICAL_REFERENCE`.**
- **H-11** — no se define el comportamiento mínimo cuando las fuentes no están disponibles.
  **Resuelto: `SKILL.md` §9 (modos de operación).**
- **H-12** — no existe gobernanza del propio skill, del Living Spec ni de las decisiones.
  **Resuelto: `SKILL.md` §12.**

## Hallazgos medios

- **M-01** — tenant/org y project/farm/worksite sin jerarquía ni reglas de herencia.
  **Resuelto (v2.1.0): `operations.md`, "Tenant/org, jerarquía de recursos"** — jerarquía
  Tenant→Project/Farm/Worksite→Job/Milestone/Evidence, membresía multi-organización con
  tenant activo, herencia de permisos evaluada por el Policy Engine (no implícita), y
  `ResourceGrant` para acceso cross-tenant explícito y auditable.
- **M-02** — no se define el modelo de idempotencia. **Resuelto: `operations.md`,
  "Idempotencia".**
- **M-03** — "Verification" no tiene niveles ni independencia requerida. **Resuelto:
  `operations.md`, "Niveles de verificación".**
- **M-04** — no se define el modelo de riesgo ni la matriz de acciones. **Resuelto:
  `SKILL.md` §10.**
- **M-05** — browser/computer use no define aislamiento técnico suficiente. **Resuelto:
  `prometeo-and-agents.md`, "Computer / Browser Use — aislamiento técnico mínimo".**
- **M-06** — no se define la política de retención y borrado de transcripts, prompts,
  imágenes y evidencias. **Resuelto (v2.1.0): `operations.md`, "Retención y borrado de
  transcripts/evidencia"** — matriz por `DataClass` × finalidad × retención por defecto ×
  legal hold, con la regla explícita de que un borrado de usuario nunca purga el AuditEvent
  que registra el borrado.
- **M-07** — el modo offline/degraded carece de límites de seguridad. **Resuelto:
  `operations.md`, "Modo offline/degraded".**
- **M-08** — no se define la política de cambios de esquema y migraciones. **Resuelto:
  `operations.md`, "Migraciones y dual-write".**
- **M-09** — la regla "no introducir un segundo writer" puede bloquear migraciones
  legítimas. **Resuelto:** misma sección, permite dual-write temporal con condiciones.
- **M-10** — no se define cómo se manejan secretos en logs, errores, trazas y evidencia.
  **Resuelto: `operations.md`, "Secretos en logs, errores, trazas y evidencia".**
- **M-11** — no se define la seguridad de subagentes y delegación interna. **Resuelto
  (v2.1.0): `SKILL.md` §4, "Subagentes — contrato de delegación interna"** — `SubagentGrant`
  explícito (capabilities, resourceScope, budget, deadline, dataScope), no transferible ni
  auto-ampliable, con la autoridad de decisión real permaneciendo en el Action Kernel/Policy
  Engine del delegador, nunca en el subagente.
- **M-12** — no se define observabilidad mínima ni objetivos operativos. **Resuelto
  parcialmente (v2.1.0): `operations.md`, "Observabilidad mínima"** — métricas mínimas
  obligatorias (error/latencia, denegaciones de policy, DLQ, bloqueos de privacidad,
  aprobaciones expiradas) antes de declarar una capacidad `DEPLOYED`/
  `OBSERVED_IN_PRODUCTION`. La propiedad del Observability Platform y sus SLOs completos
  siguen siendo una dependencia externa (`SKILL.md` §11) — este skill define el mínimo que
  exige de esa plataforma, no la reemplaza.

## Ambigüedades y contradicciones específicas

- **A-01** — descubribilidad vs. no cargar cientos de tools en prompt. **Resuelto:
  `prometeo-and-agents.md`, Capability Registry (descubribilidad ≠ autorización).**
- **A-02** — ocultar el modelo vs. transparencia/explicabilidad. **Resuelto:
  `prometeo-and-agents.md`, Model Router, "Transparencia mínima requerida".**
- **A-03** — "no confiar en prompts" vs. reglas expresadas como texto. **Resuelto:
  `prometeo-and-agents.md`, Action Kernel (clasificación de controles en 5 capas).**
- **A-04** — "todo cambio durable importante debe producir evento" sin definir "importante".
  **Resuelto: `operations.md`, "Eventos y consistencia" (tres criterios explícitos).**
- **A-05** — "no borrar durable business state" vs. obligaciones legales de supresión.
  **Resuelto: `operations.md`, "Deletes y acciones destructivas" (excepción legal
  documentada).**
- **A-06** — "no inventar cuando una fuente falla" vs. necesidad de continuar con hipótesis.
  **Resuelto: `SKILL.md` §8 (hipótesis `UNVERIFIED` permitidas, no usables para acciones
  sensibles).**
- **A-07** — "toda función nueva debe poder deshabilitarse" sin definir niveles.
  **Resuelto: `prometeo-and-agents.md`, "Kill switches".**

## Dependencias no definidas

Identity Provider · Policy Engine · Resource Authorization Service · Tenant/Org Service ·
Secrets Vault · Credential Broker · Audit Store · Evidence Store · Ledger · Approval Service ·
Capability Registry · Model Router · Verification Service · Event Bus · Outbox Dispatcher ·
Feature Flag/Kill Switch Service · Deployment Provenance Store · Observability Platform ·
Incident Management · Data Classification/Privacy Service · Schema Registry · Migration
Framework · Backup/Restore Platform · Legal/Compliance Review · Human escalation channel.

**Resuelto como registro vivo: `SKILL.md` §11** (ninguno se da por existente hasta
verificarse en el repo/infra real).

## Riesgos de seguridad y gobernanza priorizados

- **R-01** — escalada de privilegios mediante contexto o contenido externo. **Resuelto:
  `prometeo-and-agents.md`, Action Kernel + "Prompt injection y contenido externo".**
- **R-02** — confusión de tenant por referencias incompletas. **Resuelto: `SKILL.md` §5,
  último párrafo; `operations.md`, "Tenant/org, jerarquía de recursos".**
- **R-03** — reutilización de aprobaciones o replay de acciones. **Resuelto: `SKILL.md` §6
  (planHash, expiración, invalidación por cambio material).**
- **R-04** — fallback cloud que viola privacidad. **Resuelto: `operations.md`, "Privacidad
  local-only — enforcement" (prueba negativa obligatoria).**
- **R-05** — manipulación o pérdida de evidencia. **Resuelto: `operations.md`,
  "Evidence-first execution — cadena de custodia mínima".**
- **R-06** — acciones financieras duplicadas o divergentes. **Resuelto: `operations.md`,
  "Payments / financial governance".**
- **R-07** — uso de fixtures/demo como estado operativo. **Resuelto:
  `vision-and-truth.md` §8.2 (namespaces/credenciales/endpoints separados).**
- **R-08** — cambios de política sin revisión o trazabilidad. **Resuelto: `SKILL.md` §12
  (gobernanza — revisión, diff, versión, aprobación para cambios de nivel MUST).**

## Orden de remediación aplicado

**P0 (antes de acciones mutantes de agentes)** — jerarquía normativa, identidad y
delegación, policy engine, approval contract, tenant/resource authorization, Action Kernel
fail-closed, idempotencia, audit trail, clasificación de datos y privacidad, kill switches:
**todo resuelto en v2.0.0** (`SKILL.md` §2, §4, §5, §6, §5/§10, §7, `operations.md`,
`prometeo-and-agents.md`).

**P1 (antes de producción amplia)** — contratos de eventos, ledger y reconciliación,
evidencia y cadena de custodia, capability versioning, browser sandbox, retención y borrado,
migraciones, observabilidad y runbooks, backup/restore, gobernanza del Living Spec:
**mayormente resuelto**; observabilidad/runbooks y backup/restore quedan como dependencias a
confirmar (`SKILL.md` §11), no como contratos nuevos de este skill.

**P2 (antes de escalar verticales y conectores)** — catálogo de dependencias, matriz de
riesgo, modelo offline, subagentes y presupuestos (M-11), cross-tenant rules (M-01),
compatibilidad de schemas, revisión periódica de políticas, pruebas de drift, transparencia
de modelos, métricas de calidad y coste (M-12): **resuelto en v2.1.0** salvo los ítems
marcados `PROPOSED` explícitamente (compatibilidad de schemas de eventos entre versiones,
pruebas de drift automatizadas, y la propiedad plena del Observability Platform), que
siguen pendientes de decisión de producto/plataforma antes de formalizarse como MUST.

## Criterio de aceptación para una versión corregida

Una versión corregida del skill debería permitir responder de forma inequívoca: ¿Quién puede
ejecutar esta acción? ¿Sobre qué recurso y tenant? ¿Qué política lo autoriza? ¿Qué aprobación
se requiere? ¿Qué parámetros fueron aprobados? ¿Qué datos se procesan y dónde? ¿Qué ocurre si
falla una dependencia? ¿Cómo se evita el replay o duplicado? ¿Cómo se verifica el resultado
de negocio? ¿Qué evidencia queda? ¿Cómo se revoca o deshabilita? ¿Cómo se recupera el
sistema? ¿Quién puede cambiar la regla? ¿Qué fuente demuestra el estado actual? ¿Qué parte
sigue siendo desconocida?

**Este criterio es ahora el checklist de cierre de `SKILL.md` §14.** Hasta que un cambio
concreto pueda responder esas preguntas usando los contratos de `SKILL.md`, sigue siendo guía
arquitectónica — no base suficiente para autorizar mutaciones sensibles, pagos, cambios
contractuales, acceso cross-tenant o automatización de browser/computer use.
