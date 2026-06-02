import { Routes } from '@angular/router';

export const STUDENT_PORTAL_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./mi-psicologia/mi-psicologia').then(c => c.MiPsicologia),
        title: 'Mi Psicología | EduAula',
    },
];