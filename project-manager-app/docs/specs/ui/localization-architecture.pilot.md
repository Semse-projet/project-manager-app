# SEMSE — Plan de decisión y piloto ES/EN para App Router

**Fecha:** 2026-10-19  
**Documento subordinado:** `docs/specs/ui/localization-architecture.spec.md` (SDD 2.0, `REVIEW`)  
**PR documental:** #1003  
**Estatus:** **PLAN PROPUESTO — NO AUTORIZA IMPLEMENTACIÓN NI DESPLIEGUE**

> **Checkpoint 2026-10-27: cookie SSR ya existente.** En `main` ya están `apps/web/lib/language-preference.ts`, lectura de cookie `semse-language` en el layout, `InitialLanguageProvider` y `tests/unit/language-preference-cookie.test.ts`. Esta sección registra la auditoría histórica anterior, **no** describe su ausencia actual. [ADR-046](../../architecture/ADR-046-semse-ui-localization-runtime.md) sigue PROPOSED; [análisis](localization-architecture.analyze.md) actualizado. La cuenta cross-device y el smoke autenticado del wizard siguen pendientes.



> **Estado del plan:** decisiones D1–D7 abiertas y smoke ES/EN autenticado no ejecutado para este PR documental.

## Alcance y evidencia de código

Auditoría histórica de `main` (2026-10-19); requiere rebaseline antes de aprobar D1–D7:

- `apps/web/app/(app)/client/jobs/new/page.tsx`: wizard cliente de 4 pasos con `STEPS` en español fijo y formato de dinero `toLocaleString("en-US", {currency:"USD"})`. También hay cantidades, fechas y errores producidos directamente en vistas.
- `apps/web/lib/language-context.tsx`: `LanguageProvider/useLanguage` y catálogo plano ES/EN existente; no crear segundo proveedor de traducciones en la misma pantalla.
- `apps/web/app/layout.tsx`: HTML `lang="es"` fijo, metadatos públicos en español, `robots: {index:false}`.
- `apps/web/middleware.ts`: autenticación y autorización por prefijos de rutas/rol; la localización no debe sustituir, saltar o reordenar las comprobaciones de sesión.
- `lib/job-wizard-draft` y el wizard: el borrador se guarda por identidad en `sessionStorage`; el cambio de idioma no debe limpiar ni cruzar borradores.
- `.github/workflows/ci.yml`: `quality-gates` ejecuta `spec:validate:strict`, `spec:audit-plan-coverage`, `spec:index:check` y más; `unit-coverage` exige cobertura; E2E depende de `quality-gates`.

> Historial de CI movido a la descripción del PR #1003; en este plan los gates sólo se validan contra el commit final correspondiente.


## Propuesta de decisión D1–D7 (requiere ratificación)

| Decisión | Recomendación técnica | Restricción y prueba para aprobación |
|---|---|---|
| **D1** Runtime | **Conservar temporalmente `useLanguage`**, ejecutar spike aislado comparativo `next-intl` con Next.js 15.5.27/React 19. Seleccionar solo una solución tras piloto. | El spike no cambia dependencias de `main` ni el middleware existente sin revisión. Comparar SSR, compatibilidad de claves, paquete final y regresión por roles. |
| **D2** Piloto | Realizar **los 4 pasos** de `/client/jobs/new`, incluidas validaciones, errores, propuestas de presupuesto, revisión final y estado vacío. | Flujo completo ES/EN en navegador móvil y escritorio; el piloto no publica trabajos reales en producción. |
| **D3** Fallback | Proponer español como fallback **solo tras completar cobertura y pruebas**; registrar claves ausentes y fallar CI en riesgo alto. | No enseñar `payments.release.confirmAction` al usuario ni usar fallback silencioso para mensajes legales; errores críticos requieren mensaje seguro y aprobado. |
| **D4** Preferencia | Cookie SSR + `localStorage` por navegador **ya implementados parcialmente**; fuente autenticada opcional propuesta: preferencia de cuenta validada y cookie de sesión segura para SSR; preferencia explícita guardada prevalece sobre cabecera del navegador. | Evitar lectura de `localStorage` en servidor, fugas entre usuarios o parpadeos de hidratación; cuentas/tenants concurrentes. No diseñar migraciones hasta SDD APPROVED. |
| **D5** SEO | No introducir rutas públicas `/es` y `/en` ni `hreflang` durante este piloto, porque hay `robots:noindex`. | Revisar política SEO aparte. Con `next-intl`, `localePrefix:"never"` también precisa estudiar reescrituras/rutas y su interacción con auth; no configurarlo a ciegas. |
| **D6** Textos críticos | Revisión humana técnica y legal/producto antes de aprobar mensajes de pagos, custodias, disputas, consentimientos, ofertas y firmas. | Ninguna traducción puede implicar garantía de custodia no verificada, cambiar aceptación contractual ni autorizar fondos. |
| **D7** Contenido dinámico | Aplazar proveedores externos y traducción de documentos privados, chats, RAG y evidencias. En el piloto solo UI estática, códigos semánticos seguros y metadatos de idioma. | Respetar issue P0 #974, PR #987, consentimiento y controles org/proyecto/tenant. |

