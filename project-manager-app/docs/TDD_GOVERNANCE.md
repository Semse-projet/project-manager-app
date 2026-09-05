# TDD_GOVERNANCE — SEMSEproject

**Versión:** 1.0
**Fecha:** 2026-08-10 (aprobado 2026-08-11)
**Estado:** APROBADO
**Referencia:** complementa `docs/SDD_GOVERNANCE.md` — no lo reemplaza. TDD gobierna
cómo se ejecutan las Fases 1-3 del flujo SDD; SDD gobierna qué se autoriza a
implementar y cómo se cierra. `docs/RDD_GOVERNANCE.md` audita que la
evidencia que este documento exige (§8, "Evidencia de sesión") efectivamente
quede como recibo verificable, no solo como afirmación.

> Ningún código de negocio se escribe antes que su test falle por la razón
> correcta. El spec dice qué construir; el test rojo demuestra que aún no
> existe; el código lo hace pasar; el refactor lo deja limpio sin romperlo.

## 1. Escala real — por qué esto no es opcional

Este repo no es un proyecto chico donde "correr los tests antes de subir" se
sostiene por disciplina individual. A la fecha de este documento:

- **325 archivos de test versionados** solo en el árbol principal: 87 en
  `tests/unit/` (raíz), 221 bajo `apps/api/test/`, 17 specs e2e en
  `tests/e2e-semse/`.
- **Workspaces secundarios con su propia suite**, no visibles desde los
  scripts raíz: `@semse/mobile` (Jest, ~30 suites / ~117 tests) y
  `@semse/assistant-portal` (~69 tests) — se corren con `pnpm --filter
  <paquete> test`, no con `pnpm test`.
- **108 specs de dominio** activos en `docs/specs/`, repartidos en nueve
  bounded contexts (SEMSE Core, Connect, Payments, Trust, AI, Agro, BuildOps,
  Knowledge, Integrations).
- **281 reportes de sesión** acumulados en `docs/reportes/` — es decir, este
  ecosistema se construyó (y se sigue construyendo) en cientos de sesiones
  discretas, no en una sola sentada.

A esta escala, dos fallas son las que realmente rompen el sistema:

1. **Un test que no falló nunca de verdad** (se escribió después del código,
   o se escribió y nunca se corrió en rojo) es indistinguible de un test que
   protege algo, hasta que el bug llega a producción. Con 325+ tests no hay
   forma de auditar esto a ojo — la disciplina de la Sección 3-4 es la única
   garantía.
