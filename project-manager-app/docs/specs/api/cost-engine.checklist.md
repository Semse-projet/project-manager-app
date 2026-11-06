---
type: checklist
feature: "Motor de costos unificado"
spec: "docs/specs/api/cost-engine.spec.md"
version: "2.0"
date: "2026-10-30"
---

# Checklist: Motor de costos unificado

## Requisitos

- [x] Cada escenario P1–P5 es verificable
- [x] Scope y no-objetivos evitan ambigüedad
- [ ] Q2, Q3, Q5, Q7, Q9, Q10 y Q11 resueltas; Q1, Q4, Q6 y Q8 confirmadas (bloquea `APPROVED`)
- [ ] Alineada con ADR-027
- [ ] API/UI contracts no se contradicen (revisar tras Q1, Q4 y Q6)

## Contrato de reproducibilidad (evidencia #1076)

- [x] T-004 documenta 72/72 cálculos reproducibles con argumentos instrumentados, y diferencia la aritmética de la corrección comercial
- [x] La spec prohíbe inferir tasas y `perUnitDivisor` de importes redondeados (42/72 exactos por ese método, 57/66 divisores distintos)
- [ ] El contrato interno define `costs.basis`, `effectiveRates`, `perUnitDivisor`, unidad, precisión, redondeo, ausencia de `perUnit` y filtrado de privacidad
- [ ] Existe un plan de golden tests independientes para 24 motores × 3 escenarios, con valores esperados revisados por separado del ejecutor
- [ ] La implementación aditiva reproduce 72/72 sin instrumentación, con 0 centavos de diferencia, y preserva 66/66 divisores reales y el JSON antiguo (**gate posterior a aprobación de spec**)
- [ ] Casos de sobreescritura por capas, invalidación, extremos, fallo y cotización/contrato/escrow inmutable definidos y probados según su fase
- [ ] Los defectos de unidad [#1085](https://github.com/Semse-projet/project-manager-app/issues/1085) y de cuadrillas [#1086](https://github.com/Semse-projet/project-manager-app/issues/1086) tienen pruebas independientes y no bloquean el diagnóstico T-004 (sí la activación de los flujos afectados)

- [ ] Overrides no predeterminados regeneran `priceBands`, explicaciones, programación de hitos y financiación desde el costo recalculado; un adaptador incompleto rechaza el override, sin totales divergentes
- [ ] El `costReplay` histórico persiste inputs normalizados, versiones, operandos/precios congelados, regla fiscal, redondeo y revisión inmutable; replay después de cambiar precios/mapeos reproduce todos los importes al centavo
- [ ] Casos de modificación concurrente `PUT`/`DELETE` validan `expectedVersion`/`If-Match` con 409 y precondición faltante con 428

## Expedientes de aceptación T-005 (datos, licencias y fiscalidad)

- [x] **Inventario técnico inicial**: 12 claves de `BLS_SERIES` más 24/24 motores por oficio auditados por modo de fuente y componentes fiscales. 22 declaran 7 %/5 % y 2 los heredan del módulo central; 9 usan `priceOf` con respaldo. Todos los importes siguen `UNVERIFIED`. [Registro de adquisiciones](./cost-engine.t005-pricing-evidence-register.md).
- [x] **Matriz de licencias**: BLS para índice/estadística, RSMeans/Gordian `RESTRICTED_PENDING_LEGAL`, cotizaciones privadas `RIGHTS_UNKNOWN` hasta contrato. [Expediente Q11](./cost-engine.q11-license-clearance.md).
- [x] **Paquete fiscal de revisión**: matrices FL/GA con casos específicos, fuentes DOR y `UNDETERMINED` mientras no exista dictamen. [Expediente Q10](./cost-engine.q10-fiscal-professional-review.md).
- [x] **Correcciones de referencias**: PDF público RSMeans Online verificado visualmente como March 16, 2026 (la atribución a mayo 2025 era errónea); PDF accesible FL GT-800007 R.03/15 y guía actual de DOR (no declarar R.08/22 comprobada).
- [ ] **Datos comerciales verdaderos**: permisos, facturas/cotizaciones fechadas y comparables de proveedores para pilotos pintura y drywall; origen, SKU, unidad, condado, precio sin impuesto, flete, tax-paid, vigencia y responsable que revisó.
- [ ] **Dictamen de licencias**: asesor jurídico externo valida derechos efectivos de proveedor y origen de la tabla de multiplicadores atribuida a RSMeans; certifica o rechaza uso multi-tenant/SaaS por fuente y el tratamiento del histórico.
- [ ] **Dictamen fiscal**: profesional cualificado en FL/GA revisa versión normativa, clasificación de tipos de contrato, redondeo, surtax, sales/use tax, tratamiento de comisiones e impuestos de compras pagados; firma los casos y oráculos numéricos independientes.
- [ ] **Aprobación comercial**: margen, overhead, labor burden, tarifas y comisión por oficio/región y contrato sustentados por costos reales conciliados y finanzas.
- [ ] **Puerta de seguridad**: cualquier nueva cotización con precio `UNKNOWN`, `RESTRICTED` o sin clasificación fiscal vigente queda `PRELIMINARY_ONLY`; pruebas negativas y replay en staging, sin reescribir contratos/escrow.

## Validación comercial independiente

- [x] **Alternativas de DISEÑO seleccionadas:** [política comercial y fiscal 2026-11-05](./cost-engine.commercial-fiscal-policy-2026-11-05.md) (Q9/Q10/Q11 + Q2/Q3/Q5/Q7). Esta casilla no certifica precios ni impuestos.
- [ ] **Q9** pilotos pintura interior/drywall: rangos/medidas tipadas, `UNKNOWN` honesto y tablas aprobadas por especialista (sin dar total definitivo con entradas faltantes).
- [ ] **Q11** ninguna fuente `LEGACY_UNVERIFIED`/`RESTRICTED_LICENSE` pasa a cotización comercial; auditar multiplicadores atribuidos a RSMeans, permiso SaaS, SKU/precio observado y fecha; PPI es índice, OEWS es salario, ninguno precio unitario facturable.
- [ ] **Q10 clasificación obligatoria:** propertyTreatment, contractPricing, lugar/condado, dueño de materiales, título/riesgo, tax-paid y `TaxPolicy` fechada; no usar 7 % general, nunca cobrar al cliente impuestos de materiales ya incluidos en costo.
- [ ] **Q10 fail-closed:** sin política revisada, `taxStatus=UNDETERMINED`, `customerTaxAmount=null` (no cero), subtotal preliminar con advertencia; no total `tax included`.
- [ ] **Q10 casos fiscales profesionales:** 10 escenarios FL/GA firmados por CPA/asesor competente, incluyendo real property vs retail + instalación, use-tax, condados/surtax/redondeo, con bases e importes esperados.
- [ ] **Q2/Q3:** ninguna confianza `HIGH` por completar preguntas; defaults de márgenes/comisión `LEGACY_UNVERIFIED` sin evidencia de mercado, muestras o aprobación financiera.
- [ ] **Q5/Q7:** borradores `STALE` con motivo y regeneración explícita; modo sombra → pilotos → canary por gates evidenciados, sin recálculo de aceptados.

- [ ] T-005 respalda materiales, mano de obra facturable, rendimientos, multiplicadores, márgenes y vigencia de fuentes con validación por oficio/región
- [ ] Q9 revisada por especialistas, Q10 revisada por profesional fiscal y Q11 acredita procedencia, fecha y derechos de uso de precios
- [ ] La aceptación matemática no se usa para certificar precios ni legalidad fiscal; aprobación de spec, implementación y activación tienen gates distintos

- [ ] Una política fiscal que grava solo materiales aplica tasa y base por componente, excluye labor, overhead, ganancia y comisión cuando así lo dispone; comprobar fixture sintético USD 191 vs aplicación global indebida USD 196.10

## Seguridad

- [ ] Permisos por capa se validan en backend
- [ ] `platformFeeRate` y `TaxPolicy` no se pueden escribir desde capas inferiores
- [ ] Doble control: solicitante distinto del aprobador, reautenticación reciente, aprobación ligada a valores y versión
- [ ] `pricing:org:manage` exige `Membership` activa de esa organización
- [ ] Contratista y organización no leen ni escriben datos de otros tenants u organizaciones
- [ ] Los márgenes del contratista no se exponen al cliente (prueba negativa sobre el JSON)
- [ ] Límites, motivo ≥ 10 caracteres y auditoría en todo cambio
- [ ] No hay secretos ni PII en logs/evidencia

- [ ] Auditoría Q2/Q0: con `min_cell=5`, claves de contrato con 1–4 casos no se emiten; valores inválidos del umbral no devuelven datos; SQL y EXPLAIN validados en DB aislada, sin divulgar resultados

## Datos y eventos

- [ ] Migración aditiva y reproducible (fase 3)
- [ ] Rollback definido: apagar flags y borrar filas
- [ ] Sin eventos de dominio nuevos; `AuditLog` con before/after
- [ ] Los estimados guardados no cambian al leerse

## Evidencia y dinero

- [ ] Cambios de comisión e impuesto no alteran contratos, hitos ni escrow existentes
- [ ] Aprobación reforzada para parámetros con impacto en pagos
- [ ] El recalculo externo reproduce cada uno de los 24 motores y conserva sus márgenes propios (tests golden)
- [ ] `quote-engine` y `contractor-estimate` coinciden con el servicio
- [ ] Sin 7 % universal: política fiscal versionada y revisada
- [ ] Metodología PPI corregida (índice de la fecha del precio base)
- [ ] Costo interno, precio de venta y obligación de pago separados; estimados aceptados inmutables

## Entrega

- [ ] Tests, build, typecheck y lint pasan
- [ ] CI, merge, deploy y activación tienen evidencia separada
- [ ] Modo sombra con informe revisado antes de activar
- [ ] El healthcheck no sustituye el smoke funcional en Chrome
- [ ] `production_evidence` no contiene secretos

## Documentación

- [ ] Spec index regenerado (`pnpm spec:index`)
- [ ] API surface actualizada con `/v1/pricing/cost-parameters`
- [ ] ADR de las decisiones clave
- [ ] Investigación externa y decisiones registradas
