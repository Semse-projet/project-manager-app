# C51 etapa 2a — comparaciones de orgId a mano que deciden acceso (2026-10-01)

Spec: `docs/specs/platform/resource-scope.spec.md` (§3, etapa 2a). Sin cambio de permisos de rol, modelo de datos ni flags.

## Qué cambió
`sameOrg` (una org vacía/ausente nunca coincide) reemplaza la igualdad directa en decisiones de **acceso** de:
`jobs.service` (`assertTransitionAuthorized`, ahora exportada para poder probarla), `jobs.repository` (×2), `materials`, `incidents`, `change-orders`, `contracts.repository` (crear, firmar, leer) y `reservations.repository` (aceptar, liberar, leer ×2).

## Hallazgo real
`assertTransitionAuthorized` comparaba el actor contra `ownership.professionalOrgId ?? ""`. Con un job **sin profesional asignado** y un actor de org vacía, `"" !== ""` es falso ⇒ la transición por defecto se concedía. Es la misma brecha `"" === ""` de la etapa 1. (Alcance real depende de que existan actores con `orgId` vacío: el token no lo prohíbe —`typeof orgId === "string"`— aunque el camino por cabeceras sí exige no vacío.)

## Dirección de la comparación (por qué no es un reemplazo mecánico)
- Igualdad que **concede** acceso (`a === b ⇒ permitir`, `a !== b ⇒ denegar`): se aprieta con `sameOrg`.
- Igualdad que **prohíbe** (`reservations.create`: «el dueño no puede reservar su propio job»): **se deja igual**; con `sameOrg` una org vacía dejaría de estar prohibida (aflojaría la regla). Hay un test que lo fija.
- Detección de conflictos de reserva (`reservations.repository` ~130/183) y matching `bids`: no son decisiones de acceso; fuera de esta sub-etapa.

## Verificación
- `c51-stage2-org-access.test.ts` (6): transición con org vacía y sin profesional ⇒ denegada; transiciones legítimas (cliente, profesional, OPS_ADMIN, SYSTEM) siguen permitidas; otra org denegada; `canReadContract`, `canReadReservation`, `canReadJobReservations` con org vacía/cross-org/partes legítimas; guarda ligera que impide volver a comparar a mano en los archivos migrados y fija la prohibición intacta.
- Con el código anterior **fallan 4 de 6** (el hueco de `jobs`, contratos, reservas y la guarda); con el nuevo pasan los 6 (los 2 restantes son de no regresión).
- Suite API 2714 tests, 0 fallos, 38 omitidos · `typecheck` limpio · lint 0 errores.

## Pendiente
Etapa 2b (lista en el spec), etapa 3 (resolutor único + guarda de arquitectura en CI — PR de CI aparte autorizado). Sin smoke autenticado multi-tenant: C51 sigue PARTIAL.
