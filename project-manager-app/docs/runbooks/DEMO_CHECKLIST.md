# SEMSE Demo Checklist

## 1. Readiness técnica

- [ ] `node_modules` presente o `npm run bootstrap:semse` ejecutado
- [ ] `npm run demo:smoke` pasa en verde
- [ ] `bash ./scripts/start-demo.sh` arranca sin error
- [ ] El stub demo responde en `http://127.0.0.1:4301`
- [ ] La web abre en `http://127.0.0.1:3301`
- [ ] La home carga sin pantalla vacía ni error overlay

## 2. Readiness funcional

- [ ] Se ve `Kitchen Remodel — Orlando`
- [ ] Se ve `Roof Repair — Miami`
- [ ] Job detail abre correctamente
- [ ] Se puede crear milestone manualmente
- [ ] Se puede hacer `Submit`
- [ ] Se puede hacer `Approve`
- [ ] Se puede hacer `Release`
- [ ] Se puede registrar evidence
- [ ] Se puede fondear escrow
- [ ] Se puede abrir o resolver dispute

## 3. Readiness narrativa

- [ ] Explicación de 1 frase: qué es SEMSE
- [ ] Explicación de 1 frase: por qué job-first
- [ ] Explicación de 1 frase: por qué evidence + escrow + disputes importan
- [ ] Secuencia de demo definida de principio a fin
- [ ] Duración total objetivo: 5-8 minutos

## 4. Contingencias

- [ ] Si falla el browser cache, recargar una vez
- [ ] Si Next quedó colgado, reiniciar `bash ./scripts/start-demo.sh`
- [ ] Si el estado quedó muy alterado por clicks previos, reiniciar la demo para resembrar desde JSON

## 5. Done criteria

La demo está lista si:
- [ ] el entorno levanta con un solo comando
- [ ] el flujo principal se puede mostrar sin depender de backend real
- [ ] existe una secuencia clara de happy path + excepción
