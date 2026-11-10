# Spec e2e de contratación reescrito contra la API actual

**Fecha:** 2026-11-06 · **Rama:** `claude/e2e-hiring-flow` (desde `main` @ `faf8ae0`) · **Decisión del responsable:** reescribir sólo el núcleo (opción recomendada)

## Contexto

Los specs e2e de API `job-lifecycle-rating`, `dispute-resolution` y `edge-cases-payment-rating` estaban desfasados respecto a la API. El CI no los ejecuta, así que nadie lo vio:

- usaban rutas que ya no existen (`POST /v1/escrow/fund`, `POST /v1/escrow/release`, `GET /v1/users/:id/reputation`, `POST /v1/projects/:id/close`, `PATCH /v1/disputes/:id`);
- usaban payloads antiguos (`scope` de menos de 10 caracteres, `documentHash` corto, claves de evidencia sin tenant);
- esperaban estados que ya no se llaman así (`open`, `accepted`).

Al recorrer el flujo real aparecieron dos fallos del producto:

- **#1110:** el contrato se rechazaba tras aceptar la reserva.
- **#1111:** ninguna transición de trabajo era posible.

## Cambio

`tests/e2e-semse/job-lifecycle-rating.spec.ts` se reescribe entero, en 4 casos:

1. **Recorrido feliz:** trabajo → reserva → aceptar → contrato → dos firmas → escrow (`mock`) → hito → evidencia → enviar → aprobar → liberar → `in_progress` (PRO) → `review` (PRO) → `completed` (cliente) → valoraciones en los dos sentidos → resumen y reputación. Comprueba importes depositados y liberados y la subida de la reputación.
2. **Contrato y fondos:** no hay contrato sin reserva aceptada (409), ni fondos sin las dos firmas (409).
3. **Hito:** no se puede enviar sin evidencia (409), ni liberar sin aprobación (409), ni siquiera ya enviado.
4. **Transiciones, cierre y valoraciones:**
   - el profesional no puede completar el trabajo (422) y otro cliente tampoco;
   - nadie, ni `OPS_ADMIN`, completa el trabajo con un hito sin aprobar o con fondos retenidos (409, regla añadida en #1111); tras aprobar y liberar, sí;
   - un `WORKER` no tiene permiso (403);
   - no se puede valorar antes de `completed` (400), ni con 0, 6 o 4.5 (400).

Además:

- Se quitan del archivo los casos que inventaban comportamiento no especificado: categorías de valoración, progresión fija de niveles y el caso de UI con botones demo.
- `docs/semse-kit/local-stack.md` explica cómo levantar la API en `:4122` con identidad por cabeceras.
- `dispute-resolution` y `edge-cases-payment-rating` quedan sin tocar y siguen fallando (fuera del alcance acordado).

## Verificación

| Prueba | Resultado |
|---|---|
| Spec contra la API local con #1110 y #1111 (incluida la comprobación de cierre) | **4 passed**, y 8/8 en dos repeticiones |
| Spec contra la API sin #1110 | 4 failed: «contract requires an accepted reservation» |
| Contrato del kit (`semse-kit-contract.test.mjs`) | sin fallos |

**Depende de #1110 y #1111:** se fusiona después de ellos. El CI no ejecuta este spec, así que no afecta a sus checks.
