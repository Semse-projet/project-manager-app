# Politica de Retencion y Limpieza de la Operacion Asistida

- Fecha: 2026-04-12
- Estado: activo
- Tipo: repository rule

## Proposito

Definir que partes de la operacion asistida deben conservarse, cuales pueden recrearse y cuales deben purgarse regularmente sin comprometer la integridad del ecosistema.

## Subcapas oficiales

1. `operator_identity`
2. `workspace_memory`
3. `agent_runtime`
4. `ephemeral_runtime_state`
5. `backup_recovery`

## Politica por subcapa

### `operator_identity`

Incluye:

- credenciales;
- configuracion persistente;
- memoria transversal del operador.

Regla:

- conservar por defecto;
- no borrar sin respaldo validado;
- no mezclar con dominio de producto;
- toda rotacion debe documentarse si afecta continuidad operativa.

### `workspace_memory`

Incluye:

- memoria contextual por workspace;
- worktrees;
- configuraciones locales del ecosistema;
- estado operativo por repositorio.

Regla:

- conservar por defecto;
- tratar como activo del sistema vivo;
- solo archivar o podar con criterio explicito de envejecimiento o cierre de workspace.

### `agent_runtime`

Incluye:

- bundles locales;
- imagenes de ejecucion;
- runtimes versionados;
- sandboxes.

Regla:

- clasificar como recreable;
- permitir purga controlada si existe respaldo o si se acepta reconstruccion;
- nunca tratar como memoria institucional.

### `ephemeral_runtime_state`

Incluye:

- caches;
- logs;
- code cache;
- GPU cache;
- staging temporal.

Regla:

- purgable por defecto;
- no se considera activo critico;
- se puede limpiar sin proceso de aprobacion arquitectonica.

### `backup_recovery`

Incluye:

- copias externas validadas;
- snapshots de recuperacion;
- almacenamiento frio.

Regla:

- conservar al menos una copia validada;
- no operar en caliente desde medios que no soportan semantica Unix completa;
- eliminar duplicados parciales solo despues de conservar una copia buena.

## Matriz de accion

| Subcapa | Retencion por defecto | Purgable | Requiere validacion previa | Nota |
|---|---|---|---|---|
| `operator_identity` | si | no | si | afecta continuidad operativa |
| `workspace_memory` | si | no, salvo criterio explicito | si | activo del ecosistema vivo |
| `agent_runtime` | no obligatoria | si | recomendable | recreable |
| `ephemeral_runtime_state` | no | si | no | efimero |
| `backup_recovery` | si | solo duplicados o parciales | si | mantener al menos una copia valida |

## Regla de evidencia

Si una limpieza supera el estado efimero y afecta runtime, memoria o respaldo:

- debe registrarse en `reportes/`

Si la politica cambia:

- debe reflejarse en `constitution/` o `program/` segun impacto.
