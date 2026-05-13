import { Routes } from '@angular/router';

export const COURSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./course-list/course-list').then(c => c.CourseList),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./course-detail/course-detail').then(c => c.CourseDetail),
    children: [
      { path: '', redirectTo: 'contenido', pathMatch: 'full' },
      {
        path: 'contenido',
        loadComponent: () =>
          import('./course-detail/tabs/tab-contenido/tab-contenido')
            .then(c => c.TabContenido),
      },
      {
        path: 'actividades',
        loadComponent: () =>
          import('./course-detail/tabs/tab-tareas/tab-tareas')
            .then(c => c.TabTareas),
      },
      {
        path: 'foro',
        loadComponent: () =>
          import('./course-detail/tabs/tab-foro/tab-foro')
            .then(c => c.TabForo),
      },
      {
        path: 'materiales',
        loadComponent: () =>
          import('./course-detail/tabs/tab-materiales/tab-materiales')
            .then(c => c.TabMateriales),
      },
      {
        path: 'asistencia',
        loadComponent: () =>
          import('./course-detail/tabs/tab-asistencia/tab-asistencia')
            .then(c => c.TabAsistencia),
      },
    ],
  },
];
