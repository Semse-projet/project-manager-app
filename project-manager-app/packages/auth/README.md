# packages/auth

Módulo de autenticación/autorización reusable.

Incluye:
- Guards RBAC
- Verificación de permisos por tenant/org
- Estrategia para OIDC/SSO futura

Dominios RBAC declarados en `src/rbac.ts`:
- core product: jobs, bids, milestones, evidence, projects, contracts, payments/finance;
- operations: ops, domain-events, communications, autonomy, agents;
- domain tools: knowledge, tools, vision, weather, agro.
