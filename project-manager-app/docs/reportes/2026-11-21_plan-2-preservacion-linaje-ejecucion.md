# 2026-11-21 — Plan 2 «Preservación de datos y linaje»: ejecución de tareas independientes

**Estado:** DOCUMENTAL + TOOLING · sin cambios de runtime · sin acceso a producción · ningún gate operativo cerrado.
**Rama:** `claude/plan-2-preservacion-datos-linaje-c53u3e` · **Base:** `main@86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f`.

## Qué se hizo

- Búsqueda del contrato `SEMSE_Plan_2_Preservacion_Datos_Linaje.md` v34 en repo, cargas, Drive y artifacts: **no accesible**. Tampoco los Planes 0/1/3/4/6/11, el respaldo JSON, las exportaciones, el CSV ni el Site v4/v6.
- Revalidación estática de los bloqueos C (extracción TimeEntry) y D (Evidence): `scripts/plan2/static-evidence.mjs`, resultado en `docs/program/plan-2/static-evidence_2026-11-21.json` (12 controles HOLDS).
- Herramientas de solo lectura para A y B: `scripts/plan2/verify-preservation-package.mjs`, `scripts/plan2/diff-site-collections.mjs`.
- Pruebas sintéticas `tests/unit/plan2-preservation-tools.test.mjs`: 9/9 PASS (`node --test`, Node v22.23.5). Sin datos reales.
- Paquete de actualización v34→v35 con matriz de pendientes y conclusiones: `docs/program/plan-2/SEMSE_Plan_2_v35_PAQUETE_ACTUALIZACION_2026-11-21.md`.

## Hallazgos nuevos

1. La interfaz del tracker suma `durationMinutes·60` (truncado con `floor` en el servidor) y redondea a 0,01 h; es hipótesis verificable —no causa— de la diferencia de 120 s.
2. `TimeEvidence` no tiene FK a `Evidence`, ni `tenantId`, ni checksum, y ningún código lo usa: la cadena `TimeEntry`–`TimeEvidence`–`Evidence` no existe en el esquema.
3. Existe en Drive un respaldo autodeclarado del 2026-11-05 con restore aislado reportado; candidato para Plan 11/O11-10, **no verificado**. Su custodia (dump con PII en Drive sin cifrado de destino demostrado) requiere decisión humana.

## Segunda intervención (r2, mismo día)

- El enlace compartido de ChatGPT al Plan 2 exige sesión y muestra un desafío de Cloudflare: no se sorteó. v34 y Planes 0–13 siguen no accesibles (ninguna rama ni repositorio accesible los contiene).
- Railway, solo lectura: `semse-API` en producción tiene como commit fuente `86c0be5`, el mismo inspeccionado; volúmenes inventariados. Esto no prueba comportamiento en ejecución ni backups.
- `diff-site-collections` clasifica coincidencias, candidatos (re-clave), conflictos y huérfanos sin emparejar; el verificador rotula sus sumas como no aprobadas. 10/10 pruebas sintéticas PASS.
- Paquete r2: contexto del propietario (Time Tracker nativo, `TimeEntry` canónico), responsables por plan con Plan 13, puerta de ejecución P2-G1 (sin aprobación demostrada) y P2-A6 (discrepancia de Railway de Plan 1).

## Gobernanza

- No es feature de dominio: herramientas de verificación en `scripts/` y documentación, sin endpoints, sin cambios de esquema ni de permisos. No se tocó Railway, producción, Evidence, CI ni flags.
- Bloqueos y solicitud única al propietario: ver §5–§6 del paquete.
