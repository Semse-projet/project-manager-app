# Branch audit: Semse-projet/project-manager-app

Fecha de auditoria: 2026-06-18

## Resumen ejecutivo

- Ramas remotas actuales: 74.
- PRs historicas revisadas: 140.
- PRs cerradas por merge: 106.
- PRs cerradas sin merge: 34.
- PRs abiertas: 0.

Interpretacion: la mayoria de ramas "cerradas" no fallaron; se cerraron porque fueron mergeadas a `main` o `dev`. Los casos que requieren explicacion son las 34 PRs cerradas sin merge. En esos casos GitHub no expone un campo formal de "motivo"; el motivo se infiere por el titulo, fecha de cierre y PRs posteriores que consolidaron o reemplazaron el trabajo.

## Por que se cerraron las ramas sin merge

| PR | Rama | Fecha cierre | Para que era | Motivo probable de cierre |
| --- | --- | --- | --- | --- |
| [#138](https://github.com/Semse-projet/project-manager-app/pull/138) | `fix/bid-full-alignment` | 2026-06-18 | Alinear esquema de bids a `amount`/`etaDays` en todas las capas | Reemplazada por la PR consolidada [#139](https://github.com/Semse-projet/project-manager-app/pull/139), que si fue mergeada. |
| [#136](https://github.com/Semse-projet/project-manager-app/pull/136) | `fix/bid-prorgid-optional` | 2026-06-18 | Hacer `proOrgId` opcional al crear bids | Incluida despues en la consolidacion [#139](https://github.com/Semse-projet/project-manager-app/pull/139). |
| [#135](https://github.com/Semse-projet/project-manager-app/pull/135) | `test/bid-schema-cs1-cs6` | 2026-06-18 | Tests de validacion para esquema de bids | Cerrada como trabajo parcial; absorbida por la alineacion final de bids. |
| [#133](https://github.com/Semse-projet/project-manager-app/pull/133) | `fix/worker-jobs-full` | 2026-06-18 | Limitar jobs/dashboard del worker a trabajos asignados | Reemplazada por [#139](https://github.com/Semse-projet/project-manager-app/pull/139) y [#140](https://github.com/Semse-projet/project-manager-app/pull/140). |
| [#131](https://github.com/Semse-projet/project-manager-app/pull/131) | `fix/worker-jobs-correct-scope` | 2026-06-18 | Corregir scope de jobs del worker | Cerrada por ser solucion parcial; la correccion final entro en [#140](https://github.com/Semse-projet/project-manager-app/pull/140). |
| [#130](https://github.com/Semse-projet/project-manager-app/pull/130) | `fix/bidview-type-alignment` | 2026-06-18 | Alinear `BidView` frontend con backend | Absorbida por [#139](https://github.com/Semse-projet/project-manager-app/pull/139). |
| [#128](https://github.com/Semse-projet/project-manager-app/pull/128) | `fix/bid-form-amount-etadays` | 2026-06-18 | Corregir formulario de bids y BFF | Absorbida por [#139](https://github.com/Semse-projet/project-manager-app/pull/139). |
| [#116](https://github.com/Semse-projet/project-manager-app/pull/116) | `feat/vision-gated-auto-approve` | 2026-06-15 | Auto-aprobacion de milestones con Vision QA | Cerrada como version separada; parte del trabajo entro en [#115](https://github.com/Semse-projet/project-manager-app/pull/115). |
| [#110](https://github.com/Semse-projet/project-manager-app/pull/110) | `fix/vision-route-ssrf` | 2026-06-15 | Arreglo SSRF en rutas Vision | Reemplazada por [#112](https://github.com/Semse-projet/project-manager-app/pull/112) y [#113](https://github.com/Semse-projet/project-manager-app/pull/113). |
| [#105](https://github.com/Semse-projet/project-manager-app/pull/105) | `feat/vision-level3-area-timeline` | 2026-06-14 | Level 3 Vision: area, consistencia, timeline | Reemplazada por [#106](https://github.com/Semse-projet/project-manager-app/pull/106). |
| [#101](https://github.com/Semse-projet/project-manager-app/pull/101) | `feat/vision-area-consistency` | 2026-06-14 | Area estimator y consistencia multi-imagen | Consolidada en [#103](https://github.com/Semse-projet/project-manager-app/pull/103) y [#106](https://github.com/Semse-projet/project-manager-app/pull/106). |
| [#100](https://github.com/Semse-projet/project-manager-app/pull/100) | `feat/vision-progress-timeline` | 2026-06-14 | Timeline GIF/time-lapse de progreso | Consolidada en [#103](https://github.com/Semse-projet/project-manager-app/pull/103) y [#106](https://github.com/Semse-projet/project-manager-app/pull/106). |
| [#75](https://github.com/Semse-projet/project-manager-app/pull/75) | `dependabot/.../minor-and-patch-4e66dcd225` | 2026-06-11 | Grupo Dependabot de 25 updates | Cerrada por reemplazo/agrupacion; el grupo posterior [#76](https://github.com/Semse-projet/project-manager-app/pull/76) fue mergeado. |
| [#74](https://github.com/Semse-projet/project-manager-app/pull/74) | `dependabot/.../next-15.5.18` | 2026-06-11 | Upgrade de Next | Cerrada por estrategia de dependencias: updates agrupados y/o version reemplazada por otra PR. |
| [#71](https://github.com/Semse-projet/project-manager-app/pull/71) | `dependabot/.../prisma-7.8.0` | 2026-06-11 | Upgrade mayor de Prisma | Cerrada probablemente por riesgo de major upgrade; [#73](https://github.com/Semse-projet/project-manager-app/pull/73) agrupo dependabot e ignoro majors. |
| [#70](https://github.com/Semse-projet/project-manager-app/pull/70) | `dependabot/.../angular/router-22.0.0` | 2026-06-11 | Upgrade mayor Angular router | Cerrada por major upgrade no deseado en ese momento. |
| [#69](https://github.com/Semse-projet/project-manager-app/pull/69) | `dependabot/.../angular/material-22.0.0` | 2026-06-11 | Upgrade mayor Angular Material | Cerrada por major upgrade no deseado en ese momento. |
| [#65](https://github.com/Semse-projet/project-manager-app/pull/65) | `dependabot/.../tailwind-merge-3.6.0` | 2026-06-11 | Upgrade mayor `tailwind-merge` | Cerrada por major upgrade no deseado o reemplazo por grupo menor/patch. |
| [#64](https://github.com/Semse-projet/project-manager-app/pull/64) | `dependabot/.../next-16.2.7` | 2026-06-11 | Upgrade mayor de Next | Cerrada por major upgrade no deseado. |
| [#63](https://github.com/Semse-projet/project-manager-app/pull/63) | `dependabot/.../pino-10.3.1` | 2026-06-11 | Upgrade mayor de Pino | Cerrada por major upgrade no deseado. |
| [#62](https://github.com/Semse-projet/project-manager-app/pull/62) | `dependabot/.../angular/compiler-22.0.0` | 2026-06-11 | Upgrade mayor Angular compiler | Cerrada por major upgrade no deseado. |
| [#61](https://github.com/Semse-projet/project-manager-app/pull/61) | `dependabot/.../angular/forms-22.0.0` | 2026-06-11 | Upgrade mayor Angular forms | Cerrada por major upgrade no deseado. |
| [#50](https://github.com/Semse-projet/project-manager-app/pull/50) | `dependabot/.../react-19.2.6` | 2026-06-06 | Upgrade React | Cerrada por reemplazo dentro de grupo posterior; [#60](https://github.com/Semse-projet/project-manager-app/pull/60) fue mergeada. |
| [#47](https://github.com/Semse-projet/project-manager-app/pull/47) | `dependabot/.../anthropic-ai/sdk-0.99.0` | 2026-06-08 | Upgrade Anthropic SDK | Reemplazada por [#66](https://github.com/Semse-projet/project-manager-app/pull/66), que subio a `0.102.0`. |
| [#18](https://github.com/Semse-projet/project-manager-app/pull/18) | `feat/sdd-specs-p1` | 2026-05-20 | Specs P1 del ciclo monetizable | Cerrada como intento previo; el trabajo siguio en [#19](https://github.com/Semse-projet/project-manager-app/pull/19) y [#28](https://github.com/Semse-projet/project-manager-app/pull/28). |
| [#16](https://github.com/Semse-projet/project-manager-app/pull/16) | `reconcile-pnpm-plus-buildops-hardening` | 2026-05-21 | Estandarizar monorepo en pnpm | Reemplazada por [#20](https://github.com/Semse-projet/project-manager-app/pull/20). |
| [#15](https://github.com/Semse-projet/project-manager-app/pull/15) | `railway/code-change-hcMi6x` | 2026-05-21 | Limpiar duplicados DB antes de migracion Prisma | Cerrada sin merge; parece descartada por cambios posteriores de despliegue/migracion. |
| [#13](https://github.com/Semse-projet/project-manager-app/pull/13) | `railway/code-change-jzunqV` | 2026-05-09 | Agregar `NEXT_PUBLIC_SEMSE_API_BASE_URL` al Dockerfile web | Reemplazada por [#14](https://github.com/Semse-projet/project-manager-app/pull/14), que corrigio la variable como Service Variable. |
| [#10](https://github.com/Semse-projet/project-manager-app/pull/10) | `railway/code-change-IDOYvL` | 2026-05-09 | Usar `tsx` en seed script | Cerrada sin merge; probablemente descartada por no ser la solucion final del deploy. |
| [#8](https://github.com/Semse-projet/project-manager-app/pull/8) | `railway/code-change-TFcszw` | 2026-05-07 | Ejecutar seed condicional al iniciar API | Cerrada sin merge; probablemente descartada para evitar side effects en startup. |
| [#4](https://github.com/Semse-projet/project-manager-app/pull/4) | `dependabot/github_actions/actions/checkout-6` | 2026-06-07 | Upgrade `actions/checkout` 4 -> 6 | Cerrada por major upgrade no adoptado. |
| [#3](https://github.com/Semse-projet/project-manager-app/pull/3) | `dependabot/github_actions/actions/upload-artifact-7` | 2026-06-07 | Upgrade `actions/upload-artifact` 4 -> 7 | Cerrada por major upgrade no adoptado. |
| [#2](https://github.com/Semse-projet/project-manager-app/pull/2) | `dependabot/npm_and_yarn/c8-11.0.0` | 2026-06-07 | Upgrade `c8` 10 -> 11 | Cerrada por major upgrade no adoptado. |
| [#1](https://github.com/Semse-projet/project-manager-app/pull/1) | `dependabot/github_actions/actions/setup-node-6` | 2026-06-07 | Upgrade `actions/setup-node` 4 -> 6 | Cerrada por major upgrade no adoptado. |

## Patrones detectados

1. Trabajo consolidado rapidamente: varias ramas pequenas de bids/worker fueron cerradas el 2026-06-18 y reemplazadas por [#139](https://github.com/Semse-projet/project-manager-app/pull/139) y [#140](https://github.com/Semse-projet/project-manager-app/pull/140).
2. Vision AI tuvo iteraciones parciales: las ramas de timeline, area consistency y SSRF fueron cerradas porque el trabajo entro en PRs posteriores mas completas.
3. Dependabot genero ruido: varias PRs individuales o major upgrades fueron cerradas tras introducir agrupacion/ignorar majors en [#73](https://github.com/Semse-projet/project-manager-app/pull/73).
4. Railway genero ramas automaticas: algunas se mergearon, otras se cerraron cuando la solucion final se movio a otra PR o quedo descartada.

## Ramas actuales que conviene limpiar

Estas ramas siguen existiendo en remoto aunque su PR fue cerrada sin merge. Si no hay trabajo local pendiente, son candidatas a borrar:

- `fix/bid-form-amount-etadays`
- `fix/bid-full-alignment`
- `fix/bid-prorgid-optional`
- `fix/bidview-type-alignment`
- `fix/worker-jobs-correct-scope`
- `fix/worker-jobs-full`
- `test/bid-schema-cs1-cs6`
- `feat/vision-gated-auto-approve`
- `fix/vision-route-ssrf`
- `feat/vision-level3-area-timeline`
- `feat/vision-area-consistency`
- `feat/vision-progress-timeline`
- `feat/sdd-specs-p1`
- `railway/code-change-hcMi6x`
- `railway/code-change-jzunqV`
- `railway/code-change-IDOYvL`
- `railway/code-change-TFcszw`

Tambien hay muchas ramas con PR mergeada que siguen vivas (`feat/activity-vision-summary`, `feat/vision-admin-ui`, `feat/p8-governance-activation`, varias `ci/*`, `fix/*`, etc.). Esas no son problema funcional, pero ensucian la pagina de branches. Recomendacion: borrar todas las ramas ya mergeadas salvo `main`, `dev` y cualquier rama que se use como ambiente o linea de trabajo activa.

## Recomendacion operacional

1. Mantener `main` y `dev`.
2. Antes de borrar ramas, confirmar que Railway no dependa de `railway/code-change-*` ni de `dev`.
3. Borrar ramas con PR cerrada sin merge que ya fueron reemplazadas.
4. Borrar ramas mergeadas antiguas para que la pagina de GitHub refleje solo trabajo activo.
5. Activar o revisar la opcion de GitHub "Automatically delete head branches" para que futuras PRs mergeadas no dejen ramas vivas.
