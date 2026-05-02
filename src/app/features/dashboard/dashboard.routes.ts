import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard-redirect').then(c => c.DashboardRedirect),
  },
  {
    path: 'alumno',
    canActivate: [roleGuard(['alumno'])],
    loadComponent: () =>
      import('./alumno/alumno-dashboard/alumno-dashboard').then(c => c.AlumnoDashboard),
  },
  {
    path: 'docente',
    canActivate: [roleGuard(['docente'])],
    loadComponent: () =>
      import('./docente/docente-dashboard/docente-dashboard').then(c => c.DocenteDashboard),
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['admin'])],
    loadComponent: () =>
      import('./admin/admin-dashboard/admin-dashboard').then(c => c.AdminDashboard),
  },
  {
    path: 'padre',
    canActivate: [roleGuard(['padre'])],
    loadComponent: () =>
      import('./padre/padre-dashboard/padre-dashboard').then(c => c.PadreDashboard),
  },
  {
    path: 'psicologa',
    canActivate: [roleGuard(['psicologa'])],
    loadComponent: () =>
      import('./psicologa/psychology-dashboard/psychology-dashboard').then(c => c.PsychologyDashboard),
    children: [
      { path: '', redirectTo: 'alumnos', pathMatch: 'full' },
      {
        path: 'alumnos',
        loadComponent: () =>
          import('./psicologa/psychology-dashboard/tabs/tab-mis-alumnos/tab-mis-alumnos')
            .then(c => c.TabMisAlumnos),
      },
      {
        path: 'fichas',
        loadComponent: () =>
          import('./psicologa/psychology-dashboard/tabs/tab-fichas/tab-fichas')
            .then(c => c.TabFichas),
      },
      {
        path: 'citas',
        loadComponent: () =>
          import('./psicologa/psychology-dashboard/tabs/tab-citas/tab-citas')
            .then(c => c.TabCitas),
      },
      {
        path: 'disponibilidad',
        loadComponent: () =>
          import('./psicologa/psychology-dashboard/tabs/tab-disponibilidad/tab-disponibilidad')
            .then(c => c.TabDisponibilidad),
      },
    ],
  },
];