# Comparación del paquete con PR 0 (B-01) — Operational Intelligence

**Fecha:** 2026-11-07. **Cierra:** B-01 del [acta](operational-intelligence-program.reconciliation.md) (§10: «el paquete esté comparado»).
**Ejecutor:** Claude (coordinador). **Alcance:** solo lectura del paquete y de `git`; no se modificó ningún spec ni ADR en este documento.

## 1. Hallazgo principal: existen dos versiones del paquete con el mismo nombre

Las dos se llaman `semse_operational_intelligence_package_2026-10-04.zip`, pero su contenido es distinto. El owner aportó ambas el 2026-11-07 para esta comparación.

| | Versión 1 (V1) | Versión 2 (V2) |
|---|---|---|
| Uso | **Es la que se aplicó en PR 0** (#800, `05af598d`); recibida por primera vez el 2026-10-04 | No se aplicó en el repositorio |
| ZIP SHA-256 | `c9552cfb61de28314ebdfa5d5f404873b45e68f94462e07637246cbcbdd49911` | `f14725d8b39a713cdf204c7344506bdbbafccfb00d1f93bb33c3e88cbb636c97` |
| `MANIFEST.json` SHA-256 | `48a9a33e2ebde5226705351fe75ea536412e14d290b5626b7800d6f03c443882` | `0329b2d20685292dd66f9848f743955e1d3c91cad19dd236c7444686d3a14b54` |
| Integridad | **Completa:** los 26 archivos del manifiesto, sin extras, con tamaño y SHA-256 correctos | **Completa:** ídem |

Tamaños de V1 frente a V2 (bytes):

| Archivo | V1 | V2 |
|---|---|---|
| `README.md` | 619 | 839 |
| `MANIFEST.json` | 5 608 | 5 643 |
| `package_docs/HANDOFF_TO_CLAUDE.md` | 2 738 | 3 674 |
| `package_docs/CURRENT_STATE_SNAPSHOT.md` | 2 441 | 3 601 |
| `package_docs/ONE_SHOT_PROMPT_FOR_CLAUDE.md` | 909 | 921 |
| `package_docs/PRIMARY_RESEARCH.md` | 1 288 | 1 534 |
| ADR del grafo | 4 105 | 5 599 |
| Spec padre | 3 575 | 6 489 |

Los tamaños de V1 coinciden con los anotados al recibirla el 2026-10-04. El acta registró el 2026-10-15 que «el ZIP recibido solo contiene un índice de 619 bytes»: es el tamaño del `README.md` de V1, pero V1 traía los 21 documentos completos.

## 2. V1 frente a PR 0 (verificado)

Comparación archivo por archivo de los 21 documentos de `repo_overlay/` de V1 contra `git show 05af598d`:

- **14 documentos idénticos:** todos los planes, tasks y checklists de los cuatro slices, y el plan y el checklist del padre.
- **7 documentos con diferencias, todas registradas en PR 0:**
  - ADR: `ADR-035` → `ADR-042` (identificador y título) y una sección «Reconciliación PR 0» añadida.
  - Tasks del padre: `OI-002` cambia `ADR-035` por `ADR-042`.
  - Spec padre: campos canónicos `related_*` añadidos y `last_verified` de 2026-10-04 a 2026-10-06.
  - Specs de los cuatro slices: rutas y endpoints aún inexistentes movidos del frontmatter a una sección del cuerpo, para cumplir `spec:validate:strict`.
- **Nada se perdió:** cada ruta de archivo y cada endpoint que V1 declaraba en el frontmatter de los cuatro slices aparece en PR 0.

**Resultado:** PR 0 = V1 + los ajustes documentados. No hubo otros cambios.

## 3. V2 frente a PR 0

Misma estructura: los mismos 21 documentos en `repo_overlay/` y los mismos 4 en `package_docs/`. V2 es una **redacción más detallada** de los mismos documentos: tabla de actores en el padre, escenarios más concretos, listas de métricas y de pruebas por slice, *backlog* y una regla de nombres en el handoff.

Desde PR 0, el padre, los cuatro slices y el ADR se reescribieron siguiendo el acta y las decisiones del owner del 2026-10-25 y del 2026-11-06. La pregunta útil, por tanto, es qué aporta V2 frente al estado actual.

## 4. Contenido sustantivo de V2 frente al estado actual

| # | Qué dice V2 | Estado actual | Clasificación |
|---|---|---|---|
| 1 | La federación debe vivir **dentro** de los módulos `intelligence`/`prometeo` (regla de nombres del handoff) y las rutas bajo `/v1/intelligence/...` | D-03 (aceptada el 2026-10-25) y S1-Q2: módulo nuevo `operational-lineage`, porque `modules/intelligence` tiene rutas `@Public` (hallazgo P-04) | **Contradice una decisión posterior del owner; prevalece la decisión** |
| 2 | `OPS_ADMIN` con `ops:dashboard:read` como actor que pide la proyección de Omniverse | S4-Q1: identidad de servicio propia, **no** `OPS_ADMIN` | **Contradice; prevalece la decisión** |
| 3 | El slice 1 incluye proveedores de memoria y de conversaciones | S1-Q1: solo Graphify; memoria y conversaciones en specs hijos futuros | **Contradice; prevalece la decisión** |
| 4 | Herramienta de Prometeo llamada `semse.graph.query` | El slice 3 no le da nombre | **Aporta:** candidato de nombre, a confirmar con la convención `namespace.name` del registro |
| 5 | Listas de métricas por slice (p. ej. p50/p95 de consulta, nodos y aristas devueltos, proveedores degradados, truncados, éxito y fallo del registro de decisiones, deduplicaciones, alcance denegado, tamaño y latencia de la instantánea) | Los specs dejan los nombres de métricas como «pendiente de dato» | **Aporta:** candidatos de nombres (no de valores) para S1-Q3, S2-Q5, S3-Q6 y S4-Q4 |
| 6 | *Backlog*: caché materializada solo tras métricas, diferencias temporales del grafo, visualización 3D avanzada, refresco incremental de Graphify | No figura | **Aporta:** trabajo futuro fuera de V1 |
| 7 | `related_files` del padre: spec de Conversation Intelligence, `agent-memory-governance`, `prometeo.service.ts` y repositorios de memoria | El padre solo cita el ADR | **Aporta trazabilidad** |
| 8 | Las decisiones críticas de dinero o autorización se rechazan sin evidencia de política o aprobación | V1 del ledger excluye decisiones financieras y exige autoridad para las críticas | **Cubierto, de forma más restrictiva** |
| 9 | Cursor o delta de Omniverse solo tras validar la instantánea | V1 entrega solo la instantánea | **Cubierto** |
| 10 | `OmniverseSnapshot` con `sourceSha` y `freshness` como mapa | `graphSourceSha` y `freshness` como lista por proveedor; `null` si se desconoce | **Equivalente; cambia el nombre y la forma** |
| 11 | Diez invariantes no negociables y «definición de completo» del handoff | Recogidos en ADR-044, el padre y los gates de cada slice | **Cubierto** |
| 12 | `CURRENT_STATE_SNAPSHOT` con el estado de GitHub y Railway del 2026-10-04 | Obsoleto por diseño; el propio paquete exige refrescarlo antes de cada PR | **No aplica** |

## 5. Conclusión

- **B-01 queda cerrado:** el paquete aplicado (V1) está íntegro según su manifiesto y PR 0 lo contiene completo, con solo los ajustes documentados.
- **V2 es una revisión posterior y más detallada** del mismo paquete. No obliga a deshacer trabajo: lo que contradice el estado actual (#1, #2, #3) lo resolvió después el owner con decisiones registradas.
- **Cuatro aportes de V2 podrían incorporarse** (#4 a #7). Ninguno se ha aplicado: requieren decisión del owner.

## 6. Decisiones que requiere el owner

| ID | Decisión | Recomendación |
|---|---|---|
| B01-1 | ¿Se adoptan los nombres de métricas de V2 como candidatos en los specs? | Sí, como candidatos; los valores siguen pendientes de medición |
| B01-2 | ¿Se adopta `semse.graph.query` como nombre de la herramienta del slice 3b? | Comprobar primero la convención del registro de herramientas |
| B01-3 | ¿Se registra el *backlog* de V2 en el spec padre como trabajo futuro? | Sí, fuera del alcance de V1 |
| B01-4 | ¿Se añaden los `related_files` de V2 al spec padre? | Sí, los que existan en `main` |
