---
type: checklist
feature: "localization-architecture"
spec: "docs/specs/ui/localization-architecture.spec.md"
version: "2.0"
date: "2026-10-26"
---
# Checklist: Internacionalización ES/EN

**Estatus:** pendiente de D1–D7; no representa tests ejecutados ni aprobación de publicación.

**Fuente revalidada 2026-10-27:** paridad textual 1,182/1,182 ES/EN sin duplicados detectados; la cookie SSR de idioma y la prueba unitaria ya existen. Evidencia y límites en [analyze](localization-architecture.analyze.md) y [ADR-046](../../architecture/ADR-046-semse-ui-localization-runtime.md). Esto no cierra V01–V06, L01–L12 ni el gate de implementación.

## Requisitos y decisiones
- [x] Problema, scope, exclusiones, roles y escenarios P1 documentados.
- [x] Contratos de UI/API y frontera Prometeo privados distinguidos.
- [ ] Ratificar D1 runtime y elevar [ADR-046 PROPOSED](../../architecture/ADR-046-semse-ui-localization-runtime.md) a ACCEPTED tras spike comparativo.
- [ ] Ratificar D3 fallback y D4 de cuenta (cookie de navegador con SSR ya existe; verificar alcance multiusuario y decidir si hace falta sincronización entre dispositivos/migración).
- [ ] Ratificar D2/D5/D6/D7 sin exposición externa implícita.

## Validadores propuestos (todos pendientes de implementación)
- [ ] V01 Duplicados reales (no Set), sintaxis AST/JSON y claves ES/EN.
- [ ] V02 Placeholders idénticos por nombre/tipo y ICU plural/select correctos.
- [ ] V03 Mensajes vacíos/hardcoded, acceso de fallback crítico, markup/links seguros.
- [ ] V04 SHA-256 fuente y revisión invalidada cuando cambia source/glosario.
- [ ] V05 Clasificación de riesgo y traducciones críticas con revisor/fecha/versionado.
- [ ] V06 Reporte de cobertura de rutas, no sólo igualdad de cantidad de claves.

## Matriz de pruebas L01–L12 (todos NO EJECUTADOS)
| ID | Prueba obligatoria | Evidencia futura |
|---|---|---|
| L01 | Wizard 4 pasos ES y EN | Screenshots + test Playwright |
| L02 | Cambio ES↔EN en pasos 2/3, adjuntos y draft persistente | Estado antes/después y reintento |
| L03 | Importe 1250.50 USD, minor units y currency idénticos | Payload request snapshot |
| L04 | Fecha límite y zona horaria/fecha de negocio inalteradas | Comparación de date-only/UTC |
| L05 | Errores backend y presupuesto IA seguros y traducidos | Fixtures de carga/error |
| L06 | Concurrencia sesiones A/B ES/EN, no cross-org/tenant | Tests auth y cabeceras |
| L07 | Sesión expirada, URLs prefill, no POST duplicados | Capturas de red y rutas |
| L08 | Pseudo 320–390px, keyboard, aria y overflow | Capturas viewport + AX |
| L09 | Clave duplicada, placeholder roto, ICU o digest vencido | Fixture negativa de CI |
| L10 | No traducir/filtrar originales Prometeo sin ACL | Negativas org A/B y #974/#987 |
| L11 | Evidencia/hito/pago, `canRelease`, roles y estados iguales | Antes/después de payload y guard |
| L12 | Rollback catálogo y runtime aprobado | Versiones/hash + smoke funcional |

## Seguridad y economía
- [ ] Auth backend intacta; locale no da permiso.
- [ ] Same-tenant cross-org, cross-tenant, proyecto y ACL de cada lectura negativa si se habilita derivado.
- [ ] No secretos, PII ni contenido del usuario en recursos o logs de traducción.
- [ ] No cambiar ledger, importe, moneda, evidencia aprobada, firma ni escrow.
- [ ] Revisión bilingüe humana y legal separada de aprobación técnica.
- [ ] DEC-PLATFORM-001 aplicado al riesgo real de cada PR.

## Entrega / Analyze gate
- [ ] Completar análisis final spec↔plan↔tasks y ADR-046 contra constitución y resolver gaps; [análisis histórico/actualizado](localization-architecture.analyze.md).
- [ ] CI del HEAD **final** verde con logs verificables. El fallo documentado del head anterior fue índice de specs desincronizado (206 specs); no afirmar arreglo sin reejecución final.
- [ ] Smoke autenticado ES/EN por rol (no reemplazable por e2e estático).
- [ ] Revisión automatizada sin hallazgos bloqueantes y aprobación del propietario con SHA.
- [ ] Canary/rollback de cambios ejecutables autorizado y verificado aparte.
- [ ] `production_evidence` real y metadata sin estados inventados.
