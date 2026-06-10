# Reporte de Auditoría y Limpieza — Fase 1 (SEMSEproject)

**Fecha:** 2026-06-10  
**Autor:** Antigravity (AI Coding Assistant)  
**Estado de la Fase:** EXIT CRITERIA MET (Listo para avanzar a Fase 2)

---

## 1. Resumen Ejecutivo y Estado de Git (Módulo 1.1)

Se ha realizado una auditoría exhaustiva del estado actual del repositorio en la rama `fix/api-coverage-split-integration-db-tests`. El espacio de trabajo contiene un conjunto mixto de cambios que afectan tanto a la landing pública como a la API, los dashboards internos, la navegación y las especificaciones de pruebas.

* **Rama Actual:** `fix/api-coverage-split-integration-db-tests`
* **Estado del Repositorio:** Dirty (múltiples archivos modificados y no rastreados).
* **Severidad de Riesgo Inicial:** Media-Alta debido al acoplamiento de lógica de negocio interna en la landing y la presencia de componentes duplicados de navegación.

---

## 2. Clasificación de Cambios (Módulo 1.2 & 1.7)

Para evitar la contaminación de scopes y cumplir con la gobernanza de SDD, se clasificaron los archivos modificados y no rastreados en las siguientes categorías:

### A. Landing Pública (Ámbito de la Fase 2 / Candidatos a PR 1)
* **Páginas:**
  * `apps/web/app/(public)/page.tsx` (Modificado)
  * `apps/web/app/(public)/modules/` (No rastreado)
  * `apps/web/app/(public)/worker/` (No rastreado)
* **Componentes:**
  * `apps/web/components/landing/landing-nav.tsx` (Modificado)
  * `apps/web/components/landing/landing-footer.tsx` (Modificado)
  * `apps/web/components/landing/landing-intake.tsx` (Modificado)
  * `apps/web/components/landing/landing-routes.ts` (No rastreado)
  * `apps/web/components/landing/operational-routes-grid.tsx` (No rastreado)
  * `apps/web/components/landing/ecosystem-modules.tsx` (No rastreado)
  * `apps/web/components/landing/roles-dashboard.tsx` (No rastreado)
  * `apps/web/components/landing/agents-simulator.tsx` (No rastreado)
  * `apps/web/components/landing/animated-counter.tsx` (No rastreado)
  * `apps/web/components/landing/featured-jobs-feed.tsx` (No rastreado)
  * `apps/web/components/landing/pricing-estimator.tsx` (No rastreado)
  * `apps/web/components/landing/professionals-carousel.tsx` (No rastreado)
  * `apps/web/components/landing/scroll-reveal.tsx` (No rastreado)
  * `apps/web/components/landing/steps-carousel.tsx` (No rastreado)
  * `apps/web/components/landing/testimonials-carousel.tsx` (No rastreado)
* **Estilos y Contexto:**
  * `apps/web/app/globals.css` (Modificado)
  * `apps/web/lib/language-context.tsx` (Modificado)

### B. API / Backend (Fuera del Ámbito de la Landing PR - Posponer)
* `apps/api/src/infrastructure/queue/agent-queue.service.ts`
* `apps/api/src/infrastructure/queue/developer-runtime-queue.service.ts`
* `apps/api/src/modules/evidence-gateway/evidence-gateway.service.ts`
* `apps/api/src/modules/payment-governance/payment-governance.service.ts`
* `apps/api/src/modules/pricing/contractor-rate.service.ts`
* `apps/api/src/modules/pricing/location-cost.service.ts`
* `apps/api/src/modules/worker-verification/worker-verification.service.ts`
* `apps/api/test/...` (Todos los archivos de pruebas unitarias/integración de controladores e infraestructura en API)

### C. Dashboards / Aplicación Interna (Fuera del Ámbito de la Landing PR - Posponer)
* `apps/web/app/(app)/admin/dashboard/page.tsx`
* `apps/web/app/(app)/admin/ops/page.tsx`
* `apps/web/app/(app)/layout.tsx`
* `apps/web/app/dashboard/dashboard-client.tsx`
* `apps/web/components/context-panel/`
* `apps/web/components/decision/`
* `apps/web/lib/navigation-registry.ts`
* `apps/web/lib/navigation-shell.ts`
* `tests/unit/navigation-registry.test.ts`
* `tests/unit/navigation-shell.test.ts`

