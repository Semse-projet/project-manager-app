# Biblioteca Técnica — seguimiento de revisión, 2026-10-23

## Alcance y evidencia

Revisión de [Devin en #1008](https://github.com/Semse-projet/project-manager-app/pull/1008#issuecomment-6272283912), sobre `d3f206f4`. Se contrastó con HEAD `8cec36df05e46046fc0f4af3cbba8e050670a9fd` y con #1010 `e5cc54980732959211fe4fc2a79654949c0d26e9` antes de editar. Ambos siguen DRAFT; no se encontraron reviews APPROVED. El CI del head F1A permanece fallido sin nueva ejecución observada. No se reintentó ni cambió configuración de Actions.

## Análisis spec/plan/tasks/checklist y correcciones documentales

| Observación | Corrección preparada | Límite |
|---|---|---|
| 1. ADR ausente | ADR-curated-knowledge-custody-and-gateway PROPOSED, alternativas, riesgos, aceptación y rollback | No es aprobación independiente; ID semántico evita colisión con ADR-046 de #987 |
| 2. ADRs previos no citados | ADR-036 preserva orquestación/tool policy; ADR-022 gobierna outbox/receipts/BullMQ | Integraciones propuestas, no implementadas |
| 3. Ownership indefinido | Extensión del KnowledgeModule existente; controlador/policy/repositorio de dominio | No crear otro backend o router |
| 4. FSM/eventos inconsistentes | DRAFT/REDACTION_REVIEW/TECH_REVIEW/READY/PUBLISHED/SUSPENDED/WITHDRAWN/SUPERSEDED; tabla de transiciones en spec; curated_knowledge.withdrawn y aggregateRevision en anexo | F1 sólo DRAFT; eventos no registrados hasta implementación |
| 5. GET privados ausentes del spec | /private/drafts y /private/consents incorporados con scopes y paginación | No endpoints existentes |
| 6. Relación con ingesta APPROVED ausente | Enmienda propuesta explícita, alcance compartido y seguimiento #974/#992 | No cambia silenciosamente el contrato APPROVED ni prueba cuarentena |

También se alineó la lectura de borradores: F1 aportante/custodio; revisores sólo desde F2. El gateway se limita a biblioteca curada y conserva autorización de tool y de recurso como verificaciones distintas.

## Hallazgos F1A que el test histórico no cierra

Se consultaron los seis hilos de Codex; todos continúan abiertos. La migración actual de #1010 se leyó directamente.

| Hilo | Evidencia del esquema actual | Criterio de cierre |
|---|---|---|
| [Titular org](https://github.com/Semse-projet/project-manager-app/pull/1010#discussion_r4311411737) | Ya existe CHECK holder_org_required | Revisión independiente del fix y rechazo específico de NULL; no cerrar sólo por lectura propia |
| [Delete/recreate](https://github.com/Semse-projet/project-manager-app/pull/1010#discussion_r4311411742) | Trigger sólo BEFORE UPDATE | Reservar identidad/versión incluso tras borrado; prueba delete/recreate con ID y ordinal anteriores, sin bypass de mantenimiento disponible al runtime |
| [Retiro monotónico](https://github.com/Semse-projet/project-manager-app/pull/1010#discussion_r4311411748) | CHECK fecha no impide volver withdrawnAt a NULL ni retarget de firma | Identidad/hash/política inmutables, retirada irreversible del registro; nuevo grant con nueva identidad; pruebas SQL y concurrencia |
| [Procedencia](https://github.com/Semse-projet/project-manager-app/pull/1010#discussion_r4311411752) | sourcePrivateRef está en Entry mutable, no Version | Snapshot privado inmutable por versión o guarda equivalente; nueva fuente exige nueva versión |
| [Identidad persistida](https://github.com/Semse-projet/project-manager-app/pull/1010#discussion_r4311411762) | actorUserId es texto sin FK a usuario | FK a identidad persistida y pruebas de inexistente; sesión/membresía/mandato se verifican aparte |
| [Idempotencia](https://github.com/Semse-projet/project-manager-app/pull/1010#discussion_r4311411770) | Sólo índices no únicos de Consent | Constraint de identidad activa o request key durable; dos firmas concurrentes no dejan duplicado activo tras retirar |

No se modificaron migraciones aplicadas, código, grants ni producción. Los cinco últimos son gaps de integridad persistente antes de endpoints, no sólo tareas de UI. La declaración anterior de F1A parcialmente verificada sigue limitada a las aserciones que sí corrieron en el CI histórico.

## Siguiente entrega y decisión pendiente

Corregir/validar integridad F1A antes de completar F1B. El código de nuevo dominio sigue sujeto al SDD aprobado que exige AGENTS.md; propietario ya ratificó producto. Falta dictamen independiente del expediente y definición competente de derechos/retención. No se cambió DRAFT/PROPOSED a APPROVED ni se cerraron hilos por cuenta del revisor.

## Validación de esta entrega

- `node scripts/spec-validate.mjs --strict`: 203 specs, 0 errores, 0 advertencias en checkout completo.
- `node scripts/spec-index.mjs --check`: 203 entradas coherentes.
- `git diff --check`: PASS.
- Comprobación local de coherencia: nombres FSM/eventos, GET privados, referencias ADR-022/036, ownership, enlaces relativos y preservación DRAFT/PROPOSED: PASS.
- El primer intento sobre checkout parcial reportó referencias de código ausentes; se completó el checkout y se repitió el validador. No se modificaron specs ajenos para ocultar esos errores del entorno.
- No se ejecutaron nuevas pruebas PostgreSQL/HTTP, rollback ni revisión humana independiente. CI histórico no se atribuye a esta entrega.
