# Lote crítico — identidad de sesión en BFF mutantes

**Fecha:** 2026-07-25
**Hallazgo:** `0.1b` / `NEW-BFF-02`
**Spec:** `api-bff-auth-boundary` v1.1

## Resultado

Se eliminó el escalamiento directo por identidad estática de las 22 rutas BFF
con mutaciones que todavía llamaban `fetchSemseData()`. Ese helper no recibe el
request y, por diseño legacy, ejecuta contra el API usando `SEMSE_*`; con la
configuración por defecto podía convertir una sesión no administrativa en una
llamada backend `OPS_ADMIN`.

El inventario corregido cubre:

- BuildOps: 7 rutas.
- Field Ops: 5 rutas.
- Ops: 5 rutas.
- Tasks: 2 rutas.
- Governance, Incidents y Materials: 1 ruta cada uno.

Todas usan ahora `fetchSemseDataForAuthenticatedRequest()`. El helper estricto
deriva tenant, organización, usuario y roles únicamente de headers saneados por
middleware o de una cookie de sesión firmada; si no existe esa identidad,
responde `401` y no usa el principal estático del servidor.

## Regresión

`tests/unit/sensitive-bff-boundary.test.ts`:

1. fija explícitamente las 22 rutas revisadas;
2. exige el helper autenticado sin fallback en cada una;
3. prohíbe `fetchSemseData()` y `fetchSemseDataForRequest()` en ese inventario;
4. recorre todas las rutas BFF mutantes y falla si aparece una llamada nueva al
   helper bare de identidad estática.

## Validación local

- Boundary y presentación focalizados: 13/13 verdes.
- Specs: 104 escaneadas, 0 errores, 0 warnings en modo strict.
- API build: verde después de sincronizar el lockfile.
- Web lint: 0 errores; permanecen warnings legacy fuera del lote.

## Deuda explícita

Los handlers que usan `fetchSemseDataForRequest()` reciben la identidad firmada
en el flujo normal del middleware, pero el helper todavía admite fallback
estático si el request llega sin identidad. El inventario posterior encontró 213
handlers mutantes capaces de alcanzar algún fallback request-aware/local; uno es
el login público intencional. Esa defensa en profundidad requiere una migración
fase 2; no se declara resuelta en este lote.
