import { Routes } from '@angular/router';

export const GRADES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./my-grades/my-grades/my-grades').then(c => c.MyGrades),
  },
  {
    path: 'registrar',
    loadComponent: () =>
      import('./register-grades/register-grades/register-grades').then(c => c.RegisterGrades),
  },
];