import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role-guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard-redirect').then(c => c.DashboardRedirect),
  },
  {
    path: 'alumno',
    canActivate: [roleGuard(['alumno'])],
    loadComponent: () => import('./alumno/alumno-dashboard/alumno-dashboard').then(c => c.AlumnoDashboard),
  },
  {
    path: 'docente',
    canActivate: [roleGuard(['docente'])],
    loadComponent: () => import('./docente/docente-dashboard/docente-dashboard').then(c => c.DocenteDashboard),
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['admin'])],
    loadComponent: () => import('./admin/admin-dashboard/admin-dashboard').then(c => c.AdminDashboard),
  },
  {
    path: 'padre',
    canActivate: [roleGuard(['padre'])],
    loadComponent: () => import('./padre/padre-dashboard/padre-dashboard').then(c => c.PadreDashboard),
  },
];