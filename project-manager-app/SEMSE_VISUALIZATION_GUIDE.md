# SEMSE Neural Architecture Visualization Guide

## What You've Built

A **multi-layered neurobiological visualization** of SEMSEproject as a living digital organism.

```
                           ┌────────────────────┐
                           │  SEMSE CORE        │
                           │ Consciousness +    │
                           │ Observer Pattern   │
                           └────────┬───────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                │
        ┌──────────▼────────┐  ┌────▼────────┐  ┌──▼──────────────┐
        │ Cortex Comercial  │  │ Cortex      │  │ Cortex          │
        │ (Blue)            │  │ Operacional │  │ Financiero      │
        │                   │  │ (Green)     │  │ (Amber)         │
        ├─ Landing          │  ├─ BuildOps   │  ├─ Escrow         │
        ├─ Smart Intake     │  ├─ Projects   │  ├─ Payment Eng    │
        ├─ Marketplace      │  ├─ Milestones │  ├─ Payment Gov    │
        ├─ Comms            │  ├─ Tasks      │  └─ Disputes       │
        └─ CRM              │  └─ Field Ops  │
                            │                │
        ┌──────────────────┐┴──┐  ┌─────────▼──────────┐
        │ Cortex Evidencia │   │  │ Cortex Gobernanza  │
        │ (Purple)         │   │  │ (Pink)             │
        │                  │   │  │                    │
        ├─ Upload          │   │  ├─ Governance       │
        ├─ Review Agent    │   │  ├─ Voting           │
        ├─ Storage         │   │  ├─ Trust Passport   │
        └─ Trust Signals   │   │  └─ Observer         │
                           │   │
                    ┌──────┘   └──────┐
                    │                 │
            ┌───────▼──────────┐  ┌───▼─────────────┐
            │ Cortex IA        │  │ Cortex Infra    │
            │ (Cyan)           │  │ (Gray)          │
            │                  │  │                 │
            ├─ Prometeo RAG    │  ├─ PostgreSQL     │
            ├─ RAG Library     │  ├─ Redis          │
            ├─ LLM Router      │  ├─ API Gateway    │
            └─ ProTools Agent  │  ├─ SSE            │
                               │  ├─ Mission Ctrl   │
                               │  └─ Railway        │
```

## The 3 Monetization Flows (The Economic Heart)

```
FLOW 1: INTAKE → CONTRACT
┌──────────┐    ┌──────────────┐    ┌──────────┐
│ Landing  │───→│ Smart Intake │───→│ProTools  │
└──────────┘    └──────┬───────┘    │Estimate  │
                       │            └──────┬───┘
                       ▼                   │
              ┌─────────────────┐          │
              │ Marketplace     │◄─────────┘
              │ (Matching)      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Projects Create │
              │ (Contract)      │
              └─────────────────┘


FLOW 2: EXECUTION → EVIDENCE
┌──────────┐    ┌──────────┐    ┌─────────┐
│ Projects │───→│BuildOps  │───→│Milestones
└──────────┘    └──────┬───┘    └────┬────┘
                       │             │
                       ▼             ▼
              ┌──────────────────────┐
              │ Field Updates        │
              │ (Reality happening)  │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Evidence Upload      │
              │ (Photos/Videos/Docs) │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Evidence Review      │
              │ (Validation)         │
              └──────────────────────┘


FLOW 3: EVIDENCE → PAYMENT → REPUTATION
┌──────────────────┐    ┌──────────────────┐
│ Evidence Reviewed│───→│Payment Governance│
└──────────────────┘    └────────┬─────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Escrow (Hold $) │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Payment Engine  │
                        │ (Process $)     │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Trust Passport  │
                        │ (Reputation++)  │
                        └─────────────────┘
```

## Visual Encoding

### Node Size = Criticality
```
●     = Low criticality (nice-to-have)
●●    = Medium criticality (important)
●●●   = High criticality (system depends)
●●●●  = Critical (system breaks without)
```

### Node Brightness = Current Energy
```
[●]  = Dim (low activity, 20-40%)
[●]  = Medium (normal, 40-70%)
[●]  = Bright (high activity, 70%+)
```

### Node Color = Cortex/Function
```
🔵 Blue   = Comercial (customers, intake)
🟢 Green  = Operacional (execution)
🟠 Amber  = Financiero (money, escrow)
🟣 Purple = Evidencia (validation)
🎀 Pink   = Gobernanza (governance)
🔷 Cyan   = IA (reasoning, RAG)
⚫ Gray   = Infra (databases, services)
```

### Edge Strength = Dependency Strength
```
—   = Weak (optional signal)
— —  = Medium (normal flow)
=== = Strong (critical path)
≡≡≡ = Critical (system blocks on this)
```

### Edge Color = Relationship Type
```
🟤 Brown    = depends_on (needs this to work)
🟢 Green    = creates (generates new entity)
🟡 Yellow   = feeds (sends data/signal)
🔴 Red      = blocks (prevents action)
🔵 Blue     = triggers (starts process)
🟣 Purple   = validates (approves)
```

## Reading the Map (Examples)

### Example 1: Trace the Money Path
1. Start at "Smart Intake" (blue, medium brightness)
2. Follow edges to "ProTools Agent"
3. To "Marketplace"
4. To "Projects"
5. To "Milestones"
6. To "Payment Governance"
7. To "Escrow"
8. To "Payment Engine"
9. To "Trust Passport"

**What you learned:** A job's value flows through these 9 neurons. If ANY breaks, money doesn't flow.

### Example 2: Find a Bottleneck
1. Look for a node that is:
   - High criticality (large)
   - Low maturity (red status badge)
   - High incoming edges (many dependencies)
   
2. That's your bottleneck. Fix it = high ROI

