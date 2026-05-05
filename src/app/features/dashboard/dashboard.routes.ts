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
    path: 'auxiliar',
    canActivate: [roleGuard(['auxiliar'])],
    loadComponent: () =>
      import('./auxiliar/auxiliar-dashboard/auxiliar-dashboard').then(c => c.AuxiliarDashboard),
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
          import('../psychology/tabs/tab-mis-alumnos/tab-mis-alumnos').then(c => c.TabMisAlumnos),
        title: 'Mis Alumnos | EduAula',
      },
      {
        path: 'fichas',
        loadComponent: () =>
          import('../psychology/tabs/tab-fichas/tab-fichas').then(c => c.TabFichas),
        title: 'Fichas | EduAula',
      },
      {
        path: 'fichas/:id',
        loadComponent: () =>
          import('../psychology/student-detail/student-detail').then(c => c.StudentDetail),
        title: 'Ficha del alumno | EduAula',
      },
      {
        path: 'citas',
        loadComponent: () =>
          import('../psychology/tabs/tab-citas/tab-citas').then(c => c.TabCitas),
        title: 'Agenda y Citas | EduAula',
      },
      {
        path: 'disponibilidad',
        loadComponent: () =>
          import('../psychology/tabs/tab-disponibilidad/tab-disponibilidad').then(c => c.TabDisponibilidad),
        title: 'Disponibilidad | EduAula',
      },
    ],
  },
];