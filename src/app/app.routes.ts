import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';

export const routes: Routes = [
    {
        path: 'auth',
        loadComponent: () =>
            import('./layouts/auth-layout/auth-layout').then(c => c.AuthLayoutComponent),
        children: [
            {
                path: 'login',
                loadComponent: () =>
                    import('./features/auth/login/login').then(c => c.Login),
            },
            { path: '', redirectTo: 'login', pathMatch: 'full' },
        ],
    },
    {
        path: '',
        loadComponent: () =>
            import('./layouts/main-layout/main-layout').then(c => c.MainLayout),
        children: [
            {
                path: 'dashboard',
                loadChildren: () =>
                    import('./features/dashboard/dashboard.routes').then(r => r.DASHBOARD_ROUTES),
            },
            {
                path: 'cursos',
                loadChildren: () =>
                    import('./features/courses/courses.routes').then(r => r.COURSES_ROUTES),
            },
            {
                path: 'examenes',
                loadChildren: () =>
                    import('./features/exams/exams.routes').then(r => r.EXAMS_ROUTES),
            },
            {
                path: 'tareas',
                loadChildren: () =>
                    import('./features/tasks/task.routes').then(r => r.TASKS_ROUTES),
            },
            {
                path: 'notas',
                loadChildren: () =>
                    import('./features/grades/grades.routes').then(r => r.GRADES_ROUTES),
            },
            {
                path: 'foro',
                loadChildren: () =>
                    import('./features/forum/forum.routes').then(r => r.FORUM_ROUTES),
            },
            {
                path: 'clases-vivo',
                loadChildren: () =>
                    import('./features/live-classes/live-classes.routes').then(r => r.LIVE_CLASSES_ROUTES),
            },
            {
                path: 'portal-padres',
                canActivate: [roleGuard(['padre'])],
                loadChildren: () =>
                    import('./features/parent-portal/parent.routes').then(r => r.PARENT_ROUTES),
            },
            {
                path: 'admin',
                canActivate: [roleGuard(['admin'])],
                loadChildren: () =>
                    import('./features/admin/admin.routes').then(r => r.ADMIN_ROUTES),
            },
            {
                path: 'mi-tutoria',
                canActivate: [roleGuard(['docente', 'admin'])],
                loadChildren: () =>
                    import('./features/notebooks/notebooks.routes').then(r => r.NOTEBOOKS_ROUTES),
            },

            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
        ],
    },
    { path: '**', redirectTo: 'auth/login' },
];