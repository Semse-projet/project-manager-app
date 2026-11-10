# C51 — liens sobre ResourceScopeResolver

Fecha: 2026-11-07 · Alcance: un módulo (`modules/liens`) · C51 sigue **PARTIAL**.

## Evaluación
Las 13 rutas de liens (calendario, waivers, notices) ya pasaban por `LienAccessService`: tenant + participación con
`hasScopeAccess` y, para ids hijos, pertenencia del calendario/waiver/notice al proyecto de la URL. No se encontró
hueco de acceso. `assertProject` repetía exactamente la consulta de `resolveProjectScope`.

## Cambio
- `LienAccessService.assertProject` usa `ResourceScopeResolver.resolveProjectScope(actor.tenantId, projectId)`;
  la decisión sigue en `assertLienAccess` (read = cliente/pro/OPS_ADMIN, pro = profesional asignado u OPS_ADMIN,
  ops = solo OPS_ADMIN). Otro tenant ⇒ 404; otra org u org vacía ⇒ 403. Sin cambio de comportamiento.
- `LiensModule` importa `ResourceScopeModule`.

## Pruebas
- `lien-access.test.ts` ahora construye el servicio con el resolver real sobre el stub de prisma (las 7 pruebas
  previas siguen pasando) y suma 1 que verifica que se usa el resolver con el tenant del actor.
- Mutación: si el resolver recibe un tenant fijo en lugar del del actor, fallan 4 pruebas; restaurado, 8/8.
- Liens 41/41. Suite `@semse/api test:unit`: 3847 pass, 0 fail, 2 skipped (Postgres local). ESLint limpio.

## Pendiente / límites
- Las rutas siguen con `@AuthenticatedAccess` ("pending granular lien permissions"): no hay permisos `liens:*` en
  `rbac.ts`. No se tocó (fuera de alcance y conflicto potencial con otros PR de RBAC).
- Sin smoke autenticado en producción; no se declara despliegue.
