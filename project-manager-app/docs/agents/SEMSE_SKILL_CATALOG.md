# Catálogo operativo de skills — SEMSEproject

**Corte del inventario:** 10 de octubre de 2026. **Repositorio canónico:** Semse-projet/project-manager-app. **Estado:** guía de descubrimiento, no motor de autorización.

## Cómo usar este catálogo

- El catálogo es un **índice de activación**, no una orden para cargar todas las skills. Antes de cada tarea leer la gobernanza relevante y seleccionar **una skill principal**, con las de soporte necesarias.
- Fuente real de las 23 skills de Claude: carpeta project-manager-app/.claude/skills/<id>/SKILL.md. Consultar ese archivo, nunca implementar a partir de una descripción de esta tabla.
- **Codex:** leer project-manager-app/AGENTS.md y descubrir por ID los 23 descriptores en .agents/skills/<id>/SKILL.md. Cada descriptor nuevo remite a la skill canónica de Claude y se carga sólo si aplica a la tarea; testing-worker-tracker preserva procedimientos Codex legacy.
- **Claude Code:** leer CLAUDE.md de la raíz, importaciones canónicas y project-manager-app/CLAUDE.md.
- Enrutamiento: cd project-manager-app && pnpm skill:route:report para auditar descubrimiento; pnpm skill:route -- "<descripcion de tarea>" para sugerir una skill. El enrutador es **report-only** y puede equivocarse; leer razones/avisos.
- **Precedencia:** constitución y AGENTS.md > semseproject (policy/approval) > gates SDD, seguridad y dominios > ejecución (aaa-zoom-loop-execution) > skill de tema. Ninguna skill nueva puede eliminar un control previo.
- En trabajo sensible o mutante, la decisión del enrutador no es consentimiento. Prohibidos pagos, presupuestos, secretos, merge y producción sin la autorización y condiciones expresas aplicables.
- Para CI y facturación, usar **ambas**: semse-ci-pr-workflow (ejecución y tests) y semse-github-operations-cost-guard (bloqueos financieros y ahorro).
- Añadir una skill requiere: directorio con SKILL.md + frontmatter legible; actualizar catálogo (o generarlo), probar pnpm skill:route:report, comprobar activación y evitar variantes copiadas que diverjan.

## Inventario real de skills instaladas (23 al integrar el nuevo archivo)

| Skill | Activar cuando la tarea trate de... |
|---|---|
| aaa-zoom-loop-execution | entrega end-to-end, regresiones, evidencia de cierre |
| semse-agents-governance | permisos, policy, delegación de agentes, aprobación |
| semse-audit-remediation | hallazgos remediación, RBAC, aislamiento, escrow |
| semse-bff-pattern | rutas Next.js BFF/API y contratos cliente |
| semse-ci-pr-workflow | CI, jobs, PR, squash merge, preflight y validación |
| semse-design-tokens | tokens visuales web y móvil |
| semse-domain-events | eventos, outbox, auditoría del dominio |
| semse-ecosystem-architect | arquitectura y diseño de producto SEMSE |
| semse-github-operations-cost-guard | billing GitHub, Actions budget, Code Quality, startup_failure, ahorro |
| semse-labor-engine-boundary | límites de field-ops y Labor Engine |
| semse-local-observability-testing | diagnósticos y pruebas observabilidad locales |
| semse-mobile-offline-sync | sincronización offline móvil/web |
| semse-prisma-workflow | migraciones Prisma y drift |
| semse-prometeo-orchestrator | Prometeo, rutas LLM, privacidad y orquestación |
| semse-rbac-permissions | roles y permisos de usuario |
| semse-report-writer | reporte final de trabajo y handoff |
| semse-schemas-contract | contratos Zod/TypeScript/Prisma |
| semse-security-baseline | controles seguridad e IDOR |
| semse-skill-router | descubrimiento consultivo de skills |
| semse-spec-kit-flow | SDD y Spec Kit |
| semse-upload-flow | flujos de upload presignado |
| semseproject | gobernanza maestra SEMSE y autorización |
| testing-worker-tracker | pruebas tracker worker web |

**Conteo:** 22 skills existentes antes de esta intervención + 1 nueva = **23 skills únicas** en la carpeta de Claude después del PR. Esto es un inventario de directorios de skill, no de todos los documentos con ideas de skill.

**Paridad de descubrimiento:** 23 skills Claude ↔ 23 descriptores Codex (21 nuevos, 2 preexistentes). La auditoría de rutas, límites y excepción testing-worker-tracker está en docs/agents/SEMSE_CODEX_SKILL_COVERAGE_AUDIT.md. Una prueba unitaria falla si futuros cambios crean un desbalance; no indica paridad de funcionalidad ni autoriza mutaciones.

## Skills y protocolos fuera del repositorio: clasificación sin duplicar

Durante la revisión de la Library de conversaciones se encontraron artefactos SEMSE:
- SEMSE_SKILL_EXECUTION_PROTOCOL_v1.md — protocolo de ejecución y selección; **documentación externa**; no contarlo como directorio de skill instalado.
- SEMSE Skill Router & Governance Kit v1 — diseño/paquete externo; parte de su propósito ya está en semse-skill-router, que **sí está instalado**.
- AAA Zoom + Loop Execution Skill Pack — paquete externo; ya existe una versión instalada como aaa-zoom-loop-execution.
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
