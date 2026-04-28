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
  {
    path: 'comunicados',
    loadComponent: () => import('./announcements-admin/announcements-admin').then(c => c.AnnouncementsAdmin),
  },
  {
    path: 'importar',
    loadComponent: () => import('./import-students/import-students').then(c => c.ImportStudents),
  },
  {
    path: 'usuarios/:tipo/:id',
    loadComponent: () => import('./user-detail/user-detail').then(c => c.UserDetail),
  },
];