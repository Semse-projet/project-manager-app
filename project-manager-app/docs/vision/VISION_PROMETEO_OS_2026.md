# Vision Prometeo OS 2026

## Nota de copia operativa

`docs/vision/` es la copia operativa de la vision. La fuente canonica vive
fuera de este repositorio (`vision/`, ver `VISION_CHANGE_PROTOCOL.md`). Este
documento se escribe aqui porque es donde vive el codigo y el kit SDD que
debe alinearse con el; la reconciliacion con la fuente canonica externa
queda pendiente de accion humana fuera de este repo.

Este documento no reformula lo existente: documenta una evolucion de
producto real, ya parcialmente desplegada en codigo (Prometeo Runtime P2),
que `docs/vision/` todavia no reflejaba antes de esta fecha (2026-08-04).

## Objetivo

Resolver una colision de nombres antes de que contradiga las decisiones
bloqueadas: `VISION_GLOSSARY.md` define "Prometeo" como la capa 4
institucional (DID, DAO, treasury, governance) — futura, fuera del MVP. El
codigo real usa el mismo nombre para el orquestador conversacional
(`apps/api/src/modules/ai-models/orchestrator/prometeo-orchestrator.service.ts`)
que ya interpreta intencion y ejecuta trabajo hoy. Son dos cosas distintas
con el mismo nombre. Este documento separa ambas explicitamente y ubica la
segunda dentro de la vision activa ya definida en `VISION_BOUNDARIES.md`
("agentes utiles para trabajo real" ya esta dentro de la vision activa).

## Dos capas Prometeo, dos horizontes

### Prometeo Operativo (esta sintesis — horizonte: ahora)

Orquestador conversacional que interpreta la intencion del usuario —
llegue por texto, voz, imagen o dashboard — y decide que capacidad interna
de SEMSE usar. No reemplaza los modulos: los pone detras de una interfaz
conversacional comun. Ya existe en runtime (P2):

- loop OBSERVE → INTERPRET → PLAN → APROBACION → EXECUTE → VERIFY → LEARN,
  documentado en `docs/SEMSE_CONTEXT.md`;
- Tool Registry gobernado con policy/audit/approval sobre las herramientas
  internas (`docs/specs/prometeo/tool-registry-governance.spec.md`,
  `status: APPROVED`);
- ruteo de intencion a agentes internos (Marta/Felix/Pulse/Justus/Planner)
  en diseno (`docs/specs/agents/prometeo-core.spec.md`, `status: DRAFT`).

Acotado hoy a modulos y herramientas internas de SEMSE. Cero MCP, cero
GitHub/Vercel/Railway/Docker — ver seccion "Orquestacion externa" abajo.

### Prometeo Institucional (`VISION_FUSIONADA_SEMSE_PROMETEO.md` §5.4 — sin cambios)

DID, wallet autocustodiado, DAO, treasury, governance programable. Sigue
como norte institucional, sin tocar. `VISION_DECISIONS_LOCKED.md` #10 y
`VISION_PILLARS.md` Pilar 7 siguen vigentes tal cual: no se implementa
completo ahora, no debe contaminar el MVP. Este documento no cambia esa
decision ni el orden de capas de `VISION_DECISIONS_LOCKED.md` #3
(`Jobs → Ops → Trust → Prometeo`) — Prometeo Operativo sigue dependiendo
del core operativo, no al reves.

## Los 5 principios de Prometeo Operativo

1. **El usuario nunca aprende modulos.** Interactua con Prometeo; Prometeo
   decide si eso significa Marketplace, BuildOps, Evidence, Payments, CRM,
   Planner o Mission Control. El usuario no necesita saber que modulo
   resolvio su pedido.
2. **Una cuenta, multiples capacidades, cualquier proyecto.** Un mismo
   usuario puede ser cliente en un proyecto y profesional en otro, sin
   fijar un rol unico por sesion. Detalle tecnico en la seccion
   "Identidad universal" abajo.
3. **Los modulos son organos; MCP es el sistema nervioso hacia afuera.**
   Los modulos internos siguen siendo la unidad de dominio (cada uno
   gobierna su propio schema). Prometeo los orquesta hacia adentro ya;
   MCP es el mecanismo evaluado para orquestar herramientas externas
   (GitHub, Vercel, Railway, Docker, sandboxes) — ver seccion abajo, no es
   alcance activo todavia.
4. **Ningun canal reemplaza a otro; se suman.** Dashboard, texto, voz,
   imagen y video son clientes del mismo backend, no migraciones. Precedente
   ya escrito: `docs/specs/satellites/SAT-002-alexa-voice-channel.spec.md`
   dice explicitamente "Alexa es solo otro cliente del mismo backend, no se
   migra nada" (`status: APPROVED`).
