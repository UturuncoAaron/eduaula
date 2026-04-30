import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [

  { path: '', redirectTo: 'academico', pathMatch: 'full' },

  // ─── Académico ────────────────────────────────────────────────────────────
  {
    path: 'academico',
    loadComponent: () =>
      import('./academic-setup/grados-tab/grados-tab').then(c => c.GradosTab),
  },
  {
    path: 'periodos',
    loadComponent: () =>
      import('./academic-setup/periodos-tab/periodos-tab').then(c => c.PeriodosTab),
  },

  // ─── Usuarios ─────────────────────────────────────────────────────────────
  {
    path: 'usuarios/:tipo',
    loadComponent: () =>
      import('./user-management/user-management/user-management').then(c => c.UserManagement),
  },
  {
    path: 'usuarios/:tipo/:id',
    loadComponent: () =>
      import('./user-detail/user-detail').then(c => c.UserDetail),
  },

  // ─── Matrículas ───────────────────────────────────────────────────────────
  {
    path: 'matriculas',
    loadComponent: () =>
      import('./matriculas/matriculas/matriculas').then(c => c.Matriculas),
  },

  // ─── Vínculo Padre-Hijo ───────────────────────────────────────────────────
  {
    path: 'padre-hijo',
    loadComponent: () =>
      import('./parent-child-link/parent-child-link/parent-child-link').then(c => c.ParentChildLink),
  },

  // ─── Comunicados ──────────────────────────────────────────────────────────
  {
    path: 'comunicados',
    loadComponent: () =>
      import('./announcements-admin/announcements-admin').then(c => c.AnnouncementsAdmin),
  },

  // ─── Reportes ─────────────────────────────────────────────────────────────
  {
    path: 'reportes',
    loadComponent: () =>
      import('./reports/reports/reports').then(c => c.Reports),
  },

  // ─── Configuración ────────────────────────────────────────────────────────
  {
    path: 'importar',
    loadComponent: () =>
      import('./import-students/import-students-dialog').then(c => c.ImportStudentsDialog),
  },

];