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

  // ─── Gestión de Usuarios (Vistas Separadas) ───────────────────────────────

  // 1. Rutas específicas para cada lista (Apuntan directo a tus componentes Tab)
  {
    path: 'usuarios/alumnos',
    loadComponent: () =>
      import('./user-management/tabs/tab-alumnos/tab-alumnos').then(c => c.TabAlumnos),
  },
  {
    path: 'usuarios/padres',
    loadComponent: () =>
      import('./user-management/tabs/tab-padres/tab-padres').then(c => c.TabPadres),
  },
  {
    path: 'usuarios/docentes',
    loadComponent: () =>
      import('./user-management/tabs/tab-docentes/tab-docentes').then(c => c.TabDocentes),
  },
  {
    path: 'usuarios/admins',
    loadComponent: () =>
      import('./user-management/tabs/tab-admins/tab-admins').then(c => c.TabAdmins),
  },
  {
    path: 'usuarios/psicologos',
    loadComponent: () =>
      // Nota: Deberás crear este componente 'tab-psicologos' en tu carpeta tabs 
      // copiando la estructura de los otros para listar a los psicólogos
      import('./user-management/tabs/tab-psicologos/tab-psicologos').then(c => c.TabPsicologos),
  },

  // 2. Ruta dinámica para el perfil individual (SIEMPRE AL FINAL DEL BLOQUE USUARIOS)


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
      import('../../shared/components/import-students/import-students-dialog').then(c => c.ImportStudentsDialog),
  },
];