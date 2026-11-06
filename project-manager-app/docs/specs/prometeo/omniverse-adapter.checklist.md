---
type: checklist
feature: "Omniverse Read-Only Projection Adapter"
spec: "docs/specs/prometeo/omniverse-adapter.spec.md"
version: "2.1"
date: "2026-11-06"
---

# Checklist: Omniverse Read-Only Projection Adapter

## Requisitos
- [ ] Escenarios P1 con Gherkin y trazados a pruebas (sección 9 del spec)
- [ ] Alcance solo en `semse-project-manager-app`; condiciones externas separadas
- [ ] Q-1 a Q-8 resueltas por el owner
- [ ] Slices 1 a 3 aprobados y fusionados

## Seguridad
- [ ] Identidad de servicio propia; `OPS_ADMIN` no se usa para el consumidor
- [ ] `projectId` obligatorio; no existe instantánea de todo el tenant
- [ ] Cero escrituras demostradas con una prueba (sin `ensureActorContext`)
- [ ] Aislamiento por tenant y organización probado (2 × 2)
- [ ] Allowlist publicada, techo de sensibilidad y sin datos personales ni ubicaciones
- [ ] Nodos ocultos omitidos sin rastro
- [ ] Exportaciones y denegaciones auditadas sin contenido
- [ ] Kill switch: flag en `off` o revocación de la identidad
- [ ] Sin cambios en `CORS_ORIGINS` ni en variables de producción
- [ ] Flag ausente o desconocido se trata como `off`

## Datos y eventos
- [ ] Sin migración del núcleo; tablas nuevas solo con decisión previa
- [ ] Sin acceso directo a base de datos ni base espejo
- [ ] Salida determinista y reconstruible

## Usabilidad y operación
- [ ] Respuesta con `freshness`, `degradedSources`, `truncated`, `maxDepthApplied` y `correlationId`
- [ ] Catálogo de errores sin detalles internos
- [ ] Métricas con dimensiones, SLO y responsable aprobados (Q-4)
- [ ] Runbook de revocación y de apagado

## Entrega
- [ ] Tests, build, typecheck y lint en verde
- [ ] `spec:validate:strict`, índice y cobertura en verde
- [ ] CI, merge, despliegue y activación evidenciados por separado
- [ ] Evidencia del owner de las condiciones externas antes del `canary`
