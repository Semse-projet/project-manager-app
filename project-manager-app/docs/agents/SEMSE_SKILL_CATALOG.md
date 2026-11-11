# Catálogo operativo de skills — SEMSEproject

**Corte del inventario:** 20 de octubre de 2026. **Repositorio canónico:** Semse-projet/project-manager-app. **Estado:** guía de descubrimiento, no motor de autorización.

## Cómo usar este catálogo

- El catálogo es un **índice de activación**, no una orden para cargar todas las skills. Antes de cada tarea leer la gobernanza relevante y seleccionar **una skill principal**, con las de soporte necesarias.
- Fuente real de las 31 skills de Claude: carpeta project-manager-app/.claude/skills/<id>/SKILL.md. Consultar ese archivo, nunca implementar a partir de una descripción de esta tabla.
- **Codex:** leer project-manager-app/AGENTS.md y descubrir por ID los 31 descriptores en .agents/skills/<id>/SKILL.md. Cada descriptor nuevo remite a la skill canónica de Claude y se carga sólo si aplica a la tarea; testing-worker-tracker preserva procedimientos Codex legacy.
- **Claude Code:** leer CLAUDE.md de la raíz, importaciones canónicas y project-manager-app/CLAUDE.md.
- Enrutamiento: cd project-manager-app && pnpm skill:route:report para auditar descubrimiento; pnpm skill:route -- "<descripcion de tarea>" para sugerir una skill. El enrutador es **report-only** y puede equivocarse; leer razones/avisos.
- **Precedencia:** constitución y AGENTS.md > semseproject (policy/approval) > gates SDD, seguridad y dominios > ejecución (aaa-zoom-loop-execution) > skill de tema. Ninguna skill nueva puede eliminar un control previo.
- En trabajo sensible o mutante, la decisión del enrutador no es consentimiento. Prohibidos pagos, presupuestos, secretos, merge y producción sin la autorización y condiciones expresas aplicables.
- Para CI y facturación, usar **ambas**: semse-ci-pr-workflow (ejecución y tests) y semse-github-operations-cost-guard (bloqueos financieros y ahorro).
- Añadir una skill requiere: directorio con SKILL.md + frontmatter legible; actualizar catálogo (o generarlo), probar pnpm skill:route:report, comprobar activación y evitar variantes copiadas que diverjan.

## Inventario real de skills instaladas (31 en la rama de preparación, sujeto a CI y merge)

| Skill | Activar cuando la tarea trate de... |
|---|---|
| aaa-zoom-loop-execution | entrega end-to-end, regresiones, evidencia de cierre |
| semse-agents-governance | permisos, policy, delegación de agentes, aprobación |
| semse-audit-remediation | hallazgos remediación, RBAC, aislamiento, escrow |
| semse-backup-restore-verification | Restauración aislada y conciliación de respaldos de Postgres/Evidence/originales con SHA-256; nunca equiparar fixture con backup real. |
| semse-bff-pattern | rutas Next.js BFF/API y contratos cliente |
| semse-business-flow-e2e | Journeys de negocio F01–F36, pruebas positivas/negativas y niveles de evidencia sintética, staging y real. |
| semse-ci-pr-workflow | CI, jobs, PR, squash merge, preflight y validación |
| semse-design-tokens | tokens visuales web y móvil |
| semse-domain-events | eventos, outbox, auditoría del dominio |
| semse-ecosystem-architect | arquitectura y diseño de producto SEMSE |
| semse-functional-test | Kit de calidad: pruebas funcionales por rol, ES/EN y organización, casos límite y bugs S1–S4 con evidencia; delega journeys en semse-business-flow-e2e. |
| semse-github-operations-cost-guard | billing GitHub, Actions budget, Code Quality, startup_failure, ahorro |
| semse-labor-engine-boundary | límites de field-ops y Labor Engine |
| semse-local-observability-testing | diagnósticos y pruebas observabilidad locales |
| semse-mobile-offline-sync | sincronización offline móvil/web |
| semse-parity-audit | Kit de calidad: matriz existe/falta/mejorar con evidencia frente a una referencia o un spec; `parity.py` e `imgdiff.py`. |
| semse-prisma-workflow | migraciones Prisma y drift |
| semse-prometeo-orchestrator | Prometeo, rutas LLM, privacidad y orquestación |
| semse-rbac-permissions | roles y permisos de usuario |
| semse-recon | Kit de calidad: reconocimiento funcional de una plataforma de referencia y reseñas enlazadas (`reviews.py`) como insumo de spec; nunca código. |
| semse-railway-release-verification | Preflight y gates seguros de releases Railway: SHA, CI, migración, canario y rollback; sin autorización implícita. |
| semse-release-gate | Kit de calidad: veredicto BLOCKED/UNVERIFIED/READY_FOR_HUMAN_REVIEW de un PR (contratos, ES/EN, seguridad, contraste WCAG); nunca merge ni deploy. |
| semse-report-writer | reporte final de trabajo y handoff |
| semse-schemas-contract | contratos Zod/TypeScript/Prisma |
| semse-security-baseline | controles seguridad e IDOR |
| semse-skill-router | descubrimiento consultivo de skills |
| semse-spec-kit-flow | SDD y Spec Kit |
| semse-synthetic-test-data | Fixtures, factories, seed y teardown deterministas en bases de prueba aisladas; sin datos falsos en producción. |
| semse-upload-flow | flujos de upload presignado |
| semseproject | gobernanza maestra SEMSE y autorización |
| testing-worker-tracker | pruebas tracker worker web |

