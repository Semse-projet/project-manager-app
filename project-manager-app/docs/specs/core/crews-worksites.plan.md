# Plan — BO-07 crews-worksites
- Aditivo: tablas Worksite, Crew, CrewMember; sin tocar Membership.
- Servicio CrewsService con revalidación de Membership ACTIVE en cada lectura.
- Flag SEMSE_CREWS_ENABLED (apagado -> 404). Rollback: apagar flag.
