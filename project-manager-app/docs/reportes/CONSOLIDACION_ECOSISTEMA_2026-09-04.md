# Consolidación del ecosistema SEMSE

**Fecha:** 2026-09-04  
**Alcance:** copia local, GitHub y Railway  
**Regla de preservación:** no se eliminan archivos, ramas, migraciones ni despliegues.

## Estado verificado

- **GitHub canónico de producción:** `Semse-projet/project-manager-app`, `origin/main` en `88171003` (`fix(payments,users): wire lien waiver gate + sign identity attestations separately (#595)`).
- **Railway:** proyecto `SEMSEproject`, entorno `production`.
- **Servicios Railway:** `semse-API`, `semse-web`, `semse-worker`, `semse-vision`, `Postgres`, `Redis` y `ollama` reportan `SUCCESS` con una instancia activa; `db-dedup-script` está detenido de forma esperada (`running=0`) y su último despliegue también reporta `SUCCESS`.
- **API Railway:** despliegue `ff1e40d6-56fd-4b35-b13b-15c905246bcd`, commit `88171003`, healthcheck `/v1/health`, migración previa `node scripts/pre-migrate.mjs`, dominio `api.semseproject.com`.

## Copia local conservada

La copia de trabajo usada para esta revisión es:

`release-candidates/semse-f1-f4-883949/project-manager-app`

Contiene un paquete local F1–F4 preparado en el índice de su repositorio padre. Ese paquete no está contenido en `origin/main` como un conjunto equivalente: la comparación mostró divergencias amplias de historial, documentación, módulos y migraciones. Por seguridad, no se hizo `reset`, `checkout`, `merge`, `rebase` ni `push` automático.

Esto deja tres referencias explícitas:

1. `origin/main` es la referencia de producción y de Railway.
2. La copia local F1–F4 es material de consolidación pendiente de revisión/merge.
3. Ninguna de las dos referencias se destruye ni se declara fusionada sin una decisión posterior.

## Validaciones ejecutadas en local

Desde `project-manager-app`, usando `corepack pnpm`:

- `spec:validate:strict`: correcto, sin salida de error.
- `typecheck`: correcto para paquetes, API, web y worker.
- `test:unit`: **967 aprobadas, 0 fallidas, 9 omitidas**; las omisiones corresponden a pruebas bloqueadas por alcance F6 documentado.

Se corrigió una única inconsistencia de workspace: se retiró el bloque `pnpm.overrides` duplicado de `apps/assistant-portal/package.json`; el override efectivo ya vive en el `package.json` raíz. No se retiró ninguna dependencia.

## Próximo paso seguro

Antes de publicar la consolidación F1–F4, crear una rama de integración y resolver manualmente las divergencias contra `origin/main`, preservando los documentos y módulos históricos. Después ejecutar nuevamente specs, typecheck, unit tests y una validación de despliegue en Railway; solo entonces considerar un commit/PR y un despliegue controlado.
