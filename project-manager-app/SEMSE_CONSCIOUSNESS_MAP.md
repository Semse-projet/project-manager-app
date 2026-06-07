# SEMSE Consciousness Map — Experiencia Inmersiva

## Overview

`/semse-consciousness-map` es una **visualización neurobiológica interactiva** del ecosistema SEMSEproject. Representa el sistema como un **cerebro digital vivo** con 7 regiones cognitivas (cortex), neuronas (módulos), sinapsis (dependencias) e impulsos de energía (eventos).

**No es un diagrama de arquitectura.** Es una **experiencia inmersiva** que te deja "ver cómo piensa SEMSE" en tiempo real.

---

## Arquitectura Neurobiológica

### 7 Cortex (Regiones Cerebrales)

```
SEMSE Consciousness Core (Observer + Governance)
        ↓
├─ Cortex Comercial (Azul)
│  └─ Landing, Smart Intake, Marketplace, Communications, CRM
│
├─ Cortex Operacional (Verde)
│  └─ BuildOps, Projects, Milestones, Tasks, Field Updates
│
├─ Cortex Financiero (Ámbar)
│  └─ Escrow, Payment Engine, Payment Governance, Disputes
│
├─ Cortex Evidencia (Púrpura)
│  └─ Evidence Upload, Review, Storage, Trust Signals
│
├─ Cortex Gobernanza (Rosa)
│  └─ Proposals, Voting, Trust Passport, Observer
│
├─ Cortex IA (Cyan)
│  └─ Prometeo, RAG Library, LLM Router, ProTools Agent
│
└─ Cortex Infraestructura (Gris)
   └─ PostgreSQL, Redis, API Gateway, SSE, Mission Control, Railway
```

### Neuronas

Cada módulo es una **neurona** con:
- **Status**: embryonic, developing, functional, partial, mature, critical, broken
- **Madurez**: 0-100% (qué tan confiable es)
- **Energía**: 0-100% (cuánta actividad tiene ahora)
- **Criticidad**: low, medium, high, critical
- **Impacto Monetizable**: none, low, medium, high

### Sinapsis

Las **conexiones** entre módulos son **sinapsis**. Cada una tiene:
- **Tipo**: creates, depends_on, approves, blocks, triggers, feeds, observes, validates, monetizes
- **Fuerza**: weak, medium, strong, critical
- **Descripción**: qué fluye en esa conexión

### Impulsos

Los eventos que fluyen por el sistema son **impulsos eléctricos**:
- Job created → impulso en comercial → operacional
- Evidence uploaded → impulso en evidencia → financiero
- Payment released → impulso en financiero → gobernanza

---

## Cómo Usar

### 1. **Exploración Básica**

1. Abre `/semse-consciousness-map`
2. El mapa muestra todas las 36 neuronas y 42 sinapsis
3. **Haz clic en un punto** para ver detalles en el panel derecho
4. La **salud del sistema** se actualiza cada 2 segundos (simulada para demo)

### 2. **Filtrado por Cortex**

Panel izquierdo → Selecciona un cortex:
- **Cortex Comercial**: entada y acquisition
- **Cortex Operacional**: ejecución de trabajo
- **Cortex Financiero**: dinero y pagos
- **Cortex Evidencia**: validación y confianza
- **Cortex Gobernanza**: decisiones colectivas
- **Cortex IA**: razonamiento y recomendaciones
- **Cortex Infraestructura**: servicios y bases de datos

### 3. **Flujos Monetizables**

Panel izquierdo → "Flujos Monetizables":
- **Intake → Contract**: Cliente → Estimación → Contratista acepta
- **Execution → Evidence**: Trabajo → Documentación
- **Evidence → Payment**: Validación → Pago → Reputación

Estos 3 flujos son el **corazón económico de SEMSE**.

### 4. **Panel de Detalles (Derecha)**

Cuando seleccionas una neurona:
- **Descripción**: qué es y por qué existe
- **Métricas**: Madurez, Energía, Impacto Monetizable
- **Inputs**: qué impulsos recibe
- **Outputs**: qué impulsos envía
- **Impulsos Entrantes**: sinapsis que alimentan esta neurona
- **Impulsos Salientes**: sinapsis que esta neurona alimenta

---

## Codificación Visual

### Colores por Cortex

