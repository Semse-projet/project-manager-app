# Gate 5 — guion de pruebas en dispositivos (BO-09 + OPEN-18)

> **Quién:** el propietario, en el Motorola (Android) y en los dos iPhone. **Quién registra:** el agente, a partir de las
> notas o capturas por dispositivo, en `docs/reportes/` y en las specs `core.geofence-policy` y
> `core.worksite-location-binding`.
> **Regla:** Gate 5 solo se cierra con resultados reales de los tres teléfonos. Un simulador, `expo export` o jest no
> cuentan.

## 0. Preparación (una vez)

| Dato | Valor |
|---|---|
| API de staging | `https://semse-api-qa-staging.up.railway.app` (Railway «SEMSE AgentRun 1149 Isolated QA» / `staging`) |
| Build | perfil EAS `pilot` (ver `docs/runbooks/MOBILE_PILOT_BUILD.md`); el log de EAS debe decir `pilot build: staging API origin accepted` |
| Flags en staging | `SEMSE_CREWS_ENABLED`, `SEMSE_GEOFENCE_POLICY_ENABLED` y `SEMSE_WORKSITE_BINDING_ENABLED` = `true` |
| Obra **verificada** | obra con pin manual en el lugar de prueba, radio de 150 m, vinculada al trabajo o proyecto de la persona |
| Obra **sin verificar** | segunda obra con ubicación `geocoded`, vinculada a otro trabajo o proyecto |
| Cuentas | una cuenta WORKER por teléfono (o la misma en los tres) y una cuenta gestora (PRO) |

Anota en cada fila: ✅ pasa / ❌ falla / ⚠️ parcial, más hora, versión del build y una captura o nota.

## 1. Matriz

| # | Prueba | Pasos | Aprobado si… | Motorola | iPhone A | iPhone B |
|---|---|---|---|---|---|---|
| 1 | Arranque y navegación (React 19.3 sobre Fabric de RN 0.86.3) | Instalar, abrir, iniciar sesión y recorrer Inicio, Reloj, Ajustes y Trabajos; cerrar y reabrir | Sin pantallas en blanco, cierres ni errores rojos; la navegación responde | ☐ | ☐ | ☐ |
| 2 | Permiso de ubicación en primer plano | Primera vez en Reloj o Ajustes: aceptar «mientras se usa» | Se muestra el texto del permiso en español; la app sigue funcionando si se deniega (con aviso) | ☐ | ☐ | ☐ |
| 3 | Permiso en segundo plano | Conceder «siempre» (Android: «permitir todo el tiempo») | Llega el evento de proximidad con la app en segundo plano o bloqueada | ☐ | ☐ | ☐ |
| 4 | Modo ASK | Ajustes → Ubicación: ASK; llegar a la obra verificada | Llega una notificación «¿Iniciar el reloj?»; el reloj **no** arranca solo; al aceptar arranca como `proximity_confirmed` | ☐ | ☐ | ☐ |
| 5 | Modo AUTO con consentimiento | Ajustes: AUTO y aceptar el consentimiento; llegar a la obra **verificada** | El reloj arranca solo con el aviso «Reloj iniciado»; en el historial aparece una decisión `AUTO_START_ALLOWED` | ☐ | ☐ | ☐ |
| 6 | Obra **sin verificar** en AUTO | Con AUTO, llegar a la obra geocodificada | **No** arranca solo: llega la pregunta (decisión `PROMPT`) | ☐ | ☐ | ☐ |
| 7 | Revocación del consentimiento | Pasar de AUTO a ASK u OFF y volver a llegar | No hay auto-inicio; volver a AUTO pide otra vez el consentimiento | ☐ | ☐ | ☐ |
| 8 | Modo OFF | Ajustes: OFF; llegar a la obra | Nada: ni notificación ni reloj; no se consulta la ubicación | ☐ | ☐ | ☐ |
| 9 | Sin conexión | Modo avión y llegar a la obra en AUTO | **No** auto-inicia sin la decisión del servidor; ofrece confirmar. Al volver la red no aparecen dobles sesiones | ☐ | ☐ | ☐ |
| 10 | Ahorro de batería | Activar ahorro de batería u optimización (Android) o modo de bajo consumo (iOS) y repetir la prueba 4 | Anotar si llega el evento y con cuánto retraso. Un fallo aquí se registra como limitación, no se oculta | ☐ | ☐ | ☐ |
| 11 | Salida con el reloj activo *(fuera de W-07: no bloquea)* | Con el reloj en marcha, alejarse más allá del radio | **Nunca** termina el reloj sin preguntar. El móvil todavía no informa salidas, así que hoy lo esperado es que no pase nada; anotarlo como observación | ☐ | ☐ | ☐ |
| 12 | Señal imprecisa | En interior o con mala señal, llegar en AUTO | Inicio manual (`MANUAL_ONLY` → pregunta), sin auto-inicio | ☐ | ☐ | ☐ |
| 13 | Aislamiento | Con una cuenta de otra organización, llegar a la obra | Nada (decisión `IGNORE`); no ve la obra en sus sitios | ☐ | ☐ | ☐ |
| 14 | Rechazo de un inicio automático (AC-12) | Con AUTO, llegar a la obra verificada y, **después** de que el historial muestre `AUTO_START_ALLOWED`, provocar el rechazo del inicio. Para eso, revocar el consentimiento desde la web (pasar a ASK) o cortar la red antes de que llegue «Reloj iniciado». La fila 9 cubre la llegada sin red, que pide confirmar antes del inicio | En el historial queda `AUTO_START_ALLOWED` sin consumir. No queda ningún reloj iniciado como manual. Llega la pregunta «¿Iniciar el reloj?» y solo al aceptarla arranca como `proximity_confirmed`. Si el momento no se puede reproducir en el dispositivo, anotarlo: la ruta del 409 está cubierta por tests unitarios | ☐ | ☐ | ☐ |

## 2. Evidencia que necesito por dispositivo

- Modelo y versión del sistema, y número del build de EAS.
- Por cada fila: resultado, hora y una captura (notificación, reloj o historial «Ubicación y reloj»).
- Cualquier cierre de la app: hora aproximada y qué estabas haciendo.

## 3. Criterio de cierre

Gate 5 queda **cerrado** solo si las filas 1–9, 12 y 14 pasan en los tres teléfonos. La fila 10 puede quedar como
limitación documentada; la fila 13, con al menos un dispositivo. La fila 11 (salida) es una observación fuera de
W-07 y no bloquea, salvo que el reloj termine sin preguntar, que sí bloquea. Cualquier ❌ en las filas 5, 6, 8, 9 o
14 bloquea el cierre, porque son las barreras de seguridad del auto-inicio.

**Misma cuenta WORKER en los tres teléfonos (decisión del 2026-11-25):** probar **un teléfono a la vez**. Antes de
pasar al siguiente, detener cualquier reloj activo y comprobar en el historial «Ubicación y reloj» que no quedan
sesiones abiertas. Con un reloj activo de otro teléfono, el servidor ignora las llegadas (`IGNORE`) y falsearía las
filas 4–6. Cerrar Gate 5 **no** autoriza a encender ningún flag en producción.
