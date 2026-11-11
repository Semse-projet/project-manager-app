# SEMSE — Análisis de consistencia SDD 2.0 ES/EN

**Fecha de inspección:** 2026-10-26  
**Spec / PR:** `ui.localization-architecture`, #1003 (`REVIEW`)  
**Base de código examinada:** `main` = `c6d4d323bdbdf925fd539d241ba1435bdc50c5c0` al preparar este análisis. Verificar de nuevo si `main` cambia.  
**Carácter:** análisis documental, no aceptación, pruebas ejecutadas ni autorización de runtime.

> **Checkpoint de `main` del 2026-10-27 (`40b77710`):** la versión actual de `language-context.tsx` (blob `4f95939f`) conserva 1,182 claves ES y 1,182 EN por extracción textual, pero **ya no depende únicamente de `localStorage`**. El módulo `language-preference.ts` valida `es/en`, el layout raíz lee la cookie `semse-language` en SSR y `InitialLanguageProvider` inicializa el cliente. Existen `tests/unit/language-preference-cookie.test.ts` y el reporte local `docs/reportes/2026-10-23_idioma-sin-destello.md`. Son evidencia de implementación parcial por navegador, **no** de preferencia autenticada/cross-device ni de producción. El texto histórico posterior refleja el snapshot `c6d4d323`, no el estado actual. Véase [ADR-047 PROPOSED](../../architecture/ADR-047-semse-ui-localization-runtime.md).

## 1. Evidencia de código — situación actual

| Superficie | Archivo / evidencia | Resultado observado | Límite de la verificación |
|---|---|---|---|
| UI ES/EN | `apps/web/lib/language-context.tsx` (blob `48dd3a16e28e5ce79ba044ffefdd795190e2c1de`) | **1,182 claves declaradas ES / 1,182 EN**, paridad de nombres y 0 duplicadas detectadas | Extracción textual por patrón de clave entre bloques `T.es` y `T.en`, no parser AST completo ni cobertura de todas las rutas |
| Proveedor actual | Mismo archivo | `LanguageProvider` inicializa a `es`, recupera `semse-language` de `localStorage` en `useEffect`, asigna `document.documentElement.lang` en cliente | No demuestra locale SSR inicial por cuenta ni persistencia entre dispositivos |
| Fallback | Mismo archivo | `T[language][key] ?? T.en[key] ?? key` | No elimina keys técnicas visibles cuando faltan dos idiomas; D3 sigue pendiente |
| Preferencia de cuenta | `packages/db/prisma/schema.prisma` (blob `13fcdfa259de2da8750ba4a299f47f60d30c9199`) | **No se encontró** `locale`, `preferredLocale`, `uiLanguage` ni `languagePreference` como campo de `User` o `UserProfile` | No equivale a escanear cada tabla, endpoint o sistema externo, y no descarta otro campo sin ese nombre |
| Sesión | `apps/web/lib/auth.ts`, `apps/web/middleware.ts` | La sesión firmada y las políticas de rutas ya tienen contratos propios; el idioma no añade rol ni permiso | No probado en runtime; D4 no puede cambiar el contrato de auth por inferencia |
| Job wizard | `apps/web/app/(app)/client/jobs/new/page.tsx` | Flujo de cuatro pasos y textos/formatos hardcoded ya identificados | No ejecutado smoke autenticado ni revisión móvil |

**Resultado:** el incremento desde las cifras históricas de 759, 925, 1,041 y 1,145 claves debe tratarse como evolución del repositorio. **Paridad del catálogo no es cobertura funcional.** Antes de cada aprobación/merge de implementación, repetir auditoría AST/JSON real y pruebas por ruta/rol.

## 2. D4 — contrato de persistencia no decidido

**Opción A — por navegador / sin Prisma (parcialmente existente):** conservar `localStorage` y la cookie actual estrictamente validada (`es`|`en`) que ya permite SSR. **No crear otra cookie ni duplicar el proveedor**. Actualmente la cookie de preferencia utiliza `Path=/`, `Secure` en HTTPS, `SameSite=Lax`, y es accesible al cliente (no `HttpOnly`): no es una credencial. Evaluar posibles endpoints futuros sólo si D4-B se aprueba. Invalidar/prevenir caché compartida de render privado. **No promete** preferencia cross-device ni impone vínculo de cuenta cuando se cambia de usuario en el mismo navegador. Probar herencia/límites de sesión y comportamiento tras logout.

