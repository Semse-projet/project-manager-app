---
id: "labor.worker-independence-growth-program"
title: "Programa de registro personal independiente, acuerdos transparentes y crecimiento profesional"
domain: "labor"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-24"
---

# Programa: independencia, protección bilateral y crecimiento profesional

> **DRAFT / solo propuesta documental.** Este contrato de programa recoge necesidades de usuarios de construcción de forma abstracta y sin divulgar conversaciones, salarios individuales ni datos de empleadores. No autoriza implementación, migración, firma, pago, merge, despliegue ni activación. Cada fase requiere su propia spec aprobada y gates SDD 2.0.

## 1. Problema y resultado

**Actores:** trabajador sin empresa en SEMSE; trabajador afiliado a una o varias organizaciones; profesional independiente; compañía; supervisor delegado; cliente final.

**Problema:** la persona necesita conservar un registro lícito de su propio trabajo y progresar sin depender de que una compañía utilice SEMSE. Cuando sí existe una relación compartida, ambas partes necesitan términos y estados transparentes sin que una pueda alterar silenciosamente los registros de la otra. El profesional también necesita demostrar hechos verificables para optar por empleo, liderazgo o contratos empresariales.

**Resultado:** identidad global portable; registro personal privado y exportable; invitación/compartición explícita; términos y diferencias auditables; constancias profesionales sin certificaciones inventadas; posibilidad de cotizar por alcance usando el flujo comercial existente.

**Prioridad del programa:** primero autonomía y privacidad (F0/F1), después acuerdos y conciliación (F2/F3), por último carrera y negocios (F4/F5).

## 2. Alcance y compatibilidad con contratos existentes

| Fase | Decisión de arquitectura | Preexistencia y límite |
|---|---|---|
| F0 — Matriz de autoridad, datos y consentimiento | DOCUMENTAR antes de código | `DOMAIN_INVARIANTS`, ResourceScope, Identity Multi-role |
| F1 — Registro personal independiente y exportación | REUSE/EXTEND; no segundo reloj | `labor.engine-remediation` declara `TimeEntry purpose=personal` solo para `createdBy`; `labor.free-project-mutation-guard` protege FreeProject por `createdBy`; ADR-029 mantiene Labor Engine canónico |
| F2 — Colaboración bilateral | CONTRACTUALIZE, no convertir ofertas en contrato legal | `core.business-offers` BO-05: clasificación W-2/1099 excluida del payload por decisión existente, permisos restringidos, flag OFF; aceptación no significa firma |
| F3 — Horas, gastos, pagos declarados y desacuerdos | SEPARATE reported/verified/calculated | `core.labor-policy` BO-08: horario versionado, corrección con original, sin nómina automática; pagos siguen gobernados por su dominio |
| F4 — Experiencia y portabilidad | REUSE, no duplicar Skills | `core.skills` BO-12: atestaciones redactadas, temporales, revocables y sin fotos/clientes; **NO insignias, niveles de competencia ni licencias automáticas** |
| F5 — Ruta empresarial | CONNECT LATER | Profesional/organización existente, Marketplace/ProTools/BuildOps; no fusionar Job/Bid/Contract con BO-05 |

Este programa NO autoriza modificar contratos previamente aprobados ni presume que todas las capacidades listadas estén activas en producción.

### Fuera de alcance

- Determinar jurídicamente relación W-2/1099, automatizar nómina/overtime, resolver disputas legales o renunciar a derechos por aceptar una oferta.
- Reintroducir `classification` en BO-05; cambiar permisos de supervisor; activar Documenso o escrow; publicar fotos confidenciales; emitir badges/licencias o decidir competencias por IA.
- Compartir automáticamente historial personal al aceptar una invitación, convertir FreeProject a Job o cambiar de organización.
- Nuevos modelos o endpoints en este PR; es exclusivamente documental.

## 3. Matriz de autoridad y privacidad propuesta (F0)

