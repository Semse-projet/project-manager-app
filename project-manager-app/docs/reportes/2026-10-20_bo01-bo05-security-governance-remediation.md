# BO-01/BO-05 — Remediación preparada y gates pendientes

Fecha: 2026-10-20 UTC. Responsable de esta revisión: Codex. Modo: Systems Reviewer. Skills aplicadas: github-security-review, functional-governance-review y semse-ecosystem-architect. Dictamen: **BLOQUEADO para implementar/activar la remediación mientras el contrato permanezca REVIEW; revisión operacional incompleta**.

## Alcance y cambios entregados

Inspección estática de GitHub en main `a03bb2b5a211c286874a9f08438b78f29a8e2de5`, metadatos actuales de los ocho PRs, observaciones #975, revisiones #972, comentarios #952/#954 y contrato de identidad. Se preparan dos conjuntos spec/plan/tasks/checklist y su índice generado. Este PR es documental: no corrige todavía el código, no modifica Prisma/migraciones, workflows, Railway, secrets ni flags. La entrega de documentación no cierra los hallazgos.

Se retiran contradicciones: clasificación W2/1099, permisos de gestión de ofertas por PRO, compensación por grants implícitos al supervisor, Membership creada/suspendida por engagement y uso productivo de db push. Se mantienen las decisiones OPEN-03/04/06/14 ya registradas el 2026-10-18 y la distinción entre roles CLIENT/PRO/WORKER aprobada en universal-identity-multi-role.

## Evidencia de código y remediación requerida

Enlaces fijados al SHA inspeccionado; ver documentos de cada dominio para criterios completos.

