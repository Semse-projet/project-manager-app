# C51 — contracts: request-signatures exige la org cliente dueña

Fecha: 2026-11-07 · Alcance: un módulo (`modules/contracts`) · C51 sigue **PARTIAL**.

## Evaluación
Crear, leer y firmar contratos ya están acotados por tenant y participación (`sameOrg` con la org cliente o la
profesional; firmar exige además ser el usuario firmante). El alcance es del job/contrato, previo al proyecto; no se
migra a `ProjectScope`.

## Hallazgo y cambio
`POST /v1/contracts/:contractId/request-signatures` (permiso `contracts:create`, que tienen CLIENT y OPS_ADMIN)
solo exigía poder **leer** el contrato. Después envía la solicitud de firma a los correos del cuerpo y sobrescribe
`helloSignRequestId` y las URLs de firma del contrato. Un usuario con rol CLIENT en la org profesional del contrato
podía hacerlo. Ahora `ContractsService.requestSignatures` exige lo mismo que crear el contrato: org cliente dueña u
OPS_ADMIN del tenant; si no, 403 sin enviar nada ni tocar el contrato.

## Pruebas
- Nueva `apps/api/test/contracts-request-signatures-scope.test.ts` (3).
- Mutación: sin la comprobación falla la prueba de la org profesional; restaurado, 3/3.
- Contracts 128/128. Suite `@semse/api test:unit`: 3849 pass, 0 fail, 2 skipped (Postgres local). ESLint limpio.

## Pendiente / límites
- No se valida que los firmantes del cuerpo coincidan con las partes del contrato, ni se impide pedir firmas sobre
  un contrato ya firmado. Son reglas de negocio no definidas; no se inventaron.
- Sin smoke autenticado en producción; no se declara despliegue.
