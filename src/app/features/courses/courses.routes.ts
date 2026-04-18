import { Routes } from '@angular/router';

export const COURSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./course-list/course-list/course-list')
        .then(c => c.CourseListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./course-detail/course-detail/course-detail')
        .then(c => c.CourseDetailComponent),
  },
  {
    path: ':id/subir-material',
    loadComponent: () =>
      import('./material-upload/material-upload/material-upload')
        .then(c => c.MaterialUpload),
  },
];