# Auditoría de completitud modular — 2026-07-17

## Resultado

Los nueve dominios oficiales tienen una superficie canónica completa: taxonomía,
catálogo/página pública, módulo NestJS montado, ruta API representativa y probe
de producción. `pnpm verify:modules` convierte esa relación en una compuerta de
CI; Production Health prueba además las nueve páginas y las nueve rutas.

“Completo” en este corte significa **módulo estructuralmente integrado y
operable**, no que todas las capacidades F0-F9 del roadmap estén terminadas. La
profundidad pendiente continúa en `architecture/IMPLEMENTATION_STATUS_MATRIX.md`
y no se presenta como funcionalidad disponible.

| Dominio | Probe API protegido | Página | Superficie | Profundidad pendiente declarada |
|---|---|---|---|---|
| SEMSE Core | `/v1/users` | `/modules/core` | LIVE | hardening de políticas/DID por fases |
| SEMSE Connect | `/v1/jobs` | `/modules/connect` | LIVE | agenda, dispatch y calendarios externos |
| SEMSE Payments | `/v1/payments/provider-readiness` | `/modules/payments` | LIVE | shared ledger y reconciliación integral |
| SEMSE Trust | `/v1/jobs/module-probe/trust` | `/modules/trust` | LIVE | policy central y explainability ampliada |
| SEMSE AI | `/v1/prometeo/tools` | `/modules/ai` | LIVE | write tools, binarios y video gobernados |
| SEMSE Agro | `/v1/agro/farms` | `/modules/agro` | LIVE | offline-first compartido y expansión F2-F5 |
| SEMSE BuildOps | `/v1/buildops/overview` | `/modules/buildops` | LIVE | agenda avanzada y promoción de código legacy seguro |
| SEMSE Knowledge | `/v1/knowledge/overview` | `/modules/knowledge` | LIVE | learning loop y gobierno formal de retención |
| SEMSE Integrations | `/v1/satellites/me` | `/modules/integrations` | LIVE | conectores adicionales según credenciales/proveedor |

## Conflictos cerrados en este corte

- El estado legacy `AWARDED` de Job se exponía como `COMPLETED`; ahora se
  presenta como `ACCEPTED`, evitando una finalización falsa.
- La FSM documental de Milestone no coincidía con el guard real. Código, specs,
  invariantes y tests ahora usan `DRAFT|AWAITING_REVIEW|REJECTED -> SUBMITTED`
  con evidencia; `APPROVED -> REJECTED` sigue permitido antes de `PAID`.
- Crear, aprobar, rechazar y pedir cambios en hitos ahora emite eventos canónicos
  validados. Submit/approve/reject/request-changes emiten también actualización
  SSE para que la UI no quede detrás del estado durable.
- Disputes documentaba `CANCELLED`, mientras Prisma persiste `ASSIGNED`,
  `UNDER_REVIEW`, `RESOLVED` y `REJECTED`. FSM, tipos visibles y tests quedaron
  alineados.
- `resolutionType` de disputa era opcional aunque determina el efecto financiero;
  ahora es obligatorio. El cliente dueño solo puede cerrar por acuerdo
  `pro_favor`; refund, split y escalamiento requieren OPS.
- La herramienta de resolución del Project Copilot exigía solo texto y podía
  omitir el efecto financiero. Su contrato, acción sugerida y ejecutor ahora
  requieren el mismo `resolutionType` explícito que la API.
- `dispute.evidence_submitted` y `dispute.under_review` se emitían sin existir en
  el contrato Zod. Ambos están registrados; asignación y resolución también
  producen eventos canónicos.
- Claims públicos de agenda, reconciliación, satélites y “escrow legal” se
  ajustaron al alcance realmente implementado.
- Los gaps P0 históricos de HMAC WhatsApp, lectura financiera por PRO, evidencia
  obligatoria y enum `EscrowStatus` se marcaron cerrados con evidencia ejecutable.

## Código en incubación, sin conflicto con producción

`weather`, `liens` y controladores de draws/lender de `escrow` no están montados.
Dependen de contratos Prisma retirados o de ownership/permisos aún no cerrados.
Mantenerlos fuera de `AppModule` es una cuarentena deliberada: no deben promoverse
para aparentar completitud ni introducir rutas que fallen en runtime.

## Verificación requerida antes del cierre

- `pnpm verify:modules`
- build de `@semse/schemas`, `@semse/api` y `@semse/web`
- suite unitaria completa de API
- `pnpm spec:validate -- --strict` y `pnpm spec:coverage`
- CI de GitHub verde sobre el SHA del cambio
- Railway Deploy verde sobre el mismo SHA
- Production Health verde con 18 probes modulares (9 API + 9 web)

## Cierre verificado

- PR de implementación: `#320`, fusionado en `92eb9ea1b29c8efb2275e6549a093283a4506e11`.
- `main` desplegado al cierre: `646528c64cfb774c74bef119522d73b1b2578bd8`;
  `git merge-base --is-ancestor` confirma que contiene el merge `92eb9ea`.
- CI del PR: quality-gates, E2E, unit coverage, integración, CodeQL,
  autonomy-staged y operación asistida en `SUCCESS`.
- Railway Deploy: run `29598805544`; worker, API, web y vision confirmados en
  `SUCCESS` para el SHA exacto `646528c`.
- Production Health: run `29599005110`; API health verde, nueve páginas de
  módulo con HTTP `200` y nueve probes API protegidos con HTTP `401`.
- Comprobación HTTP directa posterior al workflow: mismo resultado 9/9 web y
  9/9 API, sin `404` ni `5xx`.

Estado final del corte: **completitud estructural 9/9 y producción verde**. Las
capacidades de profundidad que siguen parciales permanecen declaradas como
roadmap y no bloquean ni se presentan como completas.
