---
type: plan
feature: "semse-library-hub"
domain: "platform"
spec: "docs/specs/platform/semse-library-hub.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/semse-library-hub-sdd-audit-20261025"
date: "2026-10-25"
---

# Plan técnico — SEMSE Library Hub

> Prerrequisito para implementar F1: **spec APPROVED** y ADR revisado. Esta rama aporta solo F0 documental; no se corre CI hasta que los artefactos del corte estén completos.

## 1. Snapshot de verdad

- `origin/main`: rama principal de `Semse-projet/project-manager-app` inspeccionada el 2026-10-25. Registrar SHA commit exacto antes del primer cambio de código F1.
- SHA API/Web desplegado: **NO VERIFICADO**; no se consultó Railway.
- Estado de servicios/migraciones: **NO VERIFICADO**. Sin crear servicios/migraciones en F0.
- Fuentes inspeccionadas: `semse-library-hub.inventory.md` con Git blob SHA por archivo.
- Flags: `SEMSE_LIBRARY_HUB_ENABLED` solo **propuesta**; no existe ni se activa mediante F0.
- Deuda: Recharts/Query/Form/Tiptap declarados en assistant-portal, no automáticamente en Web; diferentes major de Zod. Aún no hay SBOM full ni consumo medido.

## 2. Constitution check

- [ ] Spec DRAFT debe aprobarse antes de código de negocio.
- [x] Restricciones del owner registradas: sin servicios adicionales; on-demand; selección mínima; rentabilidad; revisión trimestral.
- [x] Separación de Library Hub vs Tool Registry/Knowledge/Capability Registry definida en ADR.
- [x] Payment/Evidence fuera de mutación; no saltar policies.
- [ ] Permisos y propiedad del runtime del slice F2 requieren ratificación y tests.
- [ ] Tests rojos antes de cualquier implementación F1+.
- [x] No secretos, no backend paralelo, no alteración de producción en F0.
- [x] CI/merge/deploy/activation se medirán por separado.

## 3. Arquitectura y autoridad

- **Fuente de verdad:** manifiestos + pnpm-lock + manifests Python; Git/PR para decisiones versionadas. Reporte inventario es una proyección, no autoridad para instalar.
- **Read models:** F1 genera JSON/SBOM de esos archivos; F0 documento manual con evidencia de manifiestos.
- **Apps/paquetes potenciales:** `scripts/` para escáner F1; `packages/schemas/` para contratos F2; `apps/api/` (metadata) y `apps/worker/` (job aprobado), sin nuevo servicio.
- **Tool Registry:** publicar una capacidad a Prometeo solo por descriptor/adapter ya aprobado. No duplicar endpoint de invocación si se puede reutilizar.
- **ADR:** `docs/architecture/ADR-SEMSE-LIBRARY-HUB-001.md` (proposed).

## 4. Datos y migración

F0/F1 sin Prisma; lectura de manifest/lockfile en Git. F2 solo considerará tabla si un caso operacional lo necesita. Antes de habilitar escritura, definir tabla, RLS/resource scope, migración aditiva, SQL, checksum, roll-forward, compatibilidad y rollback. No editar migraciones aplicadas.

## 5. Seguridad y política

- `OPS_ADMIN` y revisor designado para decisiones de supply chain; control en Git/PR en F0/F1.
- Usuario runtime solo solicita funcionalidad con permiso del dominio; jamás nombres de paquete ni shell. No hay plugin/arbitrary JS/Python sandbox in-process.
- Access check antes de adapter, alcance tenant/org/ownership; audit de aprobación/revocación y fallos relevantes; logs sin imágenes/contratos/secretos.
- Escanear CVE, integridad, licencia y señales de OpenSSF antes de incorporar algo no presente; licencias comerciales bajo revisión jurídica.
- Riesgo especial: `worker_threads.resourceLimits` no limita toda memoria del proceso; CPU bloqueante de Python/NumPy y WebGL se prueban con benchmark del servicio y navegador real.

