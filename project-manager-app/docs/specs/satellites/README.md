# SATELLITES INTEGRATION PLAN — SEMSE se conecta a sus satélites

**Versión:** 1.0
**Fecha:** 2026-07-05
**Estado:** APPROVED (plan maestro) — SAT-000 y SAT-001 APPROVED (2026-07-05); el resto en DRAFT hasta su fase
**Autor:** Claude — sesión planificación satélites
**Regla de oro:** aplica `docs/SDD_GOVERNANCE.md`. Ningún satélite se conecta sin spec APPROVED + arnés (SAT-000).

---

## 1. Principio rector: dirección de la integración

**SEMSE es quien se integra a los satélites, no los satélites a SEMSE.**

Los satélites permanecen donde viven, con su propio stack, ciclo de vida y deploy.
El monorepo `project-manager-app` NO absorbe su código. Lo único que crece es la
**superficie de conexión de SEMSE**: API pública versionada, SDK, tokens con scopes,
eventos salientes y observabilidad.

```
                    ┌──────────────┐
                    │   graphify    │  (conocimiento)
                    └──────▲───────┘
                           │ MCP/CLI
┌──────────────┐    ┌──────┴───────┐    ┌──────────────────┐
│ alexa skill   │◄──┤  SEMSE CORE   ├──►│ semse-mobile-app  │
│ (voz)         │sdk│  (Railway)    │sdk│ (frontend satélite)│
└──────────────┘    └──┬───▲───┬───┘    └──────────────────┘
                       │   │   │
              webhooks │   │   │ StorageDriver
                       ▼   │   ▼
              ┌────────────┴─┐ ┌──────────────┐
              │ Pro Tools v2  │ │ semse-storage │
              │ (HTML embed)  │ │ (driver local)│
              └──────────────┘ └──────────────┘
```

Coherencia con la visión agentiva (`vision_agentiva_semse`): SEMSE como organismo
central; satélites como órganos externos conectados por contratos, no por fusión.

---

## 2. Inventario y clasificación de satélites

Clasificación: **VIVO** (se conecta), **LATENTE** (se documenta el conector, no se activa),
**ARCHIVO** (no se integra; referencia histórica).

| # | Satélite | Ubicación local | Naturaleza | Clase | Spec |
|---|---|---|---|---|---|
| 1 | semse (node/python) | `~/labsemse/semse` | Embriones de SDK TS + Python | VIVO | SAT-001 |
| 2 | alexa-openai-skill | `~/alexa-openai-skill` | Skill Alexa → Lambda → LLM | VIVO | SAT-002 |
| 3 | semse-mobile-app | `~/labsemse/semse-mobile-app` | Web app móvil Vite + shadcn | VIVO | SAT-003 |
| 4 | graphify | `~/graphify` | Knowledge graph de código/docs (Python) | VIVO | SAT-004 |
| 5 | semse-storage | `~/semse-storage`, `~/labsemse/semse-storage` | Storage multipart local | VIVO | SAT-005 |
| 6 | SEMSE Pro Tools v2 | `~/labsemse/SEMSE Pro Tools v2` | Herramientas HTML standalone | LATENTE | SAT-006 |
| 7 | app / app semse | `~/labsemse/app`, `~/labsemse/app semse/app` | Prototipos React landing/premium | LATENTE | — (candidatos a SAT-006 embed) |
| 8 | labsemse_project | `~/app prototipos/labsemse_project` | Prototipo con matriz de consolidación | ARCHIVO | — |
| 9 | Entropía App / agent-runtime-starter | `~/nuevo proyecto` | Prototipos de agentes Kimi | ARCHIVO (conceptos → Autonomy Core) | — |
| 10 | _satellites-archive (7 protos) | `~/labsemse/app semse/_satellites-archive` | web-assistant-portal, semse-control-mvp, Agent_* | ARCHIVO | — |
| 11 | labsemse-main | `~/labsemse-main` | Copia vieja del workspace | ARCHIVO (borrar tras verificación) | — |
| 12 | project-manager-app (2ª copia) | `~/project-manager-app` | Clon en branch `feat/admin-job-detail` | DUPLICADO — resolver en Fase 0 | — |

**Infraestructura transversal (no satélites, pero requerida):**
webhooks salientes (SAT-007) y registro de nodos satélite en Observer/Consciousness (SAT-008).

