import { Routes } from '@angular/router';

export const EXAMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./exam-list/exam-list/exam-list').then(c => c.ExamList),
  },
  {
    path: 'crear',
    loadComponent: () => import('./exam-create/exam-create/exam-create').then(c => c.ExamCreate),
  },
  {
    path: ':id/tomar',
    loadComponent: () => import('./exam-take/exam-take/exam-take').then(c => c.ExamTake),
  },
  {
    path: ':id/resultados',
    loadComponent: () => import('./exam-results/exam-results/exam-results').then(c => c.ExamResults),
  },
];