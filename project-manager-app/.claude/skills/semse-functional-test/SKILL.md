---
name: semse-functional-test
description: Probar flujos reales de SEMSE con un plan por flujo, casos límite y negativos, roles OPS_ADMIN, cliente y profesional, idioma ES/EN y aislamiento entre organizaciones, usando el Playwright existente y reportando bugs con severidad S1–S4 y evidencia reproducible. Delega journeys F01–F36 en semse-business-flow-e2e y los datos en semse-synthetic-test-data.
routing:
  version: 1
  category: support
  scope:
    - functional_testing
    - bug_reporting
    - es_en_smoke
  triggers:
    - prueba funcional
    - pruebas funcionales
    - probar flujos reales
    - click through
    - reporte de bugs
    - severidad s1
    - smoke autenticado
    - cambiar el idioma
    - aislamiento entre organizaciones
  excludes:
    - worker tracker
    - trackerlocalstore
    - prisma migration
    - deploy
  phases:
    - verification
  precedence:
    subordinate_to: [semseproject, semse-business-flow-e2e, semse-synthetic-test-data]
  specificity: 60
  status: experimental
  notes: Parte del kit de calidad SEMSE (docs/semse-kit/). Adaptada de replica-test. Capa de método y de reporte sobre semse-business-flow-e2e; no la sustituye.
---

# semse-functional-test — plan, ejecución y reporte de pruebas funcionales

Tercera pieza del **kit de calidad SEMSE** (`docs/semse-kit/README.md`). Adaptada de `replica-test` del pack MIT `Jakeschincariol/replica-skill` (commit `77c9436`). Del original quedan el plan por flujo, la lista de casos límite, el formato de bug y la severidad S1–S4. Se sustituyó su instalación propia de Playwright por la del repo.

## Relación con lo que ya existe (no reemplaza nada)

| Necesidad | Quién manda |
|---|---|
| Ficha de aceptación por journey F01–F36, niveles de evidencia (`E2E_SYNTHETIC`, `STAGING_CANARY`, `PILOTO_REAL`…) | `semse-business-flow-e2e` |
| Usuarios, organizaciones, `testRunId` y teardown | `semse-synthetic-test-data` |
| Time Tracker del trabajador | `testing-worker-tracker` |
| IDOR, roles y aislamiento | `semse-security-baseline`, `semse-rbac-permissions` |
| **Este kit** | plan de casos, ejecución en Playwright, roles × idioma × organización, reporte de bugs y bucle de arreglo |

## Autoridad y límites

- Antes de actuar, leer `project-manager-app/AGENTS.md`, la spec del dominio y `docs/semse-kit/security-rules.md`.
- **Probar SEMSE, nunca a terceros.** No se hacen pruebas de carga, fuzzing ni scripts contra la plataforma de referencia ni contra servicios externos.
- **Entorno.** Local o preview/staging reservado para pruebas, con datos sintéticos. **Nunca producción** salvo el `PROD_CANARY` que define `semse-business-flow-e2e`, con autorización expresa para esa ejecución.
- Sin dinero, contratos, correos ni SMS reales. Pagos sólo en mock o sandbox.
- No se instalan dependencias nuevas (por ejemplo `@axe-core/playwright`, que hoy **no** está en el repo) sin autorización.
- Credenciales de prueba sólo por variables de entorno o secretos de CI, por **nombre**. Nunca en el código, los logs ni el reporte.

## Procedimiento

1. **Plan por flujo** (`references/test-plan.template.md`). Para cada flujo de la spec o del recon, numerar casos `F07-H1` (camino feliz), `F07-E3` (límite) y `F07-N2` (negativo).
2. **Matriz mínima por flujo con UI**, según `docs/semse-kit/test-matrix.md`:
   - Roles: `OPS_ADMIN`, cliente y profesional (los nombres exactos salen de `packages/auth/src/rbac.ts`).
   - Idioma: ES y EN. La preferencia se guarda en `localStorage["semse-language"]` (`apps/web/lib/language-context.tsx`). Se cambia desde el selector de la UI y se comprueba que no aparezcan claves crudas (`nav.x`) ni textos del otro idioma en la pantalla.
   - Organizaciones: un actor de la org A **no** ve ni modifica recursos de la org B. Se esperan 403 o 404 según el contrato, nunca 200 con datos ajenos.
3. **Casos límite**, para cada flujo: entrada vacía o muy larga, acentos y emoji, doble clic en enviar, atrás o recargar a mitad, dos pestañas, red lenta u offline, sesión expirada, datos de otro usuario u organización, zona horaria y horario de verano, ancho móvil (390 px), sólo teclado y etiquetas accesibles.
4. **Negativos**: contraseña errónea, permiso insuficiente, recurso borrado, transición de estado inválida (`docs/foundation/STATE_MACHINES.md`), evidencia rechazada y pago declinado en sandbox.
5. **Automatizar con el Playwright del repo.** Specs en `tests/e2e-semse/`, configuración `playwright.semse.config.ts`, ejecución `pnpm test:e2e:semse` (o un spec concreto). Los selectores van por rol y etiqueta (`getByRole`, `getByLabel`), nunca por clases CSS. Cada spec falla con errores de consola y con respuestas 5xx.
6. **Pasada manual** para lo no automatizable (correo, OAuth real, notificaciones push, fallos visuales), con captura por paso.
7. **Reportar** cada bug en `references/bug-report.template.md`:

   | Sev. | Significa |
   |---|---|
   | S1 | pérdida de datos, fuga entre organizaciones, dinero o escrow incorrecto, flujo central bloqueado |
   | S2 | funcionalidad rota sin alternativa, texto crítico sin traducir (pagos, permisos, errores) |
   | S3 | roto con alternativa o visiblemente incorrecto |
   | S4 | cosmético |

   Sólo se reporta lo reproducido. Lo dudoso va en una lista aparte “por comprobar”. Los S1 de seguridad o dinero se escalan además a `semse-audit-remediation`.
8. **Bucle de arreglo.** Por cada arreglo: primero el test que falla, después el cambio, verlo pasar y conservar el test. Tras cada lote se repite la suite afectada.

## Evidencia (no basta un “pasó”)

Cada ejecución deja en el PR o en el reporte: el SHA, el entorno, el comando exacto, el resultado `n passed / n failed`, la ruta del reporte HTML o el trace de Playwright, y los IDs de bug. Los datos personales y los tokens se tachan.

## Criterios de aprobación

- [ ] Cada flujo del alcance tiene casos H, E y N numerados.
- [ ] Matriz roles × ES/EN × org A/B cubierta o marcada como pendiente con motivo.
- [ ] Ningún S1 ni S2 abierto para declarar el flujo listo.
- [ ] Evidencia reproducible adjunta.
- [ ] El estado del flujo se reporta con el vocabulario de `semse-business-flow-e2e`, nunca como “verificado” por un CI verde.

## Notas para futuros agentes

- El spec `authenticated-es-en.spec.ts` y el validador de catálogos críticos ES/EN están **planificados** en `docs/semse-kit/README.md` (fase 3) y todavía no existen. Mientras tanto, los tests de claves ya existentes son `tests/unit/operational-panels-i18n.test.ts` y `tests/unit/contributor-i18n-keys.test.ts`.
- No hay `@axe-core/playwright` instalado. La parte de accesibilidad se queda en revisión de roles y etiquetas hasta que alguien autorice la dependencia.
