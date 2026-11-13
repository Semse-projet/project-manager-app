# T-005 — OEWS: ejecución reproducible del diagnóstico salarial (no precios comerciales)

Fecha: 2026-11-06. PR #1075, estado RESEARCH_ONLY / OFFICIAL_ZIP_IMPORT_PENDING.

Esta tarea NO modifica el Cost Engine, las variables de Railway, precios, impuestos, contratos, ni datos de producción.

## Entrega técnica en la misma rama

- [Validador Python](../../../scripts/research/oews_coverage.py) — lee CSV/XLSX y ZIP que contiene XLSX; procesa fuentes descargadas localmente sin red, cuenta referencias salariales por los 51 estados/DC y 24 motores. No estima tarifas facturables.
- [Quince pruebas sintéticas](../../../scripts/research/test_oews_coverage.py) — casos de supresión, ZIP/XLSX, conteos por estado/metro, duplicados, ZIP de varios XLSX y ausencia de XLSX. La verificación de este HEAD exige CI nuevo; NO se han ejecutado contra los ZIP oficiales de 2025.

## Ejecución sobre datos oficiales cuando exista acceso

Fuente: [BLS OEWS May 2025 tables](https://www.bls.gov/oes/tables.htm). Los enlaces de los ZIP están en esa página.

~~~bash
curl -fL --retry 3 -o oesm25st.zip https://www.bls.gov/oes/special-requests/oesm25st.zip
curl -fL --retry 3 -o oesm25ma.zip https://www.bls.gov/oes/special-requests/oesm25ma.zip
python3 -m unittest discover -s scripts/research -p test_oews_coverage.py -v
python3 scripts/research/oews_coverage.py \
  --state oesm25st.zip --metro oesm25ma.zip --out reports/oews-may2025
~~~

**Limitación actual:** las descargas ZIP oficiales no se completaron desde el entorno de análisis: el navegador rechazó el formato ZIP y el contenedor careció de conectividad. La alternativa secundaria WageDex tampoco se pudo descargar. Por tanto, aún NO existe importación oficial nacional ejecutada ni métricas reales de cobertura por los 24 oficios.

## Control adicional integrado en el CI existente (7-nov-2026)

- `tests/unit/oews-research-contract.test.mjs` incluye las quince pruebas Python sintéticas en `pnpm test:unit` **sin crear un workflow ni conectar BLS**. El test falla, no hace skip, cuando Python no está disponible o la suite no termina `OK`.
- `manifest.json` diferencia `release_claim` de `release_verified=false` y `source_authentication=NOT_VERIFIED_OFFLINE`; el hash SHA-256 identifica bytes **no autentica** por sí mismo su origen o fecha.
- `area_count_observed` permite separar el conteo de estados/metrópolis representados por filas reales del grid completo de 51×24 combinaciones.
- Los ZIP que contengan múltiples XLSX diferentes ahora fallan con `Ambiguous OEWS ZIP` en vez de seleccionar el primero silenciosamente. Si BLS distribuye varios ficheros legítimos, antes se debe acordar selección explícita del XLSX pertinente y comprobar su esquema; no debilitar este rechazo automáticamente.
- **CI del HEAD nuevo pendiente de comprobación**, sin uso comercial; el último PASS de una versión anterior no se reutiliza.

## Endurecimiento de grano OEWS y rechazo de mezclas (8-nov-2026)

- Para archivos que incluyan los campos de dimensión, el lector ahora acepta exclusivamente `AREA_TYPE=2` en el dataset estatal y `AREA_TYPE=4/6` en el metropolitano/no metropolitano. `3` (territorios) y `1` (nacional) no se usan para afirmar cobertura de 50 estados + DC.
- En el alcance de referencia se comprueban `NAICS=000000`, `I_GROUP=cross-industry`, `OWN_CODE=1235` y `O_GROUP=detailed` cuando figuran en la fuente. Las filas de otros sectores, propiedad o agregaciones ocupacionales quedan fuera; no se suman como observaciones equivalentes.
- El manifiesto de investigación incluye `scope_fields_present` y contadores `skipped_wrong_geography`, `skipped_non_cross_industry`, `skipped_ownership_scope`, `skipped_non_detailed_occupation` cuando aplica. Un ZIP/XLSX sin estas cinco columnas se rechaza; la ausencia de una dimensión en CSV de prueba no certifica el alcance: `release_verified=false` permanece.
- Los quince casos Python sintéticos comprueban los filtros, mezclas y ausencia de filas válidas, además de supresión, duplicados, fuentes ambiguas y reproducibilidad; se ejecutan desde la suite Node existente. **El HEAD modificado requiere CI terminal exitoso; se registrará por separado.**
- Fuentes oficiales: [BLS May 2025 tables](https://www.bls.gov/oes/tables.htm) y [documentación OEWS](https://www.bls.gov/oes/oes_doc.htm). La nomenclatura se contrastará con el Excel y sus Field Descriptions originales antes de validar importación.

**Encabezados y geografía:** los encabezados repetidos se rechazan en vez de sobrescribir el valor salarial con la última columna; el título de área se toma de cualquier registro observado del área, no del primer SOC del motor, por lo que una ocupación ausente/suprimida no elimina la etiqueta metropolitana. Ambos comportamientos tienen pruebas sintéticas propias.

**Aislamiento de ejecución:** cada corrida debe utilizar un directorio de salida vacío y archivos estatales y metropolitanos distintos. Si el destino contiene un manifiesto/CSV anterior, el script falla sin sobrescribirlo; el origen no puede apuntar al mismo archivo para ambos tipos geográficos. Dos casos sintéticos nuevos comprueban ambos rechazos.

**Integridad de generación:** ahora se validan primero los dos insumos (estatal y metro) antes de escribir los archivos de cobertura. Una falla en el segundo archivo no deja un CSV estatal nuevo a medio producir. Esta mitigación no equivale a un commit transaccional del directorio; utilizar un directorio de salida nuevo por ejecución y no interpretar artefactos antiguos como vigentes.


**Corrección de clasificación (8-nov-2026):** BLS SOC 2018 identifica `47-3010` como **grupo amplio** (`Helpers, Construction Trades`), no una ocupación detallada. Se quitó **solo** de la lista de cobertura referencial del motor `labor` y del borrador operativo, y se actualizó la conciliación; sigue pendiente la clasificación de ayudantes por oficio y no se ha aprobado ningún costo/hora comercial. [Jerarquía SOC 2018 (BLS)](https://www.bls.gov/soc/2018/major_groups.htm). Una prueba sintética verifica que `47-2061` por sí solo puede completar el conjunto de referencias de `labor`.

## Contrato de salida

- state_trade_coverage.csv: 51 estados/DC × 24 motores = 1,224 combinaciones *posibles*, incluso cuando no hay salario publicable. El número de filas NO mide cobertura real.
- metro_trade_coverage.csv: 24 motores por área efectivamente encontrada, sin inferir cobertura territorial donde hay supresión.
- manifest.json: hash SHA-256 de cada entrada, conteos de claves, medianas sin cifra y clasificación RESEARCH_ONLY_NOT_APPROVED.

Estados por área/oficio: ALL_REFERENCE_WAGES_PRESENT, SOME_REFERENCE_WAGES_PRESENT o NO_REFERENCE_WAGES. Ningún estado significa salario de cuadrilla validado, tarifa comercial, margen correcto, o política fiscal aprobada. Mantener las cifras por SOC separadas, sin promediarlas como precio facturable.

**Guardia de procedencia:** el campo release_claim identifica el release solicitado, pero NO demuestra por sí mismo que el archivo suministrado sea oficial ni que contenga May 2025. Registrar URL, fecha, hash, XLSX interno, edición, tamaño y columnas; cotejar los datos con el portal BLS antes de considerar el análisis válido.

## Comprobaciones pendientes antes de una importación oficial aceptada

1. Descargar los ZIP desde BLS y verificar esquema, edición interna, nombre del miembro y huella; no confiar en el alias cambiante CURRENT.
2. Revisar las supresiones publicadas; valores suprimidos y NA deben ser NULL, nunca cero. Detectar duplicados por área×SOC; si el ZIP incluye scopes industriales distintos, aislarlos por definición en lugar de sobrescribir.
3. Reconciliar muestras por SOC de FL, GA, TX, CA, NY y WA contra la publicación original.
4. Medir cobertura de medianas reales por cada SOC candidato de los 24 motores, por estado y metro; no confundir filas previstas con cifras presentes.
5. Revisar con especialista el mapeo SOC→operación y contrastar costos patronales reales, horas productivas, impuestos y estimaciones con registros reconciliados.
6. Mantener T-005, Q2, Q3, Q9, Q10, Q11 en validación externa, independientemente de que este script supere pruebas.

Fuentes: [BLS OEWS Tables](https://www.bls.gov/oes/tables.htm); [BLS OEWS Documentation](https://www.bls.gov/oes/oes_doc.htm); [WageDex Open Data](https://wagedex.com/data) (compilación secundaria, no importada).

**Activación comercial:** desautorizada; PR #1075 permanece DRAFT y #1101 no valida precios base BLS ni políticas fiscales.