### Example 3: Understand Impact
1. Click on "Evidence Review" (purple)
2. Panel says maturity: 80%
3. Outgoing edges go to: Payment Governance, Trust Passport
4. **Implication:** Evidence Review feeds 2 critical paths. Improve it = unlocks both.

### Example 4: Test Red Flags
1. Look for "broken" or "embryonic" status
2. If also high criticality → URGENT
3. If low criticality → can wait

Example:
- "Trust Passport" broken + high criticality = governance broken = URGENT
- "Field Ops" broken + medium criticality = execution slower = important
- "Communications" broken + medium monetization = nice-to-have = can wait

---

## System Health Score (Panel Left)

```
80-100%  🟢 GREEN   = System healthy, responsive
60-80%   🟡 YELLOW  = Degraded, some issues
< 60%    🔴 RED     = Critical, manual intervention needed
```

**What affects it:**
- Maturity of critical nodes (BuildOps, Payment Engine, etc.)
- Current energy (high activity = higher health needed)
- Unresolved risks
- Blocked nodes

**Reading it in real-time:**
- Updates every 2 seconds (currently simulated)
- When connected to API: every 1-5 seconds from `/v1/ops/consciousness/`

---

## Cortex Filtering (Panel Left)

Click a cortex to focus on ONE region:

### Cortex Comercial (Blue)
**Time Window:** Hours-days  
**Actors:** Customers, marketers  
**Problem it solves:** Where do customers come from? Are we acquiring?  
**Key metric:** Intake volume → conversion rate  

### Cortex Operacional (Green)
**Time Window:** Days-weeks  
**Actors:** Field teams, project managers  
**Problem it solves:** Is work getting done on time?  
**Key metric:** Milestones on schedule, field productivity  

### Cortex Financiero (Amber)
**Time Window:** Minutes-days  
**Actors:** Accountants, clients, contractors  
**Problem it solves:** Where's the money? When does it flow?  
**Key metric:** Payment success rate, dispute rate  

### Cortex Evidencia (Purple)
**Time Window:** Hours-days  
**Actors:** Field workers, project managers  
**Problem it solves:** Did the work get done correctly?  
**Key metric:** Evidence approval rate, rework rate  

### Cortex Gobernanza (Pink)
**Time Window:** Days-months  
**Actors:** Admins, community  
**Problem it solves:** Who decides what? Are we fair?  
**Key metric:** Trust score, proposal participation  

### Cortex IA (Cyan)
**Time Window:** Seconds-minutes  
**Actors:** Agents, LLMs  
**Problem it solves:** What should we recommend? What do users ask?  
**Key metric:** RAG accuracy, recommendation quality  

### Cortex Infraestructura (Gray)
**Time Window:** Milliseconds-seconds  
**Actors:** DevOps, databases  
**Problem it solves:** Can users connect? Is data safe?  
**Key metric:** Uptime, latency, CPU/memory  

---

## Monetization Flows (Panel Left Toggle)

Each flow is a **sequence of value transformation:**

```
INTAKE → CONTRACT
Energy: Customer intent
Value: Lead captured
Status: ✅ 82% healthy

EXECUTION → EVIDENCE
Energy: Work done
Value: Proof of work
Status: ✅ 80% healthy

EVIDENCE → PAYMENT
Energy: Validation
Value: $$$ released
Status: ⚠️ 75% healthy (Payment Governance bottleneck)
```

When you toggle "Flujos Monetizables", the graph **highlights** these 3 paths:
- Highlights the neurons in that flow
- Dims everything else
- Shows you where money gets stuck

---

## Real-time Updates (Future)

Currently: **Static demo** (energy updates are simulated)

When connected to API `/v1/ops/consciousness/`:

```
Every 1-5 seconds:
├─ Node colors update (status changes)
├─ Node brightness changes (energy follows real activity)
├─ Health score updates (calculated from current state)
├─ Alerts appear/disappear (risks appear in real-time)
└─ Recommendations refresh
```

Example:
```
User creates job
  → Smart Intake gets 100% energy (bright)
  → ProTools requests spike
  → Marketplace shows waiting contractors
  → You see it LIVE on the map
```

---

## Controls Reference

| Action | Effect |
|--------|--------|
| Click a node | Select it, show details on right |
| Click background | Deselect |
| Filter by Cortex | Dim all other cortex |
| Toggle Monetization Flows | Highlight value paths |
| Watch Health Score | System status in real-time |

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Topology (36 neurons) | ✅ Complete | Mapped from memory |
| Visualization (Canvas) | ✅ Complete | Renders grafo |
| Filtering | ✅ Complete | By cortex |
| Detail Panel | ✅ Complete | Shows inputs/outputs |
| API Integration | ⏳ Pending | Needs endpoint |
| Real-time Updates | ⏳ Pending | Needs websocket or polling |
| Monetization Flows | ✅ Complete | But not highlighted yet |
| Alerts/Risks | ⏳ Pending | Needs risk data |
| Recommendations | ⏳ Pending | Needs consciousness API |

---

## Next: Make It Live

To connect to real data:

```bash
# In semse-consciousness-map.tsx:

useEffect(() => {
  const poll = async () => {
    const response = await fetch('/api/semse/ops/consciousness')
    const data = await response.json()
    
    // Update neuron energy from data.body.neurons[id].energy
    // Update system health from data.healthScore
    // Update alerts from data.risks
    // Update recommendations from data.recommendations
  }
  
  const interval = setInterval(poll, 3000)
  return () => clearInterval(interval)
}, [])
```

Then watch the map COME ALIVE. That's when you'll truly see how SEMSE thinks.

---

**Navigate to:** `http://localhost:3000/semse-consciousness-map`

**Explore. Click. Filter. Watch. Understand.**

This is not documentation. This is a **living interface to the SEMSE organism.**
