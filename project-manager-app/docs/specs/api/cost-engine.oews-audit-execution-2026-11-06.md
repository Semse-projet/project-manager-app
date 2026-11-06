# T-005 — OEWS: ejecución reproducible del diagnóstico salarial (no precios comerciales)

Fecha: 2026-11-06. PR #1075, estado RESEARCH_ONLY / OFFICIAL_ZIP_IMPORT_PENDING.

Esta tarea NO modifica el Cost Engine, las variables de Railway, precios, impuestos, contratos, ni datos de producción.

## Entrega técnica en la misma rama

- [Validador Python](../../../scripts/research/oews_coverage.py) — lee CSV/XLSX y ZIP que contiene XLSX; procesa fuentes descargadas localmente sin red, cuenta referencias salariales por los 51 estados/DC y 24 motores. No estima tarifas facturables.
- [Tres pruebas sintéticas](../../../scripts/research/test_oews_coverage.py) — casos de supresión de valores, ZIP/XLSX, conteos por estado/metro y detección de duplicados. Las pruebas sintéticas han pasado en el entorno de análisis, pero NO se han ejecutado sobre los ZIP oficiales de 2025.

## Ejecución sobre datos oficiales cuando exista acceso

Fuente: [BLS OEWS May 2025 tables](https://www.bls.gov/oes/tables.htm). Los enlaces de los ZIP están en esa página.

~~~bash
curl -fL --retry 3 -o oesm25st.zip https://www.bls.gov/oes/special-requests/oesm25st.zip
curl -fL --retry 3 -o oesm25ma.zip https://www.bls.gov/oes/special-requests/oesm25ma.zip
python3 scripts/research/test_oews_coverage.py
python3 scripts/research/oews_coverage.py \
  --state oesm25st.zip --metro oesm25ma.zip --out reports/oews-may2025
~~~

**Limitación actual:** las descargas ZIP oficiales no se completaron desde el entorno de análisis: el navegador rechazó el formato ZIP y el contenedor careció de conectividad. La alternativa secundaria WageDex tampoco se pudo descargar. Por tanto, aún NO existe importación oficial nacional ejecutada ni métricas reales de cobertura por los 24 oficios.

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
