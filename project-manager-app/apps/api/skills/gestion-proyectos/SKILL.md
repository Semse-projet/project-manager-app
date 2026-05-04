---
name: gestion-proyectos
description: "Gestión de proyectos de construcción: hitos, cronograma, seguimiento, problemas comunes."
version: 1.0.0
author: SEMSE OS
metadata:
  semse:
    tags: [proyecto, hitos, cronograma, milestone, timeline, seguimiento, tracking]
    intents: [project_report, schedule_plan, operational_summary]
    related_skills: [seguimiento-pagos, evaluacion-contratistas]
---

# Skill: Gestión de Proyectos de Construcción

## Fases típicas de un proyecto residencial

### Fase 0: Pre-construcción
- Permisos obtenidos ✓
- Planos aprobados ✓
- Contratistas contratados ✓
- Materiales de larga entrega pedidos ✓
- Fechas de inicio confirmadas ✓

### Fase 1: Demolición / Prep (5-10% del tiempo total)
- Protección de áreas adyacentes
- Demo de lo que se va
- Disposición de escombros
- **Hito de pago**: usualmente no hay pago en demo sola

### Fase 2: Trabajo de estructura / MEP rough-in (20-30%)
- Plomería rough (antes de cerrar paredes)
- Eléctrico rough (antes de cerrar paredes)
- HVAC rough (si aplica)
- Inspección de rough-in (OBLIGATORIO antes de tapar)
- **Hito de pago**: 20-25% del contrato

### Fase 3: Drywall y acabados intermedios (20-25%)
- Instalación de drywall
- Tape y textura
- Primera capa de pintura
- **Hito de pago**: 20-25% del contrato

### Fase 4: Acabados finales (30-35%)
- Instalación de pisos
- Pintura final
- Carpintería (puertas, moldings)
- Plomería final (fixtures)
- Eléctrico final (outlets, fixtures)
- **Hito de pago**: 20% del contrato

### Fase 5: Cierre (10%)
- Limpieza profunda
- Inspección final del cliente
- Punch list (lista de detalles pendientes)
- Inspección final municipal (si requiere)
- **Hito de pago**: 10-15% final (retención)

## Señales de proyecto en problemas

🚩 Contratista no aparece 2+ días sin avisar  
🚩 Progreso visible = 0% después de semana 2  
🚩 Materiales no llegan en fecha prometida  
🚩 Solicita dinero extra antes del siguiente hito acordado  
🚩 No pasa la inspección rough-in (retrasa todo)  
🚩 Subcontratistas dicen no haber recibido pago del GC  

## Cronograma típico por tipo de proyecto

| Proyecto | Duración típica |
|---------|----------------|
| Pintura completa apartamento 2/2 | 3-5 días |
| Remodel baño básico | 1-2 semanas |
| Remodel baño completo | 3-4 semanas |
| Remodel cocina básica | 2-3 semanas |
| Remodel cocina completa | 4-8 semanas |
| Pisos (toda la casa 1,200 sqft) | 3-5 días |
| Adición de cuarto (room addition) | 8-14 semanas |
| Roofing completo (1,500 sqft) | 2-5 días |

## Protocolo de hitos SEMSE

En SEMSE OS, un hito (milestone) representa:
1. **Nombre**: descripción del trabajo completado
2. **Evidencia requerida**: fotos de antes/después, video si aplica
3. **Monto**: % del contrato asociado al hito
4. **Estado**: pending → in_progress → submitted → approved → paid

**Flujo de aprobación:**
Contratista sube evidencia → Cliente revisa (48h) → Aprueba o disputa → Si aprueba, se libera el escrow

## Cómo manejar disputes (disputas)

1. **Primero**: comunicación directa cliente-contratista (24-48h)
2. **Si no se resuelve**: escalar a SEMSE mediación
3. **Documentación necesaria**: fotos, mensajes, contrato, facturas
4. **Tiempo de resolución estándar**: 3-5 días hábiles
5. **En casos extremos**: small claims court (< $10,000 en la mayoría de estados)
