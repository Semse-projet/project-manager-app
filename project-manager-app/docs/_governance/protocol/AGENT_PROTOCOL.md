# AGENT PROTOCOL — Protocolo para Agentes de IA

> Este archivo define las reglas de operación para cualquier agente de IA que trabaje en el ecosistema SEMSE.
> Es de lectura obligatoria antes de modificar cualquier archivo del proyecto.

---

## ANTES DE EMPEZAR CUALQUIER TAREA

Ejecuta estos pasos en orden. No omitas ninguno.

### Paso 1 — Orientación (obligatorio)
```
1. Lee: _governance/status/ECOSYSTEM_STATUS.md          ← Dónde estás parado
2. Lee: _governance/protocol/AGENT_PROTOCOL.md          ← Este archivo
3. Lee: _governance/reports/[más reciente]_health.md  ← Qué está fallando hoy
```

### Paso 2 — Identificar el componente sobre el que vas a trabajar
```
¿Es canónico?  → project-manager-app/
¿Es satellite? → app semse/_satellites-archive/[nombre]/STATUS.md
¿Es governance? → _governance/
```

### Paso 3 — Leer el STATUS.md del componente
Antes de tocar cualquier satellite, lee su STATUS.md completo.
Antes de tocar el canónico, lee ECOSYSTEM_STATUS.md sección "Cuellos de botella".

### Paso 4 — Registrar la sesión
Al inicio de cada sesión de trabajo, agrega una entrada en `_governance/logs/WORK_SESSION_LOG.md`:
```markdown
## [FECHA] — [Agente/Humano] — [Tarea]
**Componente:** project-manager-app / web-assistant-portal / etc.
**Objetivo:** descripción
**Estado inicial:** qué estaba pasando antes
```

---

## REGLAS FUNDAMENTALES

### R1 — Solo el canónico recibe código nuevo
El único lugar donde se escribe código nuevo es `project-manager-app/`.
Los satellites son **solo lectura** — referencia y destilación, nunca desarrollo activo.

### R2 — Nunca destilar sin documentación lista
Antes de copiar/adaptar código de un satellite al canónico:
1. Documenta qué vas a tomar y por qué en `_governance/distillation/DISTILLATION_QUEUE.md`
2. Verifica que el sprint actual corresponde al momento indicado en la queue
3. Después de la destilación, registra en `_governance/distillation/DISTILLATION_LOG.md`

### R3 — Build + smokes después de cada cambio significativo
```bash
cd "project-manager-app"
npm run build:api        # debe salir EXIT 0
# Si Postgres está corriendo:
npm run smoke:projects   # verificar que nada se rompió
```

### R4 — Actualizar etiquetas después de cada cambio
Si cambias el estado de algo, actualiza:
- El `STATUS.md` del componente afectado
- `_governance/status/ECOSYSTEM_STATUS.md` si cambia el sprint o el estado del canónico
- `_governance/logs/WORK_SESSION_LOG.md` con qué se hizo

### R5 — Detectar colisiones antes de actuar
Si encuentras conflicto entre dos etiquetas, dos documentos o dos instrucciones:
1. NO ejecutes nada
2. Documenta la colisión en `_governance/logs/WORK_SESSION_LOG.md`
3. Reporta al usuario antes de continuar

### R6 — Jerarquía de autoridad
```
1. VISION_DECISIONS_LOCKED.md    (inmutable — nadie lo toca)
2. _governance/status/ECOSYSTEM_STATUS.md  (estado vigente)
3. constitution/08_SPRINT_BACKLOG.md          (qué hacer ahora)
4. STATUS.md del componente      (contexto específico)
5. Código en canónico            (implementación)
```
Si algo contradice a un nivel superior → reportar colisión.

---

## CÓMO LEER LAS ETIQUETAS

### Estado de un satellite
```
SATELLITE:ARCHIVED          → Congelado, movido a archive
SATELLITE:FROZEN            → Congelado en origen, no movido
PENDING_DISTILLATION        → Tiene valor rescatable identificado
DISTILLING                  → Actualmente en proceso de destilación
FULLY_DISTILLED             → Todo lo valioso fue extraído
REFERENCE_ONLY              → Solo lectura, no distilable a código
```

### Iconos de urgencia
```
🔴  → Bloqueante — resolver antes de continuar
🟡  → Advertencia — no bloquea pero debe atenderse
🟢  → OK — sin issues
⏳  → Pendiente — registrado, no urgente
✅  → Completado
```

### Campos de frontmatter YAML en STATUS.md
```yaml
status: ARCHIVED|FROZEN|ACTIVE
distillation_status: PENDING|IN_PROGRESS|COMPLETE|NONE
priority: HIGH|MEDIUM|LOW
sprint_target: "2.5"       # sprint donde se destilará
health_score: 0-100        # solo para canónico
last_updated: YYYY-MM-DD
```

---

## AL TERMINAR UNA TAREA

1. Actualiza el STATUS.md del componente modificado
2. Si completaste una destilación → agrega entrada en `_governance/distillation/DISTILLATION_LOG.md`
3. Si el sprint cambió → actualiza `_governance/status/ECOSYSTEM_STATUS.md`
4. Cierra la entrada en `_governance/logs/WORK_SESSION_LOG.md` con resultado
5. Si algo se rompió y se arregló → documenta en `_governance/distillation/DISTILLATION_LOG.md`

---

## SEÑALES DE ALERTA — Para reportar al usuario inmediatamente

- Encontraste código que contradice una decisión en `VISION_DECISIONS_LOCKED.md`
- Dos STATUS.md dicen cosas incompatibles sobre el mismo dominio
- El canónico no compila después de un cambio
- Un satellite tiene código más avanzado que el canónico en un dominio crítico
- Un item de `_governance/distillation/DISTILLATION_QUEUE.md` ya fue implementado en el canónico sin registrarse
