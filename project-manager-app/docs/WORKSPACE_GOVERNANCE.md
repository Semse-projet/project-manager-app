# WORKSPACE_GOVERNANCE — puntero

**Estado:** PROPUESTO
**Fuente canónica:** `C:\Users\SEMSEproject\agent-sessions\WORKSPACE_GOVERNANCE.md`

No se duplica contenido acá (mismo principio que `AGENTS.md` de
`agent-sessions/` aplica a las sesiones: "un proyecto con convención propia
no se duplica, solo puntero indexado"). Esta política es cross-proyecto
(`project-manager-app`, `my-app`, `semse-mobile`, `buzz`), así que vive en
`agent-sessions/`, no acá.

## Qué define

Qué checkout de un proyecto, en esta máquina, es **canónico** (recibe
commits/PRs) vs **sandbox** (pruebas de infra/OS, sin trabajo real) vs
**huérfano** (sin rol asignado — no asumir ninguno de los dos anteriores).
Nació de un incidente real: una sesión afirmó haber borrado
`Desktop\project-manager-app` sin verificarlo, y el checkout siguió
existiendo y divergiendo del canónico por más de un día sin que ningún
registro lo reflejara.

## Estado verificado al 2026-08-12

- **Canónico:** `Documents\project-manager-app\project-manager-app` (este
  checkout).
- **Sandbox:** `Desktop\project-manager-app\project-manager-app` — reservado
  para verificar el setup local de WSL2/Docker (`SEMSE_SHUTDOWN_CHECKPOINT_2026-08-10.md`),
  no recibe commits de trabajo real.

Ver la tabla completa (registro vivo, se actualiza en la fuente canónica,
no acá) y el protocolo de verificación antes de confiar en cuál checkout es
cuál.

Acceso a `agent-sessions/` requiere autorización explícita del usuario en
cada sesión (ver `00-AUTORIZACION-REQUERIDA.md` ahí) — no asumir que una
sesión anterior ya la dio.