**Regla:** el cuadro expresa recomendaciones para decisión humana/técnica, no cambios de `status` del SDD. Se mantiene `REVIEW`, `NOT_STARTED`, `NOT_RUN`, `UNMERGED`, `NOT_DEPLOYED` e `INACTIVE`.


**Artefactos canónicos vinculantes para etapas posteriores:** [plan](localization-architecture.plan.md), [tasks](localization-architecture.tasks.md) y [checklist](localization-architecture.checklist.md). Todos pendientes de aprobación; este piloto no los sustituye.

## Revisión aplicable al mantenedor único (2026-10-26)

Este plan está subordinado a [DEC-PLATFORM-001](../../architecture/DEC-PLATFORM-001-solo-maintainer-review.md): el PR #1003, **solo documental**, requiere CI verde del SHA final, una revisión automatizada sin hallazgos bloqueantes y aprobación del propietario registrada con fecha/SHA/alcance (nivel 1). Los cambios posteriores de sesión, cookies, privacidad, pagos o autorizaciones necesitan clasificación de riesgo propia; nivel 2 exige dos revisiones automatizadas independientes, pruebas negativas contra PostgreSQL real y 24 horas antes de fusión; nivel 3 exige también **revisión humana externa, canary y rollback**. En ningún nivel se omite revisión humana bilingüe y jurídica del texto crítico. Ninguna revisión automatizada se presentará como externa/humana.

## Plan de trabajo — PR separados solo después de APPROVED

### P0 — Sanear base y CI del documento

1. Verificar CI sobre el HEAD final y registrar pasos, no usar resultados de commits anteriores. El fallo antiguo de `quality-gates` en #4413 fue `spec:index:check`: índice desincronizado (206 specs); `spec:validate:strict` y `spec:audit-plan-coverage` pasaron. La fila del índice fue actualizada después, pero sólo el nuevo CI permite acreditar el arreglo.
2. Validar correspondencia de metadata/index generado con `pnpm spec:validate:strict --base-ref <sha-main>`, `pnpm spec:index:check`, `pnpm spec:audit-plan-coverage`. No editar a mano la matriz generada.
3. Reconocer #968, #969 y #970 como fusionados; #973 abierto con bloqueo de seguridad. Recalcular cobertura real de `main`: la paridad de claves de ramas no mide cobertura de rutas.

### P1 — Spike de compatibilidad de runtime

- Comparativa A: `useLanguage` + catálogos JSON Git + SSR locale/resolución controlada.
- Comparativa B: `next-intl` con `getRequestConfig` y adaptador de claves para consumidores actuales, sin introducir rutas públicas nuevas.
- Usar rama de prueba aislada, sin Railway ni credenciales externas.
- Evaluar interacciones con `apps/web/middleware.ts` existente (Node runtime, auth, API paths, rewrites). No reemplazar middleware de autorización con middleware de locale.
- Medir: compilación web, hidratación, idioma antes de primer render, peso de recursos, continuidad de sesión, mantenimiento y rollback.
- Entrega: ADR pequeña con ganador, evidencia reproducible, cambios en archivos y coste/riesgos. Solo después se selecciona runtime canónico.

