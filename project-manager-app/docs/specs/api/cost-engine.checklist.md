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

## Validación comercial independiente

- [ ] T-005 respalda materiales, mano de obra facturable, rendimientos, multiplicadores, márgenes y vigencia de fuentes con validación por oficio/región
- [ ] Q9 revisada por especialistas, Q10 revisada por profesional fiscal y Q11 acredita procedencia, fecha y derechos de uso de precios
- [ ] La aceptación matemática no se usa para certificar precios ni legalidad fiscal; aprobación de spec, implementación y activación tienen gates distintos

## Seguridad

- [ ] Permisos por capa se validan en backend
- [ ] `platformFeeRate` y `TaxPolicy` no se pueden escribir desde capas inferiores
- [ ] Doble control: solicitante distinto del aprobador, reautenticación reciente, aprobación ligada a valores y versión
- [ ] `pricing:org:manage` exige `Membership` activa de esa organización
- [ ] Contratista y organización no leen ni escriben datos de otros tenants u organizaciones
- [ ] Los márgenes del contratista no se exponen al cliente (prueba negativa sobre el JSON)
- [ ] Límites, motivo ≥ 10 caracteres y auditoría en todo cambio
- [ ] No hay secretos ni PII en logs/evidencia

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