2. **Una sesión nueva no hereda la memoria de la anterior.** El agente (o la
   persona) que retoma un slice no sabe si "ya funcionaba" salvo que corra
   la suite y lea el reporte de la sesión anterior — nunca por inferencia de
   que el código está ahí o que Railway está `SUCCESS` (esto ya lo dice
   `AGENTS.md`: "no inferir activación desde código, merge, deploy o
   healthcheck"). Ver Sección 9.

## 2. Relación con SDD

Esto no es un flujo paralelo. `SDD_GOVERNANCE.md` §6 ya exige "los tests
requeridos se escriben antes del código de negocio", y `semse-tasks.md` ya
tiene una Fase 1 dedicada:

- `[T-010]` Escribir tests rojos de escenarios P1 y seguridad
- `[T-011]` `[P]` Crear/actualizar schemas compartidos
- `[T-012]` `[P]` Definir fixtures de idempotencia/concurrencia
- `[T-013]` Confirmar que el fallo inicial demuestra el gap

Este documento formaliza **cómo** se ejecutan esos ítems y los extiende a las
Fases 2-4 (`T-024`, `T-034`, `T-040`), donde el ciclo se repite por cada
slice de dominio/API/UI en vez de una sola vez por feature completa.

## 3. Ciclo obligatorio

```text
RED     -> escribir el test que expresa el criterio de aceptación (P1 o de
           seguridad) y verificar que falla por el motivo esperado, no por
           un error de setup/import/tipo.
GREEN   -> escribir el mínimo código de negocio necesario para que ese test
           pase. No se adelanta código para escenarios aún no cubiertos por
           un test.
REFACTOR-> limpiar duplicación/nombres sin cambiar comportamiento observable.
           Los tests existentes deben seguir en verde sin modificarlos.
```

Este ciclo se repite por cada escenario P1 del spec, no una sola vez al
final. Un PR que llega a `T-040` sin pasar por RED en cada slice de dominio
(`T-024`), API/BFF/UI (`T-034`) queda `code_status: IN_PROGRESS`, nunca
`COMPLETE`, aunque los tests finales estén en verde — la evidencia de que
existió un rojo previo es parte de `T-013`.

## 4. Qué exige un test antes de contar como "rojo válido"

Un test recién escrito solo cuenta como punto de partida válido si:

- falla ejecutándolo (`pnpm test:unit` / `pnpm --filter @semse/api
  test:integration`, según capa) **antes** de tocar el código de negocio;
- el fallo es una aserción no cumplida, no una excepción de compilación,
  import roto o fixture faltante;
- el mensaje de fallo señala exactamente el gap del spec (permiso, FSM,
  evento, cálculo) que el test debía demostrar.

Si el test pasa sin código nuevo, no prueba nada: se corrige el test antes
de seguir.

## 5. Pirámide de test en este repo

Comandos reales, de más rápida/aislada a más lenta/end-to-end. La columna
"Workspace" importa: los tres últimos niveles **no** corren con `pnpm test`
desde la raíz — hay que invocarlos con `--filter` o se quedan sin correr sin
que nadie lo note.

| Nivel | Workspace | Comando | Cuándo |
|---|---|---|---|
| Unit (raíz) | root | `pnpm test:unit` | Lógica de dominio pura en `tests/unit/*.test.{mjs,ts}`, sin DB |
| Unit (API) | `@semse/api` | `pnpm --filter @semse/api test:unit` | Servicios/controladores NestJS aislados |
| Integration (API) | `@semse/api` | `pnpm --filter @semse/api test:integration` | Persistencia real (Prisma), FSM, outbox/eventos |
| Coverage | `@semse/api` | `pnpm test:coverage` | Gate antes de PR — corre build + `@semse/api test:coverage` |
| Mobile | `@semse/mobile` | `pnpm --filter @semse/mobile check` | Jest, offline-first / trackerLocalStore — no se dispara desde `pnpm test` |
| Assistant Portal | `@semse/assistant-portal` | `pnpm --filter @semse/assistant-portal test` | No se dispara desde `pnpm test` |
| E2E | root | `pnpm test:e2e` / `pnpm test:e2e:semse:*` | Journey autenticado vía Playwright, un spec por dominio crítico |
| CI completo | root | `pnpm test:ci` | `test:coverage` + `test:e2e` — **no incluye mobile ni assistant-portal**, se corren aparte |

Regla de capa: si un caso se puede demostrar en unit, no se sube a
integration; si se puede demostrar en integration, no se sube a e2e. E2E se
reserva para journeys que ninguna capa inferior puede probar (auth real,
navegación, SSE en vivo).

**Convención de nombre no negociable:** `apps/api/scripts/run-tests.mjs` —
el runner real detrás de `test:unit`/`test:integration`/`test:coverage` —
clasifica un archivo como integración únicamente por su nombre: debe
terminar en `-integration.test.ts` (guion, no punto). Un test que abre una
conexión Prisma real pero se llama `foo.test.ts` corre bajo `test:unit`, sin
`--test-concurrency=1`, compitiendo por filas con otros tests en paralelo —
no falla ruidosamente, falla intermitente. Al escribir `T-010` para un
escenario de persistencia, el nombre del archivo se decide en el mismo paso
que el test.

Si el slice toca `apps/mobile` o `apps/assistant-portal`, su checklist de
cierre (§7) debe listar el resultado de esa suite explícitamente — `test:ci`
no la corre y su ausencia en el reporte no significa que pasó, significa que
nadie la corrió.

## 6. SIEMPRE / NUNCA

### SIEMPRE

- Escribir el test desde el escenario P1 o de seguridad del spec, no desde
  la implementación que ya se tiene en mente.
- Correr el test y ver el fallo antes de escribir código de negocio.
- Un test por comportamiento observable — no un test gigante por endpoint.
- Dejar los tests de seguridad (tenant/org/ownership) en la misma fase que
  el resto, no como tarea aparte al final.
- Actualizar `T-013`/`T-024`/`T-034` en el `.tasks.md` del slice al cerrar
  cada ciclo, para que la evidencia de RED quede trazable.

### NUNCA

- Escribir el código de negocio y el test en el mismo paso "para ahorrar
  tiempo" — invierte la garantía que el ciclo existe para dar.
- Marcar `code_status: COMPLETE` sin que exista al menos un test por
  escenario P1 del spec.
- Debilitar o borrar un test para que pase (ajustar el código, no el test,
  salvo que el test mismo esté mal escrito — y eso se documenta).
- Usar mocks para reemplazar la base de datos en tests de integración
  (`test:integration` corre contra Postgres real vía Prisma).
- Saltar a e2e para probar algo que un test unitario ya puede demostrar más
  rápido y de forma más aislada.

## 7. Gate de cierre

Se alinea con `docs/SDD_GOVERNANCE.md` §12 y con la sección "Entrega" del
checklist (`semse-checklist.md`). Un slice no se considera `IMPLEMENTED` si:

- falta un test por cada escenario P1/seguridad del spec;
- algún test fue escrito después del código que pretende cubrir sin pasar
  primero por rojo verificado;
- `pnpm test:coverage` no corrió limpio antes del PR (`T-040`/`T-041`);
- toca mobile o assistant-portal y esa suite no aparece en la evidencia (§5).

## 8. Evidencia de sesión — mismo formato que `docs/reportes/`

Este repo ya documenta 281 sesiones con un formato consistente en
`docs/reportes/`: `Objetivo` → `Cambios` → `Evidencia local` (con conteos
`PASS`/suites/tests, no solo "pasó") → `Impacto y rollback`. TDD no agrega un
formato nuevo — exige que la sección "Evidencia local" de cada reporte cierre
el ciclo RED/GREEN, no solo el resultado final:

```markdown
## Evidencia local

- rojo inicial: `pnpm --filter @semse/api test:integration` — FAIL esperado
  en `capability-fsm.test.ts::rechaza transición sin permiso backend`
  (demuestra el gap del spec, no un error de setup)
- verde: mismo comando — PASS, N tests
- regresión: `pnpm test:unit` — PASS, N tests; `pnpm test:coverage` — PASS
- (si aplica) `pnpm --filter @semse/mobile check` — PASS, N suites / N tests
```

Un reporte que solo dice "tests: PASS" sin el paso por rojo y sin conteos no
cumple este gate, aunque el resto del reporte esté completo — es el mismo
estándar de rigor que ya exige `docs/SDD_GOVERNANCE.md` §10 para la
investigación externa (fuente primaria, no "se buscó").

## 9. Continuidad entre sesiones y estabilidad a escala

Con 281 sesiones acumuladas y creciendo, dos reglas adicionales evitan que la
suite se vuelva ruido:

- **Ninguna sesión nueva asume que un slice de una sesión anterior sigue
  verde.** Se corre la suite relevante al abrir la sesión, no se lee el
  reporte anterior como si fuera el resultado actual. El reporte dice qué se
  verificó *entonces*; el comando dice qué es cierto *ahora*.
- **Un test flaky se cuarentena explícitamente, nunca se ignora en silencio.**
  Si un test falla de forma intermitente sin relación con el cambio en curso,
  se documenta en el reporte de la sesión (`Impacto y rollback` o una nota
  aparte), se abre seguimiento, y no se borra ni se comenta el `it`/`test`
  sin dejar rastro — a esta escala, un test que desaparece sin registro es
  indistinguible de un test que nunca protegió nada.
- **Los fixtures compartidos entre dominios (`T-012`, tareas `[P]`) se versionan
  junto al test que los usa**, no en un helper global mutable — con nueve
  bounded contexts corriendo en paralelo, un fixture compartido que cambia
  silenciosamente rompe suites de dominios que nadie tocó en esa sesión.

## 10. Automatización

Sin scripts nuevos — se reutiliza lo existente:

```bash
pnpm test:unit                              # ciclo rápido durante RED/GREEN local
pnpm --filter @semse/api test:integration
pnpm test:coverage                          # gate previo a PR (T-040)
pnpm test:ci                                # lo que corre en CI (T-052)
pnpm --filter @semse/mobile check           # solo si el slice toca apps/mobile
pnpm --filter @semse/assistant-portal test  # solo si el slice toca apps/assistant-portal
```

El umbral de cobertura **ya existe y ya es duro** — no hace falta proponerlo,
solo conocerlo: `apps/api/scripts/run-tests.mjs` invoca `c8` con
`--check-coverage --lines=70 --functions=65 --branches=80 --statements=70`
sobre `src/**/*.ts` (excluyendo `test/**` y `*.d.ts`) cuando corre
`test:coverage`. Si el build baja de esos números, el comando sale con
código de error — es el mismo mecanismo que ya registra `ci_status`, no uno
nuevo. Bajar cualquiera de los cuatro números es un cambio versionado de
este documento con justificación explícita, no un ajuste silencioso en el
script.
