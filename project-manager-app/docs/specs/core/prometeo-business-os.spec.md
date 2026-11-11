---
id: "core.prometeo-business-os"
title: "Herramientas de Prometeo sobre Business OS: solo lectura y borradores (BO-13)"
domain: "core"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "SEMSE_PROMETEO_BUSINESS_OS_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/prometeo/business-os-tools.service.ts"
  - "apps/api/src/modules/prometeo/prometeo-tool-registry.ts"
  - "apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts"
related_tests:
  - "apps/api/test/prometeo-business-os-tools.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-18"
---
# BO-13 — Prometeo sobre Business OS

Fuente: plan Astra `03_producto/11_PROMETEO_REPORTES_EVIDENCIA.md` ("Funciones autorizables" y "Poderes prohibidos"). Depende de BO-10, BO-11 y BO-12. Usa el registro y el ejecutor de herramientas de Prometeo que ya existen (Tool Registry + política + aprobación + auditoría); no crea otro.

## Decisión del propietario (2026-10-18)
Conjunto aprobado: **herramientas de solo lectura y borradores con revisión humana, sin escrituras automáticas.** Las acciones quedan registradas pero desactivadas.

## Herramientas (namespace `business_os`)
| Herramienta | Tipo | Qué hace | Alcance |
|---|---|---|---|
| `my_assignments` | lectura | Mis tareas asignadas y su estado | Solo las propias |
| `my_skills` | lectura | Cuántas tareas confirmó un responsable, por oficio (hechos, sin niveles) | Solo las propias |
| `crew_tasks` | lectura | Tareas internas de una cuadrilla | Su supervisor o un gestor de cuadrillas de la Org |
| `crew_blocked` | lectura | Qué asignaciones están bloqueadas y por qué; solo informa | Igual que `crew_tasks` |
| `draft_report_summary` | borrador | Texto del reporte diario armado desde el reporte ya generado, marcado `requiresHumanReview` | Igual que `crew_tasks` |
| `assign_task`, `release_task` | acción | Proponen asignar o liberar; requieren aprobación del supervisor | **Desactivadas** (`adapterPending`): hoy las aprobaciones de escritura no están disponibles |

## Reglas
1. **Ninguna herramienta escribe, aprueba, firma ni decide.** No existe herramienta para contratar, firmar, dar roles, liberar escrow, certificar, corregir u horas ni revisar experiencia o reportes: esas decisiones son humanas. Una prueba verifica que no se registre ninguna con esos nombres.
2. **Sin modelo de lenguaje en este slice.** El borrador es determinista: no puede inventar horas, descansos ni timestamps. Si no hay reporte generado, responde que falta, no lo inventa.
3. El alcance se comprueba dentro del servicio en cada llamada (membresía vigente, supervisor o gestor); un trabajador no ve cuadrillas ajenas.
4. Flag `SEMSE_PROMETEO_BUSINESS_OS_ENABLED` apagado → todas devuelven un bloqueo auditado por el mecanismo existente, sin leer datos.
5. Salarios, tokens, coordenadas y fotos no forman parte de ninguna respuesta.

## Criterios de aceptación
AC-01 lecturas sin aprobación, acciones desactivadas y ninguna herramienta prohibida · AC-02 la política deja pasar lecturas y exige aprobación a las acciones · AC-03 flag apagado bloquea sin leer · AC-04 mis asignaciones solo las mías · AC-05 mi experiencia solo lo confirmado y sin niveles · AC-06 alcance de cuadrilla (403/404) · AC-07 bloqueos solo informan · AC-08 borrador determinista, para revisión humana y sin tocar el reporte.

## Fuera de alcance
Propuesta de desglose de tareas con un modelo de lenguaje (necesita privacidad y evaluación; slice aparte), activar las acciones (requiere aprobaciones de escritura), recomendaciones de capacitación, y explicar sugerencias con fuentes.

## Riesgos
Que Prometeo parezca decidir: por eso solo lee y todo borrador lo dice. Que lea de más: el alcance está en el servicio y probado.
