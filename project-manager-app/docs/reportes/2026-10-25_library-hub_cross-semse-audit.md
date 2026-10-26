# Auditoría transversal — SEMSE Library Hub ↔ ecosistema SEMSE

**Fecha:** 2026-10-25  
**Estado:** AUDIT / DESIGN, no implementación ni verificación de runtime.  
**Repositorio:** `Semse-projet/project-manager-app`; evidencia consultada: archivos en `main` y PR específicos (se indica la rama cuando no están en main).  
**Spec rector:** `docs/specs/platform/semse-library-hub.spec.md` (`DRAFT`, SDD 2.0, versión de feature 1.0).  
**Restricciones aprobadas:** cero servicios Railway nuevos; capacidades solamente cuando se solicitan; usar sólo las librerías necesarias; decisión económica, seguridad/licencia y revisión trimestral; CI al final del corte.

## 0. Alcance y grados de certeza

Esto es una **auditoría cruzada de arquitectura, manifiestos y rutas de código representativas de los nueve dominios**, no una auditoría forense línea por línea de todo el monorepo, sus dependencias transitivas o producción. `package.json` prueba **dependencia declarada**, no que esté instalada, importe en un flujo, desplegada o que su licencia/CVE esté validada. Los documentos históricos no sustituyen a código ni smoke; seguir `docs/CANONICAL_STATE_REGISTRY.md`. No se consultaron secretos, datos personales, tablas productivas ni costos efectivos Railway. No se ejecutó CI, benchmark, instalación o deploy.

