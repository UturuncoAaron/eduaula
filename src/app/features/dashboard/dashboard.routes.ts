import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard-redirect')
        .then(c => c.DashboardRedirectComponent),
  },
  {
    path: 'alumno',
    canActivate: [roleGuard(['alumno'])],
    loadComponent: () =>
      import('./alumno/alumno-dashboard/alumno-dashboard')
        .then(c => c.AlumnoDashboardComponent),
  },
  {
    path: 'docente',
    canActivate: [roleGuard(['docente'])],
    loadComponent: () =>
      import('./docente/docente-dashboard/docente-dashboard')
        .then(c => c.DocenteDashboardComponent),
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['admin'])],
    loadComponent: () =>
      import('./admin/admin-dashboard/admin-dashboard')
        .then(c => c.AdminDashboardComponent),
  },
  {
    path: 'padre',
    canActivate: [roleGuard(['padre'])],
    loadComponent: () =>
      import('./padre/padre-dashboard/padre-dashboard')
        .then(c => c.PadreDashboardComponent),
  },
];