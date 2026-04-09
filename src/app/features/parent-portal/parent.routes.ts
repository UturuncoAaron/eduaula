import { Routes } from '@angular/router';

export const PARENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./child-selector/child-selector/child-selector').then(c => c.ChildSelector),
  },
  {
    path: ':childId/notas',
    loadComponent: () => import('./child-grades/child-grades/child-grades').then(c => c.ChildGrades),
  },
  {
    path: ':childId/asistencia',
    loadComponent: () => import('./child-attendance/child-attendance/child-attendance').then(c => c.ChildAttendance),
  },
  {
    path: 'comunicados',
    loadComponent: () => import('./announcements/announcements/announcements').then(c => c.Announcements),
  },
];