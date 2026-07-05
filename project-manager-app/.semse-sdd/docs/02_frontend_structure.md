# 02 — Frontend Structure

## Estructura recomendada

```txt
apps/web/
├── app/
│   ├── (public)/
│   ├── (auth)/
│   ├── (app)/
│   │   ├── admin/
│   │   ├── client/
│   │   ├── worker/
│   │   └── contractor/
│   └── api/
├── components/
│   ├── layout/
│   ├── navigation/
│   ├── cards/
│   ├── tables/
│   ├── forms/
│   ├── evidence/
│   ├── finance/
│   ├── intelligence/
│   └── tool-hub/
├── features/
│   ├── workops/
│   ├── marketplace/
│   ├── finance/
│   ├── trust/
│   ├── intelligence/
│   ├── tool-hub/
│   └── verticals/
├── lib/
│   ├── api/
│   ├── auth/
│   ├── config/
│   ├── railway/
│   ├── stripe/
│   └── utils/
└── types/
```

## Fase 1 segura

Crear solamente:

```txt
apps/web/lib/admin/admin-navigation.ts
apps/web/app/(app)/admin/workops/page.tsx
apps/web/app/(app)/admin/intelligence/page.tsx
apps/web/app/(app)/admin/tool-hub/page.tsx
apps/web/app/(app)/admin/verticals/page.tsx
```

Actualizar con cuidado:

```txt
apps/web/app/(app)/admin/mission-control/page.tsx
```

