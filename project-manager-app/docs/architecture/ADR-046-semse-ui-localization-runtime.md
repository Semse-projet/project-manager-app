---
id: "ADR-046"
title: "Runtime de traducción ES/EN y preferencia de idioma de SEMSE Web"
status: "PROPOSED"
date: "2026-10-27"
owners: ["semse-core"]
related_spec: "docs/specs/ui/localization-architecture.spec.md"
---

# ADR-046 — Runtime y persistencia del idioma de SEMSE Web

> **PROPUESTA, NO APROBACIÓN.** El SDD `ui.localization-architecture` en el PR #1003 sigue `REVIEW`. Este ADR no autoriza alterar cookies de sesión, Prisma, runtime, catálogos, permisos o Railway. Se aplica DEC-PLATFORM-001 al riesgo de cada cambio.

## Situación verificada en main (2026-10-27)

- `apps/web/package.json`: Next.js **15.5.28**, React **19.3.0**; sin `next-intl` ni `react-i18next` en dependencias.
- `apps/web/lib/language-context.tsx`: contrato `LanguageProvider/useLanguage/t(key)` y diccionario plano con **1,182 claves ES y 1,182 EN** por extracción textual, sin divergencias de nombres. Esto **no prueba** cobertura de componentes ni placeholders correctos.
- `apps/web/lib/language-preference.ts`: `semse-language` con parseo que admite sólo `es` o `en`; la cookie tiene `Path=/`, `SameSite=Lax`, `Secure` en HTTPS y caducidad a un año. Es preferencia de presentación, **nunca credencial**.
- `apps/web/app/layout.tsx`: el servidor obtiene el idioma de la cookie y establece `<html lang>` más `InitialLanguageProvider`. `language-context.tsx` sincroniza cookie y `localStorage`.
- `tests/unit/language-preference-cookie.test.ts` contiene las pruebas de parseo, cookie y contratos de hidratación. `docs/reportes/2026-10-23_idioma-sin-destello.md` registra smoke local; ninguno sustituye una prueba autenticada de todas las rutas en staging.
- En `User` y `UserProfile` del esquema Prisma no se encontró un campo explícito de idioma de cuenta. Persiste el fallback `T[language][key] ?? T.en[key] ?? key`.

## D1 — Comparación de una única fuente de traducción

| Variante | Ventaja | Riesgo | Criterio |
|---|---|---|---|
| **A. Mantener temporalmente useLanguage y extraer JSON por dominio** | Menos cambios, conserva consumidores y SSR de preferencia ya implementado | Necesita validador AST, variables/ICU, cobertura por ruta y revisión humana editorial | Baseline del spike; no aceptada todavía |
| **B. next-intl con adaptador para claves existentes** | Soporte especializado para traducción Server/Client y mensajes complejos | Cambios en middleware Node de autorización, hidratación, sintaxis y tamaño de bundle | Probar en rama aislada; no instalar en main sin ADR ACCEPTED |
| C. Ejecutar dos providers globales simultáneamente | Ninguna ventaja suficiente | Doble fuente de verdad y mayor riesgo de regresión | No recomendado |

La comparación debe registrar build/lint/typecheck Next 15.5.28, tamaño de recursos, SSR ES/EN, `html.lang`, ausencia de hydration mismatch, navegación protegida, sesiones de usuarios A/B, preservación de borradores/archivos y rollback. Escoger **un solo** runtime definitivo después del spike.

## D3 — Fallback

El idioma predeterminado de producto se propone como `es`, sin eliminar la selección `en`. **No cambiar el fallback actual automáticamente.** Los mensajes críticos incompletos o desactualizados deben bloquear publicación y mostrar texto seguro aprobado, nunca una clave técnica ni una autorización de dinero o contrato inferida.

## D4 — Persistencia

**A ya parcialmente implementada:** cookie de preferencia de navegador + `localStorage`, con SSR correcto según cookie. Completar pruebas de sesión expirada, usuarios diferentes en navegador compartido, cookies ausentes/invalidas, modo privado y cachés. No crear una cookie adicional ni asumir que representa una preferencia por usuario.

**B opcional, no implementada ni aprobada:** preferencia autenticada sincronizada entre dispositivos. Antes de adoptarla, el propietario debe aprobarla como requisito, especificar precedencia cuenta/cookie/cambio explícito y aceptar un PR propio con endpoint autenticado, migración Prisma expand/contract, backfill/rollback, ownership, pruebas PostgreSQL reales y controles DEC-PLATFORM-001 adecuados.

## D2, D5, D6 y D7 — Límites

- **D2:** piloto ES/EN completo de cuatro pasos de `/client/jobs/new`; formularios, errores, adjuntos, formatos, IDs, importe USD y POST idempotente.
- **D5:** sin rutas públicas `/es`/`/en` ni SEO bilingüe durante `robots:noindex`.
- **D6:** revisión humana bilingüe de mensajes legales, pagos, custodia, ofertas, disputas, firmas y consentimiento, independientemente de CI.
- **D7:** no traducir chats, documentos, evidencia ni RAG privado con terceros; primero resolver #974/#987, consentimiento y ACL por organización/recurso.

## Condiciones para convertir esta propuesta en ACCEPTED

- [ ] El propietario ratifica D1/D3/D4 y el requerimiento (o no) de sincronización de idioma entre dispositivos.
- [ ] Spike reproducible compara variantes A/B y preserva el middleware de autorización existente.
- [ ] El SDD se aprueba antes de código adicional; si D4-B se elige, actualizar metadata de migración/endpoints y diseñar rollback.
- [ ] Pruebas negativas, smoke ES/EN por rol y matriz L01–L12 proporcionan evidencia; CI del SHA final es verde.
- [ ] Revisión automatizada sin bloqueantes y aprobación del propietario conforme DEC-PLATFORM-001; revisión externa cuando la exposición real alcance nivel 3.

**Estado: PROPOSED.** El código ya fusionado en main no obtiene aprobación retroactiva por escribir este ADR.
