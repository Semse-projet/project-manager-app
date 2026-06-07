# SEMSE Demo Smoke

Validación mínima y reproducible para confirmar que la ruta de demo está realmente operativa antes de mostrarla.

## Qué valida

- levanta el runtime demo en puertos aislados;
- confirma que la API stub responde;
- confirma que la web responde;
- verifica los jobs demo esperados;
- prueba lifecycle de milestone: create → submit → approve → release;
- prueba funding de escrow;
- prueba registro de evidence;
- prueba resolución de dispute.

## Comando

```bash
cd /home/yoni/labsemse/project-manager-app
npm run demo:smoke
```

## Puertos por defecto del smoke

- Web: `http://127.0.0.1:3305`
- API: `http://127.0.0.1:4305`

Esto evita chocar con la demo manual estándar (`3301/4301`).

## Si quieres puertos custom

```bash
cd /home/yoni/labsemse/project-manager-app
SEMSE_DEMO_WEB_PORT=3310 SEMSE_DEMO_API_PORT=4310 npm run demo:smoke
```

## Resultado esperado

Al final debe aparecer una línea similar a:

```text
[demo-smoke:pass] demo smoke passed | web=http://127.0.0.1:3305 api=http://127.0.0.1:4305
```

## Qué NO valida

- experiencia visual completa en navegador humano;
- calidad de narrativa comercial;
- backend real;
- persistencia real fuera del proceso demo;
- despliegue productivo.

## Uso recomendado

1. correr `npm run demo:smoke`;
2. si pasa, correr `bash ./scripts/start-demo.sh` para demo humana;
3. seguir `docs/runbooks/DEMO_QA_PASS.md` y los scripts de 90s / 5 min.
