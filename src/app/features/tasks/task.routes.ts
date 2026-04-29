import { Routes } from '@angular/router';

export const TASKS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./task-list/task-list/task-list').then(c => c.TaskList),
  },
  {
    path: 'crear',
    loadComponent: () => import('./task-create/task-create').then(c => c.TaskCreate),
  },
  {
    path: ':id/entregar',
    loadComponent: () => import('./task-submit/task-submit/task-submit').then(c => c.TaskSubmit),
  },
  {
    path: ':id/tomar',
    loadComponent: () => import('./task-take/task-take').then(c => c.TaskTake),
  },
  {
    path: ':id/resultados',
    loadComponent: () => import('./task-results/task-results').then(c => c.TaskResults),
  },
  {
    path: ':id/calificar',
    loadComponent: () => import('./task-grade/task-grade/task-grade').then(c => c.TaskGrade),
  },
];