# Tesis de Mejora del Ecosistema SEMSE

**Fecha:** 2026-06-28
**Estado:** ACTIVO
**Alcance:** `project-manager-app`, web, API, agentes, Agro, Railway, documentación SDD
**Documento hermano:** `docs/program/execution/SEMSE_ECOSYSTEM_IMPROVEMENT_MASTER_PLAN_2026-06-28.md`

## Tesis central

SEMSE ya no necesita "más piezas" como prioridad principal. SEMSE necesita convertir sus piezas existentes en un sistema operativo coherente: flujo comercial canónico, datos protegidos por tenant/ownership, navegación unificada, módulos verticales integrados al shell, agentes con contratos verificables y despliegue con readiness real.

La mejora correcta es pasar de un ecosistema rico pero paralelo a un `SEMSE OS` gobernado por SDD: cada servicio debe tener una ruta clara de uso, un contrato técnico, pruebas de permisos, trazabilidad de evidencia y una forma explícita de ser asistido por agentes.

## Síntesis ejecutiva

La producción actual está viva y saludable a nivel de deploy: web, API y health checks responden, y GitHub Actions pasó en `main`. El problema principal no es que Railway esté roto hoy; el problema es que el producto todavía permite rutas paralelas, excepciones de seguridad, superficies UI no integradas y agentes sin un arnés común de evaluación.

La página pública debe explicar y conducir a un flujo real: cliente describe el trabajo, SEMSE genera un intake/draft, se estima y se publica con login solo cuando ya hay valor claro. Los dashboards deben dejar de ser vitrinas de métricas y convertirse en mesas de acción: qué está pendiente, qué riesgo existe, quién debe decidir y qué evidencia falta.

## Lectura del estado actual

### Lo que ya existe y debe preservarse

- `SEMSE OS` tiene una visión fuerte: marketplace, payments, evidence, field ops, BuildOps, agentes, Prometeo, Agro y Mission Control.
- La aplicación tiene módulos reales, specs, CI, e2e, health gate y deploy Railway.
- `docs/SDD_GOVERNANCE.md` y `docs/AGENTIC_HARNESS.md` ya establecen la disciplina correcta: spec primero, código después, validación y reporte.
- El runtime agentic existe en varias capas: `packages/agents`, `AgentsService`, harnesses de copilot, developer runtime, autonomy, memory/context y Mission Control.
- Agro ya demuestra que SEMSE puede absorber verticales especializados, pero todavía debe comportarse como módulo del OS.

### Lo que falta para que sea un ecosistema confiable

- Un flujo público canónico que no mande al usuario a login antes de entender el valor.
- Un shell de navegación único, gobernado por registry, no por listas hardcodeadas.
- Autenticación BFF cerrada: las rutas `/api/*` del web no deben poder usar identidad estática ni saltarse contexto de request.
- RBAC deny-by-default, registro formal de permisos y pruebas por endpoint crítico.
- Repositorios tenant-safe, especialmente en Agro, donde los accesos por ID deben validar granja, tenant y ownership.
- Tokens, estilos y componentes convergidos entre `@semse/ui` y `apps/web/components/ui`.
- Un arnés único para agentes: entrada, herramientas permitidas, riesgo, salida, evaluación y aprobación humana.
- Readiness real en producción: DB, Redis/queues, storage, migraciones y observabilidad.

## Principio rector

El ecosistema se mejora en este orden:

1. Cerrar riesgos de seguridad y readiness.
2. Hacer que el usuario entienda y use el servicio principal sin fricción innecesaria.
3. Consolidar navegación, diseño y contratos.
4. Endurecer dominios, permisos y datos.
5. Unificar agentes con arnés, evaluación y aprobación.
6. Operar con métricas, rollback y reportes confiables.
7. Expandir verticales solo cuando hereden el sistema base.

## Estado objetivo

SEMSE debe sentirse como un sistema operativo de servicios:

- **Cliente:** describe una necesidad, entiende opciones, acepta estimación, publica trabajo, paga y revisa evidencia.
- **Profesional:** recibe oportunidades explicables, acepta trabajo, reporta campo, adjunta evidencia y cobra.
- **Operaciones:** ve excepciones, riesgos, SLA, disputas, pagos retenidos, evidencia incompleta y agentes recomendando decisiones.
- **Admin:** configura permisos, módulos, tenants, health, deploys, políticas y auditoría.
- **Agente:** no actúa como chat libre; actúa bajo `WorkItem`, herramientas declaradas, presupuesto, nivel de riesgo, pruebas y `DecisionPackage`.

## No negociables arquitectónicos

- Ningún endpoint crítico sin spec, tests, permisos y tenant/ownership.
- Ningún cambio de estado monetario, evidencia, disputa o pago sin audit log.
- Ningún agente ejecuta mutaciones de producción sin compuerta humana cuando el riesgo sea L2 o superior.
- Ninguna ruta BFF sensible acepta identidad fabricada por fallback.
- Ningún módulo vertical vive fuera del shell operativo si maneja datos de usuario.
- Ningún deploy se considera listo solo por compilar; debe pasar readiness y smokes representativos.

## Métricas de éxito

- 100% de rutas BFF sensibles autenticadas con contexto real de request.
- 100% de endpoints Agro por ID con validación tenant/farm/ownership.
- Registro RBAC sin permisos huérfanos y con pruebas negativas para endpoints P0.
- Intake público usable hasta draft/estimación antes de login obligatorio.
- Navegación app generada desde un registry único.
- Agentes produciendo `DecisionPackage` con evidencia, riesgo, plan de rollback y validaciones.
- Health gate separa `/v1/health` de `/v1/ready` y valida dependencias reales.
- CI bloquea lint/type/test/build/e2e sin `ignoreDuringBuilds` para el core.

## Decisión estratégica

El siguiente ciclo no debe enfocarse en añadir otra vertical o pantalla aislada. Debe enfocarse en convertir las capacidades actuales en una operación coherente, demostrable y segura. La expansión de producto vuelve después de que el flujo canónico, la seguridad BFF/RBAC, el shell y el arnés agentic estén bajo control.
