import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { permissionGuard } from './core/guards/permission-guard';
import { MODULO } from './core/auth/modulos';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login-split/login-split').then(c => c.LoginSplit),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/main-layout/main-layout').then(c => c.MainLayout),
    children: [

      // ═══ DASHBOARD (todos los roles) ══════════════════════════════════
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes')
            .then(r => r.DASHBOARD_ROUTES),
      },

      // ═══ PSICOLOGÍA ═══════════════════════════════════════════════════
      {
        path: 'psicologa',
        canActivate: [roleGuard(['psicologa'])],
        loadChildren: () =>
          import('./features/psychology/psychology.routes')
            .then(r => r.PSYCHOLOGY_ROUTES),
      },

      // ═══ COMUNES ══════════════════════════════════════════════════════
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/perfil/perfil').then(c => c.Perfil),
      },
      {
        path: 'comunicados',
        loadComponent: () =>
          import('./features/comunicados/comunicados').then(c => c.Comunicados),
      },
      {
        path: 'notificaciones',
        loadComponent: () =>
          import('./features/notificaciones/notificaciones').then(c => c.Notificaciones),
      },

      // ═══ ACADÉMICO ════════════════════════════════════════════════════
      {
        path: 'cursos',
        canActivate: [permissionGuard([MODULO.MIS_CURSOS, MODULO.CURSOS_DOCENTE])],
        loadChildren: () =>
          import('./features/courses/courses.routes').then(r => r.COURSES_ROUTES),
      },
      {
        path: 'tareas',
        canActivate: [permissionGuard([MODULO.MIS_TAREAS, MODULO.TAREAS_GESTIONAR])],
        loadChildren: () =>
          import('./features/tasks/task.routes').then(r => r.TASKS_ROUTES),
      },
      {
        path: 'notas',
        canActivate: [permissionGuard([MODULO.MIS_NOTAS, MODULO.NOTAS_CURSO])],
        loadChildren: () =>
          import('./features/grades/grades.routes').then(r => r.GRADES_ROUTES),
      },
      {
        path: 'foro',
        canActivate: [permissionGuard([MODULO.FORO])],
        loadChildren: () =>
          import('./features/forum/forum.routes').then(r => r.FORUM_ROUTES),
      },
      {
        path: 'clases-vivo',
        canActivate: [permissionGuard([MODULO.CLASES_VIVO])],
        loadChildren: () =>
          import('./features/live-classes/live-classes.routes')
            .then(r => r.LIVE_CLASSES_ROUTES),
      },
      {
        path: 'asistencia',
        canActivate: [permissionGuard([
          MODULO.ASIST_CURSO, MODULO.ASIST_GENERAL, MODULO.MI_ASISTENCIA,
        ])],
        loadChildren: () =>
          import('./features/assists/assists.routes').then(r => r.ASSISTS_ROUTES),
      },
      {
        path: 'mis-libretas',
        canActivate: [permissionGuard([MODULO.MIS_LIBRETAS])],
        loadChildren: () =>
          import('./features/notebooks/notebooks.routes').then(r => r.NOTEBOOKS_ROUTES),
      },
      {
        path: 'mis-citas',
        canActivate: [permissionGuard([MODULO.MIS_CITAS, MODULO.CITAS_AGENDADAS])],
        loadChildren: () =>
          import('./features/appointments/appointments.routes')
            .then(r => r.APPOINTMENTS_ROUTES),
      },
      {
        path: 'mi-tutoria',
        canActivate: [permissionGuard([MODULO.TUTORIA])],
        loadChildren: () =>
          import('./features/tutoring/tutoring.routes').then(r => r.TUTORING_ROUTES),
      },
      {
        path: 'portal-padres',
        canActivate: [permissionGuard([MODULO.HIJOS])],
        loadChildren: () =>
          import('./features/parent-portal/parent.routes').then(r => r.PARENT_ROUTES),
      },
      {
        path: 'admin',
        canActivate: [roleGuard(['admin'])],
        loadChildren: () =>
          import('./features/admin/admin.routes').then(r => r.ADMIN_ROUTES),
      },

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: 'auth/login' },
];
