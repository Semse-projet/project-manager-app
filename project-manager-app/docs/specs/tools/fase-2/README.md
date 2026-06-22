# FASE 2 — Protección Legal y Cumplimiento

**Versión:** 1.0  
**Fecha:** 2026-06-21  
**Estado:** APPROVED  
**Objetivos:** Proteger al contratista automáticamente de demandas y disputas.

---

## Visión

SEMSE Fase 2 transforma la documentación del trabajo en **defensa automática contra disputas**.

El contratista no tiene que pensar en la defensa legal; SEMSE lo hace por él:
- ✅ Captura de evidencia timestamped con GPS
- ✅ Alertas de lien deadlines (50 estados, automático)
- ✅ Calendarios de cambios y registros diarios
- ✅ Factores climáticos documentados
- ✅ Bundles de exportación para defensa legal

**Resultado:** Cuando una disputa llega, el contratista tiene el 90% de la documentación que un abogado necesita.

---

## Módulos de Fase 2

### Módulo 2.1 — Gestión de Lien Rights (LienGrid API)

**6 bloques:** 2.1.A a 2.1.F

Integración con LienGrid para capturar deadlines de preliminary notice en 50 estados, generar calendarios automáticos, alertas y waivers.

**Documentación:** `m2.1-lien-rights.spec.md`

---

### Módulo 2.2 — Documentación Anti-Disputas

**5 bloques:** 2.2.A a 2.2.E

Sistema de captura de evidencia con timestamp + GPS, daily logs, change order trail con firma digital, extended metrics en 20 trades, exportación PDF bundles.

**Documentación:** `m2.2-dispute-docs.spec.md`

---

### Módulo 2.3 — Integración de Clima (Tomorrow.io)

**3 bloques:** 2.3.A a 2.3.C

API de clima en tiempo real para alertas de impacto (lluvia, helada, granizo, viento), logs automáticos de cambios de tareas por clima, base para change orders.

**Documentación:** `m2.3-weather.spec.md`

---

## Dependencias

- **Fase 1 completa**: Estimaciones y pagos funcionan
- **Módulos 2.1 y 2.3 → Fase 3**: Los agentes de alertas proactivas dependen de estos datos

---

## Orden de Implementación

```
Bloque-T (2.1.A):   Integrar LienGrid API
Bloque-U (2.1.B):   Capturar datos → generar calendario de deadlines
Bloque-V (2.1.C-D): Alertas automáticas + generación de notices pre-poblados
Bloque-W (2.1.E-F): Integración de envío certificado (Lob.com) + waivers

Bloque-X (2.2.A):   Foto timestamping + GPS en uploads
Bloque-Y (2.2.B-C): Daily logs + Change order trail con firma digital
Bloque-Z (2.2.D-E): Extended metrics + Export bundle PDF

Bloque-AA (2.3.A-B): Tomorrow.io integration + alertas por proyecto
Bloque-AB (2.3.C):   Calibrar alertas trade-specific
```

---

## Decisiones Arquitectónicas

### Por qué LienGrid en lugar de API estatal individual

**Decisión:** Usar LienGrid API (pay-per-notice) en lugar de integrar con 50 secretarías de estado.

**Razón:** 
- Una URL unificada vs. 50 endpoints
- Deadlines ley federal vs. estatal
- Pay-per-notice ($0.50-$2 por notice) escala mejor que suscripción a cada estado
- LienGrid mantiene actualizado automáticamente

**Costo:** ~$5-$20/proyecto (variación por estado)

---

### Por qué Daily Logs son obligatorios

**Decisión:** Daily logs no son opcionales; son gate en el FSM de trabajo.

**Razón:**
- Evidencia de continuidad de trabajo
- Base para clima/cambios de tareas
- Defensa contra "no trabajaron ese día"
- Auditable: timestamp, crew, weather, tasks, delays

---

### Por qué Clima en tiempo real

**Decisión:** Tomorrow.io API en lugar de histórico.

**Razón:**
- Avisos antes de la tormenta (mitiga daño)
- Documenta fuerza mayor automáticamente
- Base legítima para change orders
- Trade-aware (roofing ≠ interior painting)

---

## Integración con el Resto de SEMSE

| Módulo Fase 2 | Integra con | Efecto |
|---|---|---|
| 2.1 Lien Rights | Payments escrow | Waivers condicionales antes de liberar pagos |
| 2.1 Lien Rights | Milestone FSM | Gate: no cerrar sin waiver si hay liens |
| 2.2 Anti-Disputas | Evidence module | Timestamp + GPS en uploads nuevos |
| 2.2 Anti-Disputas | Change orders | Trail obligatorio con firma antes de proceder |
| 2.2 Anti-Disputas | Projects | Export bundle por proyecto completo |
| 2.3 Clima | Milestones FSM | Tareas flagueadas si clima adverso |
| 2.3 Clima | Daily logs | Nota automática: "work halted due to [weather]" |
| 2.3 Clima | Alerts | Notificación push 24h antes de evento crítico |

---

## Notas de Implementación

- **Testing:** Simular eventos de LienGrid, clima, uploads; no requiere datos reales de ley
- **Pricing:** Verificar con LienGrid y Tomorrow.io antes de escalar a producción
- **Privacy:** Timestamps de GPS son location-critical; encriptar en tránsito (HTTPS) y reposo
- **Observabilidad:** Cada integración necesita logs de webhook, reintentos fallidos, estado de sync

---

## Cambios en la Base de Datos

Necesarios en `packages/db/prisma/schema.prisma`:

```prisma
model LienCalendar {
  id String @id @default(cuid())
  projectId String
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  stateName String // "California", "Texas", etc.
  preliminaryNoticeDeadline DateTime
  waiverDeadline DateTime
  finalNoticeDeadline DateTime
  statusLienDeadline DateTime
  
  status String @default("PENDING") // PENDING, NOTIFIED, SUBMITTED, FULFILLED
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([projectId, stateName])
}

model DailyLog {
  id String @id @default(cuid())
  projectId String
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  date DateTime
  crew String[]
  tasksCompleted String[]
  tasksDelayed String[]
  weatherObservation String
  notes String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([projectId, date])
}

model WeatherAlert {
  id String @id @default(cuid())
  projectId String
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  eventType String // "RAIN", "FROST", "WIND", "HAIL"
  severity String // "LOW", "MEDIUM", "HIGH"
  startTime DateTime
  endTime DateTime
  affectedTrades String[]
  notificationSent Boolean @default(false)
  
  createdAt DateTime @default(now())
  
  @@index([projectId, startTime])
}
```

---

## Siguiente: Bloque-T

**Bloque-T — Módulo 2.1.A: Integrar LienGrid API**

Crear el servicio de integración con LienGrid, modelar calendarios de deadlines, y escribir tests.
