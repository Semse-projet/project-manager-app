# Checklist de aceptación — centro de cuenta y seguridad

## Contrato

- [x] Spec y plan aprobados.
- [x] Actores y límites definidos.
- [x] Riesgo residual de access tokens documentado.

## Seguridad

- [x] Requiere sesión autenticada.
- [x] Requiere contraseña vigente.
- [x] Contraseña nueva: 15..128, sin reglas de composición.
- [x] Rechaza reutilizar la contraseña vigente.
- [x] Revoca sesiones renovables secundarias.
- [x] No registra contraseñas ni derivados.
- [x] Aplica rate limit.

## Experiencia

- [x] Disponible para `CLIENT`, `PRO` y `OPS_ADMIN`.
- [x] Muestra identidad sin permitir editar el correo.
- [x] Permite editar perfil reutilizando `/v1/users/me/profile`.
- [x] Confirma la contraseña nueva en cliente.
- [x] Explica qué sesiones se revocan.
- [x] Ofrece cierre de sesión actual.
- [x] Formularios accesibles, con labels y autocomplete correcto.

## Evidencia

- [x] Tests del servicio.
- [x] Test del contrato web/BFF.
- [x] Build API.
- [x] Build web.
- [x] Lint relevante.
- [x] Spec index regenerado.
- [x] Reporte de implementación creado.