5. **El nucleo del proyecto es universal; la ejecucion se especializa por
   industria.** El orquestador y el modelo de datos no cambian entre
   verticals; las skills/agentes de dominio si.

## Mapa canal → capacidad

| Canal | Estado | Referencia |
|---|---|---|
| Dashboard | ✅ construido | UI existente por modulo |
| Texto (chat Prometeo) | ✅ P2 desplegado | `docs/SEMSE_CONTEXT.md` |
| Adjuntos multimodales (imagen/video/audio/docs en el chat) | ✅ `IMPLEMENTED` | `docs/specs/ui/prometeo-multimodal-workspace.spec.md` |
| Voz nativa (satelite) | ✅ `APPROVED`, sin activar | `docs/specs/satellites/SAT-002-alexa-voice-channel.spec.md` |
| Voz/camara/video nativos del workspace, streaming | ⏳ pendiente, F7 | `ROADMAP.md` — "F7 — Prometeo Multimodal" |
| Vision-a-proyecto (foto → intencion) | ⏳ pendiente, F7 | idem |
| Orquestacion de herramientas externas (MCP) | ⏳ decision pendiente, ADR nuevo | ver seccion siguiente |

## Identidad universal (una cuenta, multiples capacidades)

El schema ya lo permite a nivel de datos: `Membership(userId, orgId,
roleId)` tiene PK compuesta `[userId, orgId, roleId]`
(`packages/db/prisma/schema.prisma`), es decir, un usuario ya puede tener
mas de un rol por organizacion sin migracion. Lo que falta es
producto/UX: hoy la sesion asume un rol fijo, y `docs/AUDIT_REMEDIATION_PLAN.md`
ya documenta confusion de nombres de rol (`PRO` en DB vs "Profesional" en
UI) como sintoma de esa asuncion. Este es un cambio de superficie de
producto sobre una capacidad de datos que ya existe, no un cambio de
schema. Detalle de alcance en
`docs/specs/core/universal-identity-multi-role.spec.md` (a crear, ver
seccion "Kit SDD" abajo — este documento de vision no lo desarrolla).

## Orquestacion externa (MCP) — decision pendiente, no alcance activo

MCP externo ya se evaluo una vez y se retiro: `SPEC-INT-001` (CLI Agent
Adapter + MCP Gateway externo) figura como "retirado" en `ROADMAP.md`
(seccion "Programa transversal — Consolidacion Cognitiva"), reemplazado
por `packages/agents/src/developer-runtime.ts`. `ADR-024` §12 propone un
"MCP Gateway" para Obscura (control de scopes, "confused deputy",
auditoria inmutable) pero sin evidencia de implementacion. Revivir MCP no
es agregar algo nuevo: es reabrir una decision ya cerrada, y por eso
necesita su propio ADR explicito (`docs/architecture/ADR-025-mcp-external-tool-gateway.md`,
a crear) en vez de asumirse como parte de esta vision. Mientras ese ADR no
se apruebe, Prometeo Operativo no gana herramientas externas.

## Originador / facilitador (glosario nuevo)

Rol nuevo, sin precedente en ningun documento existente: un usuario que
ayuda a un tercero a crear un proyecto en SEMSE (lo origina o facilita) y
recibe una recompensa atada a hitos verificables del proyecto resultante —
no a la sola publicacion. Ejemplos de hitos que si califican: proyecto
validado por su dueño, primera propuesta recibida, profesional contratado,
primer milestone financiado, proyecto completado. Publicar sin que nada de
eso ocurra no genera recompensa. Toca dinero real (Stripe/escrow) y por
eso su spec (`docs/specs/core/originador-referral-program.spec.md`, a
crear) cae bajo el gate §7 "Economia" de `docs/SDD_GOVERNANCE.md`.

## Que no cambia

- El orden de capas `Jobs → Ops → Trust → Prometeo`
  (`VISION_DECISIONS_LOCKED.md` #3).
- La frontera institucional de Prometeo (`VISION_BOUNDARIES.md`,
  "Frontera de Prometeo"): orienta arquitectura, trust e identidad,
  governance futura — no es requisito de salida del MVP.
- `Job` como entidad canonica del flujo comercial
  (`VISION_DECISIONS_LOCKED.md` #4).
- F0–F9 de `ROADMAP.md`: no se reordenan ni renumeran. Ver documento de
  planeacion `docs/reportes/planning/plan_alineacion_prometeo_os_roadmap_sdd_2026-08-03.md`
  para como se conecta esta vision con el roadmap y el kit SDD.
