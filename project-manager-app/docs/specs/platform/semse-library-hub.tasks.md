---
type: tasks
feature: "semse-library-hub"
domain: "platform"
plan: "docs/specs/platform/semse-library-hub.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/semse-library-hub-sdd-audit-20261025"
date: "2026-10-25"
---

# Tareas — SEMSE Library Hub

> El estado de completitud documental NO acredita código, CI, merge, deploy ni activación. SDD está en DRAFT; implementar requiere pasar por aprobación.

## F0 — auditoría y SDD (rama documental)

- [x] [T-001] Censar los 20 package.json de primer nivel de apps/* y packages/*, requirements Python de vision-service y existencia del lockfile; registrar SHA y límites (sin afirmar transitivas ni runtime).
- [x] [T-002] Diferenciar software libs, Tool Registry, Capability Reality Registry y bibliotecas de conocimiento.
- [x] [T-003] Redactar spec SDD 2.0, versión de capacidad 1.0, y restricciones del owner.
- [x] [T-004] Redactar ADR PROPOSED y plan de ejecución por PRs.
- [x] [T-005] Inventariar las 30 entradas, con declaración verificada/no probada, sin inventar licencias.
- [x] [T-006] Registrar fuentes OWASP, OpenSSF, CISA, Node; decisiones aplicadas/backlog.
- [ ] [T-007] Revisión independiente de documentación y ratificación de detalles técnicos; spec `APPROVED`.
- [x] [T-007A] Cruce arquitectónico de 9 dominios, Mission Control, Product Intelligence y Omega registrado en `docs/reportes/2026-10-25_library-hub_cross-semse-audit.md`; NO equivale a auditoría exhaustiva de código ni runtime.
- [ ] [T-008] Verificar índice y `pnpm spec:validate:strict` cuando llegue el gate final.
- [x] [T-009] Capturar dos snapshots JSON declarativos para 20 `package.json` de primer nivel más 8 requisitos Python y reconciliar 210 nombres, 29 repetidos y 7 especificadores divergentes; **no es F1 SBOM ni scanner automatizado**.
- [x] [T-010] Documentar escenarios y criterios de aceptación del futuro escáner F1 en `semse-library-hub.direct-reconciliation.md`, sin implementar ni ejecutar CI.

## F1 — inventario automático (PR posterior; NO HECHO)

- [ ] [T-101] Snapshot main SHA, alcance del monorepo y worker/infra desplegados.
- [ ] [T-102] Tests rojos de paquetes directos/transitivos, manifestos Python, alias, multiversión, integridad y versionado.
- [ ] [T-103] Escáner read-only sin runtime deps nuevos que genere JSON/SBOM.
- [ ] [T-104] Reconciliar direct declarations, lockfile, código importado y deployment real.
- [ ] [T-105] Comparar duplicados, licencias y advisories. Registrar «desconocido» sin false PASS.
- [ ] [T-106] Tests dirigidos + validación SDD; CI al final de F1.

## F2 — gobierno y rentabilidad (PR posterior; NO HECHO)

- [ ] [T-201] Diseñar decision schema, score y gates obligatorios; nunca convertir la puntuación en autorización.
- [ ] [T-202] Definir permisos efectivos y aprobación humana independiente.
- [ ] [T-203] Registry/version/estado/owner/fecha de revisión; revisión trimestral y alertas fuera de ciclo.
- [ ] [T-204] Cuotas y telemetría de CPU/RAM/latencia/costo reales con pruebas.
- [ ] [T-205] Resolver si metadata Git basta o requiere persistencia; migración sólo con spec independiente.
- [ ] [T-206] Tests deny-by-default e idempotencia; CI al final.

## F3 — ejecución selectiva (PR posterior; NO HECHO)

- [ ] [T-301] Primer caso de uso real, de bajo riesgo y librería ya declarada.
- [ ] [T-302] Prueba de no ejecutar/descargar/importar código arbitrario.
- [ ] [T-303] Adapter autorizado por tenant/resource + feature flag OFF por defecto.
- [ ] [T-304] Benchmark CPU/RAM, budgets, concurrencia, timeout, cancelación, limpieza.
- [ ] [T-305] Canary sintético y rollback seguros; no romper colas críticas.
- [ ] [T-306] Código, test, CI, merge, deploy, activation, evidence por separado.

## F4 — Omega / Python / gráficos avanzados (backlog)

- [ ] [T-401] Revisión por caso de negocio y licencia de Meyda/Tone/Librosa/ONNX.
- [ ] [T-402] Validar DSP con señales de prueba. «Consciencia» y «coherencia cuántica» no se declaran científicamente medidas por números arbitrarios.
- [ ] [T-403] Si necesita servicio nuevo o aislamiento imposible en hosts existentes, bloquear hasta nueva decisión del owner.

## Done para F0 (solo documentación)

- [x] SDD, plan, ADR, inventario y tasks creados como borrador.
- [ ] Checklist documental revisado; índice regenerado, validaciones y CI documentados.
- [ ] PR revisado, aprobado y fusionado; no afirmar aún.
