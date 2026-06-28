# Plan Maestro de Mejora del Ecosistema SEMSE

**Fecha:** 2026-06-28
**Estado:** ACTIVO
**Tesis:** `docs/program/strategy/SEMSE_ECOSYSTEM_IMPROVEMENT_THESIS_2026-06-28.md`
**Kit SDD:** `docs/specs/SEMSE_ECOSYSTEM_SDD_KIT_2026-06-28.md`
**Arnés:** `docs/agents/harnesses/SEMSE_ECOSYSTEM_WORK_AGENT_HARNESS_2026-06-28.md`

## Objetivo

Mejorar el ecosistema SEMSE sin aumentar deuda estructural: primero seguridad y readiness, después flujo público, navegación, contratos, agentes, observabilidad y módulos de negocio.

## Evidencia base

- `origin/main` desplegado desde `f120b58 feat: Agro evidence/audit dark UI + Admin OS sidebar (9 módulos) (#224)`.
- GitHub Actions reportó éxito en CI, Railway Deploy, Production Health Gate y CodeQL.
- Producción respondió HTTP 200 en web `/como-funciona`, web `/agro` y API `/v1/health`.
- `admin/mission-control` redirige a login correctamente.
- Cinco agentes exploraron producto/UX, frontend, backend/API/data, AI/runtime y DevOps/Railway/security.

## Fases

### F0. Congelamiento de seguridad y readiness

**Objetivo:** cerrar riesgos que pueden filtrar datos, aceptar identidades falsas o desplegar servicios no listos.

**Entregables:**

- BFF web sin fallback de identidad estática en rutas sensibles.
- Middleware/proxy con matcher explícito para rutas públicas, privadas y API.
- API fail-closed cuando falten secretos de auth o bootstrap.
- Registro RBAC completo y deny-by-default en endpoints autenticados.
- `/v1/ready` separado de `/v1/health`, validando DB, Redis/queues, storage y migraciones.
- Plan para sacar migraciones mutantes de boot/deploy.
- Métricas/SSE protegidas cuando expongan datos operativos.

**Aceptación:**

- Tests negativos de auth/BFF/RBAC pasan.
- Health gate falla si DB/Redis no están listos.
- No hay endpoint P0 que use identidad de desarrollo en producción.

### F1. Flujo público canónico

**Objetivo:** que la web explique servicio por servicio y convierta sin exigir login antes de valor.

**Entregables:**

- Página `como-funciona` semántica, no solo rewrite implícito.
- Guía visible por servicio: Jobs, Escrow/Payments, Evidence, Field Ops, BuildOps, Agents, Agro, Mission Control.
- Intake anónimo: descripción del trabajo, ubicación, fotos/documentos opcionales, estimación inicial y draft recuperable.
- Login/register solo para publicar, contratar, pagar o guardar identidad permanente.
- Checklist de interacción por rol: cliente, profesional, operador, admin.

**Aceptación:**

- Usuario puede explicar qué hace cada servicio después de leer la página.
- CTA principal inicia intake, no una pared de login.
- E2E cubre visita pública, draft, redirección de publicación y retorno post-login.

### F2. Navegación, diseño y shell

**Objetivo:** reducir duplicación UI y hacer que todos los módulos vivan dentro de una experiencia operativa consistente.

**Entregables:**

- `navigationRegistry` como fuente única para sidebar, shell, breadcrumbs y módulos.
- Remoción de listas NAV hardcodeadas en `(app)/layout.tsx`.
- Corrección del riesgo CSS donde estilos globales quedan atrapados bajo media query móvil.
- Consolidación de `LandingNav` duplicado.
- Revisión de clases Tailwind inválidas o no generadas.
- Plan de convergencia entre `@semse/ui` y `apps/web/components/ui`.
- Agro integrado como vertical del shell con `FarmShell`, tabs compartidos y protección de middleware.

**Aceptación:**

- No hay warnings de key duplicada en navegación.
- Desktop y móvil renderizan estilos base fuera de media queries accidentales.
- Agro conserva rutas existentes pero hereda shell, auth y navegación.

### F3. Dominio, API y datos

**Objetivo:** hacer que los datos críticos sean tenant-safe y que los contratos API sean ejecutables.

**Entregables:**

- Registro formal de permisos usados por código: `jobs:update`, `ops:*`, `workers:*`, `agents:run`, `milestones:write` y equivalentes.
- Repositorios tenant-safe para jobs, evidence, payments, buildops y Agro.
- Fix de IDOR en Agro: farm-units, animals, groups, inventory items y tasks.
- Envelope de respuesta consistente y schemas compartidos donde aplique.
- Dinero representado con tipos seguros, no floats para lógica monetaria.
- Soft delete/versioning donde existan datos operativos auditables.