| ID | Evidencia observada | Efecto / trabajo pendiente |
|---|---|---|
| INV-01 | [client/team](https://github.com/Semse-projet/project-manager-app/blob/a03bb2b5a211c286874a9f08438b78f29a8e2de5/project-manager-app/apps/web/app/(app)/client/team/page.tsx) genera `?token=`; [accept page](https://github.com/Semse-projet/project-manager-app/blob/a03bb2b5a211c286874a9f08438b78f29a8e2de5/project-manager-app/apps/web/app/(app)/invitations/accept/page.tsx) usa useSearchParams | Token en URL de petición; plan fragmento, memoria y scrub, incluyendo productores de correo y enlaces legacy. No declarar eliminada exposición histórica. |
| INV-02 | client/team toma `orgs[0]`; client/offers repite patrón | Contexto organizativo silencioso; binding explícito y visible, limpieza y descarte de respuestas antiguas. |
| INV-03 | BFF cancel sustituye razón ausente por «cancelada por la empresa» | Se pierde intención real del actor; formulario y validación BFF/API sin fallback fabricado. |
| INV-04 | Gestión solo en `/client/team`; PRO usa superficie worker | Añadir wrapper permitido reutilizando componente, sin abrir globalmente rutas CLIENT ni conceder permisos WORKER. |
| INV-05 | preview/register hacen fetch sin identidad de cliente; accept usa helper BFF | La protección por IP exige demostrar topología efectiva. No dar por resuelto reenviando XFF sin confianza o quitando límites. Selección de mecanismo y pruebas entre réplicas pendientes. |
| INV-06 | Preview público ya fue reconocido en el baseline | No duplicar ese arreglo ni presentar el hilo histórico como prueba de fallo actual. Regresión anónima todavía debe ejecutarse. |
| OFF-01 | [requireManage](https://github.com/Semse-projet/project-manager-app/blob/a03bb2b5a211c286874a9f08438b78f29a8e2de5/project-manager-app/apps/api/src/modules/organizations/offers.service.ts) comprueba membership/permiso; [Org](https://github.com/Semse-projet/project-manager-app/blob/a03bb2b5a211c286874a9f08438b78f29a8e2de5/project-manager-app/packages/db/prisma/schema.prisma) carece de owner | CLIENT no demuestra dueño. Propuesta de vínculo explícito con tenant/org/user, legacy fail-closed y conciliación auditada; no inferir de primera membership ni issuer de oferta. |
| OFF-02 | Tests llaman owner a un usuario CLIENT; no hay segundo CLIENT no dueño | No demuestran owner-only. Matriz negativa de cinco operaciones y compensación pendiente. |
| OFF-03 | Controller exige legalConfirmed:true; servicio usa NOT_RECORDED; PRO ya no gestiona | Conservar correcciones existentes. La declaración no acredita revisión legal; no borrar datos históricos sin inventario autorizado. |
| OFF-04 | UI promete «solo ustedes dos» y finalización BO-06 sigue pendiente | Corregir promesa frente a gestores/OPS_ADMIN y completar finalización con engagementId permitido y motivo. |

## Decisiones y nuevos gates

- **Ya decidido:** OPEN-03 sin clasificación, OPEN-04 dueño + OPS_ADMIN sin HR, OPEN-06 compensación restringida, OPEN-14 firma solo planificada. No pedirlos otra vez.
- **Por aprobar formalmente:** contrato reconciliado v0.2, mecanismo de ownership y migración aditiva/conciliación auditada; frontera confiable/rate limiter distribuido. La orden de continuar autoriza preparar estos artefactos, no inventar signoff independiente.
- **Regla real del repositorio:** AGENTS.md §Dominios Activos exige detener implementación con DRAFT/REVIEW; SDD_GOVERNANCE §4/§6 solo autoriza código desde APPROVED. No se eleva el estado sin aprobación competente.
- **Implementación y pruebas:** pendientes tras ese gate. No se crearon nuevos endpoints ni eventos, ni se modificó esquema.

## Estado actualizado del resto del conjunto

Datos de API GitHub observados durante esta sesión; comentarios operacionales distinguidos de verificaciones propias.

| Línea | Hecho observado | Gate que sigue pendiente |
|---|---|---|
| #966 | CLOSED sin merge, SUPERSEDED; head 8eb461dc | Mantener cerrado; no revivir rama. |
| #968 | MERGED; head bfc14013 | Smoke visual ES/EN no ejecutado por esta revisión. |
| #969 | OPEN; head **0117ccbb84956ba0d9bc701dbf96c6ca4faca091**, CI [39364292308](https://github.com/Semse-projet/project-manager-app/actions/runs/39364292308) SUCCESS | Otro trabajo actualizó la rama; no sobrescribir ni heredar el smoke del antiguo f2af7b3. Falta smoke autenticado aplicable al head actual. |
| #970 | OPEN; head 424000a147ef2964d75f4d0b2c2f0ba3c56d8212; CI [39346971906](https://github.com/Semse-projet/project-manager-app/actions/runs/39346971906) y workflows adicionales SUCCESS | Sigue apilado en rama #969. Reconciliar base/CI después de integrar #969 y realizar su smoke; no reescribir rama mientras otro agente trabaja sin comprobar delta. |
| #971 / #954 | MERGED; issue #954 abierto. [Comentario de operación](https://github.com/Semse-projet/project-manager-app/issues/954#issuecomment-6281043261) registra Signed GET SHADOW, secreto sellado y gate de 7 días | Son datos informados en issue, no lectura propia de Railway. No adelantar enforce ni repetir pruebas destructivas. Inicio informado 2026-10-20 01:03 UTC; primera consideración 2026-10-27 01:03 UTC, condicionada a aceptación. |
| #1014 | PR draft OPEN-only production; head a2085e8c; CI [39352807209](https://github.com/Semse-projet/project-manager-app/actions/runs/39352807209) y workflows adicionales SUCCESS | Revisión independiente y gates propios; no confundir este canary con permiso de freeze/export ni duplicar implementación. |
| #972 / #952 | MERGED; revisiones consultadas solo COMMENTED, sin APPROVED | Revisión retrospectiva y decisiones OAuth productivas pendientes. [Acta](https://github.com/Semse-projet/project-manager-app/issues/952#issuecomment-6273155543) solicita revisión cruzada; no la acredita. |

## Observación estática complementaria de #972

Se inspeccionó el patch completo de cuatro archivos del PR #972. El laboratorio liga introspection.ext.synthetic_session_binding con AuthSession, valida issuer/client/audience/scope y consulta autorización durable por llamada; usa tests cross-org/cross-tenant y guard de lecturas. El workflow usa permisos contents:read, checkout sin credenciales persistidas y DB descartable. Esto es análisis estático del laboratorio, **no una nueva ejecución de Hydra/PostgreSQL ni aprobación de seguridad**.

Consentimiento/binding sigue sintético en memoria, no D7 durable. No hay Resource Server MCP productivo en ese patch. No se observó aprobación formal en las tres revisiones devueltas. La revisión de dependencias/acciones vigentes, el runtime productivo y el host MCP real quedan fuera de este análisis; no se emite certificado independiente.

## Orden de dependencia por etapa

1. BO-01 y BO-05: aprobar sus contratos formales y diseños aún pendientes. No bloquear i18n por estos gates: no se encontró dependencia de código entre las líneas.
2. Con contrato autorizado, preparar tests rojos y remediaciones pequeñas: token/organización/cancelación/PRO; ownership/permiso/compensación/ofertas. Rate limit requiere su frontera antes de implementar ese control.
3. Validar cada slice con CI actual, revisión aplicable y PostgreSQL/canary antes de activación. Ownership depende de migración y despliegue del guard en todas las instancias; el rollback mantiene flag OFF.
4. #969: smoke autenticado del head actual → integración autorizada → #970 actualizado a main → CI/smoke nuevos. La existencia del preview no acredita el recorrido.
5. #1014 y MCP siguen sus propios gates. No agrupar cuatro activaciones como consecuencia de merge verde.

## Validación de esta entrega

- Lectura de GitHub/código/decisiones: EJECUTADA con los límites indicados.
- Generación de índice y `node scripts/spec-index.mjs --check`: EJECUTADA, 203 specs.
- `git diff --check`: EJECUTADA, sin errores.
- Validación de metadata/rutas de los dos contratos contra inventario GitHub del SHA base: EJECUTADA / PASS para ambos contratos, incluyendo metadata canónica, estados SDD 2.0, archivos/tests existentes en el inventario del SHA y artefactos plan/tasks/checklist. No equivale al validador estricto completo.
- `pnpm spec:validate:strict` completo, build/typecheck/lint/tests de app, PostgreSQL, navegador autenticado y flags de Railway: NO EJECUTADOS en esta fase documental. Checkout local parcial obtenido por conector; clone Git autenticado no estuvo disponible. No se presenta esa limitación como fallo de tests del repositorio. CI nuevo del PR deberá validar el checkout completo.
- CI histórico de #975 [39049257289](https://github.com/Semse-projet/project-manager-app/actions/runs/39049257289) y #976 [39068760667](https://github.com/Semse-projet/project-manager-app/actions/runs/39068760667): SUCCESS observado, **no acredita la remediación nueva**.

## Investigación externa — tres búsquedas primarias independientes

1. Fragmento HTTP — [RFC 9110 §7.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-7.1): fragmentos para procesamiento cliente, fuera del target HTTP.
2. Permiso frente a propiedad — [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): denegar por defecto y verificar autorización por solicitud.
3. IP por proxy — [Fastify Server trustProxy](https://fastify.dev/docs/latest/Reference/Server/#trustproxy): delimitar confianza; no aceptar cabeceras reenviadas arbitrarias.

Aplicado ahora: criterios verificables de token, ownership y rate limit en specs/planes. Backlog: materializar y probar esas garantías tras aprobación. Descartado: confiar en CLIENT como owner, XFF universal, flags como prueba de seguridad o CI como aprobación formal.

## Cierre real pendiente

Esta entrega completa la preparación SDD y la reconciliación del estado. No se afirma completada la implementación solicitada. El siguiente paso concreto es aprobación formal de v0.2 y del binding de dueño; para rate limit aún se debe acreditar la frontera. Luego código y pruebas según tasks. No fusionar, activar, cerrar hallazgos ni marcar VERIFIED desde este informe.
