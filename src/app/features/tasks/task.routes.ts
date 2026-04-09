import { Routes } from '@angular/router';

export const TASKS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./task-list/task-list/task-list').then(c => c.TaskList),
  },
  {
    path: ':id/entregar',
    loadComponent: () => import('./task-submit/task-submit/task-submit').then(c => c.TaskSubmit),
  },
  {
    path: ':id/calificar',
    loadComponent: () => import('./task-grade/task-grade/task-grade').then(c => c.TaskGrade),
  },
];