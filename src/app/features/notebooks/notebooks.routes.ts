import { Routes } from '@angular/router';
export const NOTEBOOKS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./my-tutoring/my-tutoring').then(m => m.MyTutoring),
        children: [
            { path: '', redirectTo: 'alumnos', pathMatch: 'full' },
            {
                path: 'alumnos',
                loadComponent: () =>
                    import('./tabs/tutoring-student/tutoring-student')
                        .then(m => m.TutoringStudent),
            },
            {
                path: 'padres',
                loadComponent: () =>
                    import('./tabs/tutoring-parent/tutoring-parent')
                        .then(m => m.TutoringParent),
            },
            {
                path: 'libretas',
                loadComponent: () =>
                    import('./tabs/tutoring-notebook/tutoring-notebook')
                        .then(m => m.TutoringNotebook),
            },
        ],
    },
];