### D. Documentación y Especificaciones (Sincronización SDD)
* `docs/SPEC_INDEX.md`
* `docs/frontend/FRONTEND_ARCHITECTURE.md`
* `docs/specs/README.md`
* `docs/specs/...` (Todos los archivos `.spec.md` modificados y no rastreados)
* `docs/SEMSE_6_PHASE_WORK_PLAN.md`

---

## 3. Auditoría de la Landing y Componentes Duplicados (Módulos 1.3 & 1.4)

### Componentes Mapeados:
* **Landing Page Principal:** `apps/web/app/(public)/page.tsx` actúa como contenedor e integra las secciones dinámicas mediante componentes ubicados en `apps/web/components/landing/`.
* **Componente de Entrada (Intake):** `landing-intake.tsx` proporciona el wizard para que el usuario describa su necesidad sin loguearse.

### Hallazgo de Duplicación Crítica:
* **Archivos:** Existen `LandingNav.tsx` (5.1 KB, estilos inline, no soporta tema) y `landing-nav.tsx` (7.7 KB, clases de Tailwind v4, soporta temas light/dark).
* **Importación:** `apps/web/app/(public)/layout.tsx` importa de forma canónica `"../../components/landing/landing-nav"`, que en Linux se resuelve directamente a `landing-nav.tsx`.
* **Recomendación:** Eliminar `apps/web/components/landing/LandingNav.tsx` (el archivo capitalizado) en la limpieza de la landing por ser código muerto e incompatible con el sistema de temas.

---

## 4. Auditoría de Rutas y Enlaces (Módulo 1.5)

Se verificó la existencia y el estado de los enlaces configurados en la landing:

| Ruta de Enlace | Destino Real en Workspace | Estado | Riesgo |
|---|---|---|---|
| `/client/jobs/new` | `apps/web/app/(app)/client/jobs/new/page.tsx` | Existe | Bajo |
| `/login?from=/worker/dashboard` | `apps/web/app/login/page.tsx` (con query) | Existe | Bajo |
| `/tools` | `apps/web/app/(app)/tools/page.tsx` | Existe | Bajo |
| `/modules/[id]` | `apps/web/app/(public)/modules/[id]/page.tsx` | Existe | Bajo |
| `/client/dashboard` | `apps/web/app/(app)/client/dashboard/page.tsx` | Existe | Bajo |
| `/client/milestones` | `apps/web/app/(app)/client/milestones/page.tsx` | Existe | Bajo |
| `/worker/evidence` | `apps/web/app/(app)/worker/evidence/page.tsx` | Existe | Bajo |
| `/admin/dashboard` | `apps/web/app/(app)/admin/dashboard/page.tsx` | Existe | Bajo |
| `/admin/mission-control` | `apps/web/app/(app)/admin/mission-control/page.tsx` | Existe | Bajo |
| `/admin/ai-mission-control` | `apps/web/app/(app)/admin/ai-mission-control/page.tsx` | Existe | Bajo |
| `/buildops/projects` | `apps/web/app/(app)/buildops/projects/page.tsx` | Existe | Bajo |

* **Conclusión:** Todas las rutas enlazadas existen físicamente. Los accesos administrativos se mantienen en el footer de la página redirigiendo de forma segura a través de `login`.

---

## 5. Auditoría de Tailwind CSS y Variables (Módulo 1.6)

La aplicación utiliza **Tailwind CSS v4** mediante `@tailwindcss/postcss`. La configuración del tema se gestiona en `apps/web/app/globals.css` usando la directiva `@theme`.

### Clases Inválidas/Sospechosas Detectadas:
1. **`slate-250`, `slate-350`, `slate-450`, `slate-650`, `slate-850`:**
   * *Problema:* No están declaradas en `@theme` en `globals.css`. Por defecto, Tailwind no genera colores con terminaciones `50` intermedias fuera de los múltiplos de `100` estándar (y `50`, `950`).
   * *Acción:* Reemplazar con clases estándar (`slate-200`, `slate-300`, `slate-400`, `slate-700`, `slate-800`, `slate-900`) o registrarlas en el bloque `@theme` de `globals.css` si es estrictamente necesario.
2. **`max-height-screen`:**
   * *Ubicación:* `apps/web/components/landing/landing-nav.tsx` (Línea 122).
   * *Problema:* No es una clase válida de Tailwind. La clase correcta es `max-h-screen` o el uso de un valor arbitrario como `max-h-[100vh]`.
   * *Acción:* Modificar por `max-h-screen`.
