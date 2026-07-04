---
id: agt-001-verification-loop
title: "SPEC-AGT-001 — Verification Loop en packages/agents"
type: spec
domain: agents
status: "DRAFT"
owner: semse-core
risk: medium
related_files:
  - packages/agents/src/verification.ts
  - packages/agents/src/governance.ts
  - packages/schemas/src/agent-verification.schema.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
---

# SPEC-AGT-001 — Verification Loop en `packages/agents`

**Estado:** DRAFT → listo para bloque en PROTOOLS_MASTER_PLAN
**Deriva de:** ADR-021
**Módulos afectados:** `packages/agents/src/runtime.ts`, `packages/agents/src/governance.ts`, `packages/autonomy/src/validator.ts`, `packages/schemas/src/agent-governance.schema.ts`
**Fase Matriz:** F1 (MVP) — celda "MCA/Cognitivo" nivel I

---

## 1. Objetivo

Convertir el run gobernado lineal actual (`policy → handler → risk → approvals → output`) en un loop cerrado **actuar → verificar → corregir → re-verificar**, con presupuesto explícito, para runs cuya `actionType` implique escritura (código, archivos, datos, configuración).

Fuera de alcance: runs de solo lectura/análisis (pricing, risk, trust-match) — no verifican, no cambian.

## 2. Contratos nuevos

### 2.1 `VerificationBudget` (en `governance.ts`)

```ts
export type VerificationBudget = {
  maxIterations: number;        // default 3, techo duro 5
  maxTokens?: number;           // presupuesto LLM total del loop
  timeoutMs?: number;           // techo temporal del loop completo
  successCriteria: VerifierName[]; // qué debe pasar para declarar éxito
};
```

Regla P2 del ADR: si un run de escritura llega sin `successCriteria` no vacío, el policy engine responde `deny` con razón `missing_verification_budget`.

### 2.2 `VerifierName` y registry de verificadores

```ts
export type VerifierName =
  | "verify.typecheck"    // tsc --noEmit en workspace afectado
  | "verify.lint"
  | "verify.unit_tests"   // npm run test:unit --workspace <pkg>
  | "verify.build"        // npm run build --workspace <pkg>
  | "verify.schema"       // validación Zod del output contra packages/schemas
  | "verify.custom";      // hook inyectable (mismo patrón que setDelegateImpl)
```

Cada verificador se registra en `agentToolRegistry` como tool de categoría `verification`, riesgo `low`, sin approval. Implementación: reutilizar el patrón `spawnSync` de `packages/autonomy/src/validator.ts` — los verificadores **son los comandos de CI**, nunca lógica propia del agente (mitigación de falsa confianza, ADR §6).

### 2.3 `VerificationReport` (se añade a `GovernedAgentExecutionResult`)

```ts
export type VerificationAttempt = {
  iteration: number;
  verifier: VerifierName;
  status: "pass" | "fail" | "skipped" | "error";
  durationMs: number;
  evidence?: string;      // stderr/stdout truncado, máx 4KB
};

export type VerificationReport = {
  budget: VerificationBudget;
  attempts: VerificationAttempt[];
  finalStatus: "verified" | "exhausted" | "not_applicable";
  iterationsUsed: number;
  tokensUsed?: number;
};
```

`GovernedAgentExecutionResult` gana el campo opcional `verification?: VerificationReport`. El schema Zod correspondiente se añade a `agent-governance.schema.ts`.

## 3. Algoritmo (modificación de `executeGovernedAgentRun`)

```
1.  policy engine evalúa el run                    (existente)
2.  si deny → salida actual sin cambios            (existente)
3.  handler especializado produce el cambio        (existente)
4.  si actionType ∉ WRITE_ACTIONS → saltar a 8
5.  LOOP (i = 1 .. budget.maxIterations):
      a. ejecutar successCriteria en orden; registrar VerificationAttempt + AgentAuditEvent("agent.verify", …)
      b. si todos pass → finalStatus = "verified"; break
      c. si fail → construir FixInput { evidencia del fallo, diff previo, intento i }
         y re-invocar el handler en modo "fix" (payload.mode = "fix")
      d. auditEvent("agent.fix.attempt", { iteration, verifier fallido }, "warn")
6.  si se agota el budget → finalStatus = "exhausted";
    requiresHumanReview = true; abrir approval con contexto del último fallo
7.  riesgo final: "exhausted" suma +1 nivel de riskLevel (nunca baja de "medium")
8.  approvals + output                              (existente, ahora con verification report)
```

Puntos de diseño clave:

- **El fix es el mismo handler, no un agente nuevo.** Evita explosión de manifests; el modo `fix` llega en el payload y el handler decide cómo corregir con la evidencia.
- **Cada intento de verificación es un `AgentAuditEvent`.** El audit trail existente absorbe el loop sin cambiar su contrato.
- **`exhausted` nunca falla silenciosamente:** siempre abre approval humano con la evidencia del último fallo. Es la traducción de "el agente itera hasta que pasan los tests, o escala".

## 4. Delegación tipada (cierre de GAP-2)

Formalizar en `delegate.ts` dos perfiles que el policy engine reconoce:

```ts
export type DelegateProfile = "explore" | "general";
```

- `explore`: manifest sintético restringido a tools de categoría `read` + `verification`. No puede escribir. Uso: reunir contexto sin contaminar ni arriesgar.
- `general`: hereda el manifest del rol delegado, con presupuesto propio (sub-budget ≤ 50% del budget del padre).
- **Concurrencia:** máximo 4 delegaciones activas por run (constante `MAX_CONCURRENT_DELEGATES = 4`); la 5ª se encola. Razón: rate limits de proveedores y control de costo — la paralelización ahorra tiempo, no tokens.
- El contexto del subagente se construye con `resolveAllowedContextEnvelope` (existente) sobre su propio manifest, nunca por herencia directa del padre (P3).

## 5. Plan de implementación (bloques)

| Bloque | Contenido | Depende de |
|---|---|---|
| AGT-001-A | Tipos + schema Zod (`VerificationBudget`, `VerificationReport`, `VerifierName`) | — |
| AGT-001-B | Registry de verificadores sobre `spawnSync` (reusar `packages/autonomy/src/validator.ts`) | A |
| AGT-001-C | Loop en `executeGovernedAgentRun` + eventos de auditoría + regla `deny` por budget faltante | A, B |
| AGT-001-D | Perfiles de delegación + límite de concurrencia | A |
| AGT-001-E | Tests: unit del loop (mock verifiers pass/fail/exhausted), integración vía `@semse/api` | C, D |

## 6. Criterios de aceptación

1. Un run de escritura sin `successCriteria` es denegado por policy con razón trazable.
2. Un run cuyo primer intento falla y el segundo pasa termina `verified` con 2 `attempts` en el report y ≥2 eventos `agent.verify` en el audit trail.
3. Un run que agota `maxIterations` termina `exhausted`, `requiresHumanReview = true`, y existe un `AgentApprovalRequest` pendiente con la evidencia.
4. Un delegado `explore` que intente una tool de escritura recibe `deny` del policy engine.
5. `npm run test:unit --workspace @semse/api` y `npm run build --workspace @semse/agents` en verde (los mismos comandos que el loop usa como verificadores — el sistema se valida con sus propias reglas).

## 7. Métricas para OMEGA

`verification.pass_rate_first_try`, `verification.avg_iterations`, `verification.exhausted_rate`, `tokens_per_verified_run`. Umbral de alarma inicial: `exhausted_rate > 20%` sostenido → revisar calidad de handlers o de criterios.
