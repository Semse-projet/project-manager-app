# C51 finanzas — implementación y evidencia

## Objeto

Base inspeccionada: main `3070398736e05ca935bb1b2d051396d98066a879`.
Autorización: implementar, publicar y desplegar la etapa financiera (sesión
2026-10-05). Es un slice de C51; el programa sigue PARTIAL.

## Resultado de código

Una FinanceAccessPolicy usa ResourceScopeResolver. Factura/gasto por ID, PDF,
mutaciones y resumen requieren ownership de cliente/OPS en proyecto/job o de
org sin asociación. Capa repo también filtra writes por tenant y convierte
P2025 en 404. Cuerpos no reasignan propiedad/actor/asociaciones/estado en PATCH.
Creación comprueba asociaciones y sus cruces; hito/factura derivan el proyecto.
Listados, SSE y Prometeo aplican el mismo alcance; contexto/snapshot pierde
financials cuando cambia ownership/permiso. Duplicados persisten referencias
solo del scope exacto. Listados acotados, cursor estable y números UUID para
réplicas concurrentes; no se afirma numeración secuencial ni backfill realizado.

## Evidencia local OBSERVADA

- Tests originales: 9/9 rojos con implementación previa; 200 inesperados,
  writes sin tenant y listados por org emisora reproducidos.
- Tests dirigidos: finanzas 14/14; participación/contexto 19/19; conjunto inicial
  de regresión finanzas/resolver/SSE/contractor 78/78 antes de 2 tests adicionales.
- Build y typecheck API: PASS. Workspace packages y Prisma generados.
- Lint archivos fuente afectados: PASS.
- SDD strict: 161 specs, 0 errores; plan-spec 165/165, 0 faltantes.
- Regresión API completa: 2938 tests; 2892 PASS, 38 skipped, 8 FAIL por
  `dns_resolution_failed` en satellite-webhooks-service.test.ts. Esos fallos
  se conservan como limitación local de red; no se registran como PASS.
- Dependencias locales reutilizadas desde instalación disponible, no se afirma
  instalación frozen-lockfile. CI del PR debe ejecutar el toolchain reproducible.

## Entrega (por observar)

CI del PR, merge, CI de main y deploy todavía pendientes al preparar este
registro. No se atribuye este código a producción por checks locales.

Railway destino confirmado: SEMSEproject `95ad1b14-d1d9-467d-82d8-5354619ba873`,
production `d682210a-956a-4508-9c5b-4ca5959278f9`. API, web, worker y vision
observados online antes del cambio. No se modifican variables ni Prisma.
OAuth solo devuelve nombres de variables; contraseñas/tokens de smoke no están
disponibles. Smoke autenticado y auditoría SQL de datos históricos = NO VERIFICADO.

## Camino de escala y pendientes explícitos

Ahora: policy reutilizable, actor obligatorio en servicio, writes tenant-scoped,
cursor y máximo 500; filtro de proyecto evita enumeración masiva de ACL.
El resolver enumera completo y falla cerrado a partir de 20.000 asociaciones
(422); no oculta datos al truncar. Próxima expansión: ACL por joins, índices de
tenant/job/orden y aggregates SQL para resumen, usando EXPLAIN antes de migrar.
No cachear permisos para esconder coste. Numeración UUID evita count+1 entre
réplicas; referencias anteriores se conservan.

`scripts/audit-finance-scope.sql` prepara conteos de solo lectura para filas
previas con proyectos/jobs/hitos/facturas/duplicados incompatibles. No ejecutado
en producción, no hay reparación de datos asumida. Backfill requiere evidencia
y migración aditiva en otro slice. Otros pendientes C51 (documentos/RAG,
credenciales públicas, resolutores duplicados y worker smoke) permanecen abiertos.

Rollback: SHA estable previo verificado por el flujo de CI; dado que volver a
él reabre BOLA financiera, preferir forward-fix o suspender el acceso financiero.
No se mueve dinero real ni se cambian providers/FSM de escrow.

## Investigación externa

1. OWASP API1 BOLA: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
2. Prisma Client filtros update: https://docs.prisma.io/docs/orm/v6/reference/prisma-client-reference
3. PostgreSQL índices multicolumna: https://www.postgresql.org/docs/16/indexes-multicolumn.html

Aplicado: autorización por objeto y filtro id+tenant. Backlog: índices/joins
medidos y agregados SQL. Descartado: resolver paralelo y permisos cacheados.
