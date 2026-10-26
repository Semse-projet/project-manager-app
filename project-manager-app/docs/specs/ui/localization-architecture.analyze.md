# SEMSE — Análisis de consistencia SDD 2.0 ES/EN

**Fecha de inspección:** 2026-10-26  
**Spec / PR:** `ui.localization-architecture`, #1003 (`REVIEW`)  
**Base de código examinada:** `main` = `c6d4d323bdbdf925fd539d241ba1435bdc50c5c0` al preparar este análisis. Verificar de nuevo si `main` cambia.  
**Carácter:** análisis documental, no aceptación, pruebas ejecutadas ni autorización de runtime.

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

**Opción A — por navegador / sin Prisma:** conservar compatibilidad con `localStorage`, proponer cookie estrictamente validada (`es`|`en`) para resolver SSR en una futura implementación. Un endpoint autenticado seguro o server action puede emitir cookie con `Path=/`, `Secure` en producción y `SameSite=Lax`; decidir explícitamente `HttpOnly` y sincronización con el selector. Invalidar/prevenir caché compartida de render privado. **No promete** preferencia cross-device ni impone vínculo de cuenta cuando se cambia de usuario en el mismo navegador. Probar herencia/límites de sesión y comportamiento tras logout.

**Opción B — preferencia de cuenta:** añadir campo validado a `User` o `UserProfile` y API autenticada para lectura/escritura con owner y controles de organización. Resolver precedencia `preferencia explícita del usuario > cookie de continuidad > negociación del navegador > fallback`, pero aclarar si cuenta prevalece en el mismo dispositivo al entrar otro usuario. Requiere `migration_status: PENDING` en el **slice de implementación**, migration SQL aditiva, `prisma migrate deploy`, compatibilidad durante rollout, prueba Postgres real, forward-fix y salida sin pérdida de datos. **No aprobado.**

| Condición P1 | A (sin DB) | B (con DB) |
|---|---|---|
| Idioma estable antes del primer SSR, `html.lang` coherente | Requiere cookie/sincronización, pruebas | Requiere resolución de cuenta por servidor, cookie y pruebas |
| Cambiar ES/EN no borra borrador, archivos, IDs o transacciones | Obligatorio | Obligatorio |
| Preferencia entre dispositivos | No garantizada | Debe verificarse |
| Dos usuarios en mismo navegador | Definir alcance de la cookie al login/logout | Reconciliar fuente de cuenta y cookie sin fugas |
| Schema/DB migration | No | Sí, en PR propio, reversibilidad demostrada |
| Secretos, RBAC, tenant/org | Sin cambios ni bypass | Misma invariante + ownership del endpoint |

**Recomendación para decisión, no aprobación:** usar A como baseline mínimo de comparación y autorizar B solo si la experiencia cross-device es requisito de producto. Evitar introducir B mientras D1, D3 y D4 permanezcan `REVIEW`. Cualquier cambio de auth/DB o acceso a datos privados requiere su clasificación DEC-PLATFORM-001 independiente.

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

## 4. Gaps que permanecen abiertos antes de código o publicación

- [ ] D1–D7 ratificadas con **ADR de runtime** y D4 elegido; ni Next.js ni Prisma se cambian en el PR documental.
- [ ] AST/JSON validator detecta duplicados reales, mensajes vacíos, cambios de variables, ICU plural/select, aprobación obsoleta y cobertura por ruta (incluido el comentario del propietario del 2026-10-20).
- [ ] Demostrar que alternar locale preserva uploads, drafts, form state, reintentos idempotentes y exactamente los mismos importes/IDs/estados/decisiones `canRelease`.
- [ ] Resolución segura de locale en SSR con aislamiento multi-usuario/tenant y compatibilidad con el middleware Node de autorización.
- [ ] Smoke autenticado ES/EN móvil y escritorio por CLIENT, PRO, WORKER y OPS_ADMIN. `e2e` legacy por sí solo no demuestra este smoke.
- [ ] Revisión humana bilingüe de textos contractuales, pagos, disputa, consentimiento y firmas; protección de fuente privada #974/#987.
- [ ] Gates de nivel 1 de #1003, incluido CI verde del SHA final, revisión automatizada enlazada sin bloqueantes y comentario de aprobación del propietario. Después, PR de implementación separados por riesgo.

**Límite explícito:** análisis basado en archivos de GitHub y comprobaciones estáticas; no se ejecutaron validadores locales, pruebas Playwright, entorno PostgreSQL, Railway ni despliegue. El SDD permanece `REVIEW`.
