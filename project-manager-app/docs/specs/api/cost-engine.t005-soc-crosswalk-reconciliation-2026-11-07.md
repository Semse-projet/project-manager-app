# T-005 — Reconciliación verificable de mapeos SOC para los 24 motores

**Corte:** 2026-11-07 · **Rama:** `docs/cost-engine-spec` · **Estado:** `DESIGN_ONLY / PENDING_SPECIALIST_REVIEW` · **Autoridad:** ninguna tarifa ni mapeo comercial aprobado.

## Hallazgo y control

Se compararon las 24 filas de dos borradores T-005 y el diccionario SOC del script de investigación `scripts/research/oews_coverage.py`. Hay **14/24 discrepancias** entre los documentos. El script coincide con el primer borrador, pero esto **no valida** los SOC ante especialistas ni su cobertura en las tablas oficiales May 2025.

**Fuentes dentro del mismo PR:** [modelo operativo](./cost-engine.national-labor-geo-tax-operating-model-2026-11-06.md) · [contrato de ingestión](./cost-engine.us-data-ingestion-and-24-trade-crosswalk-2026-11-06.md) · [script de investigación](../../../scripts/research/oews_coverage.py).

**Decisión provisional:** los dos listados son propuestas descriptivas, no fuentes canónicas para cálculos. Ningún agente debe resolver diferencias por unión, intersección, elección de la lista más larga ni coincidencia con el script. El catálogo de referencia por tarea se definirá y se firmará después de revisar alcance laboral real, roles auxiliares, supervisores, condiciones reguladas y tipo de geografía. El script actual permanece solo para auditoría de cobertura referencial, jamás como tarifa aprobada.

## Matriz 24 × SOC — comparación de borradores

| Motor | Modelo operativo | Contrato de ingestión | Estado | Revisión requerida |
|---|---|---|---|---|
| `bathroom` | `47-2031`, `47-2044`, `47-2111`, `47-2152` | `47-2044`, `47-2081`, `47-2111`, `47-2152` | CONFLICTO | Carpintería frente a drywall según alcance |
| `carpentry` | `47-2031` | `47-2031` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `cleaning` | `37-2011`, `37-2012` | `37-2011`, `47-4041` | CONFLICTO | Limpieza ordinaria frente a remediación peligrosa |
| `concrete` | `47-2051`, `47-2073`, `47-2171` | `47-2051`, `47-2061` | CONFLICTO | Operadores/refuerzo frente a ayudantes |
| `deck` | `47-2031`, `47-2061` | `47-2031`, `47-2061` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `demolition` | `47-2061`, `47-4041` | `47-2061`, `47-4041` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `drywall` | `47-2081`, `47-2082` | `47-2081`, `47-2082` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `electrical` | `47-2111` | `47-2111`, `47-3013` | CONFLICTO | Electricista frente a ayudante |
| `fencing` | `47-2031`, `47-4031` | `47-2061`, `47-4031` | CONFLICTO | Carpintería frente a obrero de construcción |
| `flooring` | `47-2041`, `47-2042`, `47-2043`, `47-2044` | `47-2031`, `47-2042`, `47-2044` | CONFLICTO | Carpet, lijado, tile, madera y apoyo |
| `hvac` | `47-2111`, `47-2211`, `49-9021` | `47-2211`, `49-9021` | CONFLICTO | Electricista adicional según interconexión |
| `insulation` | `47-2131`, `47-2132` | `47-2131`, `47-2132` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `kitchen` | `47-2031`, `47-2044`, `47-2111`, `47-2152` | `47-2031`, `47-2044`, `47-2111`, `47-2152` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `labor` | `47-2061` | `47-1011`, `47-2061` | CONFLICTO | `47-3010` (grupo amplio) excluido del parser detallado conforme SOC 2018; `47-1011` supervisor sigue pendiente de revisión por tarea |
| `landscaping` | `37-3011`, `37-3013` | `37-1012`, `37-3011` | CONFLICTO | Poda arbórea especializada frente a supervisión |
| `masonry` | `47-2021`, `47-2022` | `47-2021`, `47-2022` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `painting` | `47-2141` | `47-2141`, `47-3014` | CONFLICTO | Pintor frente a ayudante de pintura |
| `plumbing` | `47-2151`, `47-2152` | `47-2152`, `47-3015` | CONFLICTO | Pipelayer frente a ayudante de plomería |
| `project-manager` | `11-9021`, `47-1011` | `11-9021`, `47-1011` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `roofing` | `47-2181` | `47-2181`, `47-3016` | CONFLICTO | Tejador frente a ayudante |
| `siding` | `47-2031`, `47-2211` | `47-2031`, `47-2061` | CONFLICTO | Sheet metal frente a obrero general |
| `solar` | `47-2111`, `47-2231` | `47-2111`, `47-2231` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |
| `tile` | `47-2044` | `47-2022`, `47-2044` | CONFLICTO | Tile frente a stonemason |
| `windows-doors` | `47-2031`, `47-2121` | `47-2031`, `47-2121` | COINCIDENCIA DE BORRADORES | Aprobar clasificación por actividad; sin tarifa automática |