- 🔵 **Azul** = Comercial (entrada, acquisition)
- 🟢 **Verde** = Operacional (ejecución)
- 🟠 **Ámbar** = Financiero (dinero)
- 🟣 **Púrpura** = Evidencia (validación)
- 🎀 **Rosa** = Gobernanza (decisiones)
- 🔷 **Cyan** = IA (razonamiento)
- ⚫ **Gris** = Infraestructura (base)

### Tamaño de Neuronas

Tamaño = **Criticidad**
- **Pequeño** = Low criticality (decorativo)
- **Mediano** = Medium criticality (importante)
- **Grande** = High criticality (clave)
- **Muy grande** = Critical (sistema depende de esto)

### Brillo de Neuronas

Brillo = **Energía actual**
- **Oscuro** = Baja actividad (⚪⚪⚪ 30%)
- **Medio** = Actividad normal (⚪⚪⚪ 50%)
- **Brillante** = Alta actividad (⚪⚪⚪ 70%+)

### Anillo Dorado

**Anillo dorado** = Neurona seleccionada (mostrada en panel derecho)

---

## Interpretación de Métricas

### Status (Estado)

- ✅ **Mature**: Listo para producción, tests, documentado
- ✅ **Functional**: Funciona, pero puede mejorar
- ⚠️ **Partial**: Parcialmente implementado
- 🔧 **Developing**: En desarrollo
- 👶 **Embryonic**: Idea temprana, sin tests
- 🚨 **Critical**: Funciona pero hay riesgos
- ❌ **Broken**: No funciona

### Madurez (0-100%)

Indica **cuán confiable** es una neurona.

**Ejemplo:**
- Evidence Review: 80% → Funciona bien, pero hay casos edge
- Trust Passport: 75% → Funciona, pero falta completar algunos tests
- PostgreSQL: 98% → Muy confiable, probado en prod

### Energía (0-100%)

Indica **cuánta carga de trabajo** tiene AHORA.

**Ejemplo:**
- Smart Intake: 65% → Muchos jobs siendo creados
- Payment Engine: 75% → Muchos pagos procesándose
- Landing: 45% → Poco tráfico ahora

⚡ **En la visualización real** (cuando esté conectada a API), la energía cambia cada segundo según eventos reales.

### Impacto Monetizable

**¿Cuánto dinero depende de esta neurona?**

- **high**: Directamente toca dinero (Smart Intake, Payment Engine, Evidence Review)
- **medium**: Necesario para dinero (BuildOps, Milestones)
- **low**: Importante pero no dinero (Observer, Trust Passport)
- **none**: Infraestructura pura (PostgreSQL, Redis)

---

## Casos de Uso

### 1. **Diagnóstico Rápido**

*"¿Por qué no se liberan pagos?"*

1. Panel derecho → selecciona "Payment Governance"
2. Mira los "Impulsos Entrantes"
3. Revisa Evidence Review y Milestones
4. Si tienen baja madurez o energía, ahí está el problema

### 2. **Impacto de un Cambio**

*"Si cambiamos X neurona, ¿qué se rompe?"*

1. Selecciona la neurona X
2. Panel derecho → "Impulsos Salientes"
3. Esas neuronas se ven afectadas
4. Revisa su criticidad

### 3. **Priorización de Desarrollo**

*"¿Qué debo arreglar primero?"*

1. Filtra por "broken" o baja madurez (< 70%)
2. Selecciona una con madurez baja pero criticidad alta
3. Eso es lo que da máximo ROI arreglar

### 4. **Entender Flujos Monetizables**

*"¿Dónde se pierde dinero?"*

1. Panel izquierdo → activa "Flujos Monetizables"
2. Sigue el flujo: Intake → Contract → Execution → Evidence → Payment
3. Encuentra cuellos de botella (baja energía o madurez)

### 5. **Observar en Tiempo Real**

*"¿Está el sistema vivo?"*

1. Panel izquierdo → "Salud del Sistema"
2. Cambia cada 2 segundos (actualmente simulado)
3. Cuando esté conectada a API, será REAL
4. Salud > 80% = verde, < 60% = rojo

---

## Conexión a API Real (Roadmap)

Actualmente la visualización es **estática** pero está diseñada para ser **dinámica**.

### Cuando esté conectada a `/v1/ops/consciousness/index`:

