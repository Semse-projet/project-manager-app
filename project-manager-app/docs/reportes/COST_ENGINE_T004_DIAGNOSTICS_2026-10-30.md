# T-004 — Diagnóstico de los 24 motores de costos

> Generado por `packages/tools/test/cost-engine-t004-diagnostics.test.ts`. **Solo diagnóstico**: no cambia lógica productiva ni precios.
> Demuestra estabilidad matemática; **no** demuestra que ningún precio, rendimiento, multiplicador o margen sea comercialmente correcto.

## Resumen

- Escenarios: 72 (24 motores × normal, complejo y límite). Todos válidos y con montos finitos.
- Todos los motores llaman a `buildCostSummary` y `costs` es exactamente la salida de esa llamada: sí.
- Reejecutar `buildCostSummary` con los **argumentos capturados** reproduce `costs` byte a byte (tolerancia cero): 72/72.
- Motores con más de una llamada a `buildCostSummary` en un escenario: ninguno.
- Escenarios con `perUnit`: 66.

## Reconstrucción por división de importes redondeados (método de la spec v0.2)

- Reconstrucciones exactas (0 centavos en todos los campos): **42/72**.
- Mayor diferencia en `total`: **1 centavo(s)**.
- Con la base redondeada pero las **tasas reales** del motor: exactas 72/72; mayor diferencia en `total`: 0 centavo(s). Todas dentro de la cota analítica (un centavo de redondeo de la base propagado por la fórmula, más dos redondeos de salida).
- Divisor de `perUnit` recuperado como `total / perUnit` que difiere del real: 57/66 escenarios.

**Lectura:** la base (materiales y mano de obra) ya llega en centavos exactos en todos los escenarios, así que el redondeo de la base no explica las diferencias.
Las 30 reconstrucciones inexactas se deben solo a **re-derivar las tasas dividiendo importes ya redondeados**: el motor no expone sus tasas ni su divisor. Con las tasas reales la reconstrucción es exacta (72/72).
Recomendación: que los motores expongan directamente `effectiveRates` (overhead, ganancia, comisión, impuesto), la base y `perUnitDivisor`, manteniendo la respuesta actual, en vez de reconstruirlos por división. No se usan tolerancias para ocultar estas diferencias.

## Tasas efectivas por motor (capturadas, no derivadas)

| Motor | normal (OH / ganancia / fee / impuesto) | complejo | límite |
|---|---|---|---|
| bathroom | 15.0 / 22.0 / 5.0 / 7.0 | 15.0 / 22.0 / 5.0 / 7.0 | 15.0 / 22.0 / 5.0 / 7.0 |
| carpentry | 14.0 / 20.0 / 5.0 / 7.0 | 17.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| cleaning | 10.0 / 18.0 / 5.0 / 7.0 | 10.0 / 18.0 / 5.0 / 7.0 | 10.0 / 18.0 / 5.0 / 7.0 |
| concrete | 15.0 / 20.0 / 5.0 / 7.0 | 15.0 / 20.0 / 5.0 / 7.0 | 15.0 / 20.0 / 5.0 / 7.0 |
| deck | 14.0 / 20.0 / 5.0 / 7.0 | 16.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| demolition | 15.0 / 20.0 / 5.0 / 7.0 | 18.0 / 20.0 / 5.0 / 7.0 | 15.0 / 20.0 / 5.0 / 7.0 |
| drywall | 16.0 / 20.0 / 5.0 / 7.0 | 16.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| electrical | 15.0 / 20.0 / 5.0 / 7.0 | 15.0 / 20.0 / 5.0 / 7.0 | 15.0 / 20.0 / 5.0 / 7.0 |
| fencing | 14.0 / 20.0 / 5.0 / 7.0 | 16.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| flooring | 14.0 / 20.0 / 5.0 / 7.0 | 16.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| hvac | 17.0 / 22.0 / 5.0 / 7.0 | 17.0 / 22.0 / 5.0 / 7.0 | 17.0 / 22.0 / 5.0 / 7.0 |
| insulation | 14.0 / 20.0 / 5.0 / 7.0 | 17.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| kitchen | 15.0 / 22.0 / 5.0 / 7.0 | 15.0 / 22.0 / 5.0 / 7.0 | 15.0 / 22.0 / 5.0 / 7.0 |
| labor | 13.0 / 16.0 / 5.0 / 7.0 | 16.0 / 16.0 / 5.0 / 7.0 | 13.0 / 16.0 / 5.0 / 7.0 |
| landscaping | 16.0 / 20.0 / 5.0 / 7.0 | 16.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| masonry | 16.0 / 20.0 / 5.0 / 7.0 | 16.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| painting | 14.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| plumbing | 15.0 / 20.0 / 5.0 / 7.0 | 15.0 / 20.0 / 5.0 / 7.0 | 15.0 / 20.0 / 5.0 / 7.0 |
| project-manager | 22.0 / 18.0 / 5.0 / 7.0 | 22.0 / 18.0 / 5.0 / 7.0 | 18.0 / 18.0 / 5.0 / 7.0 |
| roofing | 16.0 / 22.0 / 5.0 / 7.0 | 16.0 / 22.0 / 5.0 / 7.0 | 16.0 / 22.0 / 5.0 / 7.0 |
| siding | 15.0 / 22.0 / 5.0 / 7.0 | 15.0 / 22.0 / 5.0 / 7.0 | 15.0 / 22.0 / 5.0 / 7.0 |
| solar | 17.0 / 18.0 / 5.0 / 7.0 | 20.0 / 18.0 / 5.0 / 7.0 | 17.0 / 18.0 / 5.0 / 7.0 |
| tile | 14.0 / 20.0 / 5.0 / 7.0 | 17.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |
| windows-doors | 16.0 / 20.0 / 5.0 / 7.0 | 16.0 / 20.0 / 5.0 / 7.0 | 14.0 / 20.0 / 5.0 / 7.0 |

