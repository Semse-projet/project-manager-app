# SOURCE OF TRUTH — Fuentes de verdad de SEMSEproject

- **Version:** 2.1
- **Corte:** 2026-07-29
- **Repositorio:** `Semse-projet/project-manager-app`
- **Raiz canónica de desarrollo:** `project-manager-app/`

Este archivo define precedencia y ownership. No sustituye los contratos SDD.

## Ejes oficiales de verdad

No existe una sola precedencia que permita borrar una contradicción:

1. **Constitución + specs aprobados:** intención autorizada y criterios.
2. **Código actual de `main`:** comportamiento implementado/versionado.
3. **Producción comprobada:** runtime, configuración y datos realmente
   desplegados.
4. **Contratos ejecutables:** Zod, Prisma, migrations, eventos y tests.
5. **Documentación operativa:** debe reconciliar los cuatro ejes anteriores.
6. **Visión/conversaciones/investigación:** informan trabajo futuro y primero
   se convierten en spec/ADR.

Si producción tiene una migración que Git no contiene, producción no “gana” ni
Git “gana”: existe drift y se detiene el siguiente deploy hasta reconciliar el
historial de forma segura.

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
| Plantillas SDD | `.specify/templates/overrides/` | Specs/planes/tareas/checklists nuevos |
| Arquitectura vigente | `docs/architecture/CURRENT_ARCHITECTURE.md` | Equipo y agentes |
| Mapa de convergencia | `docs/architecture/PRODUCTION_CONVERGENCE_MAP.md` | Programa F3-F9 |
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
[`PRODUCTION_CONVERGENCE_TRACKER.md`](PRODUCTION_CONVERGENCE_TRACKER.md).
No copiar su SHA a documentos futuros sin repetir la verificación.
