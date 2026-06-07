# Plan, comandos y prompts operativos

## Plan de operación

### Paso 1
- abrir `/admin/agent-runtime`
- revisar `Host diagnostics`
- revisar `command policies`

### Paso 2
- hacer `bootstrap` en modo:
  - `detect_only`
  - o `guided_install`

### Paso 3
- `attach` del provider al catálogo interno

### Paso 4
- validar desde `ProjectCopilotHarness`

## Comandos ya modelados

### Verify allowlist
- `claude --version`
- `codex --version`
- `echo manual verification required`

### Install commands modelados pero no auto-ejecutados
- `curl -fsSL https://claude.ai/install.sh | bash`
- `npm install -g @openai/codex`

## Prompts recomendados para copilot

### Runtime status
`Dime el estado del runtime, qué providers están adjuntos y qué host detectaste.`

### Runtime readiness
`¿Está listo el runtime para operar sobre este workspace o falta attach/bootstrap?`

### Payments + runtime
`Antes de ejecutar pagos, revisa si hay runtime adjunto utilizable y resume el estado financiero.`

### Disputes + runtime
`Antes de resolver la disputa, dime si hay runtime/provider adjunto y el estado del caso.`

## Prompts operativos para admin

### Detect only
`Prepara el runtime en modo detect_only para codex-cli y dame el plan.`

### Guided install
`Prepara el runtime en guided_install para claude-code y marca qué comandos requieren aprobación.`

### Attach
`Registra manus-bridge como runtime adjunto del tenant en modo workspace_attach.`

## Checklist de aceptación
- `providers` responde
- `status` responde
- `bootstrap` responde con policy
- `attach` persiste estado
- `catalog` incluye providers adjuntos
- `ProjectCopilotHarness` responde con estado del runtime
