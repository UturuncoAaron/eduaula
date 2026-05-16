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

      // ═══ DASHBOARD ════════════════════════════════════════════════════════
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes')
            .then(r => r.DASHBOARD_ROUTES),
      },

      // ═══ PSICOLOGÍA ═══════════════════════════════════════════════════════
      {
        path: 'psicologa',
        canActivate: [roleGuard(['psicologa'])],
        loadChildren: () =>
          import('./features/psychology/psychology.routes')
            .then(r => r.PSYCHOLOGY_ROUTES),
      },

      // ═══ DOCENTE ══════════════════════════════════════════════════════════
      {
        path: 'docente',
        canActivate: [roleGuard(['docente'])],
        children: [
          {
            path: 'citas',
            canActivate: [permissionGuard([MODULO.CITAS_DOCENTE])],
            loadComponent: () =>
              import('./shared/components/tab-citas/tab-citas')
                .then(m => m.TabCitas),
            title: 'Mis citas | EduAula',
          },
          {
            path: 'disponibilidad',
            canActivate: [permissionGuard([MODULO.DISPONIBILIDAD_DOCENTE])],
            loadComponent: () =>
              import('./shared/components/tab-disponibilidad/tab-disponibilidad')
                .then(m => m.TabDisponibilidad),
            title: 'Disponibilidad | EduAula',
          },
          { path: '', redirectTo: 'citas', pathMatch: 'full' },
        ],
      },

      // ═══ PADRE ════════════════════════════════════════════════════════════
      {
        path: 'padre',
        canActivate: [roleGuard(['padre'])],
        children: [
          {
            path: 'citas',
            canActivate: [permissionGuard([MODULO.CITAS_PADRE, MODULO.CITAS_AGENDADAS])],
            loadComponent: () =>
              import('./shared/components/tab-citas/tab-citas')
                .then(m => m.TabCitas),
            title: 'Mis citas | EduAula',
          },
          { path: '', redirectTo: 'citas', pathMatch: 'full' },
        ],
      },

      // ═══ ALUMNO — Mis citas ═══════════════════════════════════════════════
      {
        path: 'mis-citas',
        canActivate: [permissionGuard([MODULO.MIS_CITAS])],
        loadComponent: () =>
          import('./shared/components/tab-citas/tab-citas')
            .then(m => m.TabCitas),
        title: 'Mis citas | EduAula',
      },

      // ═══ ADMIN / AUXILIAR — Agenda propia ════════════════════════════════
      // ═══ ADMIN / AUXILIAR — Agenda propia ═════════════════════════
      {
        path: 'agenda',
        canActivate: [permissionGuard([MODULO.AGENDA_PROPIA])],
        children: [
          {
            path: 'citas',
            loadComponent: () =>
              import('./shared/components/tab-citas/tab-citas')
                .then(m => m.TabCitas),
            title: 'Mis citas | EduAula',
          },
          {
            path: 'disponibilidad',
            loadComponent: () =>
              import('./shared/components/tab-disponibilidad/tab-disponibilidad')
                .then(m => m.TabDisponibilidad),
            title: 'Disponibilidad | EduAula',
          },
          { path: '', redirectTo: 'citas', pathMatch: 'full' },
        ],
      },

      // ═══ COMUNES ══════════════════════════════════════════════════════════
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

      // ═══ ACADÉMICO ════════════════════════════════════════════════════════
      {
        path: 'cursos',
        canActivate: [permissionGuard([MODULO.MIS_CURSOS, MODULO.CURSOS_DOCENTE])],
        loadChildren: () =>
          import('./features/courses/courses.routes').then(r => r.COURSES_ROUTES),
      },
      {
        path: 'foro',
        loadChildren: () =>
          import('./features/forum/forum.routes').then(r => r.FORUM_ROUTES),
      },
      {
        path: 'notas',
        loadChildren: () =>
          import('./features/grades/grades.routes').then(r => r.GRADES_ROUTES),
      },
      {
        path: 'asistencia',
        loadChildren: () =>
          import('./features/assists/assists.routes').then(r => r.ASSISTS_ROUTES),
      },
      {
        path: 'tareas',
        loadChildren: () =>
          import('./features/tasks/task.routes').then(r => r.TASKS_ROUTES),
      },
      {
        path: 'clases-vivo',
        loadChildren: () =>
          import('./features/live-classes/live-classes.routes').then(r => r.LIVE_CLASSES_ROUTES),
      },
      {
        path: 'mis-libretas',
        canActivate: [permissionGuard([MODULO.MIS_LIBRETAS])],
        loadChildren: () =>
          import('./features/notebooks/notebooks.routes').then(r => r.NOTEBOOKS_ROUTES),
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

  // ══ 404 — FUERA del layout, pantalla completa ══════════════════════
  {
    path: '404',
    loadComponent: () =>
      import('./features/not-found/not-found').then(c => c.NotFound),
    title: 'Página no encontrada | EduAula',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found').then(c => c.NotFound),
    title: 'Página no encontrada | EduAula',
  },
];