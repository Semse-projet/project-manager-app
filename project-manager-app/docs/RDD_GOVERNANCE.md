# RDD_GOVERNANCE — SEMSEproject (Recibo-Driven Development)

**Versión:** 1.0
**Fecha:** 2026-08-11
**Estado:** PROPUESTO
**Referencia:** tercera pata junto a `docs/SDD_GOVERNANCE.md` (qué se
autoriza construir) y `docs/TDD_GOVERNANCE.md` (qué prueba que funciona).
RDD exige que todo trabajo termine en un **recibo verificable**, no en una
afirmación.

> Ningún trabajo se considera terminado porque alguien diga que se hizo.
> Se considera terminado cuando existe un recibo — un artefacto que
> cualquier otra sesión, agente o persona puede verificar sin confiar en
> el relato de quien lo hizo.

## 1. Por qué esto es una disciplina propia y no una nota al pie

`SDD_GOVERNANCE.md` ya exige evidencia (`ci_status`, `production_evidence`,
`last_verified`). `TDD_GOVERNANCE.md` §9 ya dice "ninguna sesión nueva
asume que un slice de una sesión anterior sigue verde". `SDD_SESSIONS.md`
existe entero para que el contexto sobreviva entre sesiones y agentes. Los
tres apuntan al mismo problema desde ángulos distintos: **una sesión de
agente no tiene memoria propia entre una conversación y la siguiente** —
lo único que persiste es lo que quedó escrito en disco de forma
verificable. RDD nombra ese principio una sola vez para que los otros tres
documentos lo hereden en vez de repetirlo con matices distintos.

Caso real de esta misma sesión: al decidir qué hacer con
`release-candidates\semse-f1-f4-883949` (una feature de control plane sin
commitear, superada por `packages/forge`), la acción no fue "se borró la
carpeta" — fue generar `semse-f1-f4-canonical-883949.patch` (recibo del
contenido exacto, restaurable con `git apply`) + `...README.md` (recibo del
razonamiento: por qué se archivó y no se mergeó) + una entrada indexada en
`agent-sessions/` (recibo de que la decisión existió, cuándo, y quién la
tomó). Sin esos tres, borrar la carpeta habría sido una afirmación sin
receipt — nadie podría auditar la decisión después.

## 2. Qué cuenta como un recibo válido

Un recibo es válido si es **verificable de forma independiente** del
agente o la persona que lo generó — otra sesión debe poder confirmarlo sin
tener que confiar en el resumen. No se inventan mecanismos nuevos: esto
inventaría lo que ya existe en el ecosistema.

| Tipo de trabajo | Recibo | Dónde vive |
|---|---|---|
| Cambio de código | SHA de commit | `git log` |
| Test ejecutado | Resultado con conteo (PASS/FAIL, N tests), no solo "pasó" | `TDD_GOVERNANCE.md` §8, evidencia de sesión |
| Feature entregada | `ci_status`, `merge_status`, `deploy_status`, `production_evidence` | metadata SDD 2.0 en el spec |
| Decisión de sesión | Entrada indexada con frontmatter y etiquetas | `agent-sessions/INDEX.md` + archivo de sesión |
| Trabajo archivado/descartado | `.patch` + nota explicando el porqué | ej. `release-candidates/*.patch` + `*.README.md` |
| Investigación externa | Link a fuente primaria, no "se buscó" | `SDD_GOVERNANCE.md` §10 |

Un recibo que solo existe en el resumen de la conversación no cuenta —
desaparece cuando la sesión termina. Tiene que quedar en un archivo, un
commit, o un sistema externo consultable.

## 3. Regla central

**Una afirmación sin recibo es una hipótesis, no un hecho.**

Aplicado:

- "Los tests pasan" sin conteo ni comando ejecutado es una hipótesis.
- "Ya lo revisé" sin decir qué se revisó y qué se encontró es una
  hipótesis.
- "Esto está superado por X" sin mostrar la evidencia que lo compara
  (como se hizo con el control plane vs. Forge: ADR, mapeo de archivos,
  `git fetch` mostrando cuántos commits de distancia) es una hipótesis.
- Una sesión nueva que retoma un slice **no hereda como hecho** lo que la
  sesión anterior afirmó sin recibo — lo trata como hipótesis a verificar.

## 4. SIEMPRE / NUNCA

### SIEMPRE

- Generar el recibo en el mismo paso que se hace el trabajo, no
  "después, si hay tiempo".
