# SEMSE Agro — F2 to F5 Roadmap

Version: 1.0  
Estado: DRAFT

## F2 — Mixed FarmOps + Traceability + Prometeo Query

### Objetivo

Expandir F1 desde RanchOps hacia finca mixta:

```txt
ciclos productivos
cultivos
aplicaciones
cosechas
trazabilidad
cumplimiento configurable
consultas Prometeo seguras
```

### PRs

```txt
PR 16 — ProductionCycleOps
PR 17 — CropOps
PR 18 — ApplicationOps
PR 19 — HarvestOps
PR 20 — TraceabilityOps
PR 21 — ComplianceOps Configurable
PR 22 — Prometeo Agro Query Layer
PR 23 — F2 UI Shell Expansion
PR 24 — Cycles & Crops UI
PR 25 — Applications & Harvest UI
PR 26 — Traceability & Compliance UI
PR 27 — Prometeo Agro UI
```

### Nuevos modelos

```txt
AgroProductionCycle
AgroCropCycle
AgroInputApplication
AgroHarvestRecord
AgroTraceabilityEvent
AgroComplianceCheck
```

### Prometeo Agro F2

Prometeo Agro no debe diagnosticar ni prescribir.

Permitido:

```txt
consultas deterministicas
resumen de datos internos
explicacion de costos
propuesta de acciones confirmables
```

No permitido:

```txt
diagnostico veterinario
dosis de medicamentos
dosis de quimicos
cumplimiento legal garantizado
acciones criticas sin confirmacion
```

## F3 — Commercial Trust Layer

### Objetivo

Convertir datos internos en confianza comercial.

### PRs

```txt
PR 28 — Buyer Report Packages
PR 29 — Public Traceability Share / QR
PR 30 — Audit Export PDFs
PR 31 — Farm Trust Score / Trust Score Agro
PR 32 — Monetization Gates
PR 33 — Agro Marketplace Prep
```

### Nuevos modelos

```txt
AgroBuyerReportPackage
AgroShareLink
AgroExportFile
AgroFarmTrustScore
AgroSubscriptionEntitlement
AgroServiceProviderProfile
AgroServiceRequest
AgroServiceMatch
```

### Regla de privacidad

Por defecto, reportes externos no incluyen:

```txt
costos internos
notas privadas
datos personales innecesarios
IDs tecnicos
```

Costos solo se comparten con opt-in explicito.

## F4 — Advanced Data & Risk Intelligence

### Objetivo

Pasar de registro historico a inteligencia preventiva.

### PRs

```txt
PR 34 — WeatherOps
PR 35 — GeoFieldOps
PR 36 — SensorOps / IoT Foundation
PR 37 — SatelliteOps Foundation
PR 38 — Agro Risk Engine
PR 39 — Predictive Alerts
PR 40 — Prometeo Agro Advanced
PR 41 — Advanced Data UI
```

### Nuevos modelos

```txt
AgroWeatherObservation
AgroWeatherForecast
AgroWeatherAlert
AgroGeoFeature
AgroSensor
AgroSensorReading
AgroSatelliteObservation
AgroRiskSignal
AgroPredictiveAlert
```

### Regla F4

Primero detectar y explicar riesgo. Despues automatizar decisiones.

No diagnosticar. No prescribir. No prometer certeza.

## F5 — Agro Ecosystem & Marketplace

### Objetivo

Conectar finca con mercado y servicios:

```txt
veterinarios
agronomos
tecnicos
cuadrillas
transportistas
proveedores
compradores
auditores
contratos
pagos
reputacion
gobernanza
```

### PRs

```txt
PR 42 — Agro Marketplace Core
PR 43 — Service Provider Profiles
PR 44 — Agro Service Requests & Matching
PR 45 — Buyer Network
PR 46 — Input Supplier Network
PR 47 — TransportOps Marketplace
PR 48 — Agro Contracts
PR 49 — Agro Escrow & Payments
PR 50 — Agro Trust Passport
PR 51 — Marketplace Governance
PR 52 — Marketplace UI
```

### Nuevos modelos

```txt
AgroMarketplaceRequest
AgroMarketplaceOffer
AgroMarketplaceThread
AgroMarketplaceMessage
AgroProviderProfile
AgroProviderMatch
AgroBuyerProfile
AgroBuyerOpportunity
AgroSupplierProfile
AgroSupplierCatalogItem
AgroTransportRequest
AgroContract
AgroPaymentRecord
AgroTrustPassport
AgroGovernanceCase
```

### Regla F5

Cada transaccion debe estar conectada a:

```txt
contrato
evidencia
aprobacion
gobernanza
reputacion
```

No prometer:

```txt
financiamiento automatico
seguro automatico
certificacion gubernamental
diagnostico veterinario
garantia comercial absoluta
marketplace sin verificacion
pagos sin gobernanza
```

## Dependencias entre fases

```txt
F1 produce control operativo.
F2 agrega produccion mixta y trazabilidad.
F3 convierte registros en confianza comercial.
F4 agrega inteligencia preventiva.
F5 conecta el ecosistema economico.
```

## Orden real recomendado

No avanzar a F2 hasta que F1 tenga piloto operativo.
No avanzar a F4 hasta tener datos suficientes.
No avanzar a F5 hasta tener confianza comercial real.

