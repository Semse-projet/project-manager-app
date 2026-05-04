import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';
import { pendingChangesGuard } from './core/routing/pending-changes.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Acceso',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPageComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Redireccionando',
        data: { section: 'Sesion' },
        loadComponent: () => import('./features/common/role-home.page').then((m) => m.RoleHomePageComponent),
      },
      {
        path: 'client/dashboard',
        title: 'Dashboard del cliente',
        data: {
          roles: ['CLIENT', 'OPS_ADMIN'],
          section: 'Cliente',
          assistant: {
            enabled: true,
            label: 'Prometeo Builder',
            title: 'Convierte una necesidad en un trabajo publicable.',
            subtitle: 'Desde aquí puedes arrancar un borrador conversacional y llevarlo a publicación sin salir del flujo.',
            quickPrompts: [
              'Quiero publicar un trabajo de pintura interior en Miami.',
              'Necesito un electricista para revisar panel y cableado.',
              'Tengo fotos del área y quiero recibir propuestas.',
            ],
          },
        },
        loadComponent: () => import('./features/client/client-dashboard.page').then((m) => m.ClientDashboardPageComponent),
      },
      {
        path: 'client/leads',
        title: 'CRM de leads',
        data: {
          roles: ['CLIENT', 'OPS_ADMIN'],
          section: 'Cliente',
          assistant: {
            enabled: true,
            label: 'Prometeo CRM',
            title: 'Convierte un lead calificado en proyecto estructurado.',
            subtitle: 'Usa el asistente para capturar contexto comercial y preparar el salto a job cuando el lead ya esté maduro.',
            quickPrompts: [
              'Quiero convertir esta necesidad en un trabajo de plomeria.',
              'Ayudame a estructurar un proyecto de remodelacion para publicar.',
              'Tengo contexto comercial y fotos; quiero pasar a borrador.',
            ],
          },
        },
        loadComponent: () => import('./features/client/client-leads.page').then((m) => m.ClientLeadsPageComponent),
      },
      {
        path: 'client/jobs',
        title: 'Trabajos publicados',
        data: {
          roles: ['CLIENT', 'OPS_ADMIN'],
          section: 'Cliente',
          assistant: {
            enabled: true,
            label: 'Prometeo Jobs',
            title: 'Abre un nuevo trabajo sin romper el pipeline.',
            subtitle: 'Prometeo puede arrancar un nuevo borrador mientras revisas el estado de los jobs ya publicados.',
            quickPrompts: [
              'Quiero publicar otro trabajo parecido pero en otra ciudad.',
              'Necesito un nuevo job de pisos con presupuesto abierto.',
              'Tengo un proyecto nuevo y quiero estructurarlo rapido.',
            ],
          },
        },
        loadComponent: () => import('./features/client/client-jobs.page').then((m) => m.ClientJobsPageComponent),
      },
      {
        path: 'client/jobs/new',
        canDeactivate: [pendingChangesGuard],
        title: 'Nuevo proyecto',
        data: {
          roles: ['CLIENT', 'OPS_ADMIN'],
          section: 'Cliente',
          assistant: {
            enabled: true,
            label: 'Prometeo Builder',
            title: 'Termina el expediente conversando con el sistema.',
            subtitle: 'Si el formulario todavía está verde, usa el asistente para completar categoría, alcance, ubicación y presupuesto.',
            placeholder: 'Ejemplo: es una remodelacion de bano en Coral Gables, tengo fotos y quiero un rango preliminar.',
            quickPrompts: [
              'Es un trabajo de electricidad residencial y todavía no tengo presupuesto.',
              'Necesito remodelar un bano principal con materiales incluidos.',
              'Tengo fotos y quiero que el asistente complete el borrador.',
            ],
          },
        },
        loadComponent: () => import('./features/client/client-job-builder.page').then((m) => m.ClientJobBuilderPageComponent),
      },
      {
        path: 'client/jobs/:jobId',
        title: 'Detalle del trabajo',
        data: {
          roles: ['CLIENT', 'OPS_ADMIN'],
          section: 'Cliente',
          assistant: {
            enabled: true,
            label: 'Prometeo Builder',
            title: 'Crea el siguiente trabajo desde el contexto actual.',
            subtitle: 'Mientras revisas este job, puedes abrir otro borrador conversacional con Prometeo.',
            quickPrompts: [
              'Quiero publicar un trabajo nuevo parecido a este.',
              'Necesito otro proyecto de la misma categoria en otra propiedad.',
              'Tengo una nueva necesidad y quiero empezar el borrador.',
            ],
          },
        },
        loadComponent: () => import('./features/client/client-job-detail.page').then((m) => m.ClientJobDetailPageComponent),
      },
      {
        path: 'worker/dashboard',
        title: 'Dashboard profesional',
        data: { roles: ['PRO', 'OPS_ADMIN'], section: 'Profesional' },
        loadComponent: () => import('./features/worker/worker-dashboard.page').then((m) => m.WorkerDashboardPageComponent),
      },
      {
        path: 'admin/dashboard',
        title: 'Control tower',
        data: { roles: ['OPS_ADMIN'], section: 'Operaciones' },
        loadComponent: () => import('./features/ops/admin-dashboard.page').then((m) => m.AdminDashboardPageComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
