# Reporte de implementación: centro de cuenta y seguridad

Fecha: 2026-07-25  
Spec: `core.account-center`  
Rama: `codex/semse-account-center`

## Resultado

Se implementó un centro de cuenta compartido para `CLIENT`, `PRO` y
`OPS_ADMIN`. Cada usuario puede consultar su identidad, editar sus propios
datos de perfil, cambiar su contraseña dentro de la sesión y cerrar la sesión
actual.

El cambio de contraseña:

- toma la identidad exclusivamente de la sesión autenticada;
- exige y verifica la contraseña vigente;
- acepta contraseñas nuevas de 15 a 128 caracteres;
- rechaza reutilizar la contraseña vigente;
- actualiza el hash y revoca las demás sesiones renovables en una transacción;
- preserva la sesión actual;
- aplica un límite de cinco intentos por minuto;
- registra `user.password_changed` sin contraseña ni derivados.

No se añadieron migraciones, variables de entorno ni cambios de
infraestructura. No se ejecutaron escrituras de datos ni despliegues.

## Superficies entregadas

- API canónica: `POST /v1/auth/password-change`.
- BFF privado: `POST /api/semse/auth/password-change`.
- Rutas web: `/client/account`, `/worker/account` y `/admin/account`.
- Componente compartido: `AccountCenter`.
- Navegación y traducción de “Cuenta y seguridad” en los tres portales.
- Política de 15..128 caracteres alineada en registro y restablecimiento.
- Catálogo de API y evento de auditoría actualizados.

## Evidencia de verificación

| Comprobación | Resultado |
|---|---|
| Tests del servicio de cambio de contraseña | 4/4 pass |
| Test de contrato de Account Center | 3/3 pass |
| Perímetro de autenticación, sesión y BFF | 30/30 pass |
| Suite enfocada de autenticación | 48/48 pass |
| Lint API | pass |
| Lint web | 0 errores; 54 advertencias preexistentes |
| Build API | pass |
| Build web de producción | pass; 403 páginas generadas |
| `git diff --check` | pass |

La revisión React confirmó un único límite cliente para la interacción,
formularios semánticos con `label`, estados accesibles, autocompletado
compatible con gestores de contraseñas y limpieza del efecto de carga.

## Riesgo residual

La revocación invalida de inmediato los refresh tokens de las demás sesiones.
Un access token secundario ya emitido puede seguir vigente hasta agotar su TTL,
tal como queda documentado en la spec. Invalidarlo antes requeriría consultar el
estado de sesión durante cada autenticación o una estrategia equivalente.

## Deuda de herramientas observada

- El runner del workspace invoca el ejecutable desnudo `pnpm`, que no está
  disponible como shim en este entorno Windows. Los paquetes se compilaron en
  el orden canónico con `corepack pnpm`.
- El build de `@semse/knowledge` contiene `mkdir -p` y `cp`, comandos POSIX no
  portables a PowerShell. TypeScript compiló y el recurso se copió con el
  equivalente nativo.
- La instalación omitió scripts de Prisma; se ejecutó
  `prisma:generate` explícitamente antes de compilar el API. No se aplicaron
  migraciones.
