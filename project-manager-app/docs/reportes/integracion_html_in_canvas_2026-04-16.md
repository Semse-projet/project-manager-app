# Integracion HTML-in-Canvas

Fecha: 2026-04-16

## Decision

`HTML-in-Canvas` se adopto como mejora progresiva del ecosistema SEMSE, no como reemplazo total del DOM.

Motivo:
- la API sigue siendo experimental y depende de Chromium con la flag `canvas-draw-element`;
- envolver paginas completas en `canvas` rompe el modelo de altura, scroll y composicion;
- el punto correcto de adopcion son superficies acotadas y reutilizables: paneles, tarjetas y vistas operativas.

## Implementacion

Se creo la primitiva compartida:
- `@semse/ui`: `HtmlInCanvasPanel`

Se conecto en:
- `packages/ui/src/components/StatCard.tsx`
- `packages/ui/src/components/JobCard.tsx`
- `apps/web/app/(app)/admin/autonomy/page.tsx`
- `apps/web/app/dashboard/dashboard-client.tsx`
- `apps/web/app/cortex/semse-cortex-console.tsx`
- `apps/web/app/field-ops/page.tsx`
- `apps/web/app/jobs/[jobId]/page.tsx`
- `apps/web/app/knowledge/page.tsx`
- `apps/web/app/knowledge/knowledge-client.tsx`
- `apps/web/app/runtime-map/page.tsx`
- `apps/web/app/runtime-map/runtime-map-client.tsx`
- `apps/web/app/repo-map/page.tsx`
- `apps/web/app/repo-map/repo-map-client.tsx`
- `apps/web/app/anatomy/page.tsx`
- `apps/web/app/anatomy/anatomy-client.tsx`
- `apps/web/app/(app)/worker/dashboard/page.tsx`
- `apps/web/app/(app)/worker/tracker/page.tsx`
- `apps/web/app/(app)/worker/evidence/page.tsx`
- `apps/web/app/(app)/worker/jobs/page.tsx`
- `apps/web/app/(app)/worker/payments/page.tsx`
- `apps/web/app/(app)/client/dashboard/page.tsx`
- `apps/web/app/(app)/client/jobs/page.tsx`
- `apps/web/app/(app)/client/milestones/page.tsx`
- `apps/web/app/(app)/client/payments/page.tsx`
- `apps/web/app/(app)/client/projects/page.tsx`
- `apps/web/app/(app)/client/jobs/new/page.tsx`
- `apps/web/app/jobs/new/page.tsx`

## Comportamiento

- Si el navegador soporta `requestPaint()` y `drawElementImage()`, la superficie se pinta con `HTML-in-Canvas`.
- Si el navegador no lo soporta, SEMSE conserva el render DOM normal sin degradacion funcional.

## Resultado

El ecosistema ya tiene una capa canonica de adopcion para `HTML-in-Canvas`, reutilizable en el resto de pantallas y componentes sin acoplar la plataforma a una API experimental como dependencia dura.

La capa ya esta extendida sobre superficies visibles del ecosistema:
- paneles operativos de autonomia;
- dashboard principal;
- consola Cortex;
- cabecera y navegacion de Field Ops;
- shell y paneles del detalle de Job;
- encabezado y paneles de Knowledge Hub;
- encabezado y paneles de Runtime Map;
- encabezado y paneles de Repo Map;
- encabezado y paneles de Anatomy;
- dashboard y tracker del frente worker;
- evidence, jobs y payments del frente worker;
- dashboard y jobs del frente client;
- milestones, payments y projects del frente client;
- formularios `new` del frente client/public;
- tarjetas base compartidas (`StatCard`, `JobCard`).

## Cobertura suficiente

Se considera alcanzada una cobertura suficiente del frente visible porque ya quedaron instrumentadas las superficies principales del ecosistema:
- admin y operaciones;
- conocimiento y mapas estructurales;
- jobs y detalle operativo;
- frente worker;
- frente client;
- formularios principales de alta.

Quedan fuera por decision explicita:
- shell global persistente;
- navegacion base;
- superficies donde el costo de redibujar en `canvas` supera el beneficio visual o funcional.

El criterio canonico adoptado es:
- usar `HTML-in-Canvas` en paneles, tarjetas, bloques de lectura y superficies acotadas;
- no usarlo como reemplazo total del DOM de la aplicacion;
- mantener fallback DOM completo cuando el navegador no soporte la API experimental.
