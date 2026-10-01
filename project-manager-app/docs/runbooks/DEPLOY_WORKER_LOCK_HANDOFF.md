# Handoff del lock `worker-primary` durante un deploy

**Qué se ve:** en los logs del worker nuevo, durante los primeros segundos de un deploy, puede aparecer repetido:

```
another worker with same workerId is running — waiting for lock   { lockKey: "semse:worker-lock:worker-primary", holder: "<host>:<pid>:<ts>", retryMs: 1500 }
```

**Qué significa:** NO es un crash. El worker anterior (mismo `workerId`) aún conserva el lock en Redis (`PX 30000`, refrescado cada 10 s). El nuevo reintenta cada 1,5 s y arranca (`worker started`) cuando el anterior recibe SIGTERM y libera el lock, o cuando el TTL (30 s) expira. Un solo worker activo por `workerId` es el comportamiento diseñado (evita jobs duplicados).

**Cómo distinguirlo de un problema real**

| Señal | Handoff normal | Investigar |
|---|---|---|
| Duración de la espera | ≤ ~30–40 s | > 60 s sostenido |
| Final | aparece `worker started` | nunca aparece, o `worker lock lost — stopping worker` |
| `holder` | host/pid del deployment anterior | host/pid que sigue vivo y no es el anterior |
| Estado Railway | deployment nuevo SUCCESS, anterior REMOVED | nuevo CRASHED/FAILED |

**Si la espera no termina:** comprobar con Railway (solo lectura) que el deployment anterior está REMOVED; el lock expira solo en ≤ 30 s. No borrar la clave a mano salvo decisión de operación con el worker anterior confirmado detenido.

**Evidencia:** observado en el deploy de `7c9df29` (2026-10-01); el worker arrancó con normalidad tras adquirir el lock.
