---
id: "agro.prometeo-intake"
title: "Prometeo Agro — intake operacional (buscar → relacionar → completar → crear)"
domain: "agro"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/agro/agro-intake.domain.ts
  - apps/api/src/modules/agro/agro-intake.service.ts
  - apps/api/src/modules/agro/agro-intake.controller.ts
  - apps/api/src/modules/prometeo/prometeo-tool-registry.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
related_tests:
  - apps/api/test/agro-intake.service.test.ts
related_endpoints:
  - farms/:farmId/intake/propose
related_events: []
related_agents:
  - prometeo
last_verified: "2026-09-25"
---

# Spec: Prometeo Agro intake

> Aprobación: solicitud explícita del propietario de producto en la sesión del 2026-09-25 (PR4).

## 1. Resultado

Un reporte de campo en lenguaje natural ("Al lote 15 le falta agua", "Ya alimenté los cerdos del corral 8") se convierte en una propuesta estructurada, relacionada con las entidades reales de la finca, que una persona revisa antes de guardarla.

## 2. Reglas

- No es otro chatbot. Es una capa operativa sobre los datos Agro.
- Solo propone, nunca escribe: `POST v1/agro/farms/:farmId/intake/propose` responde con `requiresHumanReview: true`.
- Principio: buscar → relacionar → completar → crear. Primero busca tareas abiertas (AgroFarmTask + JobTask `domain = "agro"`) e incidencias abiertas similares; crear algo nuevo es el último recurso.
- Sin diagnóstico: la categoría es operativa, la severidad es una *sugerencia* y se guarda con `severityConfirmed = false` (también por la tool `agro.create_incident`).
- `privacyCritical`: el motor v1 es determinista y local (reglas en español, sin LLM), así que ningún dato sale del API. Si se añade un LLM, debe enrutarse a Ollama local.

## 5. Contratos Agente/Prometeo

```yaml
tools:
  - agro.propose_intake   # read, sin aprobación, no persiste
  - agro.list_incidents   # read
  - agro.create_incident  # write, approvalPolicy: confirm, source=PROMETEO
forbidden_behavior:
  - emitir diagnóstico veterinario o agronómico
  - confirmar severidad
  - crear registros sin confirmación humana
```

## Pendiente

Transcripción de audio y análisis de imagen: el audio se adjunta como evidencia y el intake recibe su transcripción como texto. Falta conectar ASR/visión (vision-service) respetando `privacyCritical`.
