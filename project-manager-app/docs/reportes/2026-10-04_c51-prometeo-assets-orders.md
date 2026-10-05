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

## Correcciones tras la revisión de Devin (2026-10-05)
- Una orden con proyecto y job solo se crea si el job es el del proyecto (400); antes los participantes de un proyecto podían acabar viendo órdenes de otro trabajo.
- Alcance de la coherencia proyecto/job: se comprueba **solo al crear**; las órdenes anteriores con pares incompatibles no se reconcilian (pendiente: auditoría y corrección de datos).
- Los jobs eliminados lógicamente (`deletedAt`) no conceden acceso (también en `resolveJobScope`, que usan tasks y vision).
- Los listados enumeran TODOS los ids de proyecto/job (paginados) y fallan cerrado con 422 por encima del tope de seguridad, en lugar de truncar en silencio a 1000.
- El spec aprobado (`resource-scope.spec.md` §3.4) recoge la decisión y las pruebas.

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

## Investigación externa (SDD_GOVERNANCE §10)
Consultas hechas el 2026-10-05 con búsqueda web; las páginas primarias no se pudieron abrir desde esta sesión (el proxy de salida las bloquea), así que se cita lo que devolvió la búsqueda y el enlace primario.

1. Consulta: autorización a nivel de objeto en APIs con ids en la petición — [OWASP API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/). Resultado: toda ruta que recibe el id de un objeto debe comprobar en el servidor que el usuario autenticado puede hacer esa acción sobre ese objeto, sin fiarse de ids del cliente, y con pruebas automáticas de autorización.
2. Consulta: paginación por cursor para enumerar todos los ids sin truncar — [Prisma, paginación](https://www.prisma.io/docs/orm/prisma-client/queries/pagination). Resultado: `cursor` + `skip: 1` + `take` con orden estable por una columna única; coste constante por página frente al desplazamiento por `skip`.
3. Consulta: código HTTP para «demasiadas asociaciones, filtra» — [RFC 9110, 422 Unprocessable Content](https://www.rfc-editor.org/rfc/rfc9110.html#name-422-unprocessable-content). Resultado: la sintaxis es correcta pero el servidor no puede procesar la instrucción; repetir sin modificar falla igual (distinto de 400, que es petición malformada).

- Aplicado ahora: comprobación de objeto en cada ruta por id (404/403), pruebas negativas cross-tenant/cross-org, enumeración de ids por cursor con tope y 422.
- Backlog: migrar `docs/specs/api/prometeo.spec.md` a SDD 2.0 (con evidencia de entrega) y enlazar desde allí el contrato de activos y órdenes; documentos y la búsqueda RAG (`search`, `rag-context`, `rag-query`) por documentos accesibles, a la espera de la regla del dueño.
- Descartado: truncar ids en silencio (pierde filas sin avisar) y confiar en el `orgId` del cuerpo.
