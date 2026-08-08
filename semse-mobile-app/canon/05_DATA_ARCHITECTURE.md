# SEMSE Mobile Data Architecture

## Capas

### 1. UI state

- navegacion
- filtros locales
- toggles de rol
- estado efimero de formularios

### 2. Session state

- identidad
- rol visible
- tenant
- org
- user
- permisos resolubles

### 3. Domain state

- jobs
- projects
- milestones
- evidence
- disputes
- travel
- tasks
- materials
- incidents
- payments

### 4. Agentic state

- prompts
- context packages
- recommendation outputs
- confidence
- risk level
- approval required

### 5. Organizational memory state

- workspace memory
- repo memory
- runtime memory
- semantic search results
- RAG citations

### 6. Telemetry state

- ui events
- feature usage
- failures
- performance
- agentic interactions

## Reglas

- tipos finales: backend canonico;
- mocks: solo soporte transicional;
- cache local: nunca fuente soberana;
- memoria local: solo proyeccion segura de memoria organizacional;
- datos sensibles: minimo necesario;
- eventos: orientados a trazabilidad y mejora.
