# SEMSE Project — Plan operativo de cierre de 36 flujos
**Fecha:** 2026-10-12 · **Estado:** PROPUESTA DE PROGRAMA / NO ES VERIFICACIÓN PRODUCTIVA  
**Repositorio:** `Semse-projet/project-manager-app` · **Destino:** Railway / proyecto `SEMSEproject`, entorno `production`.  
**Alcance:** 11 modalidades de negocio (F01–F11), 17 capacidades operativas (F12–F28) y 8 capacidades de inteligencia/plataforma (F29–F36).  
**Mandato:** crear/mejorar lo necesario para completar los 36 flujos, con tests sintéticos aislados primero, integración/canarios controlados y validación real posterior; no confundir los niveles de evidencia.

## Reglas transversales, obligatorias en todas las fases
- Respetar `AGENTS.md`, constitución, `docs/SDD_GOVERNANCE.md`, `SPEC_INDEX.md` y `DOMAIN_INVARIANTS.md`. Para cada cambio: spec aprobada → plan → tareas → pruebas → implementación → análisis/checklist → CI → PR/merge → migración/deploy → canary → evidencia.
- Nunca declarar «implementado» equivalente a «desplegado» o «probado». Estados independientes por flujo: `spec`, `code`, `unit`, `integration`, `e2e_synthetic`, `CI`, `merge`, `deploy`, `activation`, `e2e_staging`, `prod_canary`, `real_pilot`.
- Categorías de resultado: `NO_INICIADO`, `EN_PROGRESO`, `BLOQUEADO`, `SIMULADO_VALIDADO`, `STAGING_VALIDADO`, `PRODUCCION_TECNICAMENTE_VERIFICADA`, `PILOTO_REAL_VALIDADO`. No cambiar a «completo» si falla algún gate exigible.
- Datos ficticios únicamente en DB efímera/local o staging de pruebas, con identificadores `TEST_`, `synthetic=true`, namespaces separados, credenciales no reales, proveedores de pago/firma en sandbox, limpieza trazable. **No** poblar el tenant productivo ni registros económicos reales con datos de demo.
- Seguridad mínima: multi-tenant y ownership por organización/objeto, pruebas 403/404/IDOR, roles, audit y correlación; cambios de estado válidos; idempotencia y no doble pago; privacidad; fallos cerrados para acciones sensibles.
- Operaciones financieras, activación de escrow, producción con dinero real, cambios de secretos/variables, mutaciones irreversibles o recuperación sobre datos reales exigen sus autorizaciones y gates específicos. La autorización general del programa no reemplaza aprobación transaccional ni controles del repositorio.
- Las pruebas sintéticas y mocks **no demuestran** respuesta de proveedor real, restauración de backups productivos o cumplimiento legal; dejar `PENDIENTE_PILOTO_REAL` donde corresponda.

## Skills comprobadas y skills candidatas
**Catálogo existente (23 instaladas, al corte de 2026-10-10):**
`aaa-zoom-loop-execution`, `semse-agents-governance`, `semse-audit-remediation`, `semse-bff-pattern`, `semse-ci-pr-workflow`, `semse-design-tokens`, `semse-domain-events`, `semse-ecosystem-architect`, `semse-github-operations-cost-guard`, `semse-labor-engine-boundary`, `semse-local-observability-testing`, `semse-mobile-offline-sync`, `semse-prisma-workflow`, `semse-prometeo-orchestrator`, `semse-rbac-permissions`, `semse-report-writer`, `semse-schemas-contract`, `semse-security-baseline`, `semse-skill-router`, `semse-spec-kit-flow`, `semse-upload-flow`, `semseproject`, `testing-worker-tracker`. Todas deben validarse por archivo `SKILL.md`, no solo por catálogo.

**Cuatro necesidades por resolver:** comprobar primero si pueden resolverse extendiendo una skill existente; instalar una nueva solo cuando una brecha real permanezca y sin duplicar autoridad:
1. `semse-synthetic-test-data`: factories/fixtures/seed de pruebas, aislamiento y teardown.
2. `semse-business-flow-e2e`: journeys por persona, contratos, evidencia de e2e y negativos.
3. `semse-railway-release-verification`: preflight, migraciones seguras, canary, provenance, rollback, observabilidad.
4. `semse-backup-restore-verification`: inventario, snapshots, restauración aislada, hash/SHA-256 y reconciliación DB/evidencia.

**Gate de skill nueva:** contrato breve `SKILL.md` + descriptor en `.agents/skills/<id>/SKILL.md` + catálogo + selección `skill:route:report` + prueba de paridad `semse-codex-skill-parity` + revisión PR. **No se afirman instaladas estas cuatro.** Cargar por tarea una principal y las auxiliares necesarias, no 27 simultáneamente.

