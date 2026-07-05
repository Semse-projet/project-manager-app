# 03 — Backend Structure Future Plan

Esta parte NO se ejecuta en Fase 1. Sirve para guiar la reorganización posterior.

## NestJS por dominios

```txt
apps/api/src/
├── core/
│   ├── auth/
│   ├── users/
│   ├── organizations/
│   ├── roles/
│   ├── permissions/
│   ├── audit/
│   └── config/
├── workops/
│   ├── projects/
│   ├── jobs/
│   ├── tasks/
│   ├── milestones/
│   ├── evidence/
│   ├── change-orders/
│   ├── time-tracker/
│   └── field-reports/
├── marketplace/
├── finance/
├── trust/
├── intelligence/
├── communications/
├── tool-hub/
├── verticals/
└── shared/
```

## Regla

No mover backend hasta que el Admin modular esté estable en producción.

