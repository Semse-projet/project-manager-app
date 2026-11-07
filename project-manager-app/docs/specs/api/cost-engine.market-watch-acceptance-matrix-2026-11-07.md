# Matriz de aceptación — agente residente de vigilancia de mercado (MW-01..MW-24)

**Fecha:** 2026-11-07 · **Estado:** `DRAFT / TODOS LOS CASOS NO EJECUTADOS` · **Documento padre:** [diseño del observador](./cost-engine.market-watch-agent-design-2026-11-07.md).

Esta matriz prepara pruebas de integración/seguridad y *oráculos independientes*. No equivale al diagnóstico T-004 del #1076 (72 escenarios instrumentados). Ninguna prueba se marca PASS antes de ejecutarla contra el SHA y entorno correctos.

| ID | Escenario | Resultado exigido / oracle | Fase |
| --- | --- | --- | --- |
| MW-01 | Flag global ausente o `false` | Cero jobs/extracciones/efectos; API/estimados idénticos. | A |
| MW-02 | Scheduler activo, varias réplicas worker | Un run lógico por ventana/fuente/alcance; lease e idempotencia. | A |
| MW-03 | Reinicio y reintento del mismo release | No duplicar observación ni renovar vigencia incorrectamente. | A |
| MW-04 | API BLS 500/timeout/retorno vacío | Ningún snapshot `BLS_PPI` nuevo o renovado como verificado; candidato con fallo. | A / #1101 |
| MW-05 | BLS retorna índice=0, NaN, negativo, serie incompatible o período sin base | Rechazar `UNVERIFIED`/`PPI_UNAVAILABLE`; sin inventar índice 100. | A / T-008 |
| MW-06 | Índices 120→126 con precio observado autorizado $100 | Oráculo sintético de ajuste = $105, sin presentar como precio de mercado. | C / T-008 |
| MW-07 | PPI no contiene precio base observado o derechos | Solo `INDEX_ONLY`, `amountDecimal=null`. | A |
| MW-08 | OEWS con SOC/región/edición y celda suprimida | Guardar benchmark o `null`, jamás tarifa facturable proxy. | A |
| MW-09 | Página pública de tienda sin contrato de extracción | Sin crawling automatizado ni promoción comercial; `NEEDS_EVIDENCE`. | A |
| MW-10 | Cotización consentida de tienda para una obra privada | Solo scope de obra, sin catálogo global; revocación aplicable. | B |
| MW-11 | Licencia OEM expirada, revocada o sin uso SaaS | Rechazo/retención según contrato, sin nuevas cotizaciones. | B |
| MW-12 | SKU distinto, UOM ambigua (galón/pie², rollo/pie²) | `NOT_COMPARABLE` hasta equivalencia/normalización revisada. | B |
| MW-13 | Sin ubicación/condado/fecha de precios | `PRELIMINARY_ONLY`, sin precio comercial confirmado. | B |
| MW-14 | Proveedor/tenant A vs usuario B | 403/404 sin filtrar existencia ni valores de cotización de otro tenant/org. | B |
| MW-15 | Cliente consulta estimado | JSON no expone rights docs, márgenes, licencias privadas ni `costReplay` interno. | B |
| MW-16 | Texto remoto contiene instrucciones para agente/LLM | Contenido tratado como dato no confiable; sin ejecución ni secretos expuestos. | A |
| MW-17 | SSRF/redirección a metadata de nube o IP privada | Bloqueo antes del request y error auditado sin datos sensibles. | A |
| MW-18 | Demasiados requests/conexión lenta | Rate limit, circuit breaker, timeout, backoff, DLQ y alertas sin afectar API. | A |
| MW-19 | Fuente sin `TaxPolicy` revisada | `taxStatus=UNDETERMINED`, `customerTaxAmount=null`, no tasa 7% implícita. | C/Q10 |
| MW-20 | Revisión humana aprueba evidencia con valores/versiones fijos | Approval enlazada al hash, permisos, scope y expiración; al cambiar fuente caduca la aprobación. | B |
| MW-21 | Nuevo precio aprobado después de presupuesto aceptado | Sin cambio de estimado/contrato/hito/escrow; revisión nueva explícita. | C/Q5 |
| MW-22 | Replay de estimado con precios y mapping actuales distintos | Replay histórico sin red desde operandos congelados: cada importe exacto o error tipado. | C/T-004b |
| MW-23 | `wastePercent` de concrete vs masonry; `crewSize` 1/20/21 | Unidades explícitas y capacidad multi-oficio; no pasar defectos #1085/#1086 por alto. | C |
| MW-24 | Canary, datos de precio inválidos o rollback | Kill switch desactiva sin corromper evidencia; auditoría de SHA, métricas, derechos y estado en Railway. | C |

## Criterio de salida por etapa

- **A (observación):** MW-01..09, MW-16..18 y evidencia de que el código económico/estimados no recibió escrituras; revisión de seguridad, derechos y límites de egress.
- **B (evidencia y aprobación):** MW-10..15 y MW-20, contratos de licencia y revisión humana; almacenamiento versionado y minimización de PII.
- **C (uso por motor):** MW-06, MW-19, MW-21..24 más todos los gates Q2/Q3/Q5/Q7/Q9/Q10/Q11, 24×3 golden independientes, protección de consumidores y modo sombra revisado; CI, merge, deploy y canary separados.

## Evidencia por test cuando llegue a ejecutarse

`testId`, entrada sintética o autorizada, oráculo **independiente** (no derivado de función bajo prueba), resultado esperado/observado, commit/PR, entorno, fecha, revisión humana, versión y derechos de fuente, scope/tenant ficticio, resultado y enlace a logs sin secretos. No usar el `math exact 72/72` del T-004 como certificado comercial, fiscal o de licencia.