### P2 — Catálogos y editoriales

- Extraer semánticamente `jobs`, `common`, `validation` y `payments` necesarios para piloto; preservar claves actuales mediante mapa explícito.
- Incorporar para nuevas entradas `sourceHash`, `translationSourceHash`, `glossaryVersion`, `status`, `reviewer` y `reviewedAt` en metadatos, no en runtime JSON.
- Reconocer placeholders con sintaxis real del runtime seleccionado; no mezclar `{{amount}}` con `{amount}` sin migración y tests.
- Separar `uiLanguage` de `formatLocale`, `currency`, `timeZone` y `measurementSystem`.
- API: errores de dominio con código estable/params seguros para mostrar, no cadenas libres tomadas de excepción o RAG.

### P3 — Wizard y pruebas

- Localizar los cuatro pasos, acciones y ayudas, `aria-label`, categorías, urgencias, validaciones, errores y confirmación de publicación.
- Localizar el formato de fechas; el presupuesto sigue siendo USD si la operación lo establece, aunque el texto esté en español. No convertir moneda por cambiar idioma.
- Al alternar ES↔EN: preservar ruta, `user.id`, `intakeId`, categoría, título, descripción, coordenadas, importe exacto, moneda y borrador de `sessionStorage`; no disparar doble `POST`.
- Probar también entrada con URLs prefill explícitas, recarga, cierre de sesión, reingreso, sesión expirada, clientes A/B y cuentas con distinto idioma.
- Emplear pseudolocalización con expansión de textos y caracteres especiales para descubrir overflow; después smoke humano real ES/EN.

## Matriz mínima de aceptación

| Caso | Escenario | Resultado obligatorio |
|---|---|---|
| L01 | CLIENT abre wizard en `es` y `en` | 4 pasos, validaciones y controles 100% localizados, sin claves crudas |
| L02 | Cambio de idioma durante paso 2/3 | Borrador, formulario, sesión y paso intactos |
| L03 | Importe 1250.50 USD, idiomas distintos | Cambia representación regional permitida; valor numérico, moneda y payload intactos |
| L04 | Fecha límite con zona horaria controlada | Misma fecha de negocio, sin desfase por idioma |
| L05 | Propuesta IA de presupuesto y error de API | Parámetros seguros y texto traducido; datos y autorizaciones sin cambio |
| L06 | CLIENT A en ES y CLIENT B en EN concurrentes | Sin contaminación de locale, caché, cookie o resultados |
| L07 | Sesión expirada y URL prefill | Comportamiento de auth igual al actual; redirección segura y sin pérdida indebida |
| L08 | Pseudolocalización móvil 320–390 px | No hay recortes de acciones esenciales, modales ni controles inaccesibles |
| L09 | Traducción con placeholder roto, duplicado o digest obsoleto | CI rechaza el recurso crítico |
| L10 | Intento de compartir/reutilizar fragmento privado de Prometeo | Bloqueado por políticas de objeto; no llamadas MT externas |
| L11 | Pago/hito/evidencia: enunciados en ambos idiomas | Ninguna diferencia de permiso, estado, importe ni compromiso legal |
| L12 | Rollback a catálogo aprobado anterior | Reaparecen mensajes correctos sin migración de datos ni pérdida de sesión |

**Salida mínima para considerar piloto listo:** CI verde sobre *head final*; D1–D7 ratificadas; pruebas L01–L12 verificadas con evidencias; aprobación bilingüe y legal para textos críticos; evidencia de aislamiento multi-tenant/rol; rollback validado. Hasta entonces **NO MERGE / NO DEPLOY / NO ACTIVATE**.

## Enlaces de referencias oficiales consultadas

- Next.js App Router i18n: https://nextjs.org/docs/app/guides/internationalization
- `next-intl`, composición middleware y autenticación: https://next-intl.dev/docs/routing/middleware
- `next-intl`, configuración y rutas sin prefijo: https://next-intl.dev/docs/routing/configuration
- Shopify, localización de apps: https://shopify.dev/docs/apps/build/localize-your-app
- Microsoft, pseudolocalización: https://learn.microsoft.com/en-us/globalization/methodology/pseudolocalization
