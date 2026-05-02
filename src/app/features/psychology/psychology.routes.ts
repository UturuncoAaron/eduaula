import { Routes } from '@angular/router';

export const PSYCHOLOGY_ROUTES: Routes = [
    {
        path: 'student/:id',
        loadComponent: () =>
            import('./student-detail/student-detail').then(m => m.StudentDetail),
        title: 'Ficha del alumno | EduAula',
    },
    { path: '', redirectTo: 'student', pathMatch: 'full' },
];
