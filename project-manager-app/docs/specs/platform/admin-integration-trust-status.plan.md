---
type: plan
feature: "Admin Integration Trust Status"
domain: "platform"
spec: "docs/specs/platform/admin-integration-trust-status.spec.md"
version: "2.0"
status: "APPROVED"
branch: "feat/admin-integration-trust-status"
date: "2026-09-25"
---

# Plan técnico: Admin Integration Trust Status

## 1. Snapshot de verdad

- `origin/main` SHA: `aeac305308d63f4d90962cf159e30be2766d1ae4`.
- Producción: API/Web activos en Railway; SHA desplegado se confirma antes de deploy.
- Drift: mapa de integraciones conserva nombres obsoletos de WhatsApp.

## 2. Constitution check

- [x] Spec aprobado antes de código por instrucción explícita del owner.
- [x] RBAC y tenant definidos.
- [x] No toca Evidence ni Payment Governance.
- [x] No expone secretos ni crea backend paralelo.
- [x] Código, CI, merge, deploy y activación se medirán por separado.

## 3. Arquitectura y autoridad

- Fuente de verdad: variables del servidor + último chequeo en TenantSettings.
- Contratos Zod: paquete `@semse/schemas`.
- API/BFF/UI: módulo Admin → BFF Next → Settings.
- ADR: no requerido; extensión compatible del módulo existente.

## 4. Datos y migración

- Sin Prisma/SQL. Cambio aditivo dentro de JSON validado.
- Rollback: revertir código; no borrar datos.

## 5. Seguridad y política

- Lectura `ops:dashboard:read`; verificación `ops:dashboard:write`.
- No retornar valores de variables ni cuerpos de error externos.
- Timeout de red y probes estrictamente GET.

## 6. Eventos, idempotencia y reconstrucción

- Sin eventos de dominio. Repetir verify reemplaza solo el último chequeo del proveedor.

## 7. Estrategia de implementación

1. Tests de derivación de estado y contratos Zod.
2. Servicio API, endpoints y BFF.
3. UI accesible y responsive con estados explícitos.
4. Build, tests y tooling SDD.
5. PR/CI; deploy separado y verificación autenticada.

## 8. Riesgos

| Riesgo | Impacto | Mitigación | Rollback |
|---|---|---|---|
| Fuga de secreto | Crítico | allowlist de campos públicos | revertir inmediatamente |
| Probe con efecto | Alto | solo endpoints GET documentados | desactivar endpoint |
| Proveedor lento | Medio | timeout de 8 s | mantener estado previo/error |

## 9. Investigación externa

Se usan exclusivamente referencias oficiales de los cinco proveedores.

## 10. Gates antes de tareas

- [x] Archivos, rollback y pruebas identificados.
- [x] Scope cabe en un PR reversible.
