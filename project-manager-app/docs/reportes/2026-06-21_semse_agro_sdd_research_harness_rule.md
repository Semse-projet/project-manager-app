# Reporte: SEMSE Agro — regla SDD de investigación externa y registro en arnés

**Fecha:** 2026-06-21  
**Agente:** Codex  
**Estado final:** DONE  

## Qué se hizo

- Se formalizó una regla obligatoria de investigación externa para SEMSEproject.
- La regla exige al menos 3 búsquedas externas independientes al cerrar cada módulo,
  PR, bloque SDD o corte de código listo.
- Se integró la regla en la gobernanza SDD.
- Se integró la regla en el Agentic Harness como checklist pre-DONE.
- Se agregó un bloque obligatorio de "Investigación externa de mejora" al formato de
  reporte por bloque.

## Archivos modificados

- `docs/SDD_GOVERNANCE.md` — agrega el ciclo obligatorio de investigación externa y mejora.
- `docs/AGENTIC_HARNESS.md` — agrega checklist y formato de reporte para el research loop.
- `docs/reportes/2026-06-21_semse_agro_sdd_research_harness_rule.md` — registra esta sesión.

## Investigación externa de mejora

### Búsquedas ejecutadas

1. `spec driven development best practices documentation traceability software engineering`
   - Fuente revisada: https://en.wikipedia.org/wiki/Specification-driven_development
   - Fuente relacionada: https://en.wikipedia.org/wiki/Requirements_traceability

2. `continuous improvement software development code review external research best practices`
   - Fuente revisada: https://en.wikipedia.org/wiki/Code_review
   - Fuente relacionada: https://en.wikipedia.org/wiki/Automated_code_review

3. `AI coding agent harness documentation session logging best practices`
   - Fuente revisada: https://arxiv.org/abs/2605.13357
   - Fuente relacionada: https://arxiv.org/abs/2604.25850

### Ideas detectadas

- La trazabilidad debe conectar requerimiento, especificación, implementación,
  verificación y refinamiento futuro. Esto refuerza que cada hallazgo externo debe
  aterrizar en spec, plan, tasks o backlog.
- Code review no solo detecta bugs; también mejora calidad, mantenibilidad,
  transferencia de conocimiento y alternativas de solución. Esto justifica que el
  research loop busque mejoras, no solo errores.
- Los arneses de agentes necesitan observabilidad de decisiones, acciones y resultados.
  Esto justifica registrar búsquedas, fuentes, decisiones aplicadas, descartadas y
  diferidas.

### Decisiones

- Aplicado ahora:
  - Se agregó el research loop a `docs/SDD_GOVERNANCE.md`.
  - Se agregó el research loop al checklist y formato de reporte en `docs/AGENTIC_HARNESS.md`.
  - Se creó este reporte de sesión.

- Backlog:
  - Crear una plantilla reusable de reporte con la sección de investigación externa.
  - Crear un script que valide que los reportes de bloque contienen la sección
    "Investigación externa de mejora".
  - Agregar checklist automatizado en CI para specs/reportes críticos.

- Descartado:
  - Exigir búsqueda por cada línea individual de código. Se documentó como "corte de
    código listo" porque una búsqueda literal por línea generaría ruido, duplicación y
    decisiones pobres. La intención queda preservada: ningún cambio listo se cierra sin
    investigación externa y registro.

## Decisiones tomadas

- La regla queda en SDD y en el arnés, no solo en SEMSE Agro, porque afecta la forma de
  trabajar de todo el proyecto.
- La investigación externa no reemplaza el spec. Cualquier mejora que cambie alcance,
  arquitectura o contrato debe pasar por spec/plan/tasks antes de codificarse.

## Problemas encontrados

- La solicitud original pide aplicar la regla "cada línea de código". Se ajustó a
  "módulo, PR, bloque SDD o corte de código listo" para mantener auditabilidad real
  sin convertir el proceso en ruido.

## Próximo bloque recomendado

- Crear plantilla oficial de reporte de sesión/bloque con la sección de investigación
  externa ya incluida.
