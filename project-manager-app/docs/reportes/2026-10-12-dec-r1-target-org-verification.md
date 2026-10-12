# DEC-R1 — continuación y verificación de permisos por recurso

Fecha local: 12-oct-2026, America/Chicago. Corte observado: 06:23–06:33 UTC. Modo: implementación en rama con validación local focalizada; no verificación funcional completa en producción.

## Base real

Al retomar la instrucción del propietario, DEC-R1 ya estaba implementada externamente en [PR #877](https://github.com/Semse-projet/project-manager-app/pull/877), fusionada en `main` **902e4d59d906abbee8235b5d8b6cc20549e17b8f**. No se recreó ese trabajo.

El PR tuvo [CI 38206617582](https://github.com/Semse-projet/project-manager-app/actions/runs/38206617582) verde sobre head `67157934a51f7221e1e8d489f23c4379f763ace9`, con quality-gates, unit-coverage y e2e ejecutados. Logs de unit-coverage, job **114671446136**, muestran los 11 tests DEC-R1 aprobados; total de la suite: 3309 tests, 3271 pass, 0 fail (el total incluye pruebas no ejecutadas, no se afirma 3309 pass). API Integration **38206617592**, Autonomy **38206617559** y Operación Asistida **38206617578**: success.

Después del merge, [CI de main 38212273924](https://github.com/Semse-projet/project-manager-app/actions/runs/38212273924) falla sin ejecutar pasos: quality-gates **114688890771** y unit-coverage **114688891001**, steps vacíos y runner vacío; e2e skipped. API Smoke/Integration/Autonomy/Operación también aparecen failure. La lectura de logs del job devuelve BlobNotFound. La interfaz del conector no permitió obtener annotations: causa de arranque **UNKNOWN**. No atribuir a tests, presupuesto o pago sin evidencia. No se hicieron reruns de main ni cambios de facturación/CI.

El workflow Railway Deploy **38212281630** quedó skipped, pero Railway sí muestra despliegues externos SUCCESS para el SHA de main:

| Servicio | Deployment |
|---|---|
| API | 2461ff52-c9e1-4407-9c45-5c1de649e9a0 |
| Web | b2bec8f9-3f53-48f2-801c-b897666c72cc |
| Worker | 6f6a8b62-7d2c-4830-9f8f-646c90baed8e |
| Vision | 772f433b-016c-4e64-a7c3-f87866c47fb5 |

GET público `/v1/health` a las 06:32:39 UTC: 200, SHA y deployment API anteriores. `/v1/auth/me` anónimo: 401. `buildTime/imageDigest` unknown. Health aún declara `authMode=jwt-crypto-only`; ese campo no acredita el comportamiento de revocación del código nuevo. La divergencia entre workflow skipped y deploy real requiere auditoría separada de la ruta de despliegue; no se editó infraestructura.

Logs worker limitados a 101 entradas, 06:25:10–06:32:41 UTC: 3 entradas severity error y ninguna coincidencia de 401/Invalid or revoked auth session/No active organization permission. No demuestra operación correcta ni identidad persistida. No se publican logs crudos o secretos.

## Defecto reproducido y corrección

En #877 la consulta exige membership ACTIVE en B, pero no verifica que el rol en **B** tenga `org:read`/`org:members:read`. El guard usa roles de la sesión de A. Con PRO en A y WORKER en B se puede tomar prestado el permiso de A y enumerar miembros de B.

Se escribió primero `organization-resource-permissions.test.ts`: **4 fallos / 3 aprobadas** sobre código de main. Después de la corrección: **7/7 aprobadas**. La reproducción es de unidad con un adaptador Prisma sintético; no se intentó explotar datos de producción ni se presenta como prueba HTTP/DB real.

Cambios: consultar solo los roles ACTIVE del usuario en cada Org; filtrar listado por `org:read`; exigir permiso objetivo en detalle/miembros; 403 ante membership visible sin permiso y 404 ante organización invisible; preservar excepción OPS_ADMIN dentro del tenant y excluir la proyección interna del DTO. Sin escritura de identidad, nuevos roles, schema o cambio de contexto. Los dos fixtures anteriores ahora incluyen su rol objetivo para reflejar la consulta real.

## Validación local

- 29/29 pruebas: foundation 11, permisos objetivo 7 y regresiones de login/demo/bootstrap BFF. Cero fallos, skipped o canceladas.
- TypeScript 5.8.2: typecheck focalizado de OrganizationsRepository y dependencias, con Prisma Client 6.19.3 generado desde el schema actual. Sin cambios de schema ni conexión productiva.
- Validación focalizada de metadatos SDD 2.0 y estados de entrega: PASS. `git diff --check`: PASS.

Este entorno tiene una copia selectiva de archivos recuperados a SHA fijo, no un clon completo (git HTTPS no dispone de credenciales; el conector sí permite lectura/escritura). Los archivos TypeScript de prueba se transpilaron con TypeScript 5.8.2, ES2022, decoradores habilitados y emitDecoratorMetadata=false para instanciar los servicios directamente. Se usaron implementaciones reales de Nest/common 11.2.6, shared, auth/RBAC y los fuentes de dominio; los tests inyectan repositorios/Prisma sintéticos. El typecheck focalizado usa emitDecoratorMetadata=true, Prisma generado y el módulo real rbac.ts como resolución de @semse/auth. **No es build completo de Nest ni validación de su grafo DI**.

Comandos canónicos pendientes en checkout completo:

```sh
pnpm build:api
node --experimental-strip-types --test apps/api/test/business-access-foundation.test.ts apps/api/test/organization-resource-permissions.test.ts apps/api/test/auth-login-membership-status.service.test.ts apps/api/test/auth-demo-mode.service.test.ts tests/unit/access-token-bootstrap.test.ts
pnpm spec:validate:strict
```

Además, CI requerido del PR y una prueba HTTP/PostgreSQL multi-org. La generación de Prisma no prueba SQL ni migraciones.

## Estado y gates

La metadata v0.3 representa **este seguimiento aún no fusionado/desplegado**; el despliegue de v0.2 se documenta arriba como historial verificable. No se marca VERIFIED ni CI PASS por tests locales.

Antes de liberar: CI verde del cambio, resolver arranque del CI main, confirmar identidad ACTIVE real del worker y comportamiento BFF con sesión revocada, canary autenticado A/B con latencia medida, aprobación de release. El cache de token BFF por sí solo no prueba revocación end-to-end. No se alteraron roles productivos, secretos, presupuestos, firmas, pagos, migraciones o deployments.
