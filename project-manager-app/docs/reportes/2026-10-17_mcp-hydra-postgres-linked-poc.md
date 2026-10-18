# S1 — Hydra OAuth real + autorización SEMSE con PostgreSQL temporal

**Fecha:** 2026-10-17  
**Estado:** PRUEBA CONJUNTA EJECUTADA Y APROBADA EN SHA `c27342cca1ac903f3a7ceb099d44ada44d3d050b`; CI GENERAL AÚN EN EJECUCIÓN  
**Autoridad:** propietario autorizó PoC aislada Ory Hydra y datos sintéticos, no activación MCP ni cambios en producción.  
**Base:** PR #953 (lectura D4), #962 (proyección D5/error D6), #963 (Hydra 26 checks), #964 (Postgres AuthSession/Membership/Project), todos fusionados con CI SUCCESS.

## Diferencia respecto a pruebas anteriores

La prueba ejecuta una **única cadena en el mismo job**:

1. Descarga y comprueba checksum SHA-256 del ejecutable oficial Hydra 26.2.0 (sin construir Docker Hydra).
2. Prepara PostgreSQL 16 temporal de GitHub Actions (servicio estándar CI, descartable) y ejecuta migraciones existentes **solo ahí**.
3. Hydra efectúa Authorization Code + PKCE S256, emite un token opaco real, luego se realiza introspección real en cada intento de lectura.
4. Un vínculo sintético creado por el flujo de login/consent de laboratorio asocia el sub/user/org/client/audience a una sesión SEMSE **realmente persistida en la base temporal**, no una `Map` de sesión.
5. La autorización ejecuta `AuthRepository.findActiveSessionAuthorization` para consultar user/status, AuthSession, Membership ACTIVE y roles reales. La lectura usa `ProjectsRepository.findByIdWithoutProvisioning` y `ProjectsService.statusForVerifiedActor`; D5 limita campos.
6. Pruebas negativas: org ajena del mismo tenant, otro tenant, token no válido, revocación de Membership, revocación del vínculo sintético, revocación de AuthSession. Extensión Prisma deniega operaciones distintas de SELECT durante las lecturas, con conteos antes/después.
7. Hydra revoca su propio token y verifica `introspection.active=false`, como en el laboratorio original.

## Barreras

- **Requiere `CI=true`**, bloquea `NODE_ENV=production` y `RAILWAY_ENVIRONMENT*`, y valida host/puerto/base `127.0.0.1:5433/semse` antes de conectar.
- Hydra admin, public y login demo sólo en loopback 127.0.0.1. Claves efímeras y DB temporal. Sin secretos, sesiones ni datos productivos SEMSE.
- No se añade un endpoint MCP, ni se crea `McpDelegatedConsent`, ni se modifica el guard global o el contrato web. Ningún token de Hydra es aceptado por el REST real.
- **El vínculo OAuth sub→org→session y la autorización de consentimiento siguen siendo de laboratorio, en memoria.** Esto NO valida aún una cadena productiva de AuthGuard + OAuth Resource Server + grant duradero.
- No se ha aprobado formalmente D2 ni el despliegue AS. ADR-045 permanece PROPOSED y S1 REVIEW/INACTIVE.

## Evidencia obtenida (17-oct-2026)

- [Workflow conjunto #39048211561](https://github.com/Semse-projet/project-manager-app/actions/runs/39048211561): **SUCCESS terminal** sobre commit `c27342cca1ac903f3a7ceb099d44ada44d3d050b`.
- Job `isolated-hydra-postgres` ID `117441145115`: log **`PASS: Hydra OAuth token introspection + actual SEMSE Postgres AuthSession/Membership/Project isolation/revocation/no writes (12 linked checks).`**
- En el mismo job: **`PASS: real Hydra OAuth PKCE, introspection and token revocation; synthetic SEMSE revocation (26 checks)`**.
- Descarga oficial de Hydra v26.2.0 comprobada con SHA-256 `28baf98c6d5da617c905d5ca77826fe863db9f9edab8f72664c69a56bde56b5a`, Postgres efímero en `localhost:5433/semse`.
- La ruta interna utiliza consultas reales a Postgres/AuthSession/User/Membership/Project/Job, pero la fuente de consent/subject binding **permanece en memoria sintética**; las frases de límite heredadas del PoC Hydra se refieren a su ensayo aislado, no invalidan la prueba conjunta agregada.
- [Hydra PoC original #39048211482](https://github.com/Semse-projet/project-manager-app/actions/runs/39048211482): SUCCESS.
- [CI general #39048211495](https://github.com/Semse-projet/project-manager-app/actions/runs/39048211495): **PENDIENTE DE RESULTADO TERMINAL** al actualizar este informe.

| Evidencia | Estado |
|---|---|
| Hydra OAuth PKCE + token revocado e introspection inactive | PASS EN CI |
| Introspección token real + sesión/membresía SEMSE con DB real | PASS EN CI — 12 checks |
| Negativas cross-org/cross-tenant/consent sintético revocado | PASS EN CI |
| Denegación de writes y conteos sin cambios | PASS EN CI |
| CI regular cobertura/calidad/E2E | PENDING |
| Consentimiento D7 **durable y revocable** + guard OAuth NestJS | NOT_IMPLEMENTED |
| Host MCP interoperable real, seguridad aprobada y Railway | NOT_EXECUTED |

**No confundir éxito del laboratorio con D2 aprobado ni con producción lista.**
