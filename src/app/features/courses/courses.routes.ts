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
  },
];