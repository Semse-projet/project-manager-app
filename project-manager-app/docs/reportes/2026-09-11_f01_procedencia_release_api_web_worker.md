# F01 — Procedencia de release: API, Web y Worker no vienen de ningún commit

**Fecha:** 2026-09-11
**Tipo:** investigación de solo lectura (Railway CLI), sin mutaciones. Continuación del `PR #609` — cierra el punto 1 ("P0 · Evidencia de release y DB, solo lectura") del plan de reconciliación, en la parte de release; la parte de DB (historial/checksums/columnas) sigue pendiente y requiere acceso a Postgres productivo.

## Método

`railway deployment list --service <nombre> --json` sobre los 4 servicios de aplicación (`semse-API`, `semse-web`, `semse-worker`, `semse-vision`), leyendo `meta.branch`, `meta.commitHash`, `meta.commitAuthor`, `meta.cliCaller`, `meta.cliAgentSessionId`, `meta.cliMessage` e `meta.imageDigest` del deployment activo y los inmediatamente anteriores. Cruzado contra `git log --all --grep` en el checkout local para confirmar si el mensaje de cada deploy corresponde a un commit real.

## Hallazgo

**Solo Vision está desplegado desde un commit real de GitHub. API, Web y Worker no lo están — los tres fueron subidos directamente vía `railway up`/un skill de agente, sin pasar por Git en absoluto.**

| Servicio | Deployment activo | `branch`/`commitHash` | Origen real (`cliCaller`/`cliAgentSessionId`) | Mensaje |
| --- | --- | --- | --- | --- |
| **semse-API** | `ff1e40d6` (31 ago) | *ninguno* | `codex`, sesión `01a0539d-48d5-7ce1-b0c6-601d818006a0` | "F1-F fix: align all Evidence writers with tenant FK" |
| **semse-web** | `43eb1df3` (31 ago) | *ninguno* | `skill:use-railway@1.3.7`, sesión `railway-skill-rotate-20260830` | "fix: restore web from validated local checkout" |
| **semse-worker** | `cc673e8c` (31 ago) | *ninguno* | `skill:use-railway@1.3.7`, sesión `railway-skill-f1f-close-20260830` | "fix: restore worker and validate event switches off" |
| **semse-vision** | `19ad6467` (31 ago) | `main` / `88171003d645e620ff748bbe53ee11baa5716783` | — (deploy real desde GitHub) | PR #595 |

El mensaje del deployment activo de API, `"F1-F fix: align all Evidence writers with tenant FK"`, **no existe en ningún commit del historial** (`git log --all --grep` sobre todas las ramas, sin resultados) — no es que esté en una rama vieja no fusionada; el texto en sí no aparece en ningún commit del repositorio. Los dos deployments FAILED inmediatamente anteriores de API (mismo `cliAgentSessionId`, mismos minutos) llevan el mensaje `"F1-F fix: persist evidence tenantId for production schema"`, tampoco existe como commit.

Los mensajes de Web y Worker ("restore ... from validated local checkout", "restore worker and validate event switches off") describen explícitamente una **restauración manual desde un checkout local**, no un deploy disparado por push/PR — coherente con que no llevan `branch`/`commitHash` en absoluto (el campo ni siquiera es `null`-con-intento, está ausente del payload, a diferencia de Web/Vision cuando sí vienen de GitHub, donde el campo existe y está poblado).

Las tres sesiones (`codex`, `railway-skill-rotate-20260830`, `railway-skill-f1f-close-20260830`) son todas del mismo día, 30-31 de agosto — coincide con la ventana de la Sección 0 (transversal) del `AUDIT_REMEDIATION_PLAN.md` cerrándose y con trabajo de "F1-F" (Event Backbone) y rotación de credenciales documentado en memoria de sesiones previas. Esto sugiere que, en ese momento, alguien (agente o el usuario) empujó fixes directamente a producción vía CLI para resolver un incidente puntual, sin commitear/pushear esos cambios exactos a `main` primero — o commiteándolos después con un mensaje distinto al que quedó en el deploy.

## Qué significa esto en concreto

- **No existe ningún SHA que se pueda usar hoy para reconstruir exactamente qué código corre en producción para API, Web o Worker.** El diff "6 commits entre `88171003` y `edfc19ef`" que reporta la auditoría es un diff de *GitHub*, no un diff de lo que está corriendo — Web y Worker no están ni siquiera en `88171003`, están en un estado local no identificado de esa misma fecha (30-31 ago).
- El intento de Web *sí* commiteado (`e9291250`, `88171003`) **falló** (el bug de `baseRate` cerrado en el PR #609) y nunca reemplazó al `43eb1df3` no rastreable — es decir, la única vez que se intentó alinear Web con un commit real, ese intento no llegó a producción.
- Vision es la única excepción real: su deployment activo sí es trazable a un PR mergeado (#595).
- Esto no prueba que el código corriendo sea *distinto* del contenido de algún commit — es enteramente posible (incluso probable, dado el patrón "restore from validated local checkout") que el contenido sea idéntico a algún punto de `main` cercano a esa fecha. Pero **no hay manera de confirmarlo sin comparar el contenido real de la imagen desplegada** (checksums de archivos, no solo el mensaje de deploy) contra un commit candidato — eso queda fuera del alcance de esta pasada de solo lectura por CLI.

## Siguiente paso recomendado (no ejecutado en esta pasada)

Para cerrar F01 con certeza binaria, alguien con acceso de shell al contenedor productivo (`railway ssh` o similar) tendría que extraer un hash de contenido del build (por ejemplo, un `git rev-parse HEAD` si el `.git` quedó embebido en la imagen, o un checksum de un subconjunto de archivos fuente) y compararlo contra los candidatos locales del 30-31 de agosto. Esto es una acción operativa adicional, no de código — se deja marcada, no ejecutada, siguiendo el mismo límite de "solo observación" que el resto de esta auditoría.