---

## 3. Fases

### Fase 0 — Higiene (prerrequisito, sin código nuevo)
1. Resolver el duplicado del monorepo: `~/labsemse/project-manager-app` (branch `docs/sdd-visuals`, 2026-07-05) es el canónico; rescatar lo pendiente de `~/project-manager-app` (`feat/admin-job-detail`) vía PR y retirar la copia.
2. Confirmar clasificación VIVO/LATENTE/ARCHIVO de la tabla §2 con el owner.
3. Crear `SATELLITES.md` (registro operativo: token, scopes, estado, heartbeat) — nace con SAT-001.

### Fase 1 — El enchufe universal (SAT-001)
`@semse/sdk` (TS) + `semse_py` (Python) + **satellite tokens** con scopes + contrato `/v1` congelado para consumo externo. Sin esto, nada conecta. Es la única pieza nueva dentro del monorepo.

### Fase 2 — Conexiones satélite por satélite
Orden por valor/demostrabilidad:
1. **SAT-002 Alexa** — integración más pequeña y demostrable: voz → intake real.
2. **SAT-003 Mobile app** — mayor valor de producto: cliente nativo del BFF.
3. **SAT-004 graphify** — mayor valor agentivo: memoria/conocimiento para BuildOps, Prometeo y Curator.
4. **SAT-005 semse-storage** — driver de almacenamiento alternativo/offline.
5. **SAT-006 Pro Tools embed** — activar cuando haya demanda de herramientas offline/compartibles.

### Fase 3 — Flujo inverso (SAT-007)
Webhooks salientes por satélite (`job.matched`, `rating.requested`, `evidence.approved`, `milestone.*`) reutilizando el fan-out de eventos existente + SSE público con satellite token.

### Fase 4 — Gobernanza y conciencia (SAT-008)
Cada satélite es un **nodo externo** en Observer/Consciousness: heartbeat, latencia, versión del SDK. El índice de madurez incorpora "conectividad satelital".

---

## 4. Specs de este paquete

| Spec | Título | Fase | Riesgo |
|---|---|---|---|
| [SAT-000](SAT-000-sdd-harness.spec.md) | Proceso SDD + arnés de verificación para satélites | 0 | high |
| [SAT-001](SAT-001-semse-sdk.spec.md) | `@semse/sdk` + `semse_py` + satellite tokens | 1 | high |
| [SAT-002](SAT-002-alexa-voice-channel.spec.md) | Alexa como canal de voz de Prometeo/Intake | 2 | medium |
| [SAT-003](SAT-003-mobile-app-client.spec.md) | semse-mobile-app como cliente satélite del BFF | 2 | high |
| [SAT-004](SAT-004-graphify-knowledge.spec.md) | graphify como capa de conocimiento consultable | 2 | medium |
| [SAT-005](SAT-005-storage-driver.spec.md) | semse-storage como StorageDriver alternativo | 2 | medium |
| [SAT-006](SAT-006-protools-embed.spec.md) | Pro Tools v2 HTML con snippet embebible del SDK | 2 | low |
| [SAT-007](SAT-007-outbound-webhooks.spec.md) | Webhooks salientes + SSE para satélites | 3 | high |
| [SAT-008](SAT-008-observer-satellite-nodes.spec.md) | Satélites como nodos en Observer/Consciousness | 4 | medium |

Dependencias: SAT-000 gobierna a todos → SAT-001 es prerrequisito de SAT-002/003/004/005/006/007 → SAT-008 depende de SAT-001 + SAT-007.

---

## 5. Criterios de éxito del programa

- [ ] 0 líneas de código de satélites copiadas al monorepo (salvo SDK y adaptadores propios de SEMSE).
- [ ] Todo satélite VIVO opera con su propio token revocable y scopes mínimos.
- [ ] Revocar el token de un satélite no afecta a ningún otro consumidor.
- [ ] Cada integración pasó su arnés SAT-000 (contrato + e2e + smoke en Railway) antes de marcarse VERIFIED.
- [ ] `SATELLITES.md` refleja el estado real (auditable contra Observer).
- [ ] SPEC_INDEX actualizado vía `pnpm spec:index` tras cada spec aprobado.
