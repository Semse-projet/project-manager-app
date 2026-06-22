# SEMSE Agro / FarmOps — Master Spec

Version: 1.1  
Estado: APPROVED FOR PLANNING  
Relacion con SEMSEproject: vertical/ecosistema hermano. Comparte plataforma, no fork.

## 1. Tesis central

SEMSE Agro no es una app agricola aislada. Es una vertical de dominio dentro de
SEMSEproject para convertir una finca en un sistema operativo inteligente.

La finca deja de depender de libreta, Excel, memoria y WhatsApp, y pasa a operar
con datos verificables:

```txt
tierra
animales
cultivos
trabajadores
maquinaria
insumos
costos
evidencia
trazabilidad
auditoria
riesgos
mercado
```

Promesa final:

```txt
SEMSE Agro convierte la finca en un sistema operativo inteligente: controla
animales, cultivos, tareas, inventario, costos, evidencia, trazabilidad,
riesgos, reportes, pagos y mercado desde un solo ecosistema.
```

English:

```txt
SEMSE Agro turns the farm into an intelligent operating system: manage animals,
crops, tasks, inventory, costs, evidence, traceability, risks, reports,
payments, and market access from one ecosystem.
```

## 2. Categoria de mercado

La categoria se conoce como:

```txt
Farm Management Software
Agriculture Management Software
Farm Operations Management
Ranch Management Software
FarmOps OS
```

Estas plataformas combinan:

```txt
mapas de finca
tareas y calendario
inventario
costos
trabajadores
animales
cultivos
maquinaria
clima
reportes
cumplimiento
trazabilidad
analitica / IA
offline / mobile
```

## 3. Lecciones del mercado

El mercado existente muestra un patron claro:

| Referencia funcional | Enfoque | Leccion para SEMSE Agro |
|---|---|---|
| Agworld | planificacion de temporada, colaboracion, offline | SeasonOps, tareas por lote, tecnicos |
| Farmbrite | finca todo-en-uno | Farm Core para productores pequenos/medianos |
| AGRIVI | cadena agroalimentaria enterprise | AgriChain y trazabilidad alimento-produccion-venta |
| Conservis | costo real y row crops | CostOps por campo, lote, cultivo o animal |
| Granular / Corteva | rendimiento y agronomia | Yield intelligence futura |
| Climate FieldView | mapas, scouting, prescripciones | FieldVision con capas, fotos, notas |
| Trimble / PTx | maquinaria y flota | MachineOps |
| Cropio | satelite y monitoreo remoto | SatelliteOps y alertas |
| Croptracker | fresh produce, sprays, trazabilidad | TraceCrop, quimicos, intervalos |
| Tend | IA practica para productores | Grower AI / Prometeo Agro |
| AgriWebb | ganaderia/ranch management | RanchOps como wedge inicial |

La oportunidad no es copiar una app. La oportunidad es unificar:

```txt
cultivos + ganado + trabajadores + costos + evidencia + ventas + auditoria + IA
```

para productores pequenos/medianos, bilingue, movil y offline-first.

## 4. Decision arquitectonica principal

SEMSE Agro no debe ser fork.

Debe vivir como vertical de dominio sobre SEMSE Core:

```txt
SEMSE Core
├── Identity / Roles
├── Projects / Lifecycle Engine
├── Tasks
├── Evidence
├── Costing
├── Signatures
├── Audit Log
├── Prometeo / RAG
├── Notifications
├── Payments / Escrow
├── Marketplace
├── Trust
├── Governance
└── Domain Verticals
    ├── Construction / BuildOps
    ├── Property Ops
    └── Agro / FarmOps
```

Regla:

```txt
SEMSE Core mantiene plataforma.
SEMSE Agro agrega ontologia agricola.
No duplicar motores core.
```

## 5. Patron canonico

El patron operativo de FarmOps es:

```txt
Farm / Field / Lot
→ Crop / Animal / Group
→ Task
→ Input
→ Worker / Equipment
→ Evidence
→ Cost
→ Result
→ Audit
→ Recommendation
```

En SEMSE:

```txt
Farm
→ FarmUnit
→ ProductionUnit / ProductionCycle
→ FarmTask
→ InventoryMovement
→ EvidenceItem
→ CostEntry
→ AuditEvent
→ TraceabilityEvent
→ ComplianceCheck
→ ReportPackage
→ TrustScore
```

## 6. Abstracciones principales

### Farm

La finca como organizacion operativa: dueno, ubicacion, tipo de operacion,
unidades, animales, grupos, tareas, inventario, costos, evidencia y auditoria.

### FarmUnit

Division fisica:

```txt
potrero
corral
bodega
campo
lote
invernadero
fuente de agua
area de trabajo
camino
zona de riesgo
```

### ProductionUnit

Unidad productiva viva:

```txt
animal individual
grupo de animales
lote de cultivo
potrero
invernadero
ciclo de engorde
temporada agricola
```

### ProductionCycle

Ciclo productivo:

```txt
Cerdos de engorde A
Maiz 2026 — Campo A
Produccion de leche junio
Cosecha de tomate primavera
Temporada mixta 2026
```

## 7. Fases del producto

### F0 — Discovery / Arquitectura

Objetivo:

