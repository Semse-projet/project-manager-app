export type AdminModule = {
  id: string
  label: string
  href: string
  description: string
  status: 'active' | 'partial' | 'planned' | 'attention'
  metricLabel: string
  metricValue: string
  children: Array<{
    label: string
    href: string
    description?: string
  }>
}

export const ADMIN_MODULES: AdminModule[] = [
  {
    id: 'mission-control',
    label: 'Mission Control',
    href: '/admin/mission-control',
    description: 'Plan, coordinate, and execute operations in real time.',
    status: 'active',
    metricLabel: 'System health',
    metricValue: 'Operational',
    children: [
      { label: 'Dashboard', href: '/admin/dashboard' },
      { label: 'Ecosystem', href: '/admin/ecosystem' },
      { label: 'Operations', href: '/admin/ops' },
      { label: 'Reports', href: '/admin/reports' },
    ],
  },
  {
    id: 'workops',
    label: 'WorkOps',
    href: '/admin/workops',
    description: 'Manage jobs, crews, milestones, evidence, and field execution.',
    status: 'active',
    metricLabel: 'Active jobs',
    metricValue: '128',
    children: [
      { label: 'Field Ops', href: '/admin/field-ops' },
      { label: 'Workers', href: '/admin/worker' },
      { label: 'Contractors', href: '/admin/contractors' },
      { label: 'Change Orders', href: '/admin/change-orders' },
      { label: 'PMO', href: '/admin/pmo' },
      { label: 'QA', href: '/admin/qa' },
    ],
  },
]
