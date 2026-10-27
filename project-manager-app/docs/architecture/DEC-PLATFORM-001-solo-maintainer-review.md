---
id: "DEC-PLATFORM-001"
title: "Revisión por niveles de riesgo para un mantenedor único"
status: "ACCEPTED"
date: "2026-10-26"
owners: ["semse-core"]
supersedes_rule: "revisor de seguridad humano independiente del autor como requisito de APPROVED/merge"
---

# DEC-PLATFORM-001 — Revisión por niveles de riesgo para un mantenedor único

> Decisión del propietario de SEMSE Project, tomada en conversación de trabajo
> el 2026-10-26 y registrada en el PR #1049. Aplica mientras el proyecto tenga
> **un solo mantenedor con permisos de revisión**. Deja de aplicar en cuanto
> exista una segunda persona con esos permisos: entonces vuelve a exigirse su
> aprobación para los niveles 2 y 3.

## Contexto

Varias piezas de gobernanza exigen una revisión de seguridad **humana e
independiente del autor**:

- `docs/specs/platform/semse-mcp-project-read.decisions.md`: "Ausencia de
  firma/review = NO APPROVED".
- El plan D7 del PR #978: "security reviewer externo a la autoría firma la
  matriz".
- `.claude/skills/semseproject/SKILL.md` §12: cambios de nivel MUST/MUST NOT
  requieren "al menos un revisor humano".
- `docs/specs/platform/semse-mcp-delegated-consent.spec.md` §12.

SEMSE Project lo desarrolla una sola persona. GitHub no permite que el autor
apruebe su propio PR y `main` no exige aprobaciones, así que la regla no se
puede cumplir y, en la práctica, se fusiona sin cumplirla (PR #972 se fusionó
sin ninguna revisión `APPROVED`). Una regla imposible de cumplir no protege
nada y erosiona la confianza en el resto de gates.

## Decisión

Mientras haya un solo mantenedor, el requisito de "revisor humano
independiente" se sustituye por **controles compensatorios proporcionales al
riesgo**:

| Nivel | Alcance | Controles exigidos para aprobar/fusionar |
|---|---|---|
| **1 — Documentación y specs** | Specs, ADRs, decisiones, planes; sin código ejecutable, schema ni flags | (a) CI en verde sobre el SHA final; (b) al menos una revisión automatizada sin hallazgos bloqueantes abiertos (Codex o Claude Code Review), enlazada en el PR; (c) **registro de aprobación del propietario** como comentario en el PR con SHA, fecha y alcance. |
| **2 — Código sensible con flag apagado** | Código de auth, consentimiento, permisos, aislamiento tenant/org, pagos o datos personales, sin exposición externa | Todo lo del nivel 1, más: (d) **dos** revisiones automatizadas de herramientas/modelos distintos; (e) las pruebas negativas del spec ejecutadas contra PostgreSQL real en CI, enlazadas por SHA; (f) **pausa mínima de 24 h** entre el último commit y la fusión; (g) autorrevisión del propietario con el checklist del spec **después** de la pausa, registrada en el PR. |
| **3 — Activación o exposición externa** | Activar en producción algo que dé acceso a datos a terceros (p. ej. MCP S1 fase D), cambios de pagos en producción | Todo lo del nivel 2, más: (h) **revisión humana externa real**, una vez y acotada al alcance (auditor de seguridad, freelance o colaborador de confianza invitado al repo), con su informe enlazado; (i) canary con allowlist y rollback demostrado. **No hay sustituto automatizado para este nivel.** |

Reglas comunes:

- Las revisiones automatizadas (Codex, Devin, Claude, CodeQL) son controles
  útiles pero **no** son revisión humana independiente y nunca se presentan
  como tal.
- **Prohibido** usar una segunda cuenta de GitHub controlada por el mismo
  propietario para aprobar sus propios PRs: aparenta una independencia que no
  existe.
- Un hallazgo bloqueante de cualquier revisión automatizada se corrige o se
  responde con justificación antes de fusionar.
- Esta decisión no relaja ningún otro gate: SDD (spec `APPROVED` antes de
  código), CI, migraciones autorizadas, flags OFF por defecto y aprobación
  operativa separada para Railway siguen igual.

## Riesgo residual aceptado

Sin una segunda persona, en los niveles 1 y 2 nadie con contexto humano
distinto del autor revisa el diseño. Los sesgos del autor pueden pasar a la
vez por la autorrevisión y por las revisiones automatizadas. Se acepta ese
riesgo porque el código de nivel 2 queda apagado y sin exposición externa, y
el nivel 3, el único con datos reales expuestos a terceros, sigue exigiendo
revisión humana externa.

## Consecuencias

- `semse-mcp-project-read.decisions.md` y `semse-mcp-delegated-consent.spec.md`
  remiten a esta decisión en lugar de exigir un revisor independiente.
- `semseproject` §12 debe añadir la excepción de mantenedor único que apunta
  aquí. **Pendiente:** el cambio en el skill lo aplica el propietario a mano
  (los agentes no modifican skills de gobernanza); texto propuesto en el PR
  #1049.
- La fusión de #972 sin aprobación queda como antecedente; no se reescribe.

## Revisión de esta decisión

Revisar al incorporar una segunda persona con permisos de revisión, o a los 6
meses (2027-04-26), lo que ocurra antes.
