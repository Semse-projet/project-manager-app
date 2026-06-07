# SEMSE Frontend Architecture

> Document version: 2026-03-18 — premium refactor

---

## 1. Diagnosis (pre-refactor state)

| Area | Problem |
|---|---|
| Styling | 1,680 lines of bespoke CSS, no utility framework, light-mode only |
| Design system | No reusable component library; inline CSS class coupling |
| Dark mode | None — hardcoded `#ffffff` backgrounds |
| Loading states | Text strings ("Cargando…") with no skeleton UI |
| Error states | Inline `<div className="jobs-message-error">` without consistent structure |
| Empty states | None — silent absence of content |
| Accessibility | Skip-link missing, no `aria-progressbar`, contrast issues on muted text |
| Component size | `semse-cortex-console.tsx` 780 lines, `semse-control-surface.tsx` 730 lines |
| Architecture | No lib/ or components/ folder — everything in `app/` root |
| Package scope | No Tailwind, no animation library, no class utility helper |

---

## 2. Architecture decisions

### 2.1 Framework

**Next.js 15 App Router** — unchanged. Server Components remain the default. Client components are limited to pages that require `useEffect`, `useState`, or browser events.

**Rule:** Every new component is a Server Component unless it explicitly requires interactivity. Client components are marked with `"use client"` and live at the leaf of the component tree.

### 2.2 Styling: Tailwind v4 (CSS-first)

Tailwind v4 is configured via PostCSS (`@tailwindcss/postcss`). No `tailwind.config.ts` is needed. Configuration lives in `globals.css` via `@import "tailwindcss"` and `@theme {}`.

**Why v4 over v3:**
- CSS-first configuration removes the JS config file
- `@theme` block generates utility classes from CSS variables, enabling a single source of truth for design tokens
- Works cleanly with Next.js 15 without additional plugins

### 2.3 Dark mode

The app is **dark by default** — not a toggle. The background is `#07071a` (very dark navy). There are no light-mode classes. This matches the operational, technical nature of the SEMSE platform.

Tailwind's `dark:` variants are not used. Instead the base HTML/body has the dark background and all design tokens are dark-first.

### 2.4 Design token layer

Two layers of tokens:

1. **Tailwind `@theme` utilities** — generate utility classes (`bg-brand`, `text-muted`, etc.) usable in Tailwind markup
2. **CSS custom properties (`:root`)** — used by legacy cortex/control-surface component CSS that predates the refactor

Both layers use the same values, ensuring visual consistency between the new Tailwind-based pages and the preserved complex dashboards.

### 2.5 Component library boundary

New components in `components/ui/` are pure presentational — no API calls, no routing, no global state. They accept only props and emit only standard DOM events.

The cortex and control-surface panels retain their bespoke CSS classes (now dark-mode-corrected) to avoid a 1,500-line rewrite risk. They will be migrated in a follow-up sprint.

---

## 3. File structure

```
apps/web/
├── app/                          # Next.js App Router pages & API routes
│   ├── layout.tsx                # Root shell — html/body/nav/main
│   ├── page.tsx                  # / — Jobs dashboard (Server Component)
│   ├── globals.css               # Tailwind v4 + dark CSS variables + legacy component CSS
│   ├── nav.tsx                   # Top navigation (Client Component — usePathname)
│   ├── sprint-1-dashboard.tsx    # Jobs list widget (Client Component)
│   ├── semse-api.ts              # API client (unchanged)
│   ├── semse-control-surface.tsx # Ops surface dashboard (preserved)
│   ├── not-found.tsx             # 404 page
│   │
│   ├── jobs/
│   │   ├── new/page.tsx          # Create job form
│   │   └── [jobId]/
│   │       ├── page.tsx          # Job detail — milestones, disputes, progress
│   │       ├── escrow/page.tsx   # Escrow funding
│   │       └── evidence/page.tsx # Evidence registration
│   │
│   ├── cortex/
│   │   ├── page.tsx              # Cortex console wrapper
│   │   └── semse-cortex-console.tsx # Real-time ops panel (preserved)
│   │
│   └── api/semse/                # API proxy routes (unchanged)
│
├── components/
│   └── ui/                       # Design system components
│       ├── button.tsx            # Button with primary/ghost/destructive variants
│       ├── badge.tsx             # Status badge + statusVariant helper
│       ├── card.tsx              # Card + MetricCard
│       ├── skeleton.tsx          # Skeleton, MetricCardSkeleton, RowSkeleton
│       ├── spinner.tsx           # Spinner, PageSpinner
│       ├── empty-state.tsx       # Empty list state
│       ├── error-state.tsx       # ErrorState + FeedbackBanner
│       ├── input.tsx             # Input, Textarea, Select
│       └── index.ts              # Barrel export
│
├── lib/
│   └── cn.ts                     # clsx + tailwind-merge utility
│
├── postcss.config.mjs            # Tailwind v4 PostCSS plugin
└── package.json                  # Added: tailwindcss, @tailwindcss/postcss, clsx, tailwind-merge, motion
```

