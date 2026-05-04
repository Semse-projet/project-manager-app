# 🔍 Audit Report — SEMSEproject

> **Fecha:** 2026-03-07 | **Estado:** Crítico en 3 áreas, Medio en 5 áreas

---

## 🔴 Crítico — Problemas que rompen funcionalidad

### 1. Respuestas AI son 100% falsas (Mock)
**Archivo:** [src/lib/ai.ts](file:///home/yoni/Descargas/semseproject/app/src/lib/ai.ts) · [línea 192](file:///home/yoni/Descargas/semseproject/app/src/lib/ai.ts#L192-L208)

```ts
// Esto NO llama a ninguna IA real:
await new Promise(resolve => setTimeout(resolve, 1500)); // solo espera 1.5s
return `Entiendo. Como experto en ${agent.description}...` // respuesta hardcoded
```

**Impacto:** Todos los agentes (Binary, Justus, Pulse, etc.) parecen inteligentes pero devuelven siempre la misma plantilla. Si un usuario hace una pregunta real, recibe una respuesta genérica que no responde nada específico.

**Solución:** Conectar con OpenAI/Claude vía Supabase Edge Function.

---

### 2. Historial de chat global — todos los agentes ven todos los mensajes
**Archivo:** [src/context/AgentContext.tsx](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx) · [línea 24-35](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx#L24-L35)

```ts
const [messages, setMessages] = useState<Message[]>(...); // 1 sola lista global
```

Todos los agentes (Ada, Felix, Binary...) comparten el mismo historial. Si hablas con Felix sobre escrow y luego cambias a Justus (legal), Justus "recuerda" la conversación de Felix y la mezcla en su contexto.

**Solución:** Usar `Record<AgentRole, Message[]>` — un historial por agente.

---

### 3. localStorage crece sin límite — crash en datos grandes
**Archivo:** [src/context/AgentContext.tsx](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx) · [línea 41-43](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx#L41-L43)

```ts
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); // sin límite
}, [messages]);
```

Con el tiempo, el localStorage llega al límite del navegador (~5MB). Esto causará un error silencioso donde el chat deja de guardarse sin avisarle al usuario.

**Solución:** Limitar a los últimos 50 mensajes por agente, o usar IndexedDB para mayor capacidad.

---

## 🟠 Alto — Problemas de UX y lógica incorrecta

### 4. Saludo inicial ignora historial existente (bucle infinito potencial)
**Archivo:** [src/context/AgentContext.tsx](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx) · [línea 63-74](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx#L63-L74)

```ts
useEffect(() => {
  if (messages.length === 0) { // ← si se borra el historial, re-saluda
    setMessages([greeting]);
  }
}, [activeAgent, messages.length]); // ← depende de messages.length
```

Cuando se llama [clearHistory()](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx#106-109), `messages` queda vacío → el effect lo detecta → añade el saludo → `messages.length` cambia → el effect vuelve a dispararse. Podría causar saludos múltiples inesperados. Además, al cambiar de agente, el historial antiguo no se limpia, por lo que el saludo del nuevo agente nunca aparece porque `messages.length > 0`.

---

### 5. Agentes de servicio (tech, design, etc.) NO tienen routing automático
**Archivo:** [src/context/AgentContext.tsx](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx) · [línea 46-60](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx#L46-L60)

Los 6 nuevos agentes expertos (Binary, Canvas, Aura, Marta, Justus, Pulse) fueron definidos en [ai.ts](file:///home/yoni/Descargas/semseproject/app/src/lib/ai.ts), pero el routing automático solo conoce a los agentes platform (assistant, escrow, jobs, professional, security, analytics). Si un usuario va a `/profesionales` buscando un diseñador, el sistema nunca activa a Canvas.

**Solución:** Leer la categoría del trabajo/profesional que se está viendo para activar el agente correcto.

---

### 6. Notificaciones y reservas son siempre mock, sin conexión a Supabase
**Archivo:** [src/pages/Dashboard.tsx](file:///home/yoni/Descargas/semseproject/app/src/pages/Dashboard.tsx) · [línea 54-58](file:///home/yoni/Descargas/semseproject/app/src/pages/Dashboard.tsx#L54-L58)

```ts
const userBookings = mockBookings.filter(booking => booking.clientId === user?.id);
// mockBookings tiene hardcoded clientId: '1', nunca coincide con un usuario real
```

**Impacto:** Un usuario real nunca verá sus reservas, notificaciones, ni las tarjetas de statisticas (activeJobs, completedJobs) porque `user.id` real no coincide con los IDs de mock (`'1'`, `'2'`).

---

### 7. Dashboard stats muestran datos de tendencia falsos
**Archivo:** [src/pages/Dashboard.tsx](file:///home/yoni/Descargas/semseproject/app/src/pages/Dashboard.tsx) · [línea 108-130](file:///home/yoni/Descargas/semseproject/app/src/pages/Dashboard.tsx#L108-L130)

```tsx
<StatCard title="Trabajos activos" value={stats.activeJobs} trend={{ value: 12, isPositive: true }} />
```

El `trend` siempre muestra "+12%" sin importar el usuario o el período real. Es decorativo puro.

---

## 🟡 Medio — Deuda técnica acumulada

### 8. AuthContext en orden incorrecto en App.tsx
**Archivo:** [src/App.tsx](file:///home/yoni/Descargas/semseproject/app/src/App.tsx) · [línea 35-36](file:///home/yoni/Descargas/semseproject/app/src/App.tsx#L35-L36)

```tsx
<AgentProvider>
  <AuthProvider> {/* ← AuthProvider está DENTRO de AgentProvider */}
```

[AgentProvider](file:///home/yoni/Descargas/semseproject/app/src/context/AgentContext.tsx#22-126) usa `useLocation()` (de React Router) pero necesita el `Router` que está arriba — eso está bien. Sin embargo si algún día el AgentProvider necesita el usuario autenticado ([useAuth](file:///home/yoni/Descargas/semseproject/app/src/context/AuthContext.tsx#211-218)), fallará porque [AuthProvider](file:///home/yoni/Descargas/semseproject/app/src/context/AuthContext.tsx#24-210) está como hijo, no como padre.

**Solución recomendada:**
```tsx
<AuthProvider>
  <AgentProvider>
```

---

### 9. Supabase funciona con placeholder si no hay .env
**Archivo:** [src/lib/supabase.ts](file:///home/yoni/Descargas/semseproject/app/src/lib/supabase.ts) · [línea 7-8](file:///home/yoni/Descargas/semseproject/app/src/lib/supabase.ts#L7-L8)

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
```

Si el desarrollador olvida crear `.env`, la app arranca con un cliente Supabase falso. Todas las llamadas a la DB fallarán silenciosamente sin error visible en UI. El usuario verá la app vacía sin entender por qué.

---

### 10. Cast forzado con `any` en Dashboard
**Archivo:** [src/pages/Dashboard.tsx](file:///home/yoni/Descargas/semseproject/app/src/pages/Dashboard.tsx) · [línea 52](file:///home/yoni/Descargas/semseproject/app/src/pages/Dashboard.tsx#L52)

```ts
const userJobs = userJobsRaw as any[]; // ← pérdida total de tipos
```

Este cast silencia errores de TypeScript. Si la respuesta de Supabase cambia de estructura, los errores no se detectarán en build. Además, impide el autocompletado en el editor.

---

### 11. Sugerencias no se desactivan mientras el agente responde
**Archivo:** [src/components/ai/AgentChat.tsx](file:///home/yoni/Descargas/semseproject/app/src/components/ai/AgentChat.tsx) · [línea 116-125](file:///home/yoni/Descargas/semseproject/app/src/components/ai/AgentChat.tsx#L116-L125)

```tsx
{suggestions.map((s) => (
  <button onClick={() => sendMessage(s.prompt)}>  // ← activo durante isTyping
```

El usuario puede hacer clic en múltiples sugerencias mientras el agente está "escribiendo", generando múltiples llamadas concurrentes y mensajes duplicados.

---

## 📋 Resumen de Prioridades

| # | Problema | Severidad | Esfuerzo de Fix |
|---|----------|-----------|-----------------|
| 1 | Respuestas AI son mock | 🔴 Crítico | Alto (requiere backend) |
| 2 | Historial chat compartido entre agentes | 🔴 Crítico | Medio |
| 3 | localStorage sin límite | 🔴 Crítico | Bajo |
| 4 | Bucle en greeting effect | 🟠 Alto | Bajo |
| 5 | Agentes verticales sin routing | 🟠 Alto | Medio |
| 6 | Mock data para reservas/notificaciones | 🟠 Alto | Alto (requiere hooks Supabase) |
| 7 | Trends estadísticas hardcoded | 🟠 Alto | Bajo |
| 8 | Orden de Providers en App.tsx | 🟡 Medio | Muy Bajo |
| 9 | Supabase con placeholder silencioso | 🟡 Medio | Bajo |
| 10 | Cast `as any[]` en Dashboard | 🟡 Medio | Bajo |
| 11 | Sugerencias activas durante typing | 🟡 Medio | Muy Bajo |
