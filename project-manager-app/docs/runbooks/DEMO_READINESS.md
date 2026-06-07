# SEMSE Demo Readiness

Objetivo: preparar una demo build reproducible de SEMSEproject enfocada en mostrar el flujo principal de forma clara.

## Alcance incluido

- seed demo controlada
- script de arranque único
- checklist de demo
- escenarios de prueba manual

## Fuera de alcance

- despliegue enterprise
- automatizaciones complejas
- nuevas features
- cierre total de gaps de producto

## Estrategia elegida

En vez de depender del backend real para la demo, esta build usa la shell visible de `apps/web` sobre un runtime demo con stub HTTP en memoria y seed fija.

Esto permite:
- reproducibilidad;
- arranque rápido;
- cero dependencia de datos vivos;
- narrativa consistente en cada presentación.

## Artefactos

### Seed demo
- `demo/seed/demo-seed.json`

### Runtime demo
- `scripts/demo-web-runtime.mjs`

### Arranque
- `scripts/start-demo.sh`

### Smoke automático
- `scripts/demo-smoke.mjs`
- `docs/runbooks/DEMO_SMOKE.md`

### Operación de demo
- `docs/runbooks/DEMO_CHECKLIST.md`
- `docs/runbooks/DEMO_MANUAL_SCENARIOS.md`
- `docs/runbooks/DEMO_QA_PASS.md`
- `docs/runbooks/DEMO_SCRIPT_90_SEC.md`
- `docs/runbooks/DEMO_SCRIPT_5_MIN.md`
- `docs/runbooks/DEMO_OPERATOR_PACK.md`
- `docs/runbooks/DEMO_READY_V1.md`

## Comando principal

```bash
cd /home/yoni/labsemse/project-manager-app
bash ./scripts/start-demo.sh
```

## Qué levanta

- API demo stub: `http://127.0.0.1:4301`
- Web demo: `http://127.0.0.1:3301`

## Flujo recomendado de presentación

1. overview comercial
2. entrar a job feliz
3. crear milestone
4. submit → approve → release
5. registrar evidence
6. fondear escrow
7. mostrar dispute y resolverla
8. cerrar con mensaje de control operativo end-to-end

## Criterio de done

Se considera cumplido cuando:
- el entorno levanta con un solo comando;
- la seed produce siempre el mismo punto de partida;
- existe checklist de pre-demo;
- existe guion manual de happy path y excepción;
- el flujo principal puede presentarse en secuencia clara.