---

## 4. Design system

### 4.1 Color tokens

| Token | Value | Usage |
|---|---|---|
| `brand` | `#14b8a6` | Primary teal — CTAs, focus rings, active nav |
| `brand-dim` | `#0d9488` | Hover state for brand elements |
| `brand-bright` | `#2dd4bf` | Accent highlights |
| `base` | `#07071a` | Page background |
| `surface` | `#0d0d20` | Card backgrounds |
| `raised` | `#131328` | Elevated cards (inputs, inner cards) |
| `overlay` | `#1a1a35` | Modals/overlays (reserved) |
| `ink` | `#f1f5f9` | Primary text |
| `muted` | `#94a3b8` | Secondary text, labels |
| `faint` | `#475569` | Placeholder text, dividers |
| `ok` | `#22c55e` | Success states |
| `warn` | `#f59e0b` | Warning states |
| `error` | `#ef4444` | Error/destructive states |
| `info` | `#60a5fa` | Informational states |

### 4.2 Border convention

All borders use `rgba(255, 255, 255, N)` opacity notation for dark mode compatibility:
- Default: `rgba(255,255,255, 0.08)` — `border-white/[0.08]`
- Hover: `rgba(255,255,255, 0.12)` — `border-white/[0.12]`
- Strong: `rgba(255,255,255, 0.14)` — `border-white/[0.14]`

### 4.3 Typography

- Base: `15px`, `line-height: 1.6`, `-webkit-font-smoothing: antialiased`
- Headings: `font-bold tracking-tight` with negative `letter-spacing`
- Labels: `text-[0.68rem] font-semibold tracking-widest uppercase` (consistent ALLCAPS pattern)
- Code/monospace: `font-mono` (ui-monospace, Consolas)

### 4.4 Border radius

- Cards, panels: `rounded-2xl` (Tailwind) / `--radius: 8px` (CSS vars)
- Inputs, buttons: `rounded-lg` / `--radius: 8px`
- Small elements (badges): `rounded` / `--radius-sm: 4px`

### 4.5 Focus management

All interactive elements use `focus-visible:ring-2 focus-visible:ring-brand`. The `:focus-visible` pseudo-class ensures keyboard users see a clear teal ring without affecting mouse users.

The layout includes a skip-link (`Saltar al contenido`) that appears on keyboard focus.

---

## 5. Component patterns

### Button

```tsx
import { Button } from "@/components/ui";

// Primary CTA
<Button>Crear job</Button>

// Ghost secondary
<Button variant="ghost">Cancelar</Button>

// Destructive
<Button variant="destructive">Abrir dispute</Button>

// With loading state
<Button loading={submitting}>Guardando...</Button>
```

### Badge (status)

```tsx
import { Badge, statusVariant } from "@/components/ui";

// Map job status automatically
<Badge variant={statusVariant(job.status)}>{job.status}</Badge>

// Explicit variant
<Badge variant="success">Aprobado</Badge>
```

### MetricCard

```tsx
import { MetricCard } from "@/components/ui";

<MetricCard
  label="Escrow"
  value="$2,500"
  sub="USD · fondeado"
  accent   // teal highlight when important
/>
```

### Loading states

