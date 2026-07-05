# SEMSEproject — Master Backlog SDD

## Epic A — Admin Modular Navigation

### A1. Navegación centralizada

**Descripción:** Crear un archivo único con la definición de módulos, rutas hijas, iconos, estados y métricas.

**Resultado esperado:** El Admin deja de depender de listas sueltas de rutas.

**Aceptación:**

- Existe `apps/web/lib/admin/admin-navigation.ts`.
- Exporta módulos principales.
- Las rutas legacy aparecen como `children`.
- No rompe imports existentes.

### A2. Mission Control como Home del ecosistema

**Descripción:** Convertir `/admin/mission-control` en una vista de entrada al ecosistema.

**Aceptación:**

- Muestra 8 módulos principales.
- Cada módulo tiene tarjeta, estado y CTA.
- Las métricas son mock o existentes, pero claramente tipadas.
- No depende de backend nuevo.

### A3. Hubs de módulo

**Descripción:** Crear hubs para WorkOps, Intelligence, Tool Hub y Verticals.

**Aceptación:**

- `/admin/workops` existe.
- `/admin/intelligence` existe.
- `/admin/tool-hub` existe.
- `/admin/verticals` existe.
- Cada hub enlaza a rutas existentes.

## Epic B — Tool Hub MVP

### B1. External Apps Grid

**Descripción:** Crear tiles de herramientas externas: ChatGPT, Claude, Codex, Gemini, Notion, Figma, GitHub, Railway, n8n.

**Aceptación:**

- No usar logos oficiales.
- Usar iconos genéricos.
- Cada tile tiene estado, botón Open y Copy Context.

### B2. Context Bridge MVP

**Descripción:** Panel lateral que resume el contexto activo para copiarlo a otras herramientas.

**Aceptación:**

- Muestra proyecto activo.
- Muestra rama.
- Muestra último deploy.
- Muestra objetivo actual.
- Muestra prompt sugerido.
- Botón para copiar prompt.

## Epic C — Visual QA

### C1. Sidebar colapsado

**Descripción:** Preparar navegación para vista compacta tipo VS Code.

**Aceptación:**

- En desktop se ve limpio.
- En colapsado muestra iconos.
- Tooltips no rompen mobile.

### C2. Mobile fallback

**Descripción:** Los hubs deben verse aceptables en móvil.

**Aceptación:**

- Cards en una columna.
- No hay overflow horizontal.
- CTA visibles.
