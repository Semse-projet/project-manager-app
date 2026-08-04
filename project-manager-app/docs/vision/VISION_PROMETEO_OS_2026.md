# Vision Prometeo OS 2026

## Objetivo

Nombrar y encuadrar formalmente algo que ya empezó a construirse sin tener
un documento de vision propio: Prometeo como orquestador conversacional que
unifica el uso de SEMSE, no solo como agente puntual dentro de un modulo.

Este documento no reemplaza [VISION_FUSIONADA_SEMSE_PROMETEO.md](VISION_FUSIONADA_SEMSE_PROMETEO.md).
Lo complementa distinguiendo dos capas de Prometeo con horizontes distintos,
resolviendo una ambiguedad que ya existia entre el glosario y el codigo real
(ver "Las dos capas de Prometeo" abajo).

## Por que este documento existe ahora

[VISION_PROMETEO_MAPPING.md](VISION_PROMETEO_MAPPING.md) (2026-05-25) ya
detecto que la seccion 6, "Agentes Autonomos", era "el modulo mas avanzado
del roadmap" frente a la vision civilizatoria completa. Desde esa fecha el
codigo avanzo mas rapido que la vision documentada:

- Prometeo Runtime P2 esta implementado, fusionado y desplegado, con loop
  `OBSERVE -> INTERPRET -> PLAN -> REQUEST APPROVAL -> EXECUTE -> VERIFY ->
  LEARN` (`docs/SEMSE_CONTEXT.md`).
- Existe un Tool Registry gobernado (31 tools, policy + audit + approval)
  — `docs/specs/prometeo/tool-registry-governance.spec.md`, `APPROVED`.
- Existe un enrutador de intencion hacia agentes internos especializados
  (Marta/Felix/Pulse/Justus/Planner) — `docs/specs/agents/prometeo-core.spec.md`,
  `DRAFT`.
- Existe un workspace multimodal para adjuntos (imagen/video/audio/docs) en
  el mismo chat — `docs/specs/ui/prometeo-multimodal-workspace.spec.md`,
  `IMPLEMENTED`.
- Existe precedente de canal adicional sin migrar nada: Alexa como "otro
  cliente del mismo backend" — `docs/specs/satellites/SAT-002-alexa-voice-channel.spec.md`,
  `APPROVED`.

Ninguno de estos documentos, individualmente, dice en voz alta lo que
resulta de sumarlos: SEMSE ya tiene el nucleo de un sistema donde el usuario
expresa una intencion y Prometeo decide que capacidad interna usar. Ese es
el objeto de este documento.

## Las dos capas de Prometeo

`VISION_GLOSSARY.md` define hoy "Prometeo" unicamente como la capa 4
institucional (governance, identidad soberana, treasury, sub-DAOs) y
`VISION_DECISIONS_LOCKED.md` #10 la fija como "norte institucional", fuera
del MVP. Esa decision **no cambia** con este documento.

Lo que este documento añade es que el nombre "Prometeo" ya se usa tambien,
en el codigo y en los specs, para una segunda capa — mas cercana, ya
parcialmente construida — que conviene nombrar por separado para no
confundir "lo que ya existe" con "lo que sigue siendo norte de largo plazo":

