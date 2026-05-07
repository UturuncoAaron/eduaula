import { Routes } from '@angular/router';

export const PSYCHOLOGY_ROUTES: Routes = [
  // Ruta raíz — solo el dashboard de resumen, sin children ni router-outlet
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('../dashboard/psychology-dashboard/psychology-dashboard')
        .then(m => m.PsychologyDashboard),
    title: 'Psicología | EduAula',
  },
  // Tabs como rutas hermanas, no hijas
  {
    path: 'alumnos',
    loadComponent: () =>
      import('./tabs/tab-mis-alumnos/tab-mis-alumnos')
        .then(m => m.TabMisAlumnos),
    title: 'Mis alumnos | EduAula',
  },
  {
    path: 'fichas',
    loadComponent: () =>
      import('./tabs/tab-fichas/tab-fichas')
        .then(m => m.TabFichas),
    title: 'Fichas | EduAula',
  },
  {
    path: 'citas',
    loadComponent: () =>
      import('./tabs/tab-citas/tab-citas')
        .then(m => m.TabCitas),
    title: 'Citas | EduAula',
  },
  {
    path: 'disponibilidad',
    loadComponent: () =>
      import('./tabs/tab-disponibilidad/tab-disponibilidad')
        .then(m => m.TabDisponibilidad),
    title: 'Disponibilidad | EduAula',
  },
  {
    path: 'student/:id',
    loadComponent: () =>
      import('./student-detail/student-detail')
        .then(m => m.StudentDetail),
    title: 'Ficha del alumno | EduAula',
  },
];