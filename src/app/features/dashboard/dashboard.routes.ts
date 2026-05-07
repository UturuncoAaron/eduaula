import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { roleGuard } from '../../core/guards/role-guard';
import { AuthService } from '../../core/auth/auth';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      const rol = inject(AuthService).currentUser()?.rol ?? '';
      const map: Record<string, string> = {
        alumno:    '/dashboard/alumno',
        docente:   '/dashboard/docente',
        admin:     '/dashboard/admin',
        padre:     '/dashboard/padre',
        auxiliar:  '/dashboard/auxiliar',
        psicologa: '/dashboard/psicologa',
      };
      return map[rol] ?? '/auth/login';
    },
  },
  {
    path: 'alumno',
    canActivate: [roleGuard(['alumno'])],
    loadComponent: () =>
      import('./alumno-dashboard/alumno-dashboard')
        .then(c => c.AlumnoDashboard),
    title: 'Mi dashboard | EduAula',
  },
  {
    path: 'docente',
    canActivate: [roleGuard(['docente'])],
    loadComponent: () =>
      import('./docente-dashboard/docente-dashboard')
        .then(c => c.DocenteDashboard),
    title: 'Mi dashboard | EduAula',
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['admin'])],
    loadComponent: () =>
      import('./admin-dashboard/admin-dashboard')
        .then(c => c.AdminDashboard),
    title: 'Panel de administración | EduAula',
  },
  {
    path: 'padre',
    canActivate: [roleGuard(['padre'])],
    loadComponent: () =>
      import('./padre-dashboard/padre-dashboard')
        .then(c => c.PadreDashboard),
    title: 'Mi dashboard | EduAula',
  },
  {
    path: 'auxiliar',
    canActivate: [roleGuard(['auxiliar'])],
    loadComponent: () =>
      import('./auxiliar-dashboard/auxiliar-dashboard')
        .then(c => c.AuxiliarDashboard),
    title: 'Mi dashboard | EduAula',
  },
  {
    path: 'psicologa',
    canActivate: [roleGuard(['psicologa'])],
    loadComponent: () =>
      import('./psychology-dashboard/psychology-dashboard')
        .then(c => c.PsychologyDashboard),
    title: 'Panel de psicología | EduAula',
  },
];