## Fases de ejecución
| Fase | Acción operativa | Skills principales | Salida y gate para avanzar |
|---|---|---|---|
| **0. Baseline y reconciliación** | Congelar inventario F01–F36; comparar código, specs, CI, PRs, Git SHA y Railway; verificar identidad del worker, warning Postgres y backups antes de mutaciones. | `semseproject`, `semse-audit-remediation`, `semse-ecosystem-architect` | Matriz 36×gates con evidencia y bloqueo por flujo; no usar un único healthcheck como prueba funcional. |
| **1. Preparación de skills** | Auditar las 23 SKILL.md; mapear 36 flujos → skills; resolver las 4 brechas por extensión o nuevas skills; revisar discovery Claude/Codex y permisos. | `semse-skill-router`, `semse-spec-kit-flow` | Catálogo actualizado, parity test OK, elección explícita por tarea y ninguna duplicidad normativa. |
| **2. Datos sintéticos y laboratorios** | Diseñar tenants y organizaciones sintéticas, usuarios por rol, proyectos, contratos, hitos, evidencia, horas, materiales, facturas, pagos sandbox, disputas y casos corruptos. Semillas deterministas con reset. | `semse-prisma-workflow`, `semse-schemas-contract`, candidata de datos | Factories versionadas, migraciones reproducibles, datos de prueba aislados, limpieza y tests de no fuga entre organizaciones. |
| **3. Banco de pruebas transversal** | Crear/extend unit, contract, DB integration, E2E web/API/worker, Playwright y pruebas de contrato de proveedores sandbox; añadir pruebas de negativa, concurrencia, duplicación, timeout y falla de red. | `semse-ci-pr-workflow`, `semse-local-observability-testing`, `aaa-zoom-loop-execution`, candidata E2E | Suites enlazadas a F01–F36 y ejecución reproducible local/CI; registrar resultados por SHA y entorno. |
| **4. Corregir P0 compartidos** | Resolver autorización multiempresa y sesión del worker con prueba real; confirmar CI; custodia/backups; límites de pagos y contratos; reparación solo según specs/decisiones aprobadas. | `semse-rbac-permissions`, `semse-security-baseline`, `semse-audit-remediation`, `semse-domain-events` | 403/404 entre organizaciones, worker puede autenticar/procesar un job de prueba, recuperación verificable y pagos bloqueados cuando corresponda. |
| **5. Cadena operativa canónica** | Completar `Intake → Estimate → Contract → BuildOps → Milestone → Evidence → Approval → Invoice/Payment`; variantes de modalidad (no obligar escrow/hitos a trabajo por horas). | `semse-ecosystem-architect`, `semse-schemas-contract`, `semse-bff-pattern`, `semse-domain-events` | Journey sintético end-to-end completo de Marketplace, proyecto privado, horas y orden de servicio, con auditoría y pruebas negativas. |
| **6. Expandir las 11 entradas de negocio** | Habilitar y cerrar los flujos faltantes de propietarios, B2B/subcontratos, licitaciones, mantenimiento, urgencias, consultoría/inspecciones y gestión empresarial. Reutilizar núcleo; no clonar apps. | `semse-ecosystem-architect`, `semse-labor-engine-boundary`, `semse-bff-pattern` | Once fichas F01–F11 con camino completo, rol, modalidad económica, pruebas y controles de contexto en UI. |
| **7. Completar las 17 capacidades y 8 de plataforma** | Cerrar F12–F28 (CRM, cotizaciones, diseño, firmas, BuildOps, trabajadores, inventario, hitos, Evidence/CaptureSession, QA, Change Orders, approvals, billing, escrow, garantías, disputas, credenciales). Cerrar F29–F36 (Prometeo, multiagente, Mission Control, Omniverse, multiempresa, integraciones, auditoría, analítica). | `semse-prometeo-orchestrator`, `semse-agents-governance`, `semse-upload-flow`, `semse-domain-events`, demás según dominio | Para cada F12–F36: test de autorización y ciclo positivo/negativo, instrumentación, ownership, feature flag si aplica y evidencia de integración. |
| **8. Entrega incremental y pilotos reales** | Para cada slice pequeño: preflight → CI → PR/revisión → merge → migración aditiva probada → despliegue Railway → salud → canary autenticado → observabilidad → rollback preparado. Después pilotos reales autorizados por oficio/rol/organización. | `semse-ci-pr-workflow`, `semse-github-operations-cost-guard`, `semse-report-writer`, candidatas release/backup | Evidencia por F01–F36 de SHA, despliegue, flag, tenant, 2+ roles relevantes, escenario canario, logs y resultado. Las verificaciones reales pendientes quedan rotuladas y no bloquean falsamente la documentación de simulación. |

**Nota:** la fase 8 se ejecuta iterativamente desde el primer slice listo; no hay que esperar a terminar los otros 35 para integrar o desplegar una corrección segura. Las fases 5–7 se intercalan según las dependencias reales por cada capacidad.