| Agregado/clase | Custodia SEMSE y control de acceso | Autorizados de base | Denegado por defecto |
|---|---|---|---|
| `TimeEntry purpose=personal`, FreeProject personal | Registro del creador, `createdBy`, tenant acotado | Solo creador autenticado | Empleador, supervisor, otro usuario del mismo tenant, OPS_ADMIN sin procedimiento habilitante |
| Registro de obra/tiempo organizacional | Mantiene autoridades de Labor Engine y Job/Org | Roles sujetos a autorización por recurso y política vigente | Acceso global por pertenecer al tenant |
| Notas, gastos y fotografías personales | Alcance personal y derechos de terceros; medios con custodia y hashes | Creador; terceros solo con grant o deber legal documentado | Publicación, búsqueda RAG, descarga ajena, sharing retroactivo |
| Oferta/engagement BO-05 | Fuente organizacional y acceso limitado al destinatario | Emisor autorizado + destinatario, según BO-05 | Supervisor sin grant de compensación, persona de otra org |
| Atestación BO-12 | Hechos confirmados bajo fuente organizacional; resumen portable controlado por persona | Destinatario de token vigente y autorizado | Fotografías, clientes, direcciones, salarios, identidades no requeridas |
| Portafolio público eventual | Publicación opt-in sujeto a autorizaciones y revisión | Lectores de contenido autorizado | Datos de obra/cliente sin consentimiento y material confidencial |

**Distinguir:** control técnico del registro personal, titularidad de propiedad intelectual, conservación exigida por ley y derechos contractuales de terceros. SEMSE no garantiza propiedad legal universal sobre cada fotografía o documento. Archivar un recurso no significa destruir la evidencia. Una solicitud de borrado se evalúa según retención, respaldo, requerimientos legales y plazos definidos.

**Reglas de compartición propuesta:** consentimiento afirmativo por recurso y finalidad, destinatario explícito, alcance de campos, vencimiento y revocación; acceso decidido siempre por backend; hashes y enlaces firmados de corta duración; revocación bloquea nuevos accesos en SEMSE sin afirmar que retira copias ya obtenidas. No reutilizar ni duplicar grants existentes hasta inventariar el sistema de autorización.

**Privacidad de localización:** minimizar coordenadas, retención por política, separar validación de asistencia de vigilancia continua; no deducir consentimiento a GPS del consentimiento a un acuerdo comercial.

## 4. Escenarios P0 y criterios de aceptación para futuras slices

### P0-A — Trabajador sin compañía en SEMSE

```gherkin
DADO un User válido sin Membership en una organización contratante
CUANDO crea un FreeProject y registra tiempo personal en Labor Engine
ENTONCES puede consultar su historial propio y solicitar exportación autorizada
Y ningún usuario diferente obtiene acceso por pertenecer al mismo tenant
```

### P0-B — Invitación tardía no transfiere historial

```gherkin
DADO un trabajador con historial personal anterior
CUANDO acepta una invitación a una empresa o cambia de organización
ENTONCES la Membership y el Job no heredan grants ni notas personales
Y cualquier compartición requiere una nueva autorización específica
```

### P0-C — Revisión sin destrucción de originales

```gherkin
DADO una hora registrada y una corrección solicitada
CUANDO un revisor autorizado aprueba o rechaza la corrección
ENTONCES queda visible la fuente original, el cambio propuesto, el decisor y motivo
Y no se edita silenciosamente la evidencia aportada por cualquiera de las partes
```

### P0-D — Experiencia portátil sin credenciales falsas

```gherkin
DADO una asignación completada y revisada por una persona autorizada
CUANDO el trabajador crea una atestación BO-12 con consentimiento
ENTONCES comparte únicamente el resumen redactado del oficio y período
Y no incluye fotos, clientes, ubicación ni afirma licencia/certificación
```

**AC-01:** A y B dentro del mismo tenant y C en otro tenant: solo A puede modificar/leer su FreeProject y TimeEntry personal; errores 401/403/404 no filtran existencia.

**AC-02:** listado administrativo/costos/overtime excluye `purpose=personal` conforme `labor.engine-remediation`.

**AC-03:** conversión FreeProject→Job no reescribe `createdBy` ni concede por defecto acceso al historial completo; la integración se decide en una spec F1 propia.

**AC-04:** exportación incluye procedencia, rango temporal y zona horaria, estado sync y referencias a adjuntos autorizados; evita introducir un método masivo para descargar materiales del cliente.

**AC-05:** reintentos offline/idempotencia `clientEventId` no duplican entradas ni eventos canónicos; API móvil y BFF compatibles con ADR-029.

**AC-06:** ninguna oferta, corrección de horas o invitación implica reconocimiento automático de overtime, clasificación legal, pago realizado o firma electrónica.

