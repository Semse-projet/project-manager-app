# T-005 — OEWS API, electricistas en 51 jurisdicciones (8-nov-2026)

**Clase de evidencia:** `RESEARCH_ONLY`, sin aprobación comercial ni tarifas productivas. Muestra transversal de una sola ocupación (`47-2111`, electricistas), `2025/A01`, mediana salarial horaria `datatype=08`, no observaciones de los 24 motores completos ni importación ZIP.

## Procedencia

- Jurisdicciones: [catálogo oficial BLS `oe.area`](https://download.bls.gov/pub/time.series/oe/oe.area), entradas `areatype=S`: 50 estados + DC. Tres territorios (`Guam`, `Puerto Rico`, `Virgin Islands`) se mantienen identificados pero **fuera de este alcance inicial de 51**.
- Ocupación y medida: [`oe.occupation`](https://download.bls.gov/pub/time.series/oe/oe.occupation), [`oe.datatype`](https://download.bls.gov/pub/time.series/oe/oe.datatype). Consulta individual: `OEUS{areaCode7}00000047211108` a [BLS Public Data API v2](https://api.bls.gov/publicAPI/v2/timeseries/data/OEUS120000000000047211108). Se comprobaron `Results.series[].seriesID`, `year=2025`, `period=A01`, `value` numérico positivo.
- Archivo de evidencia: [matriz 51 estados+DC](./cost-engine.t005-bls-api-electricians-51-jurisdictions-2026-11-08.csv). **15** respuestas con observación salarial auténtica; **36** series cuya respuesta fue `REQUEST_NOT_PROCESSED`. En verificaciones separadas de Wyoming y Hawaii el propio BLS explicó: *daily threshold for total number of requests allocated to the user with registration key has been reached*.
- **No interpretar una respuesta sin procesar como salario suprimido, cero, nulo definitivo ni ausencia de ocupación.** Las 36 celdas pendientes están vacías y el estado del servicio queda explícito.

## Resultado de la consulta (solo SOC 47-2111)

| Indicador | Cantidad |
|---|---:|
| Jurisdicciones objetivo, estados + DC | **51** |
| Respuestas verificadas `REQUEST_SUCCEEDED` con dato 2025/A01 | **15** |
| Solicitudes `REQUEST_NOT_PROCESSED` por límite diario BLS | **36** |
| Jurisdicciones con salario faltante demostrado por supresión | **0 demostradas** (no se evaluó cobertura de la cuota agotada) |
| Archivos ZIP estatales/metropolitanos auténticos importados | **0** |

Observaciones ejemplares: Alaska $43.00/h; California $36.62/h; Florida $27.52/h; Alabama $26.78/h; Georgia $28.04/h; Iowa $29.26/h; Distrito de Columbia $37.97/h. Estos valores son **salarios estadísticos de empleados**, no costo empresarial ni precio facturable.

## Separación de gates

1. Esta muestra es adicional al [CSV previo con 38 series](./cost-engine.t005-bls-api-median-sample-2026-11-08.csv): sus observaciones de Alabama, DC y Florida ya constaban allí. No sumar 15 como 15 observaciones nuevas sin deduplicar por `series_id`. El cotejo entre los dos CSV congelados confirmó **3 series compartidas y concordantes** (Florida, Alabama y DC), **12 observaciones nuevas distintas** en la segunda matriz, y **50 series salariales con dato distintas** en el conjunto (38 + 15 - 3 = 50). Las 36 respuestas de cuota no suman salarios. La prueba de invariantes del snapshot se incorpora al CI como validación estructural, sin consultas externas.
2. La cuota diaria BLS es un bloqueo de ejecución **verificado**, no un defecto de los códigos SOC ni una prueba de que OEWS omita estados. Reanudar la adquisición cuando se restablezca la cuota o importar los ZIP originales desde un entorno con acceso autorizado; no eludir la cuota mediante credenciales o vías alternativas sin autorización.
3. La muestra no valida `O_GROUP`, `NAICS` ni `OWN_CODE` del Excel bruto, ni su integridad SHA-256. Mantener el manifiesto offline `release_verified=false`.
4. Continúan pendientes los **14 conflictos de clasificación por oficio**, Q2/Q10/Q11, costos reales de cuadrillas, impuestos, derechos de datos y autorización humana. **No pasar el PR #1075 de DRAFT ni activar precios.**