| | Prometeo Operativo (este documento) | Prometeo Institucional (`VISION_FUSIONADA_SEMSE_PROMETEO.md`) |
|---|---|---|
| Que es | Orquestador conversacional que interpreta intencion y decide que capacidad interna de SEMSE usar | Identidad soberana, DAO, treasury, gobernanza distribuida |
| Horizonte | Ahora — ya en runtime (P2) | Largo plazo — norte institucional, fuera del MVP |
| Autoridad de datos | Nunca reemplaza al modulo de dominio (regla ya vigente, `docs/SEMSE_CONTEXT.md`) | No aplica todavia |
| Donde vive | `docs/specs/prometeo/`, `docs/specs/agents/prometeo-core.spec.md`, F2/F7 del roadmap | `docs/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`, capa 4 |
| Relacion entre ambas | Es la base operativa sobre la que, eventualmente, se apoyaria la capa institucional (mismo orden de capas de `VISION_DECISIONS_LOCKED.md` #3: Jobs -> Ops -> Trust -> Prometeo) | Depende del core operativo, no al reves |

Esta distincion no reabre la decision #10 ("Prometeo no se elimina, no se
implementa completo ahora, se conserva como norte institucional") — la
confirma. Lo que estaba sin nombrar es la parte de Prometeo que **si** se
esta implementando ya, dentro del limite que las decisiones bloqueadas
permiten (agentes utiles para trabajo real, ver `VISION_PILLARS.md` Pilar 5).

## Principios (sintesis de la sesion de origen)

1. **El usuario nunca aprende modulos.** No dice "voy a Marketplace" o "voy
   a BuildOps" — dice lo que necesita, y Prometeo Operativo decide que
   capacidad interna usar. Los modulos siguen existiendo y su UI/dashboards
   no se tocan; ganan un segundo punto de entrada, no pierden el primero.
2. **Ningun canal reemplaza a otro, se suman.** Dashboard, texto y voz son
   clientes del mismo backend (patron ya validado en
   `SAT-002-alexa-voice-channel.spec.md`: "no se migra nada, es solo otro
   cliente"). Un cambio hecho por voz debe verse igual en el dashboard.
3. **Los modulos son organos; las herramientas externas necesitan un
   sistema nervioso separado.** Prometeo Operativo ya sabe hablar con los
   modulos internos de SEMSE sin protocolo adicional. Hablar con el mundo
   exterior (GitHub, Vercel, Railway, Docker, sandboxes) es una superficie
   de riesgo distinta y **no esta resuelta** — ver
   `docs/architecture/ADR-025-mcp-external-tool-gateway.md` (nuevo, en
   propuesta) antes de asumir que esto es alcance activo.
4. **Una cuenta, multiples capacidades, cualquier proyecto.** Hoy el
   producto asume un rol fijo por sesion aunque el schema de `Membership`
   ya permite mas de un rol por usuario (ver
   `docs/specs/core/universal-identity-multi-role.spec.md`, nuevo). Este
   principio no cambia permisos financieros existentes por si solo.
5. **El nucleo del proyecto es universal; la ejecucion se especializa por
   industria.** `docs/SEMSE_CONTEXT.md` ya declara 9 dominios transversales
   (Core, Connect, Payments, Trust, AI, Agro, BuildOps, Knowledge,
   Integrations) con la regla "no crear identidad, permisos, pagos,
   evidencia o knowledge paralelos dentro de un vertical". BuildOps y Agro
   ya demuestran que un mismo core soporta mas de una industria — este
   principio documenta esa capacidad, no la inventa.

## Mapa canal -> capacidad

| Canal | Estado |
|---|---|
| Dashboard / UI | ✅ existente, sin cambios previstos |
| Texto (chat Prometeo) | ✅ Runtime P2 desplegado |
| Adjuntos multimodales (imagen/video/audio/doc) | ✅ `prometeo-multimodal-workspace.spec.md`, IMPLEMENTED |
| Voz nativa (no solo Alexa) | ⏳ F7 — Prometeo Multimodal, PENDIENTE en roadmap |
| Vision-a-proyecto (foto -> proyecto preliminar) | ⏳ F7 — Prometeo Multimodal, PENDIENTE |
| Herramientas externas via MCP (GitHub/Vercel/Railway/Docker) | ⏳ decision de arquitectura pendiente — `ADR-025-mcp-external-tool-gateway.md`, revisita `SPEC-INT-001` (retirado) |

## Conceptos nuevos (glosario)

### Originador / facilitador

Persona que ayuda a un tercero a crear y estructurar un proyecto en SEMSE
(sin ser el dueno del proyecto ni el profesional que lo ejecuta) y recibe
una recompensa atada a hitos verificables del proyecto — no a publicarlo.
No existe hoy en ningun spec ni en el glosario de vision. Desarrollo formal
en `docs/specs/core/originador-referral-program.spec.md` (`APPROVED`
2026-08-04; Fase 3 de recompensa real bloqueada por dependencia F5).

### Identidad universal / multi-capacidad

Un mismo usuario puede tener mas de una capacidad activa (cliente en un
proyecto, profesional en otro, originador en un tercero) sin que el
producto lo obligue a elegir un rol fijo por sesion. El schema ya lo
permite (`Membership(userId, orgId, roleId)`, PK compuesta); el gap es de
producto/UX, documentado en
`docs/specs/core/universal-identity-multi-role.spec.md` (`APPROVED`
2026-08-04).

## Que NO cambia con este documento

- No se reabre `VISION_DECISIONS_LOCKED.md` #10 (Prometeo Institucional
  sigue fuera del MVP).
- No se compromete construccion de orquestacion externa via MCP — queda
  como decision de arquitectura propuesta, no como alcance activo (ver
  `docs/ROADMAP.md`, iniciativa transversal nueva).
- No se tocan permisos financieros existentes al introducir el modelo
  multi-capacidad; cualquier cambio de permisos de pago requiere su propio
  spec bajo el gate de riesgo `critical` (`docs/SDD_GOVERNANCE.md` §7).
- Los dashboards y flujos actuales no se remueven ni se reemplazan por el
  canal conversacional.

## Referencias

- `docs/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md` — capa institucional,
  sin cambios.
- `docs/vision/VISION_PROMETEO_MAPPING.md` — mapeo original que detecto la
  seccion 6 (Agentes Autonomos) como la mas avanzada; este documento la
  extiende con lo construido despues de 2026-05-25.
- `docs/SEMSE_CONTEXT.md` — estado verificado del runtime P2 y reglas de
  Prometeo.
- `docs/ROADMAP.md` — iniciativa transversal nueva y su relacion con
  F2/F7/Core.
- `docs/specs/core/universal-identity-multi-role.spec.md`,
  `docs/specs/core/originador-referral-program.spec.md` — `APPROVED`
  2026-08-04 (contrato autorizado; código sin empezar, ver
  `IMPLEMENTATION_STATUS_MATRIX.md`).
- `docs/architecture/ADR-025-mcp-external-tool-gateway.md` — sigue
  `PROPOSED`, decisión de arquitectura sin tomar.