## Pruebas sintéticas mínimas por recorrido
- **Personas:** cliente, profesional, contratista principal, trabajador, supervisor, admin de operaciones, usuario externo no autorizado; al menos dos organizaciones y dos tenants independientes.
- **Caminos:** feliz, rechazo de oferta/contrato, cambio de orden, rechazo de evidencia, disputa, pago denegado, worker retry/requeue, vencimiento de aprobación y carga de archivo ajeno.
- **Datos:** timestamps deterministas, 2 proyectos por tenant, materiales suficientes/insuficientes, registros de horas correctos e incorrectos, facturas y montos sandbox, originales con hashes válidos y alterados.
- **Resultados exigidos:** 2xx correcto para dueño, 403/404 para ajenos según contrato, 409/422 para conflictos cuando aplique, audit trail correlacionado, ausencia de escrituras o pagos duplicados y persistencia después de reiniciar servicios.
- **Producción:** solo cuentas de prueba autorizadas y recursos segregados, sin mover dinero real. Los providers se prueban en sandbox. Cada prueba con origen sintético queda etiquetada en la matriz, no presentada como test de usuarios reales.

## Cobertura inicial de los 36 elementos (cada fila requiere ficha individual)
**F01–F11 — negocio:** F01 Marketplace; F02 Proyectos privados; F03 Personal por horas; F04 Órdenes de servicio; F05 Administración empresarial; F06 Supervisión propietario; F07 Subcontratación B2B; F08 Licitaciones; F09 Mantenimiento recurrente; F10 Emergencias; F11 Consultoría e inspecciones.

**F12–F28 — operación:** F12 CRM/intake; F13 Estimación; F14 Diseño y planificación; F15 Contratos/firmas; F16 BuildOps; F17 Trabajadores; F18 Compras/inventario; F19 Hitos; F20 Evidence/CaptureSession; F21 Inspecciones/calidad; F22 Change Orders; F23 Aprobaciones; F24 Facturación/pagos; F25 Escrow; F26 Garantías/posventa; F27 Disputas; F28 Credenciales/reputación.

**F29–F36 — plataforma:** F29 Prometeo; F30 Multiagentes; F31 Mission Control; F32 Universe/Omniverse; F33 Multiempresa; F34 Integraciones; F35 Auditoría/gobernanza; F36 Analítica.

### Plantilla de ficha de cierre (una por flujo)
`id | owner | entrada | trigger | actores | tenant/org/resource | capacidades dependientes | estados/FSM | precio/pago | endpoints | rutas UI | migraciones | spec/aprobación | tests unit/integration/E2E | negativos | SHA | CI run | PR | Railway service/deployment | flag/canary | evidencia | riesgos | PENDIENTE_PILOTO_REAL`.

No pasar a `PILOTO_REAL_VALIDADO` sin operación real autorizada observada en su contexto y prueba de negocio; **la ejecución simulada puede quedar cerrada por separado**.

## Primer paquete de intervención priorizado
1. Confirmar el estado funcional de la identidad del worker (PR #885 en draft al momento de la inspección) y corregirlo según gate de seguridad antes de depender de colas/agentes. No ejecutar un script de membresías en producción sin verificar primero usuario/org/roles actuales mediante dry-run y revisión.
2. Investigar la advertencia de PostgreSQL, sin inferir pérdida de datos desde una alerta, y verificar backups y recuperación aislada; la presencia de volumen no equivale a backup.
3. Confirmar los requisitos de CI y `main` actuales; no usar pruebas solo locales como sustituto de checks efectivos para merge/activación.
4. Cerrar como primer journey completo un cliente que crea job, profesional que oferta, acuerdo, hitos/evidencia/aprobaciones, facturación de prueba; probar también proyecto privado y horas.
5. Repetir el patrón por las restantes modalidades y actualizar la matriz con fecha/SHA/evidencia después de cada slice.

## Estado observado al 2026-10-12 (no constituye cierre)
- Railway `SEMSEproject/production`: `semse-web`, `semse-API`, `semse-worker`, `semse-vision`, PostgreSQL y Redis reportados `online`. Los cuatro deployments de app aparecen `SUCCESS` con commit `fd902626a7ce84987eda6b741f44f65242df9de1`; PostgreSQL reporta una warning; estos datos **no** prueban los 36 journeys.
- GitHub: `Semse-projet/project-manager-app` activo. PR #885 de identidad del worker en draft, con hipótesis de 401 por membresías ausentes, sin confirmar corrección en base de datos productiva; PR #886 de RETRY/REQUEUE reportado merged. Sus propios gates y pruebas E2E siguen requiriendo revisión.
- La matriz de 36 elementos discutida previamente fue una clasificación provisional, no garantía de estado individual actual. El archivo de auditoría previo debe reconciliarse por ID antes de actualizar estados.
- **Esta entrega solo organiza el programa**; no instala skills, no corrige código, no realiza pruebas de laboratorio ni cambia Railway.
