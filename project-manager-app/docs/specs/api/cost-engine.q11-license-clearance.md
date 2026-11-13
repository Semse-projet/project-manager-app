# Q11 — Control de derechos y expediente para revisión jurídica

**Corte de investigación:** 2026-11-05  
**Estado:** `PUBLIC_TERMS_REVIEWED / SEMSE_RIGHTS_NOT_PROVEN / EXTERNAL_COUNSEL_REQUIRED`  
**PR:** #1075. Ningún asesor jurídico ha aprobado estas fuentes; ningún documento constituye licencia o dictamen de SEMSE.

## 1. Matriz de utilización por familia

| Fuente | Evidencia revisada | Uso técnico propuesto | Estado comercial para SEMSE | Evidencia faltante |
|---|---|---|---|---|
| **BLS PPI** | [Guía oficial de ajuste](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm) y [términos de API](https://www.bls.gov/developers/termsOfService.htm) | Índices observados por serie, mes y edición para medir **variación relativa** | `INDEX_ONLY / NO_USD_PRICE_CERTIFICATION`. Su reutilización debe cumplir atribución, fecha de acceso y términos BLS | Mapeo serie/material, fecha de base, versión de índice, análisis de producto y atribución |
| **BLS OEWS** | [Conceptos OEWS](https://www.bls.gov/opub/hom/oews/concepts.htm), [FAQ](https://www.bls.gov/oes/oes_ques.htm) | Referencia salarial estadística por oficio/área y fecha, **no** costo total de contratación ni tarifa de venta | `STATISTICAL_CONTEXT_ONLY` | Beneficios, impuestos patronales, seguros, supervisión, traslado, carga total, acuerdo del contratista |
| **RSMeans Online / Gordian** | [Acuerdo público](https://www.rsmeansonline.com/Content/RSMeansOnlineUserAgreement.pdf), en el archivo revisado: **Last Updated March 16, 2026**, **Addendum 1, §2.2**, p.14; se revisó el texto y página de PDF | **Ninguna incorporación nueva** de precios o multiplicadores al SaaS sin autorización escrita aplicable | `RESTRICTED_LICENSE / SOURCE_ORIGIN_UNPROVEN` | Contrato suscrito por la entidad SEMSE, derechos explícitos de API/SaaS, almacenamiento, derivados, redistribución, retención y revocación; investigación de origen |
| **Trimble / RSMeans dentro de Trimble** | [Addendum / términos del producto](https://www.trimble.com/downloads/5b7enCv3RLz3iPG00pKPQT/92cf06f5642fff215e58dcab4df775a6/RSMeans_License_Agreement.pdf) citado en el expediente previo | **No presumir que es licencia de SEMSE** | `CONTRACT_UNKNOWN` | Producto, versiones, contrato real y revisión jurídica |
| **Cotización propia de proveedor** | Ninguna cotización presentada aquí | Costo privado del cliente/contratista con unidades, fechas, derechos, vigencia y consentimiento | `NO_QUOTE_OBTAINED` | Cotización emitida, quién es titular, permiso de exhibición/derivación a terceros, PII y consentimiento |
| **Factura real de obra** | Ninguna factura proporcionada para T-005 | Evidencia privada de costo de compra/reconciliación, únicamente con permiso de uso, no réplica de catálogo ajeno | `NO_RECEIPT_OBTAINED` | Factura, monto/condado, impuestos/entrega, autorización del titular y controles de acceso |
| **Precios internos del código** | `BLS_SERIES` (12 precios), `STATIC_MATERIAL_MULTIPLIERS`, constantes de motores y ProTools | Solo *golden tests*, compatibilidad, diagnóstico y auditoría de lo heredado | `LEGACY_UNVERIFIED` | Origen, derechos, fecha, validación por oficio/mercado |

### Texto de la restricción de RSMeans

El acuerdo público de Gordian (Addendum 1 §2.2) restringe la mezcla de datos de estimación con software, su conservación en bases consultables y su uso en productos vendidos o redistribuidos, salvo términos o permiso escrito aplicable. Esto es suficiente para **no asumir permiso de integración SaaS**. **No** es evidencia de que los números existentes de SEMSE hayan sido copiados, ni de que SEMSE sea parte contratante de ese acuerdo. No hacer verificaciones de similitud descargando datos RSMeans sin asesoramiento y derechos adecuados.

**Corrección de fuente verificada:** al contrastar la página 13 (numeración PDF; página 12 en índice cero) del PDF oficial `RSMeansOnlineUserAgreement.pdf`, el acuerdo SaaS y su Addendum 1 indican **Last Updated: March 16, 2026**. La mención previa a mayo de 2025 para **este PDF concreto** fue errónea y queda rectificada. Es una versión pública de términos, **no** una licencia suscrita por SEMSE ni prueba del origen de sus multiplicadores.

## 2. Autorización específica requerida a cualquier proveedor de datos de precio

La mera compra de materiales o una captura del precio público de una tienda **no** transfiere automáticamente permiso de explotación de su catálogo a un marketplace SaaS.

```yaml
ProviderDataRightsEvidence:
  providerLegalName: REQUIRED
  agreementOrGrantId: REQUIRED
  grantorAuthorizedSignatory: REQUIRED
  granteeLegalEntity: SEMSE_LEGAL_ENTITY_TO_CONFIRM
  permittedPurposes:
    - INTERNAL_ESTIMATE
    - CUSTOMER_QUOTE
    - SAAS_MULTI_TENANT
    - DERIVED_UNIT_PRICES
    - AUDIT_AND_HISTORICAL_REPLAY
  redistributionAllowed: TRUE_FALSE
  storingRawDataAllowed: TRUE_FALSE
  storingDerivedDataAllowed: TRUE_FALSE
  apiCachingAllowed: TRUE_FALSE
  regionAndProductScope: REQUIRED
  durationAndTermination: REQUIRED
  revocationAndRetentionRules: REQUIRED
  attributionAndNotices: REQUIRED
  consentOrDataOwnershipProof: REQUIRED
  piiProtectionReview: REQUIRED
  legalReviewer: EXTERNAL_NAME_MISSING
  reviewerApprovalDate: null
  signedEvidenceRef: null
  status: PENDING_LEGAL_APPROVAL
```

- **Comprobante de cliente**: puede servir como evidencia de un costo puntual y su fecha sin autorizar reproducción de la lista comercial del proveedor. Evaluar titularidad, términos, PII y finalidad.
- **Contrato comercial/licencia RSMeans**: exigir **autorización expresa por escrito para SEMSE** con derechos de integración, hosting, caché, derivados, SaaS multi-tenant y aparición en estimados; ausencia de tal autorización ⇒ `RESTRICTED_LICENSE`.
- **BLS**: consultar las condiciones públicas del servicio, guardar `retrievedAt` y la advertencia de que BLS no certifica análisis derivados; no insinuar afiliación ni usar logos sin derecho.
- **Origen desconocido**: bloquear para nueva cotización comercial, pero no borrar historial / logs hasta que el asesor defina conservación y mitigación.

## 3. Preguntas concretas que debe contestar Legal

1. ¿La tabla `STATIC_MATERIAL_MULTIPLIERS` proviene realmente de RSMeans o de estimaciones propias/IA? ¿Cómo documentar H1/H2/H3 sin descargar datos restringidos?
2. ¿Existe licencia vigente o anterior de RSMeans/Trimble/Gordian **a nombre de la entidad que opera SEMSE**, con autorización de integración SaaS?
3. ¿Qué derechos y límites de retención se exigen para cotizaciones de proveedores, facturas aportadas y datos derivados por contratistas/clientes?
4. ¿Qué uso histórico debe investigarse antes de neutralizar la tabla y qué evidencia preservarse (código, deploy, ejecución, caché, cotizaciones publicadas)?
5. ¿Qué alternativa a índices propietarios permite datos regionales comercialmente defendibles sin infringir términos?
6. ¿Qué elementos de UI, API, export y contrato deben mostrar licencias y procedencia, incluidos avisos de revocación y derecho de corrección?

## 4. Resultado de la revisión y decisión (rellenable por un profesional real)

| Campo | Resultado |
|---|---|
| Responsable legal / firma / número de expediente | **PENDIENTE** |
| Contrato SEMSE inspeccionado, versión y entidad | **PENDIENTE** |
| Veredicto H1/H2/H3 y grado de evidencia | **PENDIENTE** |
| Derechos BLS / proveedores / Gordian documentados | **PENDIENTE** |
| Política de retiro/preservación aprobada | **PENDIENTE** |
| Fecha, firma, alcance y restricciones de aprobación | **PENDIENTE** |

**Criterio para cerrar Q11:** veredicto escrito de Legal sobre lo que realmente usa SEMSE; registro de fuente y permiso de uso por cada dato habilitado; test que prohíba cotización con `UNKNOWN/RESTRICTED/EXPIRED/REVOKED`; revisión de privacidad y firmas del owner. Sin esos elementos, **no** declarar `Q11=DECIDIDA` ni `APPROVED`.