```txt
Definir vision, modulos, alcance, wedge inicial y relacion con SEMSEproject.
```

Salida:

```txt
documento maestro
auditoria de mercado
arquitectura inicial
MVP recomendado
roadmap F1-F5
```

### F1 — RanchOps Core

Pregunta:

```txt
Puedo controlar una finca ganadera pequena/mediana?
```

Incluye:

```txt
fincas
unidades
animales
grupos
tareas
inventario
costos
evidencia
dashboard
auditoria semanal
offline sync minimo
```

Promesa:

```txt
Registra tu finca, controla tus animales, asigna tareas, consume inventario,
guarda evidencia, calcula costos y genera auditoria semanal incluso cuando
trabajas sin senal.
```

### F2 — Mixed FarmOps

Pregunta:

```txt
Puedo controlar una finca mixta con animales, cultivos, ciclos productivos,
aplicaciones, cosechas y trazabilidad?
```

Incluye:

```txt
ProductionCycleOps
CropOps
ApplicationOps
HarvestOps
TraceabilityOps
ComplianceOps configurable
Prometeo Agro Query Layer
```

### F3 — Commercial Trust Layer

Pregunta:

```txt
Como convierto mis datos de finca en confianza comercial?
```

Incluye:

```txt
Buyer Report Packages
Public Traceability Share / QR
Audit Export PDFs
Farm Trust Score
Monetization Gates
Agro Marketplace Prep
```

### F4 — Advanced Data & Risk Intelligence

Pregunta:

```txt
Puedo anticipar riesgos antes de perder dinero, animales, cultivos o confianza?
```

Incluye:

```txt
WeatherOps
GeoFieldOps
SensorOps / IoT Foundation
SatelliteOps Foundation
Agro Risk Engine
Predictive Alerts
Prometeo Agro Advanced
```

### F5 — Agro Ecosystem & Marketplace

Pregunta:

```txt
Como conecto mi finca con servicios, compradores, insumos, transporte,
contratos, pagos y reputacion?
```

Incluye:

```txt
Agro Marketplace Core
Service Provider Profiles
Service Requests & Matching
Buyer Network
Input Supplier Network
TransportOps Marketplace
Agro Contracts
Agro Escrow & Payments
Agro Trust Passport
Marketplace Governance
```

## 8. MVP real recomendado

No empezar con satelite, sensores, marketplace, pagos o IA avanzada.

MVP 1:

```txt
crear finca
crear corral/potrero
registrar animal o grupo
crear tarea
completar tarea
adjuntar evidencia
crear inventario
consumir inventario
generar costo automatico
ver dashboard
generar auditoria semanal
```

Este flujo ya demuestra valor:

```txt
control operativo + evidencia + costos + auditoria
```

## 9. Wedge de mercado

No vender "plataforma agricola completa" al inicio.

Entrada recomendada:

```txt
Control ganadero simple con evidencia, costos y auditoria semanal.
```

Luego:

```txt
Control mixto de finca con cultivos, trazabilidad y reportes para compradores.
```

Finalmente:

```txt
Sistema operativo agricola con inteligencia, marketplace y confianza comercial.
```

## 10. Monetizacion

### Free

```txt
1 finca
25 animales
3 unidades
tareas basicas
inventario basico
dashboard basico
evidencia limitada
```

### Pro

```txt
3 fincas
250 animales
grupos ilimitados
costos
auditoria semanal
offline sync
Prometeo basico
```

### Business

```txt
fincas ilimitadas
ciclos/cultivos
trazabilidad
buyer packages
share links / QR
PDF exports
Trust Score
cumplimiento configurable
Prometeo avanzado
```

### Enterprise

```txt
multi-farm organization
roles avanzados
reportes personalizados
plantillas por comprador
API externa
marketplace avanzado
gobernanza
integraciones
soporte dedicado
```

## 11. Riesgos principales

| Riesgo | Severidad | Mitigacion |
|---|---:|---|
| Scope creep | Alta | F1 RanchOps primero; F2-F5 despues |
| Offline mal disenado | Alta | Event queue desde F1, sync despues |
| Captura de datos pesada | Alta | Formularios cortos, defaults, voz/foto despues |
| IA peligrosa | Alta | Consultas deterministicas, warnings, confirmacion |
| Cumplimiento mal comunicado | Alta | "Configurable", no certificacion universal |
| Marketplace vacio | Alta | Crear despues de confianza/trazabilidad |
| Satelite/sensores mal interpretados | Media | Senales de apoyo, no diagnostico |

## 12. Frase guia

```txt
Primero control.
Despues trazabilidad.
Despues confianza comercial.
Despues inteligencia predictiva.
Despues marketplace.
```

## 13. Control de ejecucion

La vision F0-F5 esta aprobada como direccion de producto, pero no autoriza una
implementacion masiva.

El control operativo vive en:

```txt
docs/specs/agro/EXECUTION_CONTROL.md
```

Orden inmediato:

```txt
1. Mantener SEMSEproject verde para Railway.
2. Implementar F1 en PRs pequenos.
3. Validar un piloto RanchOps.
4. Solo entonces avanzar a F2.
```

Regla:

```txt
Si una decision no ayuda al piloto F1 o a mantener Railway verde, no pertenece al
trabajo activo actual.
```