**Opción B — preferencia de cuenta:** añadir campo validado a `User` o `UserProfile` y API autenticada para lectura/escritura con owner y controles de organización. Resolver precedencia `preferencia explícita del usuario > cookie de continuidad > negociación del navegador > fallback`, pero aclarar si cuenta prevalece en el mismo dispositivo al entrar otro usuario. Requiere `migration_status: PENDING` en el **slice de implementación**, migration SQL aditiva, `prisma migrate deploy`, compatibilidad durante rollout, prueba Postgres real, forward-fix y salida sin pérdida de datos. **No aprobado.**

| Condición P1 | A (sin DB) | B (con DB) |
|---|---|---|
| Idioma estable antes del primer SSR, `html.lang` coherente | Requiere cookie/sincronización, pruebas | Requiere resolución de cuenta por servidor, cookie y pruebas |
| Cambiar ES/EN no borra borrador, archivos, IDs o transacciones | Obligatorio | Obligatorio |
| Preferencia entre dispositivos | No garantizada | Debe verificarse |
| Dos usuarios en mismo navegador | Definir alcance de la cookie al login/logout | Reconciliar fuente de cuenta y cookie sin fugas |
| Schema/DB migration | No | Sí, en PR propio, reversibilidad demostrada |
| Secretos, RBAC, tenant/org | Sin cambios ni bypass | Misma invariante + ownership del endpoint |

**Recomendación para decisión, no aprobación:** usar A ya existente como baseline técnico, sin rehacer la cookie, y autorizar B sólo si la experiencia cross-device es un requisito explícito. Evitar introducir B mientras D1, D3 y D4 permanezcan `REVIEW`. Cualquier cambio de auth/DB o acceso a datos privados requiere su clasificación DEC-PLATFORM-001 independiente.

## 3. Análisis cruzado de artefactos

| Control | Fuente | Situación / próxima acción |
|---|---|---|
| SDD 12 secciones | `localization-architecture.spec.md` | Presente; mantiene decisiones D1–D7 abiertas |
| Plan y orden test-first | `localization-architecture.plan.md` | Preparado en `DRAFT`; no se ejecuta hasta `APPROVED` |
| Tareas rastreables | `localization-architecture.tasks.md` | Definidas; implementación y pruebas pendientes |
| Matriz L01–L12 | `localization-architecture.checklist.md` | Casos propuestos; **ninguno marcado PASS** |
| Piloto | `localization-architecture.pilot.md` | Backticks corregidos; histórico de CI movido a descripción del PR |
| Runtime D1/ADR | SDD §12 y plan | **Abierto:** ADR del ganador debe estar ACCEPTED antes de cambiar dependencias/rutas |
| Gobernanza | `DEC-PLATFORM-001` | Documental nivel 1: CI de último SHA, revisión automatizada y aprobación del propietario, sin asumir autoaprobación |
| Prometeo/private MT | #973 / #974 / #987 | **Bloqueado:** sin autorización de contenido dinámico ni proveedor externo |
| CI | GitHub Actions del **último SHA** | Se verifica fuera de este análisis; un verde anterior no acredita un commit nuevo |

## 4. Auditoría precisa del wizard (main `40b77710`, 2026-10-27)

Fuente: `apps/web/app/(app)/client/jobs/new/page.tsx`, blob Git `152be90379ebd4e9b8580607f12e19f4970fcb1d`, 963 líneas. Esta es **lectura estática del código** (sin ejecución de navegador ni servidor); los defectos independientes de i18n deben tener correcciones separadas y no ocultarse con una traducción.

