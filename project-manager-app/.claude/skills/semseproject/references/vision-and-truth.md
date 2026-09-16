# Visión, verdad y Living Spec

Referencia del skill `semseproject`. Las marcas MUST/SHOULD/MAY/PROPOSED/EXAMPLE/HISTORICAL/
UNKNOWN siguen la taxonomía definida en `SKILL.md` §1. Ante conflicto con `SKILL.md` §1–§12,
`SKILL.md` gana.

---

## 1. Tesis de producto

SEMSEproject debe evolucionar hacia un sistema operativo de trabajo especializado.
**(PROPOSED — dirección de producto, no un hecho de estado actual.)**

Prometeo no es solo un chatbot. La dirección de producto es:

```
assistant → agent → orchestrator → persistent mission runtime → multimodal operational presence
```

La conversación puede ser la interfaz principal, pero no la única. Las pantallas
estructuradas existen para observar, controlar, corregir, aprobar, configurar y auditar.

La experiencia ideal (**PROPOSED**) es: el usuario expresa su intención de forma natural;
Prometeo entiende el contexto, descubre capacidades, usa motores y herramientas autorizados,
ejecuta o propone acciones (siempre a través del Action Kernel — ver `prometeo-and-agents.md`),
verifica resultados y deja trazabilidad (AuditEvent, `SKILL.md` §7).

**SHOULD**: no competir con modelos frontier intentando ser "otro ChatGPT". SEMSE debe hacer
que los mejores modelos disponibles sean más útiles dentro del contexto operativo de
construcción.

---

## 2. Flujo económico-operativo principal

Flujo canónico de alto nivel (**PROPOSED** como arquitectura objetivo; verificar en
`docs/SPEC_INDEX.md` qué tramos están `IMPLEMENTED`/`DEPLOYED` realmente):

```
Intake → Estimate → BuildOps → Milestones → Evidence → Approval → Payment
```

Change Orders, Disputes, Trust, Communications, Labor, Materials, Scheduling y Governance
intersectan este recorrido.

**MUST NOT**: ningún módulo nuevo rompe este flujo ni crea una autoridad paralela de escritura
sobre el mismo Resource sin una decisión arquitectónica explícita (ID `DEC-*`, ver
`SKILL.md` §12) — mitiga que dos rutas escriban la misma entidad sin reconciliación
(ver `operations.md`, "Auditoría y reconciliación").

---

## 3. Roles principales

El sistema debe reconocer como mínimo (**EXAMPLE** — lista ilustrativa, no inventario
autorizado; el inventario real vive en `packages/auth/src/rbac.ts`):

- Cliente
- Profesional independiente
- Worker
- Contratista / Company
- Originador
- Operador / Admin
- Usuarios de verticales futuras (p. ej. SEMSE Agro)

**MUST**: un rol global no implica autorización sobre cualquier recurso. Siempre evaluar
`principal`, `tenant/org`, relación con el recurso, `action` y `context` vía el Policy Engine
(`SKILL.md` §5). **MUST NOT** tratar RBAC simple como prueba de aislamiento multi-tenant.

---

## 4. Estado técnico base conocido

El ecosistema ha utilizado/documentado (**HISTORICAL** — corte no fechado en el original;
tratar como no verificado hasta confirmar contra `docs/architecture/CURRENT_ARCHITECTURE.md`
o el código real):

monorepo TypeScript · Next.js (Web/BFF) · NestJS (API) · Prisma + PostgreSQL · Redis +
BullMQ/workers · Expo/React Native (móvil) · Vision service Python · RAG/Knowledge ·
gateway/router multi-modelo · Ollama y proveedores cloud · Railway como infraestructura
principal actual · Stripe Connect/Payments · Evidence · BuildOps · ProTools · Prometeo ·
agentes especializados · eventos/SSE y patrones outbox en partes del sistema.

**MUST NOT**: asumir que una pieza documentada aquí está activada en producción. **MUST**:
antes de afirmar estado actual, inspeccionar las fuentes disponibles y distinguir DESIGN,
CODE, TEST, DEPLOYMENT y RUNTIME (declarar el modo de operación, `SKILL.md` §9, si alguna
fuente no se pudo consultar).

---

## 5. Jerarquía de verdad (para hechos del sistema — no confundir con la jerarquía normativa de `SKILL.md` §2)

`SKILL.md` §2 resuelve conflictos de *reglas/permisos*. Esta jerarquía resuelve conflictos
sobre *qué es cierto hoy* en el sistema:

1. Comportamiento observado y acotado en runtime (con alcance declarado — entorno, región,
   tenant, versión/SHA, feature flags, ventana temporal — por `SKILL.md` §7).
2. Pruebas ejecutadas y reproducibles.
3. Código fijado a commit/SHA.
4. Configuración de producción.
5. Contrato/spec aprobado.
6. Documentación histórica.
7. Conversación/idea no consolidada.