## 6. Eventos y reintentos

F0/F1 sin DomainEvent/outbox. En F2 definir en `EVENT_CATALOG.md` sólo eventos reales de aprobación/cambio de estado, con transacción atómica y consumidores idempotentes si se agregan. F3 usar job idempotency key, timeout y cancelación; nunca liberar pagos mediante este mecanismo.

## 7. Implementación en cortes reversibles

### F0 — Documentación **esta entrega**
- Spec, ADR, inventario de manifests, plan/tasks/checklist.
- No runtime, dependencias, migraciones, flags o endpoints.
- Verificar coherencia documental; CI queda para el final.

### F1 — Escáner estático y SBOM **PR separado tras aprobación**
- Tests rojos de inventario determinista (manifestos + lockfile + Python), paths maliciosos, diferentes versiones, duplicados.
- Código de sólo lectura en scripts; salida JSON y SBOM, evidencia de diff/procedencia.
- Ninguna descarga o instalación en producción, sin network al ejecutar inventario.
- Verificar tests dirigidos, regresión y spec tooling, luego CI terminal.

### F2 — Catálogo, evaluación y governance **PR separado**
- Ratificar esquema, roles, flags, estados, budgets, revisión trimestral, incidentes.
- Implementar preferentemente sobre Git metadata; si hay persistencia de runtime justificar en spec propio.
- Validar policy deny, rollback, no data leakage, auditoría; APIs sólo si necesidad demostrada.

### F3 — Piloto selectivo **PR separado**
- Función de bajo riesgo preexistente: por ejemplo una visualización o calculadora pura; no Prometeo Omega completo.
- Benchmark en entorno aislado sintético; concurrencia/latencia/CPU/RAM antes/después.
- Apagar la capability por flag/allowlist; nunca apagar el Worker necesario para otros jobs.

### F4 — Expansión Omega / Python / 3D **PRs individuales**
- Comprobar requerimiento real antes de Meyda/Tone/Librosa/ONNX/Three Rapier.
- Cualquier módulo que no pueda aislarse con recursos existentes se bloquea.

## 8. Riesgos y rollback

| Riesgo | Probabilidad | Impacto | Mitigación / rollback |
|---|---|---|---|
| Librería comprometida en build | media | crítico | lockfile + integridad + revisión; revertir PR/versión, nunca hot install |
| Saturación del Worker existente | media | alto | cuota/concurrencia por capability, kill switch y benchmark |
| Duplicar policy de Tool Registry | media | alto | contrato adapter y policy existente, ADR/forbidden direct invoke |
| Costo variable de modelos/audio | media | medio/alto | presupuesto por capacidad, piloto medido, límite de peticiones |
| Licencia incompatible | variable | alto | verificación SPDX/condiciones, hold antes de deploy |
| Mezcla de conocimiento y código | media | alto | boundaries y ownership explícitos; reversible solo metadata |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Aplicación |
|---|---|---|
| Inventario software y SBOM | https://scvs.owasp.org/scvs/v1-inventory/ | F1 IDs/versión/componentes transitivos |
| Scorecard supply chain | https://openssf.org/projects/scorecard/ | Evaluador de riesgos, no garantía |
| Mínimos SBOM 2026 | https://www.cisa.gov/sbom | Hash/licencia/contexto |
| Límite de worker JS | https://nodejs.org/api/worker_threads.html | No llamar aislamiento seguro a `resourceLimits` |

## 10. Gates antes de tareas

- [x] Rutas exactas de artefactos F0 identificadas.
- [x] F0 no tiene datos ni migración y rollback es revertir PR documental.
- [ ] F1 tests rojos definidos y aprobados antes de código.
- [ ] Flags/canary de F2/F3 ratificados y probados.
- [ ] Snapshot commit y deployments para F1+.
- [x] Cada corte debe tener PR pequeño y reversible.