**Aceptación:**

- Tests de ownership por endpoint P0/P1.
- Specs actualizados antes del código.
- No hay GET/PUT/DELETE por ID que ignore tenant/farm/ownership.

### F4. Arnés de agentes y runtime unificado

**Objetivo:** que los agentes trabajen como profesionales auditables, no como prompts sueltos.

**Entregables:**

- `WorkItem` canónico con objetivo, riesgo, contexto, SLA, owner humano y agente sugerido.
- `AgentManifest`, `ToolManifest`, `InputSchema`, `OutputSchema` y `EvaluationRubric`.
- `DecisionPackage` como salida obligatoria para decisiones L2+.
- Adaptadores para `AgentRun`, `DeveloperRuntime`, `Autonomy` y `HumanTask`.
- Roster de agentes profesionales y técnicos definido en el arnés.
- Replay/evaluación con tareas doradas y scoring.

**Aceptación:**

- Ningún agente muta producción sin política y gate.
- Cada ejecución deja audit trail, fuentes, pruebas y rollback plan.
- Mission Control puede mostrar decisiones pendientes y paquetes de decisión.

### F5. Observabilidad, release y supply chain

**Objetivo:** saber si el sistema está sano y poder desplegar con menos incertidumbre.

**Entregables:**

- E2E real con web/API arrancados o URLs configuradas explícitamente.
- Deploy Railway basado en estado de deployment, no solo `sleep`.
- Rollback/runbook documentado.
- Trivy/SBOM/secret scan para imágenes y dependencias críticas.
- OpenTelemetry HTTP spans con baja cardinalidad y atributos útiles.
- Runbooks de incidentes: auth, DB, Redis, payments, evidence storage, agents.

**Aceptación:**

- Health gate bloquea fallas reales.
- CI muestra artefactos de e2e y reportes.
- Release notes incluyen riesgos, migraciones y rollback.

### F6. Módulos de negocio y confianza

**Objetivo:** mejorar el valor visible después de estabilizar la base.

**Entregables:**

- Dashboards orientados a próximas acciones.
- Mission Control con colas de excepción: pagos, evidencia, SLA, disputes, agentes, deploys.
- Payment readiness por milestone/evidence.
- Trust/risk signals explicables.
- Agro como vertical demostrativa bajo el mismo modelo de permisos, evidencia y métricas.

**Aceptación:**

- Operaciones puede priorizar trabajo diario desde un solo tablero.
- Cliente y profesional ven próximos pasos claros.
- Agentes recomiendan, pero las decisiones críticas quedan aprobadas por humano.

## Backlog priorizado

| Prioridad | Bloque | Resultado esperado | Agente líder |
|---|---|---|---|
| P0 | BFF auth y middleware | Cerrar identidad estática y rutas API públicas indebidas | Security/API Architect |
| P0 | RBAC deny-by-default | Permisos formales y pruebas negativas | Backend/API Architect |
| P0 | Agro IDOR | Acceso por ID validado por tenant/farm/ownership | Backend/API Architect |
| P0 | `/v1/ready` | Readiness real para Railway y health gate | DevOps/SRE |
| P1 | Página de uso por servicio | Explicar SEMSE servicio por servicio e interacción por rol | Product/UX + Frontend |
| P1 | Intake público | Valor antes de login y draft recuperable | Product/UX + Frontend + API |
| P1 | Navigation registry | Shell unificado sin duplicación | Frontend Architect |
| P1 | CSS/design tokens | Base visual estable desktop/móvil | Design Systems |
| P1 | AgentHarness v1 | WorkItem, manifests, tools, DecisionPackage | Agent Runtime Architect |
| P2 | Observabilidad | Traces/logs/metrics y runbooks | DevOps/SRE |
| P2 | Supply chain | SBOM, scans y dependencias pinneadas | Security Engineer |
| P2 | Dashboards next-action | Operación orientada a decisiones | Product/UX + Frontend |

## Sprint recomendado inmediato

1. Crear specs SDD para F0: BFF auth, RBAC registry, Agro ownership y readiness.
2. Implementar tests negativos primero.
3. Arreglar BFF/middleware y fail-closed de auth.
4. Corregir IDOR Agro y proteger rutas Agro en middleware.
5. Agregar `/v1/ready` y ajustar health gate Railway.
6. En paralelo, diseñar la página `como-funciona` con explicación servicio por servicio.

## Definición de terminado

- Spec aprobado o actualizado.
- Tests unitarios/controller/e2e según riesgo.
- Validación local documentada.
- Research loop externo registrado si el bloque queda listo.
- Reporte en `docs/reportes/`.
- Sin warnings nuevos de seguridad, lint, typecheck o build.
- DecisionPackage si hubo intervención agentic L2+.
