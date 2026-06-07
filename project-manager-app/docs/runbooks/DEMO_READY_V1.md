# SEMSE Demo Ready v1

Estado consolidado de readiness para demo reproducible.

## Veredicto

**SEMSE Demo Ready v1 = LISTA PARA PRESENTACIÓN CONTROLADA**

No es un release de producto final.
Sí es una build de demo operable, reseteable y narrable.

## Qué está resuelto

- entorno demo reproducible
- seed fija
- arranque con un comando
- smoke automático previo a demo humana
- alternativa con puertos custom
- shell visual navegable
- happy path demostrable
- excepción demostrable
- checklist operativa
- QA pass rápida
- guion de demo de 5 minutos
- guion executive de 90 segundos
- operator pack centralizado

## Limitaciones conocidas

- depende de `apps/web` en modo dev, no de build productizada para escenario público
- el runtime demo usa stub en memoria, no backend real
- el objetivo es presentación controlada, no validación enterprise ni stress real
- el estado mutable durante la práctica se limpia reiniciando la demo

## Uso recomendado

### Demo interna / partner / stakeholder
Sí.

### Demo técnica guiada
Sí.

### Demo de narrativa comercial corta
Sí.

### Prueba de backend real o despliegue productivo
No. Fuera de alcance de esta entrega.

## Comandos

### Arranque estándar
```bash
cd /home/yoni/labsemse/project-manager-app
bash ./scripts/start-demo.sh
```

### Arranque alterno
```bash
cd /home/yoni/labsemse/project-manager-app
SEMSE_DEMO_WEB_PORT=3302 SEMSE_DEMO_API_PORT=4302 bash ./scripts/start-demo.sh
```

## Secuencia mínima recomendada

1. abrir home
2. entrar a Kitchen Remodel — Orlando
3. crear milestone
4. submit → approve → release
5. registrar evidence
6. fondear escrow
7. mostrar Roof Repair — Miami
8. resolver dispute
9. cerrar con resumen de control operativo end-to-end

## Artefactos de soporte

- `docs/runbooks/DEMO_READINESS.md`
- `docs/runbooks/DEMO_SMOKE.md`
- `docs/runbooks/DEMO_OPERATOR_PACK.md`
- `docs/runbooks/DEMO_CHECKLIST.md`
- `docs/runbooks/DEMO_QA_PASS.md`
- `docs/runbooks/DEMO_MANUAL_SCENARIOS.md`
- `docs/runbooks/DEMO_SCRIPT_5_MIN.md`
- `docs/runbooks/DEMO_SCRIPT_90_SEC.md`

## Criterio final

Si la demo arranca, navega y recorre esa secuencia sin fallos visibles severos, esta entrega cumple el objetivo original de demo reproducible y presentable.
