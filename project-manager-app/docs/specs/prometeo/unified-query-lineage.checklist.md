---
type: checklist
feature: "Unified Query and Lineage Layer"
spec: "docs/specs/prometeo/unified-query-lineage.spec.md"
version: "2.1"
date: "2026-11-06"
---

# Checklist: Unified Query and Lineage Layer

## Requisitos
- [ ] Escenarios P1 con Gherkin y trazados a pruebas (sección 9 del spec)
- [ ] Alcance claro: solo lectura, sin MCP, sin UI en este slice
- [ ] Q-1 a Q-8 resueltas por el owner
- [ ] Slices 1 y 2 aprobados y fusionados

## Seguridad
- [ ] Autorización en el servicio, no solo en el controller ni en la guarda de recurso
- [ ] Aislamiento por tenant y organización probado (2 × 2)
- [ ] Nodos ocultos omitidos sin placeholder ni conteo; sin oráculo de existencia
- [ ] Denegación nunca aparece como degradación
- [ ] Topes y cuota por actor impuestos por el servidor
- [ ] `label` y `attributes` entregados como datos no confiables
- [ ] La herramienta no es accesible por MCP
- [ ] `AgentDecision` y el RAG de Prometeo no se usan como proveedores
- [ ] Flag ausente o desconocido se trata como `off`

## Datos y eventos
- [ ] Sin migración ni caché persistente
- [ ] `executionId` validado junto con `tenantId`; sin copiar resúmenes de H05
- [ ] Reconstruible: misma consulta, mismo resultado

## Usabilidad y operación
- [ ] Respuesta, errores y semántica de `complete` documentados
- [ ] Métricas con dimensiones, SLO y responsable aprobados (Q-6)
- [ ] `correlationId` propagado de extremo a extremo
- [ ] Runbook de degradación y de apagado del flag

## Entrega
- [ ] Tests, build, typecheck y lint en verde
- [ ] `spec:validate:strict`, índice y cobertura en verde
- [ ] CI, merge, despliegue y activación evidenciados por separado
- [ ] Canary autenticado con un tenant