**AC-07:** nuevas funciones críticas OFF por defecto, staging con identidades y datos sintéticos; recuperación y rollback probados antes de cualquier activación.

**AC-08:** ES/EN autenticado: cambiar idioma conserva formularios sin pérdida; mensajes de consentimiento legales se versionan, no se traducen libremente por IA.

## 5. Contratos de integración (NO endpoints autorizados aún)

- **Labor Engine:** único escritor de `TimeEntry`, reuse `clientEventId`, `createdBy` y `purpose`. Adaptadores de `field-ops/time-tracker` no crean una fuente alterna de horas.
- **FreeProject:** ownership individual y guard del Job destino; la conversión no es concesión global ni publicación.
- **Core/BO-05:** una oferta NO es contrato legal, firma ni acceso; respetar decisión de 2026-10-18 de excluir clasificación, y restringir visibilidad de compensación.
- **BO-08:** horario real, pagable y posibles indicadores de horas extra diferenciados; revisión Legal/Payroll.
- **BO-12:** atestación resumen solo tras revisión y consentimiento; vence, se revoca y no pretende acreditar licencias. Rutas profesionales descritas como orientación conceptual, no niveles computados.
- **Evidence:** contenido personal y evidencia de Job separados; prohibido publicar un recurso de obra sin revisar alcance/autorización.
- **Prometeo:** solo orientación, nunca firma, certificación, aceptación por otra parte, aprobación de pago o grant implícito.

**Contrato API, eventos y FSM:** sin rutas ni eventos nuevos aprobados en esta spec de programa. Una futura spec de slice deberá definir sus schemas, permisos, FSM, eventos de `EVENT_CATALOG`, transacción/outbox, idempotencia y rechazo neutro cross-tenant antes de implementación.

## 6. Datos, migración, monitoreo y rollback

**Este PR:** ningún cambio de Prisma, migración, API, roles, banderas, CI, contrato de eventos, pagos o configuración.

**Futuras slices:** migración aditiva y reversible cuando se requiera; no modificar migraciones aplicadas; contratos BFF compatibles; telemetría de rechazos por permiso, grants revocados, discrepancias y fallos offline sin guardar PII/GPS en logs.

**Release gate:** spec de slice APPROVED → tests negativos/contratos → código en rama → revisión de seguridad y gobernanza → verificación local/CI **al final** → merge aprobado separadamente → staging con datos sintéticos → canary/rollback y evidencia independiente. Prohibido inferir activación de un CI verde.

## 7. Riesgos y decisiones abiertas

| ID | Decisión requerida antes del código sensible | Autoridad |
|---|---|---|
| D-01 | Retención, exportación y borrado por tipo de dato y jurisdicción | Legal/Privacy |
| D-02 | Fotografías/documentos permitidos del lugar de trabajo; derechos de terceros | Legal/Privacy/cliente |
| D-03 | Modelo de grant/copia/vínculo autorizado entre espacio personal y organización; evitar doble fuente | Security/Architecture |
| D-04 | Visibilidad de horas, salarios, dietas y gastos del supervisor; separar compensación | Product/Privacy |
| D-05 | Contrato legal externo vs acuerdo de intención BO-05; identidad y firmas Documenso OFF | Legal/Security |
| D-06 | Requisitos de licencia, título y competencia por oficio/jurisdicción; no badges sin estudio | Producto/Legal |
| D-07 | Cronología de discrepancias vs Payment Governance, sin desencadenar pagos | Finance/Security |
| D-08 | Alcance de exportación, integridad y límites para material confidencial | Privacy/Operations |

## 8. Referencias canónicas

- `docs/SDD_GOVERNANCE.md`
- `docs/foundation/DOMAIN_INVARIANTS.md`
- `docs/specs/labor/labor-engine-remediation.spec.md`
- `docs/specs/labor/free-project-mutation-guard.spec.md`
- `docs/architecture/ADR-029-labor-engine-canonical-time-owner.md`
- `docs/specs/core/universal-identity-multi-role.spec.md`
- `docs/specs/core/business-offers.spec.md`
- `docs/specs/core/labor-policy.spec.md`
- `docs/specs/core/skills.spec.md`

**Próximo slice propuesto:** F1 `labor.personal-record-export` — solo inventario de datos y exportación controlada de registros propios; antes de código confirmar si ya existe capacidad equivalente y cuál es su endpoint canónico.
