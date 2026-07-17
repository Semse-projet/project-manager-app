# SOURCE OF TRUTH — Fuentes de verdad de SEMSEproject

- **Version:** 2.0
- **Corte:** 2026-07-16
- **Repositorio:** `Semse-projet/project-manager-app`
- **Raiz canónica de desarrollo:** `project-manager-app/`

Este archivo define precedencia y ownership. No sustituye los contratos SDD.

## Jerarquia oficial

En caso de contradiccion se aplica este orden:

1. **Codigo actual de `main`.** Es el comportamiento implementado.
2. **Specs y contratos aprobados.** Incluye SDD, Zod, Prisma, migrations,
   eventos, tests, criterios de aceptacion y ADR vigentes.
3. **Produccion comprobada.** Determina que parte del codigo ya fue desplegada;
   no convierte por si sola una feature flag en activa.
4. **Documentacion operativa vigente.** Debe reflejar las tres capas anteriores.
5. **Conversaciones y vision de producto.** Definen intencion que debe
   convertirse en specs verificables.
6. **Investigacion externa.** Informa decisiones sin sobrescribir componentes
   existentes innecesariamente.

Codigo, test local, CI, merge, deploy y activacion son estados distintos. Toda
afirmacion de capacidad debe declarar cual de ellos fue verificado.

## Ownership canónico en este repositorio

| Capa | Fuente | Consumidores |
| --- | --- | --- |
| Esquema y migrations | `packages/db/prisma/` | API, workers, CI |
| Contratos API/dominio | `packages/schemas/src/` | API, Web, workers, SDK |
| Telemetria de producto | `packages/product-events/` | Web, API Product Intelligence |
| Autenticacion compartida | `packages/auth/` | Web, API |
| Agentes y autonomia | `packages/agents/`, `packages/autonomy/` | API, workers, runtimes |
| Knowledge/RAG | `packages/knowledge/` y modulos API asociados | API, Prometeo, workers |
| API de dominio | `apps/api/src/modules/` | Web, workers, integraciones |
| Frontend web canónico | `apps/web/` | Usuarios finales |
| Procesamiento asincrono | `apps/worker/` | Colas y loops |
| Contratos SDD | `docs/specs/` + `docs/SPEC_INDEX.md` | Equipo y agentes |
| Arquitectura vigente | `docs/architecture/CURRENT_ARCHITECTURE.md` | Equipo y agentes |
| Estado de capacidades | `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md` | Planificacion y auditoria |
| Roadmap | `ROADMAP.md` | Ejecucion F0-F9 |

`apps/angular` y `apps/assistant-portal` son superficies adicionales o de
transicion. No reemplazan `apps/web` ni `apps/api` como superficies canónicas.

## Precedencia de contratos TypeScript

```text
packages/schemas/ > packages compartidos autorizados > tipos locales en apps/
```

Si un tipo local contradice un schema compartido:

1. confirmar el contrato SDD y Zod vigente;
2. corregir el consumidor;
3. no crear un tercer contrato paralelo.

`ProductEvent` y `DomainEvent` son buses distintos: telemetria de experiencia no
se publica en la outbox transaccional de negocio.

## Precedencia de datos

```text
packages/db/prisma/schema.prisma + migrations > SQL o modelos legacy
```

- PostgreSQL + Prisma son el sistema de registro.
- Todo cambio de schema requiere plan de migracion, validacion y rollback.
- `tenantId` acota el espacio pero no autoriza: ownership y policy siguen
  siendo obligatorios.
- Una tabla o accessor presente no demuestra que el flujo esté activo en
  produccion.

## Documentos historicos y vision

- Los archivos marcados `SUPERSEDIDO` son referencia, no autorizacion de
  implementacion.
- Los documentos fuera de la raiz canónica no prevalecen sobre codigo, specs o
  documentacion vigente.
- Una vision nueva debe aterrizarse en spec/ADR antes de modificar codigo.
- No ejecutar un roadmap historico aunque conserve tareas pendientes.

## Checklist antes de implementar

- [ ] Leer `.specify/memory/constitution.md` y `docs/SPEC_INDEX.md`.
- [ ] Confirmar bounded context y ownership en la taxonomia de nueve dominios.
- [ ] Confirmar spec aprobado, invariantes, FSM y eventos aplicables.
- [ ] Reutilizar modelos, schemas, componentes y adapters existentes.
- [ ] Declarar cambios de datos, permisos, eventos, pruebas y rollback.
- [ ] Separar evidencia local, CI, merge, deploy y activacion.
- [ ] Actualizar arquitectura/matriz/roadmap si cambia el estado real.

## Snapshot vigente

El snapshot verificable más reciente se registra en
[`reportes/F0_TRUTH_SYNC_2026-07-16.md`](reportes/F0_TRUTH_SYNC_2026-07-16.md).
No copiar su SHA a documentos futuros sin repetir la verificacion.
