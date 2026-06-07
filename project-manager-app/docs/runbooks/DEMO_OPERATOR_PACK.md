# SEMSE Demo Operator Pack

Paquete operativo para correr, validar y presentar la demo build de SEMSEproject sin improvisación.

## Objetivo

Mostrar una secuencia clara, reproducible y presentable del flujo principal:

1. overview
2. job-first execution
3. milestone review
4. evidence
5. escrow
6. dispute handling

## Arranque

### Opción estándar
```bash
cd /home/yoni/labsemse/project-manager-app
bash ./scripts/start-demo.sh
```

### Opción con puertos alternos
```bash
cd /home/yoni/labsemse/project-manager-app
SEMSE_DEMO_WEB_PORT=3302 SEMSE_DEMO_API_PORT=4302 bash ./scripts/start-demo.sh
```

## URLs esperadas

- Web: `http://127.0.0.1:3301`
- API demo: `http://127.0.0.1:4301`

Si usas puertos alternos, ajusta las URLs.

## Orden recomendado de uso

1. `docs/runbooks/DEMO_SMOKE.md`
2. `docs/runbooks/DEMO_CHECKLIST.md`
3. `docs/runbooks/DEMO_QA_PASS.md`
4. `docs/runbooks/DEMO_SCRIPT_90_SEC.md`
5. `docs/runbooks/DEMO_SCRIPT_5_MIN.md`
6. `docs/runbooks/DEMO_MANUAL_SCENARIOS.md`
7. `docs/runbooks/DEMO_READY_V1.md`

## Secuencia operativa recomendada

1. correr `npm run demo:smoke`;
2. si pasa, correr `bash ./scripts/start-demo.sh`;
3. hacer la pasada rápida de `DEMO_QA_PASS.md`;
4. presentar usando script 90s o 5 min.

## Regla operativa

Si el estado quedó alterado durante la práctica:
- detener la demo;
- volver a correr `bash ./scripts/start-demo.sh`;
- arrancar otra vez desde la seed limpia.

La demo está diseñada para resetear fácil.
