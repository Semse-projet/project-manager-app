---
id: "prometeo.tool-result-multimodal"
title: "SPEC-AGT-004 — ToolResult multimodal tipado"
type: spec
domain: "prometeo"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
date: "2026-07-31"
related_files:
  - apps/api/src/modules/prometeo/prometeo-tool-registry.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
  - packages/schemas/src/prometeo-runtime.schema.ts
  - packages/db/prisma/schema.prisma
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-07-31"
---

# SPEC-AGT-004 — `ToolResult` multimodal tipado

**Deriva de:** `ADR-023-sense-agentic-architecture-v1.md` §2.3 ítem 2
**Módulos afectados:** `apps/api/src/modules/prometeo`, `packages/schemas`
**Fase Matriz:** child spec de F7 (Prometeo Multimodal); depende de
`SPEC-GTW-001` (Model Gateway unification, mergeado)

---

## 1. Propósito

Hoy toda salida de herramienta de Prometeo es JSON no tipado (`resultJson:
Json?` en Prisma, `resultJson: output` con `output: unknown` en el servicio
de ejecución). `outputKind` es solo una etiqueta descriptiva del nombre de
tipo TypeScript (p. ej. `"VisionAnalysisResult"`), no una estructura real de
partes. Este spec define un tipo `ToolResultPart` discriminado
(text/image/pdf/csv/annotation/approval_request/internal_link) que las
herramientas pueden devolver, empezando por un piloto en `vision.analyze_image`
y un export de evidencia — sin romper el contrato JSON actual de las demás
herramientas.

## 2. Estado real (verificado en código)

| Pieza | Qué hace hoy | Evidencia |
|---|---|---|
| `PrometeoToolDescriptor.outputKind` | String descriptivo del tipo TS del output (`"VisionAnalysisResult"`, `"ReferenceMatchResult"`, `"DetectMaterialResult"`, etc.) — no es un schema, es documentación | `prometeo-tool-registry.ts` (30+ descriptors, todos con `outputKind` como string libre) |
| `PrometeoToolExecutionService.invokeReadTool`/`invokeWriteTool` | Devuelve `resultJson: output` donde `output: unknown` — cualquier JSON, sin tipo de partes | `prometeo-tool-execution.service.ts:411` |
| `vision.analyze_image` | Ejecuta `VisionService.runAnalysis()`, devuelve `VisionAnalysisResult` como JSON plano — no incluye la imagen anotada ni un enlace tipado a ella como "parte" de la respuesta | `prometeo-tool-registry.ts:184-197`, `prometeo-tool-execution.service.ts:727-733` |
| Persistencia | `resultJson: Json?` sin estructura, en 4 modelos distintos (`DomainOutboxEvent`, `AgentWorkPlan`/similar, `AiInteractionLog`, `PrometeoToolInvocationAudit`) | `packages/db/prisma/schema.prisma:838,1674,2324,3815` |

**Consecuencia real:** Prometeo no puede devolver una imagen anotada, un PDF
generado, o una tabla CSV como parte estructurada de una respuesta de
herramienta — solo puede describirlos en texto o dejar una URL suelta dentro
de un JSON sin contrato. Bloquea evidencia visual y documentos de contrato
como salida real de herramienta, tal como señaló la visión original de esta
serie de ADRs/specs.

## 3. Diseño propuesto

```ts
// packages/schemas/src — nuevo, aditivo
export type ToolResultPart =
  | { type: "text"; text: string }
  | { type: "json"; data: unknown }
  | { type: "image"; url: string; mimeType: string; metadata?: Record<string, unknown> }
  | { type: "pdf"; url: string; filename: string }
  | { type: "csv"; url: string; filename: string }
  | { type: "annotation"; targetId: string; data: unknown }
  | { type: "internal_link"; entityType: string; entityId: string }
  | { type: "approval_request"; approvalId: string };

export type ToolResult = {
  parts: ToolResultPart[];
  // compatibilidad hacia atrás: el JSON plano de hoy sigue disponible
  legacyJson?: unknown;
};
```

- `resultJson: Json?` en Prisma **no cambia de tipo** — `ToolResult` se
  serializa dentro de ese mismo campo (`{ parts: [...], legacyJson: {...} }`),
  sin migración de esquema.
- Herramientas que no adopten `ToolResult` siguen devolviendo `unknown` tal
  cual — es aditivo, no se fuerza una migración de las ~30 tools existentes
  en el mismo spec.
- Piloto de adopción: `vision.analyze_image` devuelve
  `{ parts: [{ type: "json", data: <VisionAnalysisResult existente> }, { type: "image", url: <imagen anotada si existe> }] }`;
  un export de evidencia (`evidence` module) devuelve
  `{ parts: [{ type: "pdf", url, filename }] }`.
- El consumidor (UI de Prometeo Copilot, `apps/web/components/ai/` o
  equivalente) debe poder renderizar cada `type` de `ToolResultPart` sin
  romper si aparece un `type` que no reconoce (fallback a texto/JSON crudo).

## 4. Alcance y límites

- No se migra ninguna de las ~30 tools existentes en este spec — solo se
  define el tipo y se pilota en 2 tools (`vision.analyze_image`, un export
  de evidencia).
- No cambia la gobernanza de tools (`tool-governance.policy.ts` sigue
  aplicando igual, independientemente de si el resultado es `ToolResult` o
  JSON plano).
- No introduce almacenamiento nuevo: las URLs de `image`/`pdf`/`csv` deben
  apuntar al storage ya existente (Evidence bucket, ver `storage service`
  mencionado en `IMPLEMENTATION_STATUS_MATRIX.md`), no a un bucket nuevo.

## 5. Riesgos

- `risk: medium`: es un cambio de tipo aditivo (no rompe consumidores
  actuales), pero cualquier UI que consuma `resultJson` asumiendo JSON plano
  debe tolerar la nueva forma `{ parts, legacyJson }` sin fallar — requiere
  verificar los consumidores de `resultJson` en `apps/web` antes de pilotar.
- URLs de `image`/`pdf` expuestas en `ToolResultPart` deben respetar el
  mismo scoping de tenant/permiso que ya aplica al storage subyacente — no
  se introduce una ruta de acceso nueva sin controles.

## 6. Criterios de aceptación

- [ ] Ninguna tool existente cambia de comportamiento si no adopta
      `ToolResult` explícitamente (compatibilidad hacia atrás verificada).
- [ ] `vision.analyze_image` y el export de evidencia piloto devuelven
      `ToolResult` con al menos un `part` de tipo `image`/`pdf` real, no solo
      `json`.
- [ ] El consumidor en `apps/web` renderiza cada `type` sin romper ante un
      `type` desconocido (fallback verificado).
- [ ] Ninguna URL de storage se expone sin el control de permisos que ya
      aplica hoy.

## 7. No implementado en este spec

Queda en `status: DRAFT`. Sigue el mismo flujo que los specs anteriores de
esta serie: `APPROVED` → `/speckit.plan` → `/speckit.tasks` → tests antes de
código → `/speckit.implement`.