**Conteo (rama de preparación):** 23 skills previamente existentes + 4 skills de pruebas/release/recuperación + 4 skills del kit de calidad SEMSE (`docs/semse-kit/README.md`) = **31 SKILL.md canónicos** para Claude y **31 descriptores de descubrimiento** para Codex. La aparición en una rama no significa que estén instaladas en `main` hasta completar CI, revisión y merge. No equivale a que se hayan ejecutado pruebas o habilitado un flujo.

**Paridad esperada tras esta entrega:** 31 skills Claude ↔ 31 descriptores Codex (23 históricas + 4 de pruebas/release/recuperación + 4 del kit de calidad). La auditoría de rutas, límites y excepción testing-worker-tracker está en docs/agents/SEMSE_CODEX_SKILL_COVERAGE_AUDIT.md. Una prueba unitaria falla si futuros cambios crean un desbalance; no indica paridad de funcionalidad ni autoriza mutaciones.

## Skills y protocolos fuera del repositorio: clasificación sin duplicar

Durante la revisión de la Library de conversaciones se encontraron artefactos SEMSE:
- SEMSE_SKILL_EXECUTION_PROTOCOL_v1.md — protocolo de ejecución y selección; **documentación externa**; no contarlo como directorio de skill instalado.
- SEMSE Skill Router & Governance Kit v1 — diseño/paquete externo; parte de su propósito ya está en semse-skill-router, que **sí está instalado**.
- AAA Zoom + Loop Execution Skill Pack — paquete externo; ya existe una versión instalada como aaa-zoom-loop-execution.
- replica-skill (Jakeschincariol/replica-skill, MIT, commit 77c9436) — paquete externo de 11 skills; **no instalado**. Sus capacidades útiles se adaptaron en las 4 skills del kit de calidad (semse-recon, semse-parity-audit, semse-functional-test, semse-release-gate); qué se adoptó y qué se descartó está en docs/semse-kit/README.md.
- SKILL_ROUTING_PRE_AUDIT_v1.md y SEMSE_SITE_EVOLUTION_EXECUTION_LEDGER_v1.md — auditoría/ledger; **no contarlos como skills instaladas**.

Los documentos ajenos al repositorio se deben revisar individualmente por ID/versión/contenido antes de importar, porque puede haber borradores, duplicados y contradicciones. El inventario de Library no demuestra que todas las conversaciones estén representadas.

## Repositorios vs proyectos ChatGPT

- Semse-projet/project-manager-app es el repositorio canónico comprobado, con carpeta de skills indicada arriba.
- La URL histórica Samuelcastella/project-manager-app redirige al mismo ID de repositorio; **no contar ese alias como segundo repositorio independiente**.
- La identidad y el inventario de los **dos proyectos de ChatGPT llamados SEMSE** no están acreditados por el listado de GitHub. Requieren reconciliación explícita con sus archivos, sin asumir que son repos GitHub distintos.
- No importar paquetes por nombre similar; usar contenido, alcance, checksum o historial para decidir si faltan habilidades nuevas.

## Checklist de incorporación

1. Cargar solo gobernanza obligatoria y skill principal.
2. Resolver nombre, versión, rutas y precondiciones reales.
3. Clasificar READ_ONLY / PROPOSE / MUTATE y pedir autorizaciones en mutaciones sensibles.
4. Registrar evidencia, estado y riesgos sin confundir «escrito», «instalado», «usado», «CI verde» y «desplegado».
5. Actualizar catálogo/instrucciones solo con cambios revisados en PR; no alterar un repositorio cuando otro agente está trabajando sobre los mismos archivos.
