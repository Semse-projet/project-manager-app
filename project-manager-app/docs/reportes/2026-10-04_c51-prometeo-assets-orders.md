# C51 — prometeo: activos y órdenes de trabajo con propietario explícito (2026-10-04)

Decisión 1 del dueño: documentos, assets y órdenes necesitan un propietario explícito validado por el servidor; asociados a
proyecto u organización ⇒ rigen sus permisos; sin asociación no se concede acceso por ser del mismo tenant.

## Hallazgo clave
`orgId` es OBLIGATORIO en `PrometeoDocument`, `PrometeoAsset` y `WorkOrder`; solo `projectId` es opcional. Todas las filas tienen propietario
explícito; el problema era que nadie lo comprobaba: listar devolvía todo el tenant, cambiar estado era libre dentro del tenant y crear aceptaba
cualquier `projectId`/`jobId` (incluso de otra org).

## Este PR (activos y órdenes; puntos 1, 2 y 4 de mi propuesta, que cumplen el criterio)
`PrometeoAccessPolicy` + `ResourceScopeResolver.listAccessibleProjectIds/JobIds`:
- crear: el `orgId` sale del actor (nunca del cuerpo); sin org ⇒ 403; `projectId`/`jobId` declarados deben ser del tenant (404) y el actor debe participar (403);
- con `projectId`/`jobId` ⇒ rigen los permisos de ese proyecto/job (cliente, profesional asignado, OPS_ADMIN); un proyecto que ya no existe solo lo ve OPS_ADMIN;
- sin asociación ⇒ solo la org propietaria (`sameOrg`; org vacía nunca coincide) u OPS_ADMIN del tenant;
- listar: filtro en la consulta (propias sin asociación + proyectos/jobs donde participa); `?projectId=` exige participar (404/403); OPS_ADMIN todo su tenant;
- cambiar estado: carga la fila dentro del tenant (404) y aplica la regla (403) antes de escribir.
Sin migración, flags, CI, Railway ni `rbac.ts`.

## Pruebas
`prometeo-assets-orders-scope.test.ts` (5, con la consulta real del repositorio): listados por actor, OPS_ADMIN, `projectId`, cambio de estado (404/403/200, sin escrituras al denegar) y creación.
Mutaciones: política sin efecto ⇒ fallan 4 de 5; sin propiedad de la org ⇒ falla 1. API 2875 tests, 0 fallos (2 omitidos, con Postgres).

## Diferencia pendiente de tu confirmación (punto 3: documentos)
Mi propuesta decía: "documentos sin proyecto = biblioteca del tenant (lectura para todo el tenant)". Eso concede acceso solo por ser del mismo tenant, que tu criterio descarta.
Propuesta alineada: documentos con `projectId` ⇒ permisos del proyecto; sin proyecto ⇒ solo la org propietaria u OPS_ADMIN. Si algún documento debe ser biblioteca compartida,
que lo sea por una marca EXPLÍCITA (p. ej. `metadataJson.visibility = "public_training"`) validada en el servidor y con escritura solo para su org/OPS_ADMIN.
Además `search`, `rag-context` y `rag-query` consultan chunks por tenant: hay que filtrar por documentos accesibles. No se implementa hasta que confirmes
si la marca explícita de biblioteca es la regla.
C51 sigue PARTIAL.
