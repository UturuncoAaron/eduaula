import { Routes } from '@angular/router';

export const NOTEBOOKS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./student-notebooks/student-notebooks').then(m => m.StudentNotebooks),
    },
];