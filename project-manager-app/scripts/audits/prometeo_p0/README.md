# Prometeo C51 / #974 — Inventario histórico agregado

Este paquete **no concede acceso a documentos**, no altera la BD y no activa `SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED`. Sólo produce **conteos agregados** para identificar riesgos de integridad, visibilidad legada y auditoría antes de una posible decisión formal sobre compartir información entre organizaciones.

## Alcance y procedencia

- `prometeo_p0_historical_inventory_json_readonly.sql`: consulta única de PostgreSQL que devuelve un objeto JSON de conteos; `REPEATABLE READ`, `READ ONLY`, `statement_timeout=15s`, `lock_timeout=2s`, termina en `ROLLBACK`.
- `evaluate_inventory.py`: valida **offline** el JSON contra un esquema cerrado, rechaza campos de identidad o contenido, identifica inconsistencias y devuelve siempre `activation_decision=NOT_AUTHORIZED_BY_THIS_AUDIT`.
- `test_evaluator.py` y `test_sql_contract.py`: validación local con datos sintéticos y controles estáticos.
- `fixture_postgres16_synthetic.sql` y `test_postgres16_synthetic.sh`: prueba adicional contra PostgreSQL 16 **real pero desechable en GitHub Actions**, utilizando un subconjunto sintético del esquema para verificar que el SQL se ejecuta, produce JSON válido y detecta un mismatch entre tenants. No examina datos históricos ni demuestra la compatibilidad integral con todas las migraciones Prisma.
- `.github/workflows/prometeo-p0-inventory-static.yml` incluye además `postgres16-full-prisma-schema`: ejecuta las migraciones reales de Prisma del repositorio sobre otra base PostgreSQL 16 **nueva y vacía**, y ejecuta el SQL de inventario de solo lectura. Confirma compatibilidad del SQL con el esquema migrado completo, pero **no** valida datos históricos ni detecta desviaciones específicas de producción.

**La invocación sobre una BD de SEMSE requiere acceso autorizado y revisión de operaciones.** Preferir una réplica o snapshot, una cuenta `SELECT` restringida, conexión privada y una carpeta de evidencias privada; los conteos pequeños también pueden ser confidenciales. Nunca abrir un proxy TCP público ni pegar `DATABASE_URL` en GitHub, logs o tickets.

## Procedimiento del operador autorizado

Desde esta carpeta, con la conexión de `psql` configurada **fuera** del repositorio y el acceso expresamente permitido:

```bash
umask 077
if psql -X -q -t -A -v ON_ERROR_STOP=1 \
  -f prometeo_p0_historical_inventory_json_readonly.sql > .p0_inventory.tmp; then
  mv .p0_inventory.tmp p0_inventory_private.json
  python3 evaluate_inventory.py p0_inventory_private.json
else
  rm -f .p0_inventory.tmp
  echo "Inventario incompleto; no interpretar resultados parciales." >&2
  exit 2
fi
```

Los resultados individuales `p0_inventory_private.json` se conservan sólo en el almacén privado de evidencias conforme al procedimiento de la organización, **no en el repositorio ni en comentarios de PR**. Documentar la versión del snapshot, la autorización y las limitaciones sin copiar credenciales ni registros.

## Interpretación

- `HOLD_INTEGRITY`: revisar incoherencias de tenant/org/proyecto, integridad de grant, chunks o feedback.
- `HOLD_CLASSIFICATION`: revisar visibilidad histórica, grants activos y trazabilidad de eventos.
- `NO_FLAGGED_AGGREGATE_ANOMALIES`: no se detectaron anomalías dentro de las métricas examinadas, **no equivale a consentimiento**.
- Evidencia JSON inválida/incompleta: error, sin conclusión favorable.
- **Todos los casos:** `NOT_AUTHORIZED_BY_THIS_AUDIT`. SDD `REVIEW`, ADR-046 `Proposed` y los controles de nivel 3 siguen siendo gates independientes.

Para pruebas locales: `python3 -m pytest -q test_evaluator.py test_sql_contract.py` (requiere `pytest`). La prueba `test_postgres16_synthetic.sh` sólo se ejecuta en CI y exige la base efímera y guardas de host/puerto/usuario/nombre de BD.

Este auditor deriva del paquete local SEMSE P0 v6, revisado contra el esquema Prisma incorporado en PR #987. **El CI sí ejecuta el inventario contra PostgreSQL 16 sintético desechable**, nunca contra producción ni una réplica de datos reales. La consulta histórica sobre datos de SEMSE necesita autorización separada.
