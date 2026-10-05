---
type: plan
feature: "C51 finanzas"
domain: "platform"
spec: "docs/specs/platform/finance-resource-scope.spec.md"
version: "2.0"
status: "APPROVED"
branch: "fix/c51-finance-resource-scope"
date: "2026-10-05"
---

# Plan C51 finanzas

Main inspeccionado: `3070398736e05ca935bb1b2d051396d98066a879`.
Producción: SEMSEproject/production; API/Web/Worker/Vision SUCCESS observados,
sin operaciones staged. Conservar ese SHA como referencia previa de release.

## Constitución y análisis

Spec aprobado por autorización de la sesión; invariantes financieros requieren
`client`, no `read`. Permisos y tenant permanecen en backend. No schema,
migración, provider de pagos ni nuevas transiciones. C51 no se cierra aquí.
Reutilizar resolver y ampliar enumeración con relación client opcional,
conservando default read para consumidores existentes.

## Implementación

1. Tests negativos sobre controller/service/repository reales, primero rojos.
2. FinanceAccessPolicy inyectada obligatoria en FinanceService; actor requerido
   en métodos públicos, exceptuando el barrido interno de vencimientos.
3. Normalizar asociaciones; resolver proyecto/job/hito/factura antes de escribir.
   ListScope tipado; propiedad usada únicamente sin asociación. Cursor autorizado.
4. Update Prisma id+tenant con 404 uniforme; PATCH whitelist; duplicados con
   tenant/org/project/job/currency; UUID evita count+1 concurrente.
5. Pasar contexto real desde API, contractor y Prometeo. En contexto cacheado,
   revalidar financial ownership antes de devolver finance.
6. Tests, API build/lint, regresión, strict specs/index/coverage, CI del head.
7. PR, merge autorizado por el usuario, verificar CI de main, workflow de deploy,
   gate blocking de provenance y los cuatro deployments sobre SHA final o descendiente.
8. Smoke de lectura autenticado si hay cuentas autorizadas; no crear pagos reales.
   Registrar limitaciones sin convertir SUCCESS en verificación funcional.

## Escalamiento y recuperación

Listados máximo 500, cursor estable; asociación explícita evita enum masiva.
Tope existente falla cerrado 422. Siguiente expansión: ACL por joins e índices
tenant/job/orden con EXPLAIN y migración aditiva; no nuevos resolutores.
Rollback: volver a versión previa solo si no reabre exposición financiera;
preferir forward-fix o suspensión del acceso ante BOLA. Sin cambios de datos.

## Investigación

OWASP BOLA → policy por objeto; Prisma Client v6 → filtro id+tenant en updates;
PostgreSQL índices multicolumna → backlog medido, no índices especulativos.

## Gates

Tests verdes + build/lint/specs + CI terminal preceden merge. Deploy y smoke
se registran por separado. Sin credenciales, smoke = NO VERIFICADO.
