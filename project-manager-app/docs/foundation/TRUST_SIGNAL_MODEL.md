# Trust Signal Model

La capa `trust` expone una lectura explicable sobre senales ya existentes del runtime.

Rutas iniciales:
- `GET /v1/jobs/:jobId/trust`
- `GET /v1/projects/:projectId/trust`

Ownership de lectura:
- `OPS_ADMIN`
- org cliente duenia del `Job`
- org `PRO` asignada, reservada o contratada

Senales iniciales:
- contrato activo y firmas bilaterales;
- disputas abiertas o en revision;
- milestones rechazados;
- milestones enviados sin evidencia;
- transacciones financieras fallidas;
- ultimo `risk score` registrado, si existe.

Regla de producto:
- `trust` es lectura explicable y no bloquea acciones por si mismo en esta etapa.
- cualquier gating futuro debe salir de policy explicita, no del score numerico por si solo.
