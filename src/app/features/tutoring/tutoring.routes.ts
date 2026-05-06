import { Routes } from '@angular/router';

export const TUTORING_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./pages/my-tutoring/my-tutoring').then(m => m.MyTutoring),
        children: [
            { path: '', redirectTo: 'alumnos', pathMatch: 'full' },
            {
                path: 'alumnos',
                loadComponent: () =>
                    import('./pages/tutoring-student/tutoring-student').then(m => m.TutoringStudent),
            },
            {
                path: 'padres',
                loadComponent: () =>
                    import('./pages/tutoring-parent/tutoring-parent').then(m => m.TutoringParent),
            },
            {
                path: 'libretas',
                loadComponent: () =>
                    import('./pages/tutoring-notebook/tutoring-notebook').then(m => m.TutoringNotebook),
            },
        ],
    },
];