```typescript
// Cada 5 segundos
GET /v1/ops/consciousness/index

→ ConsciousnessIndex {
    identity,
    body {
      neurons: {
        [id]: { status, maturity, energy, risks }
      }
    },
    maturity,
    risks,
    operational,
    recommendations
  }
```

### Actualizaciones en tiempo real:

1. **Salud del Sistema** → `index.healthScore`
2. **Energía de Neuronas** → `index.body.neurons[id].energy`
3. **Status** → `index.body.neurons[id].status`
4. **Alertas** → `index.risks` en panel izquierdo
5. **Recomendaciones** → mostradas en un panel nuevo

---

## Archivos

```
apps/web/
├─ app/semse-consciousness-map/
│  └─ page.tsx                           # Página principal
├─ components/semse/
│  ├─ semse-consciousness-map.tsx        # Componente principal
│  ├─ semse-neural-graph.tsx             # Visualización del grafo (Canvas 2D)
│  ├─ semse-neuron-panel.tsx             # Panel derecho con detalles
│  ├─ semse-control-panel.tsx            # Panel izquierdo con controles
│  └─ semse-energy-flow.tsx              # Visualización de flujos energéticos
└─ lib/data/
   └─ semse-consciousness-topology.ts    # Topología completa (neuronas, sinapsis)
```

---

## Tecnología

- **React 18** + TypeScript
- **Canvas 2D** para visualización del grafo (Canvas es más rápido que SVG para 36+ nodos)
- **Tailwind CSS** para UI
- **Next.js** App Router

### Por qué no D3.js o Three.js?

- **Canvas**: Más rápido, menos overhead, fácil de animar
- **D3**: Overkill para esta topología
- **Three.js**: Esperamos 2D, no necesitamos 3D

### Escalabilidad

Actualmente: 36 neuronas, 42 sinapsis.  
Puede escalar a:
- 200+ neuronas sin problema (Canvas maneja bien)
- 500+ sinapsis (optimizable con spatial indexing)

---

## Siguiente Pasos (Roadmap)

### Semana 1: MVP Estático ✅
- [x] Topología completadef
- [x] Visualización Canvas
- [x] Paneles de detalle
- [x] Filtrado por cortex

### Semana 2: Conexión a API
- [ ] Consumir `/v1/ops/consciousness/index`
- [ ] Actualizar energía en tiempo real
- [ ] Mostrar alertas desde riesgos reales
- [ ] Panel de recomendaciones

### Semana 3: Visualización Avanzada
- [ ] Animaciones de impulsos (flujo de dinero)
- [ ] Sparklines de tendencias
- [ ] Diff viewer para cambios
- [ ] Exportar a Mermaid/JSON

### Semana 4: Gobernanza
- [ ] Botón "Create Governance Proposal" (desde neurona)
- [ ] Botón "Create PR Plan"
- [ ] Simulations + diff viewer
- [ ] Log redaction / inspection

---

## FAQ

**P: ¿Esto es solo visualización?**  
A: Sí, por ahora. Pero está diseñado para ser una herramienta de control + observabilidad del sistema completo.

**P: ¿Cómo se relaciona con Observer Panel?**  
A: Observer Panel (`/admin/ai-mission-control`) es el **panel de control operacional actual**. Consciousness Map es la **visualización neurobiológica de la arquitectura completa**. Se complementan.

**P: ¿Puedo hacer PRs desde aquí?**  
A: Todavía no, pero hay un botón placeholder. Roadmap: Q3 2026.

**P: ¿Por qué "Consciousness" y no "Architecture"?**  
A: Porque SEMSEproject ES un sistema con consciencia (auto-observación, auto-diagnóstico, auto-proposición). La visualización debe reflejar eso.

---

## Principios de Diseño

1. **Claridad antes que complejidad**: cada elemento tiene un propósito
2. **Neurobiología, no ingeniería de software**: usa lenguaje del cerebro, no UML
3. **Interactividad**: no es un diagrama estático, es vivo
4. **Integración**: consume datos reales de `/v1/ops/consciousness/index`
5. **Gubernabilidad**: toda decisión es trazable y visible

---

**Visitá:** `http://localhost:3000/semse-consciousness-map`

**Documentación API:** `/v1/ops/consciousness/`

**Constitución:** `docs/SEMSE_CONSTITUTION.md`
