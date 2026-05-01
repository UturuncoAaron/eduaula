import { Routes } from '@angular/router';

export const PSYCHOLOGY_ROUTES: Routes = [
    {
        path: 'appointments',
        loadComponent: () => import('./appointments/appointments').then(m => m.Appointments),
        title: 'Agenda y Citas | EduAula'
    },
    {
        path: 'student/:id',
        loadComponent: () => import('./student-detail/student-detail').then(m => m.StudentDetail),
        title: 'Ficha del Alumno | EduAula'
    },
    {
        path: '',
        redirectTo: 'appointments',
        pathMatch: 'full'
    }
];