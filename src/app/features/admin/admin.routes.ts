import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'usuarios',
    pathMatch: 'full',
  },
  {
    path: 'usuarios',
    loadComponent: () => import('./user-management/user-management/user-management').then(c => c.UserManagement),
  },
  {
    path: 'academico',
    loadComponent: () => import('./academic-setup/academic-setup/academic-setup').then(c => c.AcademicSetup),
  },
  {
    path: 'padre-hijo',
    loadComponent: () => import('./parent-child-link/parent-child-link/parent-child-link').then(c => c.ParentChildLink),
  },
  {
    path: 'reportes',
    loadComponent: () => import('./reports/reports/reports').then(c => c.Reports),
  },
];