**MUST NOT**: tratar una señal `SUCCESS` como demostración de resultado de negocio (ver
`Verification` en `SKILL.md` §3/§8). Que exista código no demuestra que esté en producción.
Que exista UI no demuestra el journey completo. **MUST**: conservar contradicciones entre
fuentes hasta reconciliarlas explícitamente — no promediar ni descartar la que incomoda.

---

## 6. Estados canónicos del Living Spec — máquina de estados (resuelve H-03)

v1 enumeraba estados sin transiciones ni dimensiones separadas. v2 separa **cinco
dimensiones ortogonales** — no colapsar todo en un único campo "estado":

| Dimensión | Valores posibles |
|---|---|
| `lifecycle` | IDEA → PROPOSED → APPROVED → DEPRECATED → RETIRED |
| `implementation` | NOT_STARTED → SPECIFIED → IMPLEMENTED |
| `verification` | UNTESTED → TESTED → VERIFIED |
| `deployment` | NOT_DEPLOYED → DEPLOYED |
| `runtime` | UNOBSERVED → OBSERVED_IN_PRODUCTION → PARTIAL → BLOCKED |

**MUST**: cada capacidad importante declara las cinco dimensiones, no una etiqueta única
tipo "done". Si solo 4 de 10 requisitos están demostrados en alguna dimensión, reportar
`PARTIAL` con el detalle — nunca `COMPLETE`.

**MUST**: `verification=VERIFIED` no puede preceder a `implementation=IMPLEMENTED`.
`runtime=OBSERVED_IN_PRODUCTION` requiere `deployment=DEPLOYED`. Las dimensiones no son
necesariamente monotónicas: una regresión (p. ej. `runtime` pasa de `OBSERVED_IN_PRODUCTION`
a `BLOCKED`) debe registrarse con motivo, evidencia y decisión — no simplemente revertirse
en silencio.

Cada capacidad importante debe tener: ID estable; propósito; inputs/outputs; owner;
dependencias; permisos; `riskLevel` (`SKILL.md` §10); side effects; invariantes; pruebas;
evidencias; versión; consumidores; las cinco dimensiones de estado; gaps; criterio de cierre.

---

## 7. Living Spec Engine

SEMSE debe tratar la especificación como un sistema vivo gobernado (**PROPOSED** como
arquitectura del propio proceso; el flujo SDD ya operativo es el de `AGENTS.md`).

Fuentes posibles: conversaciones · specs y ADRs · GitHub · commits/PRs/issues · tests · CI ·
producción · Railway · telemetría · incidentes · feedback de usuarios.

**MUST NOT**: la información observada modifica automáticamente el canon.

Flujo:

```
OBSERVE → EXTRACT → COMPARE → DETECT (DUPLICATE / CONFLICT / DRIFT)
→ PROPOSE → REVIEW / APPROVE → UPDATE CANON
→ CREATE TRACEABLE WORK → VERIFY (CODE / TEST / DEPLOYMENT / RUNTIME)
```

Tipos de drift a vigilar: spec drift · implementation drift · architecture drift ·
deployment drift · operational drift · security-policy drift.

**MUST**: toda decisión importante tiene ID, por ejemplo `DEC-PROMETEO-001`,
`DEC-ACTION-001`, `DEC-ENG-001`, `DEC-CONNECTOR-001`, `DEC-SECURITY-001` — consistente con
la gobernanza de `SKILL.md` §12.

---

## 8. Método obligatorio de trabajo de un agente

### 8.1 Antes de cambiar algo (MUST, todos los pasos)

1. Definir la petición exacta.
2. Identificar dominios afectados.
3. Buscar specs, ADRs, auditorías y la matriz vigente (`docs/SPEC_INDEX.md`).
4. Inspeccionar código real.
5. Inspeccionar tests relevantes.
6. Cuando importe, verificar runtime/deployment.
7. Construir un mapa de autoridades de escritura (quién más escribe este Resource).
8. Identificar invariantes y rutas duplicadas.
9. Clasificar riesgo (`SKILL.md` §10).
10. Diseñar el cambio mínimo compatible.

### 8.2 Durante la implementación

**MUST**: reutilizar servicios existentes · preferir adapter sobre rewrite · no saltarse
lógica de dominio · no escribir directamente a la DB desde un agente si existe servicio
canónico · preservar idempotencia · preservar tenant/org/resource authorization (`SKILL.md`
§5) · preservar auditabilidad (`SKILL.md` §7) · no permitir que el LLM sea autoridad de una
mutación sensible (una `ModelInference` no sustituye un `Approval`, `SKILL.md` §8).

**MUST NOT**: introducir un segundo writer de negocio sin decisión explícita (`DEC-*`) ·
mezclar fixtures/demo con estado operativo (namespaces/credenciales/endpoints separados,
ver R-07 en `references/audit-v1.md`).

### 8.3 Para declarar una tarea terminada

Debe existir correspondencia: requisito → implementación → prueba → evidencia → despliegue
(si aplica) → observación runtime (si aplica). **MUST NOT** reportar `COMPLETE` cuando la
correspondencia es parcial — usar `PARTIAL` con el detalle de qué falta (ver §6).
