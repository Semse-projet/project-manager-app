# Reporte: Auditoría y Plan de Mejora del Ecosistema SEMSE

**Fecha:** 2026-06-28
**Estado final:** PLAN DOCUMENTADO
**Rama:** `docs/ecosystem-improvement-master-plan`
**Alcance:** producto, frontend, backend/API, agentes, DevOps/Railway, SDD

## Qué se hizo

- Se revisó el estado de producción, CI y rama base.
- Se distribuyó la auditoría entre cinco agentes especializados.
- Se consolidó una tesis de mejora del ecosistema.
- Se creó un plan maestro por fases.
- Se agregó un kit SDD/SSD para convertir mejoras en specs, planes, tasks y reportes.
- Se armó un arnés de agentes para repartir trabajos futuros con riesgo, herramientas y gates humanos.

## Estado de producción observado

- Web pública respondió HTTP 200 en `/como-funciona`.
- Agro respondió HTTP 200 en `/agro`.
- Mission Control protegió acceso redirigiendo a login.
- API respondió HTTP 200 en `/v1/health`.
- GitHub Actions estaba verde para CI, Railway Deploy, Production Health Gate y CodeQL sobre el commit base.

## Agentes usados

| Agente | Área auditada | Resultado principal |
|---|---|---|
| Product/UX | Flujo público, dashboards, narrativa | Falta flujo canónico valor antes de login y explicación servicio por servicio |
| Frontend/Design Systems | Shell, CSS, navegación, UI | Hay duplicación de nav/tokens/componentes y riesgo CSS por media query |
| Backend/API/Data | Auth, RBAC, tenant, contratos | Prioridad en BFF auth, RBAC deny-by-default y Agro IDOR |
| AI/Agents/Runtime | Runtime, harness, autonomy | Existe base fuerte, falta arnés común y evaluación/replay |
| DevOps/Railway/Security | CI, deploy, health, supply chain | Falta readiness real, deploy gate más fuerte y proteger métricas/SSE |

## Síntesis

SEMSE tiene más producto construido del que la página pública comunica. El riesgo no es falta de ideas; es que las capacidades existen en paralelo. El sistema debe priorizar integración, seguridad, claridad de uso y operación verificable.

La primera mejora visible para usuario debe ser una página que explique cómo se usa SEMSE servicio por servicio y una ruta de intake que permita sentir valor antes de crear cuenta. La primera mejora técnica debe ser cerrar auth/BFF/RBAC/ownership/readiness.

## Hallazgos críticos

- Las rutas BFF del web no deben quedar públicas ni usar identidad estática.
- La API debe fallar cerrada si faltan secretos críticos.
- RBAC necesita registro formal y deny-by-default.
- Agro debe validar tenant/farm/ownership en accesos por ID.
- El shell debe generarse desde `navigationRegistry`.
- Los estilos globales deben revisarse para evitar que base UI quede bajo media query móvil.
- Los agentes necesitan `WorkItem`, manifest, herramientas, política, evaluación y `DecisionPackage`.
- Railway necesita readiness real, no solo health superficial.

## Documentos creados

- `docs/program/strategy/SEMSE_ECOSYSTEM_IMPROVEMENT_THESIS_2026-06-28.md`
- `docs/program/execution/SEMSE_ECOSYSTEM_IMPROVEMENT_MASTER_PLAN_2026-06-28.md`
- `docs/specs/SEMSE_ECOSYSTEM_SDD_KIT_2026-06-28.md`
- `docs/agents/harnesses/SEMSE_ECOSYSTEM_WORK_AGENT_HARNESS_2026-06-28.md`

## Investigación externa de mejora

### Búsquedas/fuentes consultadas

1. OWASP API Security 2023 - Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
2. Next.js Proxy/Middleware matcher docs: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
3. Railway Healthchecks docs: https://docs.railway.com/deployments/healthchecks
4. OpenTelemetry HTTP semantic conventions: https://opentelemetry.io/docs/specs/semconv/http/http-spans/

### Ideas detectadas

- OWASP refuerza que cada endpoint que recibe un ID debe validar autorización a nivel de objeto, no solo rol.
- Next.js refuerza que el matcher debe ser explícito y estático para evitar proteger o excluir rutas incorrectamente.
- Railway confirma que el healthcheck inicial activa el deploy solo al recibir HTTP 200, pero no es monitoreo continuo.
- OpenTelemetry recomienda rutas de baja cardinalidad para spans HTTP, útil para observabilidad sin ruido.

### Decisiones

- Aplicado ahora: el plan P0 prioriza BFF auth, RBAC, ownership por ID y readiness.
- Backlog: observabilidad OpenTelemetry completa queda en F5.
- Descartado por ahora: implementar cambios de código en este bloque; este PR solo documenta la auditoría y prepara el sistema de trabajo.

## Próximo sprint recomendado

1. Spec F0-BFF-AUTH.
2. Spec F0-RBAC-REGISTRY.
3. Spec F0-AGRO-OWNERSHIP.
4. Spec F0-READINESS-RAILWAY.
5. Diseño UI de `como-funciona` servicio por servicio.
6. WorkItems agentic para repartir implementación P0.

## Validación de este bloque

- `git diff --check` pasó sin errores.
- `pnpm spec:preflight` se ejecutó parcialmente:
  - `validate-workspace` pasó.
  - build de paquetes pasó hasta `@semse/tools`.
  - `prisma generate` pasó.
  - se interrumpió manualmente en `@semse/api nest build` después de varios ciclos sin salida nueva.
- No se detectó error de documentación; el corte pendiente es repetir el preflight completo o un build API aislado antes de merge si el PR requiere gate completo.
