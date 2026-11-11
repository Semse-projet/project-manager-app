---
type: checklist
feature: "Unified Operational Graph Contract"
spec: "docs/specs/prometeo/unified-graph-contract.spec.md"
version: "2.1"
date: "2026-11-06"
---

# Checklist: Unified Operational Graph Contract

## Requisitos
- [ ] Escenarios P1 con Gherkin propio y trazados a pruebas (sección 9 del spec)
- [ ] Alcance y fuera de alcance claros; Q-1 resuelta
- [ ] Contrato coincide con `conversationSourceRefSchema` y con el orden de sensibilidad vigente

## Seguridad
- [ ] Autorización en el proveedor y en el servicio, no solo en el controller
- [ ] Aislamiento por tenant y por organización probado (2 × 2)
- [ ] Nodos ocultos omitidos sin placeholder ni conteo
- [ ] Denegación nunca aparece como degradación
- [ ] Sin secretos ni cuerpos sensibles en logs, `label` ni `attributes`
- [ ] Graphify exige `internal:architecture:read` también vía Prometeo
- [ ] Flag ausente o desconocido se trata como `off`

## Datos y eventos
- [ ] Sin migración; sin tablas de grafo
- [ ] Reconstruible: misma consulta, mismo resultado

## Usabilidad
- [ ] `degradedSources` con motivo del catálogo cerrado
- [ ] Guía de proveedor nuevo escrita
- [ ] Métricas con nombre, SLO y responsable aprobados (Q-3)

## Entrega
- [ ] Tests, build, typecheck y lint en verde
- [ ] `spec:validate:strict`, índice y cobertura en verde
- [ ] CI y merge registrados; canary diferido al slice 3 (D-16)