**Fuentes primarias internas:**
- `docs/architecture/CURRENT_ARCHITECTURE.md` (corte 2026-10-03; sus secciones no revalidadas son históricas).
- `docs/SDD_GOVERNANCE.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/CANONICAL_STATE_REGISTRY.md`.
- `apps/web/package.json`, `apps/api/package.json`, `apps/worker/package.json`, `apps/assistant-portal/package.json`, `apps/vision-service/requirements.txt`, `pnpm-lock.yaml`, `packages/tools/src/index.ts`.
- `apps/api/src/modules/prometeo/prometeo-tool-registry.ts`, `prometeo-tool-execution.service.ts`; `apps/api/src/modules/capability-registry/`; `apps/api/src/modules/ops/mission-control/`.
- `docs/specs/vision/sense-vision-field-library.spec.md`, `docs/specs/evidence/field-memory-capture-session.spec.md`, `docs/specs/payments/escrow-release-command.spec.md`, `docs/specs/labor/labor-engine-remediation.spec.md`, `docs/specs/platform/semse-prometeo-interoperability.spec.md`.
- Biblioteca Técnica **otra rama**: PR [#1008](https://github.com/Semse-projet/project-manager-app/pull/1008) `docs/curated-knowledge-library-992-20261018`; custodia PR [#1010](https://github.com/Semse-projet/project-manager-app/pull/1010). Seguridad sharing/RAG PR [#987](https://github.com/Semse-projet/project-manager-app/pull/987), DRAFT/no merge.
- Esta auditoría **no eleva** el estado de #987/#1008/#1010 ni activa `TENANT_CURATED` o RAG.

## 1. Diagnóstico ejecutivo: ¿de dónde sale el valor?

El valor proviene de **reutilizar motores canónicos + escoger paquetes evaluados + dar rutas seguras a cada consumer + medir ahorro/riesgo**, no de crear un `pip install`/npm universal al que Prometeo pueda acceder. El mayor descubrimiento concreto: `@semse/tools` ya exporta motores de cálculo eléctrico, conduit offset, concrete, roofing, plumbing, HVAC, pintura, drywall, pisos, carpintería, albañilería, cubiertas, solares, remodelación, limpieza y otros. Antes de proponer NumPy/SciPy para estimaciones corrientes, verificar estos motores.

Hay además dependencias útiles declaradas en aplicaciones diferentes: `@tanstack/react-query`, Recharts, React Hook Form y Tiptap en `apps/assistant-portal`, frente a React/Next/Tailwind/Lucide/Three.js en `apps/web`. El reuso implica **auditar licencia/versión/compatibilidad y refactor mínimo en PR propio**; tenerlo en un subproyecto no lo convierte en dependencia de Web. Zod coexiste en versiones principales distintas (API/schemas v3, assistant-portal v4): **riesgo concreto de contrato**, no alinear por fuerza sin tests.

### Topología que respeta los owners

```text
Web / Portal / cliente
    → BFF y autenticación SEMSE
    → API de dominio + resource policy (tenant/org/ownership)
        → servicio de negocio canónico
          → capacidad aprobada y versionada (adapter allowlisted)
             ↳ calculadora TS pura en @semse/tools, cuando hace falta
             ↳ UI lazy-loaded en navegador, cuando hace falta
             ↳ Worker BullMQ autorizado, cuando hace falta
             ↳ vision-service Python ya existente, SOLO si controlado
          → resultado validado, métricas, auditoría según efecto
    Prometeo → Tool Registry y aprobación existentes → servicio de dominio
    Mission Control → lecturas de costos/salud/capacidad (no decide permisos)
    Capability Reality Registry → evidencia de madurez, NO dependencias
    Biblioteca Técnica → conocimiento RAG permitido y revocable, NO código ejecutable
```

**Principio:** los paquetes se **instalan y fijan en build**, no se descargan dinámicamente en producción. "On demand" significa que el código aprobado se carga/invoca al necesitarse y que su trabajo extra finaliza; no significa apagar el API ni desinstalar el paquete del contenedor. No hay ejecución de npm/pip arbitraría ni import paths suministrados por un agente. La cola BullMQ es mecanismo de trabajo, no sandbox; proceso y memoria deben quedar limitados con medición real.

## 2. Matriz de efectos por dominio (9 bounded contexts + dos transversales)

| Dominio | Reuso comprobado / límite existente | Poder adicional concreto | Resultado potencial (no ya implementado) | Prioridad y condición |
|---|---|---|---|---|
| **SEMSE Core (identidad/organizaciones/RBAC)** | `@semse/auth`, Zod, políticas de recurso, SDD | filtros por tenant, catálogos autorizados, trazabilidad de paquete/version | menos rutas incompatibles e incidentes de acceso | **P0**; sin permisos globales de `execute arbitrary` |
| **SEMSE Connect (intake, bids, contratos, marketplace, agenda)** | jobs, bids, contracts, Labor Engine; assistant-portal tiene React Hook Form/TanStack Query | formularios robustos, cache coherente, validación de ofertas y tiempo | menos errores de carga y re-trabajo | **P1**; evitar cache cruzando org y mutaciones optimistic que saltan invariantes |
| **SEMSE Payments** | release command/payment governance y ledger propios | librerías de precisión/validación y exportes; pruebas property-based | menor riesgo de cálculos erróneos/reconciliaciones | **P0 seguridad / P2 features**; ningún SDK o agente elude Payment Governance, firma o aprobación |
| **SEMSE Trust** | disputes, ratings, compliance y auditoría | validación de evidencias de autoría/licencias, firmas e informes | mejor trazabilidad y calidad de revisión | **P1**; cambios de reputación no automatizados por un puntaje IA |
| **SEMSE AI (Prometeo, agentes, Vision)** | Tool Registry gobernado + policy, `@anthropic-ai/sdk`, `openai`, `apps/vision-service` con NumPy/OpenCV | descubrimiento de capacidades seguras, routing económico de inferencias; audio/simulación *separados* | asistentes más útiles con respuesta sustentada, fallbacks medibles | **P1**; todo tool pasa por permisos y adapter; modelos costosos tras cuota |
| **SEMSE Agro** | `apps/api/src/modules/agro` y rules `agro-intake.domain.ts`; autorización por finca específica | cálculos de inventario/riesgo, clasificación asistida, mapas y métricas | mejor planeación de labores, alertas revisables | **P2**; finca no asumir tenant/org de BuildOps; no diagnóstico automático |
| **SEMSE BuildOps** | `@semse/tools` exporta muchos motores de oficios, API `ToolsService`, milestones, change orders | cálculo confiable de materiales/mano de obra y análisis «qué pasa si» | propuestas más rápidas, menos retrabajo, supervisión con simulación técnica | **P0/P1**, primero motores existentes; cálculos especializados tienen normas, unidades, advertencias y versionado |
| **SEMSE Knowledge** | `@semse/knowledge`, RAG/Graphify/skills; Biblioteca Técnica F0 #1008 y F1A #1010 **no fusionados** | indexación de fichas legales autorizadas; referencias técnicas para cálculos | aprendizaje/capacitación y troubleshooting trazable | **P2 bloqueado** para sharing/RAG curado hasta consentimiento, retiro inmediato, revisores, staging y #987 |
| **SEMSE Integrations** | Universal Connector, SDKs, webhooks; `@semse/sdk` | inventario SBOM, adapter catalog, validación de proveedor y límites externos | integraciones más fáciles de auditar/actualizar | **P0**; referencias verificadas, no almacenar secretos; no descarga de código al invocar |
| **Mission Control / OMEGA** | Mission Control 2.0 y Capability Reality Registry | panel de gastos marginales, fallo de adaptadores, vulnerabilidades, revisión trimestral | decisiones informadas de habilitar, suspender o retirar capacidades | **P1**; leer evidencias reales, no asumir `ACTIVE` por nombre o por grafico |
| **Product Intelligence / Observabilidad** | product-events, Pino en Worker, Sentry en API; pricing de modelos C39 | telemetría de invocación, costo por tarea/tenant y conversiones reales | costos visibles y A/B de ROI | **P1**; separar telemetría de AuditLog y proteger datos sensibles |

**Línea de negocio end-to-end:** Intake → Estimate → BuildOps → Milestones → Evidence → Approval → Payment. Library Hub puede hacer más robustos **Estimate** y **BuildOps** (cálculos deterministas), **Evidence** (lecturas/media bajo custodia), **Approval** (panel y tests) y **Payment** (validadores), pero **no puede autorizar pagos ni publicar evidencia por sí solo**.

## 3. Oportunidades productivas priorizadas

| ID | Caso de uso | Componentes primero | Valor/entregable medible | Coste operativo relativo | Dependencia decisiva |
|---|---|---|---|---|---|
| U01 | Recalcular cantidades para Estimate y change order | `@semse/tools`, Zod | misma entrada+versión ⇒ mismo cálculo, diff antes/después, unidades | bajo | tests golden y reglas regionales |
| U02 | Simulador de escenarios de horas/materiales | `@semse/tools` + visualización existente | comparar escenarios sin tocar Job/Quote real | bajo-medio | estado **simulation_only** visible |
| U03 | Formularios dinámicos de campo y supervisión | React Hook Form/Zod si se justifica | tasa error formulario, tiempo completado | bajo | integridad ES/EN, offline y scope |
| U04 | Fetch/cache coherente en portales | TanStack Query donde convenga | menor latencia percibida, invalidación al cambiar org | bajo-medio | cache keys `tenantId/orgId/actorId`; revocación de sesión |
| U05 | Telemetría costo por tarea/adapter | Pino+product-events+pricing actual | CPU, RAM, token, failure y costo marginal visible | bajo-medio | no duplicar pricing C39 |
| U06 | Respuestas Prometeo con cálculos auditables | Tool Registry → servicios actuales | resultados trazables, sin «responder de memoria» cálculos | bajo-medio | approval/tenant gates; #987 donde haya docs |
| U07 | Panel Mission Control de dependencias | Capability Reality Registry + auditoría Hub | vencimientos, CVEs, rechazadas, degradadas | bajo | lectura canónica, no tabla doble |
| U08 | Materiales con vocabulario ES/EN | Vision Library/Construction Library + calculator | nombre correcto + guía de uso y material | medio | proveedor visión, derechos y estado real de visión |
| U09 | Exportes de reportes y ADR/SDD | soluciones PDF/Markdown ya declaradas | documentos reproducibles y bilingües | bajo-medio | PDFs sin firmas falsamente validadas |
| U10 | Simulación de turnos/equipos | Labor Engine + cálculos puros | capacidad de cuadrilla y costo proyectado, sin modificar TimeEntry | bajo | asignación de trabajador y reglas W2/1099 pendientes |
| U11 | Clasificar/recortar fotografías localmente | librerías vision-service existentes | previews/minimización datos por solicitud | medio-alto | custodia original SHA256 y derechos; no mutar Evidence |
| U12 | Reconstrucción 3D y comparaciones espaciales | Three.js, pipeline externo solo si se aprueba | visualización de secuencia de obra | alto | restore drill y estructura de CaptureSession, no afirmar 3D existente |
| U13 | Audio para Prometeo/Omega | WebAudio primero; Meyda/Tone.js sólo con prueba A/B | métricas DSP legítimas y visualizador responsivo | medio | permisos de micro, no grabación por defecto |
| U14 | IA local en navegador | ONNX Runtime Web/Transformers.js **candidatas** | privacidad/latencia potencial frente a API | alto en RAM/bundle | prueba de dispositivo; modelo/licencia/energía |
| U15 | Agro simulaciones y alertas | reglas existentes + math pura | escenarios finca/insumos, revisión humana | bajo-medio | ownership farm, no intervención automática |
| U16 | Test de propiedades y accesibilidad | fast-check, axe Playwright si aprobados dev-only | menos regresiones transversales | dev/CI medio | mantener CI al último tras preparar código y tests |

**Primera vertical rentable recomendada:** U01+U02 sobre `@semse/tools` para comparar materiales/horas con un Job sintético, sin añadir npm, sin escritura financiera y midiendo tiempo por ejecución. Luego U05 (métricas), U03 (formularios) y U07 (visibilidad operativa). No seleccionar motor DSP/cuántico como piloto inicial.

## 4. Hallazgos / riesgos y acciones

| ID | Severidad | Hallazgo basado en fuentes inspeccionadas | Acción antes de ampliar |
|---|---|---|---|
| H01 | Alta | Confusión frecuente entre **librería técnica RAG**, **Construction Library de Vision**, **Tool Registry**, **Capability Reality Registry** y **dependencias**. | definiciones y enlaces por dominio; no introducir quinto registro de estado de capacidad |
| H02 | Alta | `@semse/tools` ya tiene motores técnicos extensos. Introducir nueva solución para la misma operación crea divergencias de cotización. | golden fixtures + owner por algoritmo; reusar antes de ampliar |
| H03 | Alta | Biblioteca Técnica #1008/#1010 sigue draft/no merge; #987 sigue DRAFT. | prohibido convertir librerías de software en medio para esquivar consentimiento/RAG/ACL |
| H04 | Alta | Integración de paquete no equivale a aislamiento: Worker comparte recursos de misiones y colas; `worker_threads.resourceLimits` no protege memoria externa ni convierte código no fiable en seguro. | límites de carga medidos y negar tareas que excedan capacidad; ejecución aprobada, no sandbox falso |
| H05 | Media-alta | `apps/assistant-portal` usa React Query, Recharts, RHF, Tiptap; la Web principal no los declara. | detectar duplicación funcional antes de importarlos y medir bundle/performance |
| H06 | Media-alta | Zod v3 (API/schemas) vs Zod v4 (`assistant-portal`) declarados. | contract tests serialización/formularios; prohibida migración transversal improvisada |
| H07 | Alta | Snippet Omega aportado no prueba «671B», conciencia, estado cuántico ni disponibilidad de motores; gráficas de homeostasis generan latencia sintética. | rotular `DEMO/SIMULATED`; métricas DSP con nombres físicos, no atribuir conciencia/cuántica |
| H08 | Alta | En `PrometeoAudioProcessor._fft` del snippet, `previousFFT` se sobreescribe **antes** de calcular el flux, por lo que la comparación temporal pierde el frame anterior; el tamaño FFT/frequencyBinCount no se usa de forma consistente; `_peaks` no compara máximos locales correctamente. | tests DSP de tonos sintéticos y ruido, FFT validada; no migrar este código directo a prod |
| H09 | Crítica si se intentara en prod | `callClaude` del snippet hace `fetch` desde cliente a Anthropic sin token/headers de API válidos; si se incrusta secreto en navegador lo expondría. | usar el gateway/model router backend SEMSE y presupuesto; nunca clave en browser |
| H10 | Media | `apps/vision-service/requirements.txt` declara NumPy/OpenCV pero **no SciPy/Librosa**; documentación aspiracional no significa instaladas. | benchmark Python en servicio existente y compatibilidad container antes de nuevas dependencias |
| H11 | Alta | Cambios de cálculo/redondeo/taxes pueden afectar pagos; librerías de formato no sustituyen ledger ni proveedor. | propiedades de dinero, moneda y no mutación del flujo Payment |
| H12 | Media | `pnpm-lock.yaml` existe y paquetes duplicados pueden responder a bundles/versions distintas; aún no se realizó SBOM transitivo ni revisión de licencia por versión. | F1 inventory script → SPDX/CycloneDX → advisory review, sin afirmar seguridad previa |
| H13 | Alta | Algunos specs/arquitectura son cortes anteriores y se contradicen en estado de mobile / producción. | usar código real, tests y despliegues actuales; registrar `UNKNOWN` cuando no haya evidencia |
| H14 | Alta | No tenemos benchmark de costos ni límite actual de CPU/RAM ni márgenes Railway por servicio. | no prometer ahorros monetarios; instrumentación y medición previa sobre tareas sintéticas |
| H15 | Media | El parser `apps/assistant-portal` agrega también muchas dependencias editor/UI; importarlo en masa penaliza bundle/ataque. | selección por módulo y lazy-loading, análisis de tamaño y test en equipo de gama media |

**Nota técnica Omega:** `_consciousness` y `_dimensional` son transformaciones heurísticas sin correlato demostrado con conciencia/cuántica. Reetiquetar como indicadores experimentales o eliminarlos de métricas reales; separar demo visual del backend de gobernanza. El `setInterval` de homeostasis usa `Math.random()`, de modo que no es SLO/latencia real. El bloque recibido es **código suministrado**, no un módulo de SEMSE verificado en producción.

## 5. Arquitectura para maximizar rendimiento sin servicios nuevos

**Preferencia por menor costo marginal y blast radius:**
1. cálculo puro en TS ya compilado (request-scope) para operaciones pequeñas y acotadas;
2. navegador cliente para gráficas y DSP si consentimiento, compatibilidad móvil y tamaño de bundle lo permiten;
3. Worker BullMQ existente para trabajos acotados, sólo con medición de concurrencia/CPU/RAM, timeout y cancelación;
4. vision-service Python existente para cargas Python especializadas **sólo si cabe en su memoria y SLA**; no introducir librerías de ML grandes sin benchmark;
5. proveedor API externo sólo con aprobación de privacidad, precio real y cuotas por actor/tenant;
6. cualquier tarea cuyo aislamiento seguro requiera servicio nuevo queda `BLOCKED` por restricción del propietario.

La regla `demand-driven` no elimina costo de RAM de dependencias precargadas ni tiempo de build; contabilizar bundle, contenedor, cold load y consumo incremental.

## 6. Matriz económica y criterio de rentabilidad

Cada cambio propondrá **opción A: reutilizar código** vs **B: adaptar librería ya declarada** vs **C: dependencia nueva** vs **D: no hacerla**. Sin compra/instalación por popularidad.

```text
Beneficio neto mensual estimado =
  (horas reales evitadas × valor/hora relevante) + errores/retrabajo evitados
  − [(horas de integración ÷ meses de amortización) × valor/hora]
  − mantenimiento recurrente − costo adicional de ejecución/almacenamiento/API
  − costo esperado de incidentes y oportunidad
```

**Ejemplo pedagógico, NO medición ni forecast:** 20 usos/mes × 10 min ahorrados = 3 h 20 min; a $30/h de valor de tiempo = $100/mes de beneficio bruto. Si integrar lleva 12 h, amortizadas a 6 meses ($60/mes), y mantener cuesta 1 h/mes ($30), queda **$10/mes antes de runtime e incidentes**. Si el gasto extra supera $10 o no hay ahorro comprobable, el paquete no es rentable bajo esas hipótesis. Para un piloto seleccionar `job` sintético, comparar tiempo manual versus cálculo, errores y memoria con 20–50 ejecuciones de prueba y registrar distribución p50/p95, no cifra única.

**Objetivos para aceptar (propuestos, no observados):**
- resultado determinista y tests golden en cálculos de dinero/materiales;
- mejora de tiempo/correcciones medible sobre baseline real;
- sin CVE crítica explotable, origen/licencia desconocidos o permisos ampliados;
- sin deterioro en colas/latencia de API y sin nuevo Railway service;
- modo reversible con disable; owners y próxima revisión trimestral.

## 7. Priorización por entregables (sin PR gigante)

| Corte | Entregable único | Bloqueos | CI |
|---|---|---|---|
| **F0 — documentación** | SDD, inventario de manifiestos, ADR de fronteras y este cross-audit | revisión de riesgos y aceptación técnica | al final del corte documental |
| **F1 — evidencia automática** | script de inventario/SBOM de Node+Python y test de consistencia; no modifica runtime | fijar salida sin secretos y license advisory data | al final de F1 |
| **F2 — evaluador** | reusar metadata de capabilities/Tool Registry, reglas de score y aprobación humana | permisos, responsable seguridad, formularios | al final de F2 |
| **F3 — piloto funcional** | U01/U02: motor existente `@semse/tools` + simulación solo lectura + presupuesto/métricas | golden tests, rendimiento, diferencia vista/simulación | al final de F3 |
| **F4 — UX/operator** | panel de estado/costo en Mission Control y una integración controlada UI | sin duplicar capability registry | al final de F4 |
| **F5 — especializaciones** | audio validado, vision/3D, IA local, RAG curado con SDDs independientes | consentimiento/custodia/modelos, opt-in de seguridad | al final de cada child slice |

**DoD de cada slice:** SDD aprobado, pruebas rojas→verdes, seguridad/licencia/privacidad, medición comparativa y rollback, luego CI/merge/deploy/canary separados. La aprobación de intención no sustituye revisión humana independiente para riesgos críticos.

## 8. Decisiones y riesgos pendientes

1. **No inventar `LibraryRecord` en Prisma en F0/F1:** empezar con manifiestos y archivo versionado en Git. Si UX/tenants lo justifican, documentar DB como child spec.
2. **Owner y ciclo de vida:** decidir quién autoriza versiones y bloquea CVEs, quién recibe incidentes y cuál es el procedimiento de excepción con fecha de vencimiento.
3. **Acoplamiento:** una librería ≠ capacidad de producto ≠ herramienta invocable ≠ contenido de conocimiento. La relación es por IDs/contratos, no por nuevas autoridades.
4. **CPU/RAM/timeout** de Worker/API/Vision: verificar en servicios reales antes de fijar valores; sin benchmark no habilitar tareas de cómputo alto.
5. **Datos privados:** evitar scopes compartidos o difusión de fichas técnicas, fotos, locales de obra o perfiles de trabajadores por consecuencia accidental de un adapter.
6. **Suscripción/integraciones:** licencias y SDK disponibles no prueban un proveedor activo, conectores autorizados ni facturación cero.

## 9. Referencias primarias externas

- OWASP Software Component Verification Standard, inventario y control de supply chain: https://owasp.org/projects/software-component-verification-standard
- OpenSSF Scorecard, señales auditables de seguridad del proyecto: https://openssf.org/projects/scorecard/
- CISA/NSA/FBI, 2026 Minimum Elements para SBOM: https://www.nsa.gov/Press-Room/Press-Releases-Statements/Press-Release-View/Article/4558391/nsa-collaborates-with-cisa-to-co-author-the-updated-software-bill-of-materials/
- Node worker_threads resource limits y consideraciones de aislamiento: https://nodejs.org/api/worker_threads.html

**Aplicado ahora:** límites de autoridad, inventario por evidencia, prohibición de instalación en caliente y matriz ROI. **Backlog:** automatizar SBOM, scanning, size/CPU benchmarks, UI/Operaciones y RAG seguro. **Descartado:** microservicio adicional, ejecución dinámica de paquetes desde prompts, unificación de todos los registros en una base única, versión del simulador Omega como ciencia verificada.

## 10. Conclusión

La ganancia más inmediata de SEMSE viene de **organizar y reutilizar sus motores reales de oficios**, conectarlos a flujos de Estimate/BuildOps/Prometeo de forma read-only, y demostrar ahorro sin comprometer proyectos, evidencias ni pagos. **Más librerías no equivalen a más producto. Más capacidades terminadas, verificadas y económicamente sostenibles sí.**

**Estado final de esta auditoría:** investigación documental realizada; no se ejecutó CI, no se instaló librería, no se hizo merge, no se desplegó servicio, no se activaron sharing, RAG o acciones autónomas.

## 11. Productos y líneas comerciales que esta integración puede habilitar (hipótesis, NO compromisos)

El Hub es infraestructura de oferta: su principal mérito económico es **hacer viable una función repetible y segura sin pagar una plataforma tecnológica nueva por cada cliente**. Las monetizaciones no se aprueban desde una librería; requieren decisión comercial, validación de mercado, experiencia completa, protección de datos y un precio que cubra uso real.

| Cliente o actor | Función vendible *solo después de estar verificada* | Fuente del valor | Cómo validar el mercado |
|---|---|---|---|
| Contratista individual | simulador de materiales, tiempos y variaciones de Estimate | cotización más rápida y menos compra equivocada | piloto con 10–20 estimaciones sin comprometer precios reales |
| Empresa con varias cuadrillas | planeación de horas, carga y escenarios de asignación | menos sobrecosto operativo y retrasos de coordinación | tiempo de supervisor ahorrado y corrección de entradas |
| Supervisor de obra | reportes y evidencias consistentes con trazabilidad | mejor cierre de hitos y comunicación | casos sintéticos o voluntarios, sin exponer fotos |
| Contratista de remodelaciones | comparación de antes/después y modelo 3D | claridad en cambios y as-built visual | solo tras custodia/restore verificable y permisos |
| Trabajador/aprendiz | diccionario de oficios y formación a partir de fichas autorizadas | productividad y mejor aprendizaje ES/EN | retención/uso de vocabulario, sin emitir licencias profesionales |
| Operaciones de finca | planificación/costos/alertas de Agro | decisiones más rápidas con datos propios | prueba con fincas autorizadas y revisión humana |
| Organizaciones multi-proyecto | panel Mission Control de costos y riesgo tecnológico | fiabilidad y transparencia | tasa de incidentes y costo incremental por capacidad |

**Mecanismos de negocio a evaluar:** incluir calculadoras básicas en el nivel estándar; cobrar por reportes avanzados o escenarios de alta complejidad si generan valor; cuota por organización para análisis intensivos; y ofrecer formación con material validado cuando los permisos lo permitan. No diseñar microcargos a nivel librería ni facturar por función antes de comprobar costos, licencias y autorizaciones. Ninguna ficha técnica con consentimiento para RAG autoriza reventa ni entrenamiento.

## 12. Cómo medir el efecto en la cadena de negocio

| Etapa | Línea base requerida | Señal de mejora | Riesgo que no debe cambiar |
|---|---|---|---|
| Intake | minutos para ingresar alcance | menos formularios abandonados / errores | tenant, autoría, identidad |
| Estimate | minutos y revisiones por presupuesto | tiempo y error de cantidad reducidos | precio y tasas no deducidos sin fuentes |
| BuildOps | ciclos de planeación y change order | replanificación más rápida | el Job real no cambia por una simulación |
| Milestones | discrepancias de hitos | menos retrabajo de avance | no aprobación de avance sin regla de dominio |
| Evidence | tiempo para localizar prueba y verificar hash | evidencia localizable/autenticable | originales y permisos no se modifican |
| Approval | tiempo de revisión humana | documentación verificable para decisión | IA no sustituye al aprobador |
| Payment | errores de conciliación | reportes consistentes | liberación de dinero sólo vía flujo vigente |

Cualquier análisis de ingresos o ahorro deberá segmentarse por **tenant**, tipo de negocio, frecuencia real y uso de recursos, sin exponer métricas privadas de otra organización. La interfaz siempre mostrará si una cifra es medida, estimada o simulada.

## 13. Limitaciones de esta auditoría y verificación restante

**Verificado documentalmente:** presencia de manifiestos, exportación de motores propios, rutas de Tool Registry, estado declarado de specs/PRs, patrones del Worker, y las decisiones aprobadas del propietario. **Todavía no verificado:** import graph completo, disponibilidad de cada motor en producción, versiones efectivas de imágenes, CVEs y licencias de todo el árbol, tasas de uso por módulo, facturación real Railway, pruebas E2E multi-tenant, ROI y estabilidad bajo carga. Este informe no autoriza por sí mismo un merge, un cambio en contratos, la activación de Omega ni el despliegue de conocimiento compartido.

La siguiente auditoría técnica deberá usar herramientas repetibles de inventario/carga sobre un SHA identificado y entorno seguro; la decisión de habilitación se toma por capacidad y por slice, nunca por cantidad de librerías en el catálogo.