```tsx
import { MetricCardSkeleton, RowSkeleton, PageSpinner } from "@/components/ui";

// While stats are loading
{loading ? <MetricCardSkeleton /> : <MetricCard ... />}

// While list is loading
{loading ? <RowSkeleton /> : <JobRow ... />}

// Full page loading
{loading ? <PageSpinner /> : <Content />}
```

### Empty states

```tsx
import { EmptyState } from "@/components/ui";

<EmptyState
  title="Sin milestones"
  description="Crea el primero para activar el flujo de pago."
  action={<Button size="sm">Crear milestone</Button>}
/>
```

### Feedback messages

```tsx
import { FeedbackBanner } from "@/components/ui";

<FeedbackBanner type="success" message="Job creado correctamente." />
<FeedbackBanner type="error"   message={error} />
<FeedbackBanner type="warn"    message="Modo simulación activo." />
<FeedbackBanner type="info"    message="Datos actualizados." />
```

---

## 6. UX improvements

### 6.1 Loading states
- Replaced all "Cargando…" text with animated `Skeleton` components
- `MetricCardSkeleton` for metric grids
- `RowSkeleton` for list items
- `PageSpinner` for full-page loads

### 6.2 Empty states
- `EmptyState` component with icon, title, description, optional CTA
- Applied to: jobs list, milestones list, disputes list, evidence list

### 6.3 Error states
- `FeedbackBanner` component with `type: "error" | "success" | "warn" | "info"`
- Role="alert" on errors for screen readers
- Role="status" on success/info messages

### 6.4 Progress visualization
- Job detail shows a linear progress bar (HTML `progressbar` role)
- Checklist items show a visual indicator (tick vs circle)

### 6.5 Navigation
- Skip-link to main content for keyboard users
- Sticky nav with backdrop blur
- Active nav link highlighted with brand color
- System status indicator (pulsing teal dot)

### 6.6 Breadcrumbs
- All sub-pages show a consistent breadcrumb trail
- Links use hover color transition

### 6.7 Accessibility
- `role="banner"` on `<header>`
- `aria-label` on nav, breadcrumbs, form sections, metric grids
- `aria-current="page"` on active nav link
- `aria-progressbar` with `aria-valuenow/min/max` on progress bar
- `role="alert"` on error banners
- `role="status"` on loading spinners
- All buttons have visible disabled state (`opacity-40`)
- Focus rings: `focus-visible:ring-2 focus-visible:ring-brand`

---

## 7. Performance

### Server vs Client boundary

| Component | Type | Reason |
|---|---|---|
| `app/page.tsx` | Server | Fetches initial jobs server-side |
| `app/layout.tsx` | Server | Static shell |
| `Nav` | Client | `usePathname()` |
| `Sprint1Dashboard` | Client | `useEffect`, `useState` |
| `JobDetailPage` | Client | Complex async state machine |
| `NewJobPage` | Client | Form state |
| `JobEscrowPage` | Client | Async form |
| `JobEvidencePage` | Client | Async form |
| UI components | Server | Pure presentational |

### Bundle size (post-refactor)

| Route | Size | First Load JS |
|---|---|---|
| `/` | 4.77 kB | 117 kB |
| `/jobs/[jobId]` | 6.36 kB | 119 kB |
| `/jobs/new` | 3.65 kB | 116 kB |
| `/jobs/[jobId]/escrow` | 3.97 kB | 116 kB |
| `/jobs/[jobId]/evidence` | 4.45 kB | 117 kB |

Tailwind v4 generates only the CSS actually used — no dead-weight stylesheet bloat.

---

## 8. Remaining work (next sprint)

1. **Migrate cortex/control-surface** from bespoke CSS to Tailwind inline classes
2. **Motion animations** — page entry fades, list item stagger, button microinteractions (package installed, not yet wired)
3. **Mobile hamburger menu** for nav on small screens
4. **Dark/light toggle** (if stakeholder feedback requires it)
5. **Type-safe API responses** — remove `Record<string, unknown>` from milestone/dispute/evidence state, replace with proper schema types from `@semse/schemas`
6. **Optimistic UI** — for milestone actions and escrow funding
7. **Error boundaries** — wrap client pages in React error boundaries
