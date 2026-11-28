# 2026-11-25 — OPEN-18 v0.3 y Gate 5: avance según las autorizaciones del propietario

Registro del orden autorizado (puntos 1–9 del 2026-11-25). Solo resultados verificados; lo que no se pudo verificar
se marca como tal. **Sin cambios en producción ni activación de flags.**

## 1. Procedencia del commit `6f5fb230` en #1172 (auditoría de solo lectura)

| Dato | Resultado |
|---|---|
| Autor y committer | `Cursor Agent <cursoragent@cursor.com>`, con el propietario como coautor |
| Firma | SSH, **verificada por GitHub** (`verified: true`, `reason: valid`); cuenta `cursoragent` |
| Contexto | entre las 23:06 y las 23:10 UTC del 2026-11-24, `cursor[bot]` creó ramas `cursor/*` y se abrieron, con la cuenta del propietario, #1183, #1184, #1185, #1186 y #1187 (después #1188) |
| Conclusión | Cursor Cloud Agent lanzado desde la cuenta del propietario. No hay indicio de un actor ajeno. **Pendiente:** confirmación personal del propietario |
| Observación | #1183 (`cursor/liens-forge-satellites-ui`) toca módulos congelados. No se tocó; lo decide el propietario |

Regla de coordinación vigente (4b): cada agente (Claude, Cursor, Codex u otro) trabaja en su propia rama. Ninguno
modifica ramas de otro sin autorización expresa, y todo se integra por PR.

## 2. Flags en producción (`SEMSEproject/production`, `semse-API`, solo lectura)

Railway solo devuelve los nombres de las variables (`valuesRedacted: true`).

| Flag | Definida | Estado efectivo |
|---|---|---|
| `SEMSE_GEOFENCE_POLICY_ENABLED` | no | OFF (valor por defecto) |
| `SEMSE_WORKSITE_BINDING_ENABLED` | no | OFF (valor por defecto) |
| `SEMSE_CREWS_ENABLED` | **sí** | **NO VERIFICADO**: el valor no es legible y, sin sesión, el endpoint responde 401 en ambos casos. El propietario debe revisarlo en Railway |

## 3. PR de seguimiento de OPEN-18 — #1189 (`claude/open18-followup`)

- **AC-11, opción A:** solo cuentan las obras de la Org de la sesión. Tests positivos y negativos entre Org.
- **AC-12:** un inicio automático fallido nunca se reintenta como manual; se ofrece confirmar.
- **AC-13:** se descartan las respuestas de llegada recibidas después de detener la detección.
- **AC-14:** el enfriamiento solo empieza tras un aviso visible; intervalo GPS de 40 m.
- Tipos de `geofence-sites` desde `@semse/schemas`.
- Spec v0.3 con metadatos SDD 2.0 reales; rollback móvil documentado y probado; Gate 5 actualizado (fila 11 fuera
  de W-07, fila 14 nueva, un teléfono a la vez).
- **Local:** API 4148 tests y raíz 1774, 0 fallos; móvil 280/280.
- **Gates pendientes:** CI de la versión candidata, dos revisiones automáticas, pausa de 24 h y autorrevisión.

## 4. Estabilidad de `mobile-checks` — #1190 (`claude/ci-mobile-expo-check-advisory`)

- `expo install --check` es bloqueante si el PR cambia `apps/mobile/package.json` o el lockfile, y en
  `workflow_dispatch` (release); en el resto solo avisa.
- Expo Doctor, typecheck, tests y bundles siguen siendo bloqueantes.
- La fusión requiere autorización.

## 5. Siembra de staging — #1191 (`claude/pilot-staging-seed`)

- Script con modos plan, apply y rollback, idempotente; rechaza cualquier entorno que no sea el staging autorizado.
- Verificado en PostgreSQL local desechable.
- **No ejecutado:** faltan las coordenadas y los dos correos.
- Dependencia: repuntar `semse-api-qa` a `main` (solo staging) cuando #1189 y #1191 estén fusionados.

## 6. Pendiente del propietario

- Confirmar el commit de Cursor y decidir sobre #1183.
- Revisar `SEMSE_CREWS_ENABLED` en producción.
- Datos de siembra: coordenadas de las dos obras y correos WORKER y PRO.
- EAS y Apple: login, `env:set`, `device:create` ×2, 2FA y builds.
- Gate 5: 14 filas en el Motorola y en ambos iPhone. **Abierto.**
- Ubicación de los Planes 4, 9, 10 y 13: no están en el repositorio (búsqueda en `docs/` sin resultados).
