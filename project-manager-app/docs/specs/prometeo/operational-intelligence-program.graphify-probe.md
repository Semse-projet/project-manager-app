# Prueba técnica de Graphify (B-05) — Operational Intelligence

**Fecha:** 2026-11-06. **Cierra:** B-05 del [acta](operational-intelligence-program.reconciliation.md) (hallazgos P-25, G-05, G-06, G-22, Q-11; decisión D-08).
**Ejecutor:** Claude (coordinador). **Alcance:** solo lectura; no se tocó código, imágenes ni producción.

## Método

- `graphifyy` **0.9.103** instalado en un entorno virtual aislado (no global).
- Corpus: copia de `apps/api/src/modules/graphify` y `apps/api/src/modules/repo-knowledge` (5 archivos), construido con el mismo comando de `Dockerfile.api:37`: `graphify update . --no-cluster`.
- Resultado: 61 nodos, 114 aristas, 0,4 s, **sin LLM ni red** («no LLM needed»).
- Se ejecutaron `query`, `explain`, `path` y `affected` contra ese `graph.json`.

## Límites de esta prueba

- Corpus de 5 archivos, no el monorepo completo. **No se midió** el tamaño ni el tiempo de carga de `graph.json` en producción.
- **No se verificó qué versión de `graphifyy` corre hoy en producción:** `Dockerfile.api:36` y `:98` instalan sin versión fija, así que puede diferir de 0.9.103.

## Hallazgos

1. **`graph.json` es JSON estructurado y estable de leer.** Claves de primer nivel: `nodes`, `links`, `hyperedges`, `directed`, `multigraph`, `input_tokens`, `output_tokens`.
   - Nodo: `id`, `label`, `file_type` (`code` o `concept`), `source_file`, `source_location`, `_origin`, y opcionalmente `external`, `type`, `metadata`.
   - Arista: `source`, `target`, `relation`, `confidence` (`EXTRACTED` o `INFERRED`), `confidence_score`, `weight`, `source_file`, `source_location`.
   - Relaciones vistas: `references`, `imports_from`, `method`, `calls`, `contains`, `imports`.
2. **La CLI solo devuelve texto.** `query`, `explain`, `path` y `affected` no ofrecen `--json` (solo `diagnose multigraph` lo tiene). Convertir esa salida en nodos y aristas exigiría analizar texto libre, que cambia entre versiones.
3. **Ningún nodo ni arista lleva tenant, organización ni sensibilidad.** El grafo es global (confirma P-12). Sí lleva rutas de archivo del repositorio (`source_file`), que son información de arquitectura interna.
4. **Las aristas distinguen origen:** `EXTRACTED` (105) frente a `INFERRED` (9). Esto permite marcar aristas derivadas, como pide D-12.
5. **Argumentos con guion inicial:** `query "--budget 5"` y `explain "--graph /nonexistent"` se tratan como texto de búsqueda, no como opciones. Es comportamiento de esta versión, no una garantía: se mantiene la validación de argumentos de D-08.
6. **`GraphifyService` ya usa `execFile`** (sin shell) con tiempo máximo de 15 s: no hay inyección de comandos por esa vía.
7. **La CLI degrada con gracia:** sin grafo, `GraphifyService` devuelve `available: false` sin lanzar excepción.

## Conclusión para el slice 1

| Opción | Veredicto |
|---|---|
| A. Leer `graph.json` directamente desde un proveedor TypeScript, con esquema Zod y versión fijada | **Recomendada.** Estructura real, sin subproceso, aristas con origen y ubicación |
| B. Analizar la salida de texto de la CLI | Descartada: frágil y dependiente de versión |
| C. Copiar el grafo a PostgreSQL | Descartada: ya excluida por ADR-044 |

Condiciones para que el spec del slice 1 pueda declarar la opción A:

1. Fijar la versión de `graphifyy` en `Dockerfile.api` (cambio de infraestructura, **fuera de este PR** y sujeto a las reglas de CI/despliegue de `AGENTS.md`).
2. Validar `graph.json` con Zod al cargarlo y tratar un esquema desconocido como proveedor degradado, nunca como error.
3. Aplicar `internal:architecture:read` también vía Prometeo y tratar como `internal` el ámbito de los nodos de Graphify (D-08).
4. Medir tamaño y tiempo de carga con el grafo real de producción **antes de aprobar** el slice. Hoy es un dato desconocido.
5. Mantener la CLI solo para la ruta de RAG textual que ya existe.

## Reproducción

Requiere `pip install graphifyy==0.9.103` en un entorno virtual y copiar los dos módulos a un directorio vacío; luego `graphify update . --no-cluster` y `graphify explain GraphifyService --graph graphify-out/graph.json`.
