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
3. Existe en Drive (carpeta privada) un respaldo autodeclarado del 2026-11-05 con restore aislado reportado; candidato para Plan 11/O11-10, **no verificado**. Su custodia (dump con PII en Drive sin cifrado de destino demostrado) requiere decisión humana.

## Segunda intervención (r2, mismo día)

- El enlace compartido de ChatGPT al Plan 2 exige sesión y muestra un desafío de Cloudflare: no se sorteó. v34 y Planes 0–13 siguen no accesibles (ninguna rama ni repositorio accesible los contiene).
- Railway, solo lectura: `semse-API` en producción tiene como commit fuente `86c0be5`, el mismo inspeccionado; volúmenes inventariados. Esto no prueba comportamiento en ejecución ni backups.
- `diff-site-collections` clasifica coincidencias, candidatos (re-clave), conflictos y huérfanos sin emparejar; el verificador rotula sus sumas como no aprobadas. 10/10 pruebas sintéticas PASS.
- Paquete r2: contexto del propietario (Time Tracker nativo, `TimeEntry` canónico), responsables por plan con Plan 13, puerta de ejecución P2-G1 (sin aprobación demostrada) y P2-A6 (discrepancia de Railway de Plan 1).

## Tercera intervención (r3, mismo día)

- El propietario pegó en la sesión el texto del Plan 2 v34. Con él se produjo el archivo íntegro v35, entregado fuera del repositorio porque este es público y el plan contiene datos a nivel de registro. Ver el aviso r3 del paquete.
- Se **retira** el hallazgo 1 como hipótesis de los 120 s: el total histórico procede del Site (HTML v4), no del tracker web de SEMSE.
- Diff `7029da63…86c0be5` vacío en las rutas relevantes; nuevos controles D-06…D-08 HOLDS.
- `diff-site-collections` admite `data` y colecciones-mapa, y compara `source`/`synthetic`. El verificador admite transformaciones por fila. 12/12 pruebas PASS.

## Cuarta intervención (r4, mismo día): paquete de entrada recibido

- El propietario entregó el ZIP de entrada (SHA-256 `56a2173a…cf61`): Plan 2 v34 auténtico, las dos exportaciones JSON, el CSV, el manifiesto, el verificador Python y los derivados de Plan 3. 9/9 hashes coinciden con `SHA256SUMS.txt` y con los documentados en v34.
- Verificador Python del propietario (leído antes de ejecutarlo; Python 3.13.18, `-I`, sobre copias de trabajo): `RESULT: PASS`. Originales intactos antes y después.
- Herramientas de `scripts/plan2/` sobre las mismas copias:
  - `verify-preservation-package`: PASS; 15 filas `payable` no sintéticas, 1 `synthetic` preservada y no sumada, 20 IDs cotejados y 0 fuera de tolerancia;
  - `diff-site-collections` entre las dos exportaciones: `NO_COLLISIONS`, con el hash canónico de `data` reproducido en JS igual al del manifiesto (Python).
- 120 s: las 15 duraciones son minutos exactos, así que el redondeo por fila queda descartado. Solo el redondeo del total a 0,1/0,5 h reproduce 171,50 h, como hipótesis compatible y no como causa. Además, en 11 de 15 filas las marcas `inicio`/`fin` no coinciden con la duración; queda para Plan 3.
- El respaldo no contiene referencias de Evidence.
- El plan íntegro v35 (sobre el v34 auténtico), el diff y los reportes se entregaron al propietario **fuera del repositorio**, porque contienen IDs de registros. Este reporte solo registra resultados agregados.

## Quinta intervención (r5, mismo día): v36 del plan

- La revisión documental de v35 recomienda dar pase a la puerta documental. No es aprobación formal; la puerta operativa y la de ejecución siguen bloqueadas.
- Reproducción, con resultado idéntico byte a byte:
  - paquete de entrada: 9/9 SHA-256 OK;
  - diff v34→v35 y `patch` desde la v34 original;
  - construcción de la v35;
  - verificadores Python y Node, comparación de colecciones y análisis de los 120 s.
- La v36 (`03f21990…550a`) corrige cuatro errores documentales; la principal es el estado de la hipótesis del redondeo del total, que no tiene apoyo en el código v4 local. Los 120 s siguen sin causa. Los entregables con datos personales se mantienen fuera del repositorio.

## Gobernanza

- No es feature de dominio: herramientas de verificación en `scripts/` y documentación, sin endpoints, sin cambios de esquema ni de permisos. En Railway solo se leyeron inventario y metadatos de despliegue; no se tocaron producción, Evidence, CI ni flags.
- Bloqueos y solicitud única al propietario: ver §5–§6 del paquete.
