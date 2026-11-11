# Contrato bloqueado tras aceptar la reserva: el tipo de organización del profesional en mayúsculas

**Fecha:** 2026-11-06 · **Rama:** `claude/fix-pro-org-type-case` (desde `main` @ `faf8ae0`) · **Origen:** nuevo recorrido de fallos; las pruebas e2e de API de disputas, pagos y valoraciones contra el stack local

## Diagnóstico

Con la reserva del profesional aceptada (`ACCEPTED`) y el trabajo en `ACCEPTED`, `POST /v1/jobs/:id/contracts` respondía **409 «contract requires an accepted reservation»**. Sin contrato no hay firma, escrow ni hitos, así que la contratación se detenía en ese paso.

- `Org.type` es un `String` libre y hay dos grafías del profesional:
  - el registro (`auth.repository.ts`, `type: input.roleKey`) y el seed escriben **`"PRO"`**;
  - el contexto de actor y las pujas escriben **`"pro"`**.
- Las tres consultas que resuelven la organización del profesional (`resolveProfessionalOrgId` en `reservations`, `contracts` y `trust`) filtraban `type: "pro"` literal.
- Para un profesional dado de alta desde `/register` (o del seed) no encontraban su organización y `findAcceptedByJob` devolvía `professionalOrgId: null`, de ahí el 409.
- Ninguna migración normaliza el campo.
- Por el código, afecta también a producción, a todo profesional registrado. No se ha comprobado allí: exigiría crear trabajos reales.

## Cambio

- `apps/api/src/common/org-type.ts` (nuevo): `PROFESSIONAL_ORG_TYPE_FILTER = { equals: "pro", mode: "insensitive" }`.
- Las tres consultas usan ese filtro. Sin cambios de datos, schema ni migraciones.
- Las organizaciones de cliente (`CLIENT`), de operaciones (`ops`) y de otros tenants siguen sin coincidir.

## Verificación

| Prueba | Resultado |
|---|---|
| `apps/api/test/professional-org-type.test.ts` (nuevo) | 12/12: los 3 repositorios resuelven `PRO`, `pro` y `Pro` e ignoran cliente, ops y otro tenant. Con el código anterior fallan 9. |
| Tests de API de contratos, reservas, trust y acceso por organización | 362/362 |
| `tsc` y eslint de la API | 0 errores |
| En vivo (API local, datos demo): crear trabajo → reserva → aceptar → crear contrato | antes **409**; después **201** |

## Fuera de este cambio

Las pruebas e2e de API `dispute-resolution`, `edge-cases-payment-rating` y `job-lifecycle-rating` siguen fallando, pero por estar desfasadas respecto a la API actual, no por el producto:

- piden `POST /v1/escrow/fund`, que no existe;
- usan un `scope` de menos de 10 caracteres;
- esperan el estado `"open"`, que ahora es `POSTED`.

Además:

- el CI no las ejecuta;
- necesitan una API en `:4122` con identidad por cabeceras (sólo local: `SEMSE_ALLOW_HEADER_IDENTITY=true`, `NODE_ENV=test`, sin `AUTH_SECRET`).

Ponerlas al día es una tarea aparte.

El resto del recorrido sobre `main` (26 pantallas, 133 enlaces) no encontró fallos nuevos.