| Prioridad | Evidencia por líneas | Hallazgo verificable | Prueba/corrección exigida |
|---|---|---|---|
| P1 - Cobertura UI | L46–50, L489–490, L619–690, L717–849, L907–955 | Los 4 pasos, el título, placeholders, etiquetas, `aria-label` de importes, botones y confirmación están en español literal; el módulo no invoca `useLanguage`. | L01, L08: todos los pasos y controles ES/EN con catálogo seguro, lector de pantalla y pseudolocale |
| P1 - Datos monetarios | L53–54, L738–751, L815–817 | `fmt()` fuerza `en-US`, USD y 0 fracciones para visualización; el presupuesto sugerido usa `toLocaleString()` sin locale explícito. | L03, L11: formatos ES/EN explícitos y payload numérico/currency **idéntico**; no inferir conversión de moneda |
| P1 - API/errors | L370–463, L435, L460 | En el error de publicar se muestra `data.error?.message` directamente; otro error se crea en español fijo. | L05: código semántico seguro para errores presentados, nunca traduzca la excepción arbitraria ni cambie decisiones backend |
| P0 - Adjuntos preexistentes | L160–161, L228–249, L677–707, L370–429 | La UI permite seleccionar `File[]`; el draft registra sólo `hadFiles` y avisa si hay que reseleccionar. En las dos variantes de `requestBody` del POST de publicación **no aparecen los bytes, IDs ni referencias de estos archivos**. El `handleSubmit` inspeccionado no contiene una subida asociada. | Separar corrección funcional de Evidence/upload del cambio de traducción; test de ida y vuelta real por backend/objeto y reselección. No afirmar que se publicaron adjuntos por ver sus nombres en UI |
| P1 - Continuidad | L192–260, L396–458, L940–955 | Se guarda el draft por `user.id` en `sessionStorage`; existen rutas POST diferentes para Job directo o Intake publish. El botón se deshabilita mediante estado `submitting`, pero no se ha probado idempotencia backend ante doble clic/reintento. | L02/L07: cambio ES↔EN mitad de flujo, prefill y logout; ausencia de publicaciones duplicadas verificada en requests y backend |
| P1 - Fecha límite | L849 | Input date usa `new Date().toISOString().split("T")[0]` para `min`. Es una fecha UTC, que puede no coincidir con la fecha local cerca de medianoche. | L04: comprobar date-only y zona horaria; no desplazar fechas de negocio por idioma |
| P0 - Texto de custodia | L878–883 | La confirmación afirma que el pago se realizará vía **escrow** para proteger a ambas partes. Ni el código ni un catálogo verifican por sí mismos una garantía contractual o la disponibilidad real de custodia. | D6/L11: revisión humana legal y producto, verificar estado real del proveedor y condiciones vigentes; evitar traducir o aprobar automáticamente esta afirmación |

**Riesgo de integración:** estos hallazgos no son atribuibles a los PR de internacionalización ni una autorización para modificar pagos, Evidence o gestión de archivos desde #1003 (SDD REVIEW). Abrir slices de corrección y pruebas según la gobernanza, preservar seguridad/multi-organización y no alterar el payload económico para arreglar la presentación.

**Orden propuesto para el primer PR ejecutable cuando el SDD esté APPROVED:** (1) pruebas fallidas de catálogo y wizard; (2) sustitución de textos UI estáticos y etiquetas `aria` sin cambiar datos; (3) formatos region-aware seguros; (4) pruebas L01–L12 e invariantes; (5) CI/SMOKE y revisión. Los adjuntos y el copy legal se tratan como bloqueantes de publicación y se corrigen por contratos específicos antes de atribuirles estado PASS.

## 5. Gaps que permanecen abiertos antes de código o publicación

- [ ] D1–D7 ratificadas con **ADR de runtime** y D4 elegido; ni Next.js ni Prisma se cambian en el PR documental.
- [ ] AST/JSON validator detecta duplicados reales, mensajes vacíos, cambios de variables, ICU plural/select, aprobación obsoleta y cobertura por ruta (incluido el comentario del propietario del 2026-10-20).
- [ ] Demostrar que alternar locale preserva uploads, drafts, form state, reintentos idempotentes y exactamente los mismos importes/IDs/estados/decisiones `canRelease`.
- [ ] Resolución segura de locale en SSR con aislamiento multi-usuario/tenant y compatibilidad con el middleware Node de autorización.
- [ ] Smoke autenticado ES/EN móvil y escritorio por CLIENT, PRO, WORKER y OPS_ADMIN. `e2e` legacy por sí solo no demuestra este smoke.
- [ ] Revisión humana bilingüe de textos contractuales, pagos, disputa, consentimiento y firmas; protección de fuente privada #974/#987.
- [ ] Gates de nivel 1 de #1003, incluido CI verde del SHA final, revisión automatizada enlazada sin bloqueantes y comentario de aprobación del propietario. Después, PR de implementación separados por riesgo.

**Límite explícito:** análisis basado en archivos de GitHub y comprobaciones estáticas; no se ejecutaron validadores locales, pruebas Playwright, entorno PostgreSQL, Railway ni despliegue. El SDD permanece `REVIEW`.