- Preferir un recibo que ya existe en el ecosistema (commit, reporte,
  entrada de `agent-sessions`) antes que inventar un formato nuevo.
- Cuando se archiva o descarta trabajo real (no basura), dejar recibo de
  qué era y por qué se descartó — no solo borrar.
- Citar el recibo, no resumirlo, cuando otra sesión pregunta "¿esto ya se
  hizo?" — el resumen puede estar desactualizado, el recibo no.

### NUNCA

- Marcar algo como terminado, verificado o superado sin el recibo que lo
  respalde.
- Asumir que un recibo de hace varias sesiones sigue vigente sin
  reverificarlo cuando el trabajo actual depende de él.
- Confundir "lo escribí en el resumen de esta conversación" con "dejé un
  recibo" — el resumen no sobrevive a la sesión, el archivo sí.

## 5. Cómo se integra con SDD y TDD

No es un cuarto gate paralelo — es el principio detrás de gates que ya
existen:

| Disciplina | Pregunta que responde | Recibo que exige |
|---|---|---|
| `SDD_GOVERNANCE.md` | ¿Está autorizado construir esto? | Spec `APPROVED`, metadata 2.0 |
| `TDD_GOVERNANCE.md` | ¿Funciona de verdad? | Test rojo→verde con conteos |
| `RDD_GOVERNANCE.md` | ¿Cómo lo sabe alguien que no estuvo acá? | El artefacto verificable de los dos anteriores |

`RDD_GOVERNANCE.md` no agrega un paso al flujo de `SDD_GOVERNANCE.md` §1 —
audita que cada paso que ya exige evidencia (`tests dirigidos`, `CI
terminal`, `production_evidence`) efectivamente la deje por escrito antes
de considerarse cerrado.

## 6. Integración con el arnés existente (`docs/AGENTIC_HARNESS.md`)

Este ecosistema ya tiene un arnés agéntico activo (`AGENTIC_HARNESS.md`,
2026-05-20, `ACTIVE`) que define Paso 5 (CHECKLIST) y Paso 6 (COMMIT), más
el formato de reporte por bloque en `docs/reportes/`. RDD **no reemplaza
eso ni propone uno nuevo** — nombra dos recibos que el arnés ya casi exige
y los hace explícitos:

- **Recibo de código**, por cada commit: el commit mismo + el reporte de
  bloque que `AGENTIC_HARNESS.md` Paso 6 ya pide. No cambia.
- **Recibo de sesión**, al cierre de cada sesión — no por bloque, por
  sesión completa —: una entrada en `agent-sessions/` (ver
  `SDD_SESSIONS.md`) o en `docs/reportes/` si la sesión no salió de un
  solo repo. Cubre decisiones que no llegaron a ser un commit (ej.
  archivar sin mergear, como el control plane vs. Forge) y da a la
  siguiente sesión — de cualquier agente — un punto de entrada sin tener
  que reconstruir el estado leyendo todo el historial de commits.

**Regla de cierre:** ningún trabajo se considera listo para mergear en
GitHub o deployar en Railway sin haber pasado por el checklist del arnés
(Paso 5) *y* haber dejado su recibo de sesión correspondiente. Esto aplica
tanto a bloques del loop de ProTools como a cualquier otra sesión que
toque `main` o producción — el arnés fue escrito pensando en bloques de
ProTools, RDD extiende la misma disciplina a cualquier trabajo que llegue
a GitHub/Railway, sea o no parte de ese loop.

### Estado operativo real — no ideal

Al 2026-08-10, el CI de GitHub Actions de `Semse-projet` está bloqueado
por presupuesto a nivel organización ("Actions budget is preventing
further use") — ningún PR puede pasar `ci_status: PASS` mientras esto
siga así. La vía de merge/deploy activa es verificación local completa
(`typecheck`, `lint`, `test:unit`, build) + merge con `--admin` + deploy
directo a Railway (CLI/MCP), documentada como recibo en
`SEMSE_SHUTDOWN_CHECKPOINT_2026-08-10.md` (raíz del checkout, fuera de
`project-manager-app/`). Esto es una **desviación temporal y ya
documentada** de `SDD_GOVERNANCE.md` §9 ("CI terminal" antes de merge) —
RDD exige que quede registrada como tal (como acá), no que se ignore ni
que se trate como el flujo normal permanente. Cuando el spending limit de
Actions se resuelva, esta sección se actualiza y dice de qué fecha a qué
fecha estuvo activo el bypass.
