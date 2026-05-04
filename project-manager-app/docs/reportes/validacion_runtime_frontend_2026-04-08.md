# Validación Runtime Frontend

Fecha: 2026-04-08
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Continuar después del cierre de tipado del frontend, intentando validación funcional real de las nuevas rutas y pantallas sobre `next dev`.

## Acciones ejecutadas

### 1. Revisión de sesión/middleware

Archivo revisado:

- `/home/yoni/labsemse/project-manager-app/apps/web/middleware.ts`

Conclusión:

- `/client`, `/worker` y `/admin` requieren cookie `semse_session`;
- los proxies `/api/semse/*` siguen siendo públicos;
- para validación completa de pantallas protegidas hace falta que `next dev` levante.

### 2. Revisión del formato de cookie

Archivo revisado:

- `/home/yoni/labsemse/project-manager-app/apps/web/lib/auth.ts`

Conclusión:

- la sesión se resuelve desde una cookie base64url JSON;
- quedó lista la estrategia para probar páginas protegidas, pero no pudo completarse porque el servidor web no inició.

### 3. Intento de arranque del frontend

Comando ejecutado:

- `npm run dev:web`

Resultado:

- falla en `next dev` con:
  - `Bus error (core dumped)`

### 4. Intento alterno

Comando ejecutado:

- `npm run dev --workspace @semse/web -- --hostname 0.0.0.0 --port 3002`

Resultado:

- `npm` respondió `No workspaces found: --workspace=@semse/web`
- esta segunda prueba no sirvió como validación del runtime del web;
- el hallazgo relevante sigue siendo el primero: `next dev` cae en runtime.

## Estado real

La implementación frontend de esta ronda queda en este estado:

- tipado estático limpio;
- proxies creados;
- páginas conectadas;
- sin validación navegable en browser porque el runner de Next no levanta en este entorno.

## Verificación sí conseguida

Comando ya validado en la ronda anterior inmediata:

- `npm exec tsc --workspace @semse/web -- --noEmit`

Resultado:

- pasa con `0` errores

## Lectura técnica

El bloqueo actual no apunta a:

- imports rotos;
- tipos;
- proxies mal declarados;
- ni a las páginas nuevas por sí mismas.

Apunta al runtime de Next.js en este entorno local, consistente con el antecedente previo donde `next build` también había mostrado `Bus error`.

## Siguiente paso recomendado

El siguiente paso útil es aislar el fallo de runtime del web:

1. revisar `package.json` y workspace real de `apps/web`;
2. ejecutar `next dev` con comando directo del paquete correcto;
3. si persiste el `Bus error`, tratarlo como problema de entorno/binario del runner y no de la UI implementada.
