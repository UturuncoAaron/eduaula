import { Routes } from '@angular/router';

export const LIVE_CLASSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./live-class-list/live-class-list').then(c => c.LiveClassList),
  },
  {
    path: 'crear',
    loadComponent: () => import('./live-class-create/live-class-create').then(c => c.LiveClassCreate),
  },
  {
    path: ':id/asistencia',
    loadComponent: () => import('./attendance-register/attendance-register').then(c => c.AttendanceRegister),
  },
];