**Concordancia:** 10/24, aún sin revisión de oficio. **Conflictos:** 14/24. **SOC comerciales aprobados:** 0/24.

## Precauciones de clasificación y evidencia

1. Un motor (`bathroom`, `kitchen`, `hvac`) representa una combinación de tareas, no una sola ocupación. Las horas por tarea/ocupación deben venir de evidencia de ejecución y nunca de un promedio de SOC.
2. `47-3010` es un **grupo ocupacional de ayudantes de construcción**; la cobertura de un grupo no certifica un SOC detallado. Distinguir `47-3013` (ayudantes electricistas) y `47-3014` (ayudantes pintores), por ejemplo, sin asignarlos automáticamente a cada trabajo.
3. `47-4041` representa remoción de materiales peligrosos: una ficha de `cleaning` no autoriza ni sustituye permisos/capacitación de remediación.
4. `37-3013` es poda de árboles; no equivale a todo trabajo de paisajismo. Supervisores, ayudantes y ejecutores deben separarse por rol.
5. Esta auditoría compara **códigos propuestos**, no precios, cobertura OEWS realmente descargada, elegibilidad Davis-Bacon ni clasificación legal del oficio.

**Referencias oficiales para revisión:** [BLS matriz de ocupaciones](https://www.bls.gov/emp/tables/industry-occupation-matrix-occupation.htm), [BLS OEWS May 2025](https://www.bls.gov/oes/tables.htm) y [BLS trabajadores de materiales peligrosos](https://www.bls.gov/ooh/construction-and-extraction/hazardous-materials-removal-workers.htm).

## Gates para cerrar esta brecha dentro de #1075

- [ ] Un único registro versionado por `trade × task × SOC × role × geography × release`, validado por especialistas; registrar versiones y motivo por alteración.
- [ ] Resolver los 14 conflictos con alcance y evidencia por tarea, sin mezclar como ocupación principal un grupo amplio de ayudantes ni un supervisor.
- [ ] Probar que un mismo trabajador/hora no se cuente dos veces cuando dos oficios comparten SOC.
- [ ] Descargar ZIP OEWS estatal + metro May 2025 y verificar fecha real del release, estructura, checksum, supresiones y discrepancias geográficas.
- [ ] Ejecutar pruebas negativas: supresión no equivale a salario cero; grupo no equivale a detalle; SOC fuera de tarea no entra en estimación; índice o salario de referencia no genera precio USD ni tarifa.
- [ ] Documentar revisión humana, fuente oficial, resultado y SHA; **solo después de APPROVED**, proponer cambios al script/código. Esta fase no autoriza merge ni precios nuevos.

**Estado de ejecución:** comparación documental reproducida durante la revisión; no se ejecutaron pruebas de ingestión oficial ni se aplicaron cambios al script, API, Prisma, precios, impuestos o Railway.
