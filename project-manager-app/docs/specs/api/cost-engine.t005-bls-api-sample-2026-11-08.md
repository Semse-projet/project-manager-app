# T-005 — Observaciones oficiales BLS OEWS May 2025, muestra API (8-nov-2026)

**Estatus:** evidencia observada de API pública, `RESEARCH_ONLY`, no ZIP XLSX importado y **sin autorización de precios comerciales**. PR #1075, mismo `docs/cost-engine-spec`. Fecha de recuperación: **2026-11-08**.

## Origen y validación realizada

- **Fuente primaria:** [BLS Public Data API v2](https://api.bls.gov/publicAPI/v2/timeseries/data/OEUS120000000000047211108), `/timeseries/data/{seriesID}`. Para cada entrada se verificó que la respuesta fuese `REQUEST_SUCCEEDED`, que `Results.series[0].seriesID` coincidiese con la solicitud y que existiese una observación `year=2025`, `period=A01` y un valor horario numérico positivo.
- Serie OEWS: `OEU` + tipo geográfico `S` (estado) o `M` (metro/no metro) + código geográfico BLS de **7 caracteres** + industria `000000` + SOC 2018 de **6 dígitos** + tipo `08` (**mediana salarial por hora**). Referencias: [estructura de series BLS](https://download.bls.gov/pub/time.series/oe/oe.txt), [códigos de medida](https://download.bls.gov/pub/time.series/oe/oe.datatype), [áreas](https://download.bls.gov/pub/time.series/oe/oe.area).
- **Archivo de evidencia:** [CSV de 38 observaciones](./cost-engine.t005-bls-api-median-sample-2026-11-08.csv), con `series_id` y enlace individual a la respuesta oficial, sin datos inventados ni agregaciones de SOC.

## Resultados comprobados

| Alcance | Resultado | Interpretación |
|---|---:|---|
| Florida, códigos SOC distintos de `scripts/research/oews_coverage.py` | **32/32** con `A01, 2025, tipo 08` | Todas las referencias individuales candidatas de este estado devuelven mediana horaria en la API |
| Florida, motores con todos sus códigos candidatos observados | **24/24** | Cobertura de **muestra estatal por API**, no aprobación ocupacional ni de importación ZIP |
| Observaciones adicionales en Alabama, DC y cuatro áreas metropolitanas | **6** | Contraste territorial del mismo SOC `47-2111`, sin inferir costo total o precio |
| Total respuestas con dato de 2025 | **38/38** | No demuestra 51 × 24, ni ZIP/autenticidad del XLSX, ni exhaustividad nacional |

## Muestra de medianas horarias (USD, sin ajustes)

| Ámbito | SOC | Mediana 2025 |
|---|---|---:|
| Florida | `47-2111` Electricistas | **$27.52/h** |
| Florida | `47-2152` Plomeros | **$25.44/h** |
| Florida | `49-9021` Técnicos HVAC | **$27.24/h** |
| Florida | `47-2031` Carpinteros | **$23.98/h** |
| Florida | `47-2141` Pintores | **$22.85/h** |
| Florida | `47-2061` Obreros de construcción | **$21.17/h** |
| Alabama | `47-2111` Electricistas | **$26.78/h** |
| Distrito de Columbia | `47-2111` Electricistas | **$37.97/h** |
| Miami (metro) | `47-2111` Electricistas | **$28.19/h** |
| Pensacola (metro) | `47-2111` Electricistas | **$24.28/h** |
| Tallahassee (metro) | `47-2111` Electricistas | **$26.00/h** |
| Mobile (metro) | `47-2111` Electricistas | **$29.68/h** |

## Alcance y límites obligatorios

1. **Fuente de API distinta del archivo ZIP:** los valores observados provienen de las series públicas de OEWS 2025, no de los ZIP `oesm25st.zip` o `oesm25ma.zip`. No se inspeccionaron hojas internas, no hay hashes ZIP oficiales validados, no se cruzaron los 51 estados ni todos los metros. El manifiesto del lector offline debe seguir mostrando `release_verified=false` hasta una importación ZIP autenticada.
2. **Sin precios de venta:** medianas de empleados ≠ salarios contratados por SEMSE, remuneraciones reales de cuadrilla, carga patronal, productividad, margen, impuestos ni tarifa facturable. No promediar los SOC por motor ni asumir que son el presupuesto del trabajo.
3. **Diferencias SOC:** el catálogo operativo de 24 motores utilizado para el muestreo sigue siendo candidato. Las **14 discrepancias** documentales de [T-005x](./cost-engine.t005-soc-crosswalk-reconciliation-2026-11-07.md) permanecen sin revisión profesional, aun cuando los 32 SOC existan y tengan salario referencial en Florida.
4. **Reproducibilidad:** el CSV contiene la URL oficial consultable por serie. Los datos congelados se comparan con la fuente antes de reusarse y no habilitan ingestión automática en producción; conservar respuestas originales y metadatos en una ejecución posterior que pueda acceder a ambos ZIP.

**Decisión:** T-005 queda con evidencia salarial **parcial y real para Florida**, pero la importación nacional, los gates Q2/Q10/Q11 y la aprobación comercial siguen **pendientes**. El PR #1075 permanece **DRAFT**.
