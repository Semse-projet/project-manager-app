# Surface Integration Status

Fecha: 2026-04-23

## Ya cableado a capa de dominio

- `Dashboard.tsx` -> `useWorkerJobs`
- `Trabajos.tsx` -> `useWorkerJobs`
- `Evidencias.tsx` -> `useWorkerEvidence`
- `Viajes.tsx` -> `useWorkerTravel`
- `DetalleTrabajo.tsx` -> `useWorkerJobDetail`
- `Tareas.tsx` -> `useWorkerTasks`
- `Pagos.tsx` -> `useWorkerPayments`
- `Gastos.tsx` -> `useWorkerTravel`
- `Hospedaje.tsx` -> `useWorkerTravel`
- `FieldOps.tsx` -> `useWorkerFieldOps`
- `Perfil.tsx` -> `useWorkerProfile`
- `Anticipos.tsx` -> `useWorkerAdvance`
- `Incidentes.tsx` -> `useWorkerIncidents`
- `Disputas.tsx` -> `useWorkerDisputes`
- `Materiales.tsx` -> `useWorkerJobs`
- `ClientDashboard.tsx` -> `useClientJobs` + `useClientProject`
- `ClientMisTrabajos.tsx` -> `useClientJobs`
- `ClientProyectoActivo.tsx` -> `useClientProject` + `useClientPayments`
- `ClientPagos.tsx` -> `useClientPayments`
- `ClientDetalleJob.tsx` -> `useClientJobs` + `useClientProposals`
- `ClientComparar.tsx` -> `useClientProposals`
- `ClientDocumentos.tsx` -> `useClientDocuments`
- `ClientProfile.tsx` -> `useClientProfile`

## Aun acoplado a mock data

- Ninguna pagina consume `mockData` o `clientMockData` de forma directa.
- Persisten fallbacks `mock` dentro de repositories mientras no exista contrato backend definitivo para cada dominio.

## Lectura operativa

- La app ya no es solo demo en el bloque inicial worker ni en el bloque base client.
- El corredor operativo principal de `worker` ya quedó desacoplado de `mockData`.
- La superficie `client` operativa ya no depende directo de `clientMockData` en sus vistas principales.
- Toda la superficie `worker` y `client` visible ya consume repositorio + hook + contrato de dominio.
- `travel` ya puede alinearse rapido con el backend real del monorepo porque ese dominio esta mas maduro.