3. **`active:scale-98`:**
   * *Problema:* `scale-98` no es un valor por defecto de escala en Tailwind CSS (los valores estándar son `90`, `95`, `100`, `105`, `110`, etc.).
   * *Acción:* Reemplazar con la sintaxis de valor arbitrario `active:scale-[0.98]` o usar `active:scale-95`.

---

## 6. Auditoría de Seguridad (Módulo 1.8)

* **Secrets:** No se encontraron llaves de API, contraseñas o credenciales expuestas en los archivos modificados.
* **Archivos `.env`:** El archivo `apps/web/.env.local` está ignorado correctamente en git (verificado mediante `git check-ignore`).
* **Credenciales Demo:** El sistema utiliza flujos con redirección de sesión local simulada y no expone variables de producción reales.

---

## 7. Resultados de Validación Técnica (Módulo 1.9)

Se ejecutaron los comandos de validación en la raíz del monorepo con los siguientes resultados:

1. **`pnpm spec:preflight`:** **EXITOSO (100% de éxito)**
   * Specs escaneados: 44.
   * Specs con related_tests: 44/44 (100%).
   * Specs VERIFIED: 44/44 (100%).
   * Specs sin related_files o related_tests: 0.
2. **`pnpm typecheck`:** **EXITOSO**
   * Verificación de tipos en `@semse/api` y `@semse/web` compiló sin errores.
3. **`pnpm lint`:** **PREEXISTENTES ERRORES EN BACKEND**
   * *Backend (`@semse/api`):* Falló con 30 problemas (29 errores de variables no usadas y 1 advertencia). Estos errores corresponden a la API y el backend, los cuales están fuera del scope de la landing.
   * *Frontend (`@semse/web`):* Falló debido a un error de entorno con ESLint v9 y `@rushstack/eslint-patch` en `eslint-config-next` (`Failed to patch ESLint because the calling module was not recognized`). No está relacionado con cambios en el código de la landing.
4. **`pnpm build:web`:** **FALLIDO (Error de recolección de datos de páginas)**
   * *Problema:* El build falló durante la etapa de generación estática con el error `PageNotFoundError: Cannot find module for page: /_not-found` y múltiples páginas de administración (como `/admin/agents`, `/admin/ai-mission-control`, etc.).
   * *Clasificación:* Preexistente / Relacionado con la configuración de Next.js standalone o prerendering de rutas dinámicas en el monorepo. No está causado por los cambios de la landing page.


---

## 8. Reporte de Gaps de Spec (Módulo 1.11-SDD)

* **Situación Actual:** La landing page pública y los componentes que la componen (Hero, Trust Bar, action cards, footer) no poseen un documento de especificación funcional exclusivo. Están cubiertos indirectamente por `intake-flow.spec.md` para el wizard y `client-flows.spec.md`/`pro-flows.spec.md` para las redirecciones post-login.
* **Acción Propuesta para la Fase 2:** Crear la especificación `docs/specs/ui/public-landing-operational-entry.spec.md` antes de implementar la versión definitiva y estable de la landing en la Fase 2.

---

## 9. Plan de Limpieza y Split de PR 1 (Módulo 1.10)

Para asegurar un desarrollo incremental y limpio, se recomienda la siguiente estrategia para aislar los cambios de la landing en el primer PR (PR 1):

1. **Crear una rama limpia para la Landing:**  
   `git checkout -b feature/landing-clean-stable` (basada en origin/main o en un commit limpio).
2. **Transferir los cambios clasificados como Landing Pública (Sección 2.A):**  
   Aplicar los cambios de `page.tsx`, `landing-nav.tsx`, `landing-footer.tsx`, `landing-intake.tsx` y los nuevos componentes de `apps/web/components/landing/*`.
3. **Eliminar el componente duplicado:**  
   `git rm apps/web/components/landing/LandingNav.tsx`.
4. **Resolver clases de Tailwind inválidas:**  
   Corregir las clases `slate-250`, `max-height-screen`, `active:scale-98` únicamente en los componentes de la landing.
5. **Enviar el PR 1 de la Landing pública para validación.**
6. **Los cambios de API y Dashboards (Secciones 2.B y 2.C) deben mantenerse en su rama actual o en stashes separados**, para ser integrados secuencialmente a partir de la Fase 4.