- Motores cuyo overhead o ganancia **cambia según la entrada**: carpentry, deck, demolition, drywall, fencing, flooring, insulation, labor, landscaping, masonry, project-manager, solar, tile, windows-doors.
- Escenarios con comisión distinta del 5 % por defecto: 0. Con impuesto distinto del 7 % por defecto: 0.

**Implicación para el diseño:** sustituir los márgenes por valores globales borraría las reglas propias de cada oficio. El servicio debe partir de las tasas efectivas del motor y sobrescribir solo lo que una capa defina.

## Redondeo de la base (importes que el motor pasa vs. `costs.materials`/`costs.labor`)

| Motor | escenario | materiales (centavos) | mano de obra (centavos) |
|---|---|---|---|
| — | — | 0 | 0 |

## Error de las tasas re-derivadas (relativo a la tasa real)

| Motor | escenario | overhead | ganancia | fee | impuesto | Δtotal (¢) |
|---|---|---|---|---|---|---|
| bathroom | complex | 2.48e-7 | 1.38e-7 | 2.48e-7 | -2.05e-8 | 1 |
| carpentry | complex | -4.17e-7 | -2.23e-7 | 2.61e-7 | -4.22e-7 | -1 |
| carpentry | limit | 1.06e-5 | 0 | 1.04e-5 | -1.95e-6 | 1 |
| cleaning | normal | 0 | 1.50e-5 | 1.65e-5 | -1.13e-5 | 1 |
| cleaning | complex | 1.74e-6 | -1.08e-6 | 8.71e-7 | 1.14e-6 | 1 |
| concrete | normal | 3.16e-7 | 2.20e-7 | -3.16e-7 | 3.98e-7 | 1 |
| concrete | complex | -3.53e-8 | 3.07e-8 | -7.06e-8 | -4.07e-8 | -1 |
| concrete | limit | -8.90e-6 | 0 | -2.97e-6 | -4.29e-6 | -1 |
| deck | normal | -5.46e-7 | -9.59e-7 | 0 | -2.51e-7 | -1 |
| deck | limit | 3.17e-6 | 0 | 0 | 1.73e-6 | 1 |
| demolition | complex | 5.11e-9 | 8.67e-8 | -1.28e-8 | 6.45e-8 | 1 |
| demolition | limit | -6.72e-6 | -9.35e-6 | 6.72e-6 | -3.57e-6 | -1 |
| drywall | normal | 2.55e-6 | 9.14e-7 | 2.12e-6 | -1.99e-6 | 1 |
| drywall | complex | -2.53e-7 | 0 | -2.77e-7 | -1.81e-7 | -1 |
| hvac | normal | -3.75e-7 | -3.84e-7 | 2.68e-7 | -2.90e-7 | -1 |
| insulation | complex | 0 | -1.27e-7 | 0 | -9.43e-8 | -1 |
| kitchen | complex | 5.96e-8 | -5.81e-8 | 5.96e-8 | 1.72e-8 | 1 |
| labor | complex | 0 | -6.58e-8 | 0 | -9.11e-8 | -1 |
| labor | limit | -2.62e-5 | -7.43e-6 | -2.62e-5 | -2.08e-5 | -1 |
| landscaping | limit | 2.68e-7 | -2.35e-6 | -4.68e-6 | -3.59e-6 | -1 |
| masonry | normal | 9.83e-7 | 9.42e-7 | 8.20e-7 | -1.08e-6 | 1 |
| painting | normal | 3.01e-7 | -1.32e-6 | -1.51e-6 | -6.91e-7 | -1 |
| plumbing | normal | -2.57e-6 | -2.56e-6 | -3.31e-6 | 2.98e-6 | -1 |
| project-manager | complex | 0 | -3.25e-8 | 0 | -1.78e-8 | -1 |
| project-manager | limit | -1.53e-6 | -6.47e-6 | 3.82e-6 | -3.44e-6 | -1 |
| roofing | complex | 0 | -2.99e-8 | 0 | -4.94e-10 | -1 |
| solar | normal | 2.48e-7 | 4.25e-8 | 0 | 1.43e-7 | 1 |
| solar | limit | 5.25e-7 | 2.15e-7 | 5.25e-7 | -1.98e-7 | 1 |
| tile | normal | 1.26e-6 | 1.11e-6 | 3.15e-6 | 1.56e-6 | 1 |
| windows-doors | limit | 0 | -2.72e-6 | 0 | -3.61e-6 | -1 |

## Hallazgos colaterales

- **`wastePercent` con unidades distintas:** `concrete` lo trata como puntos porcentuales (rango 0–30, divide entre 100) y `masonry` como fracción (rango 0–0.35). Pasar `10` a mampostería da error de validación; pasar `0.1` a concreto da 0.1 % de desperdicio. Un adaptador que mapee respuestas a entradas debe conocer la unidad de cada motor, o los motores deben normalizarse.
- **Límites de validación que rechazan entradas plausibles:** `project-manager` limita `crewSize` a 1–20; un proyecto multi-oficio grande queda fuera de rango.

## Qué NO demuestra este informe

- Que los precios de materiales, rendimientos, multiplicadores regionales o márgenes por oficio coincidan con el mercado.
- Que el 7 % de impuesto sea correcto (ver spec §1.2 y Q10) ni que la conversión PPI sea correcta.
- Que `quote-engine` y `contractor-estimate` den el mismo total (se verifica en tareas posteriores).
