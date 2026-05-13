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
      import('./user-management/tabs/tab-psicologos/tab-psicologos').then(c => c.TabPsicologos),
  },
  {
    path: 'usuarios/auxiliares',
    loadComponent: () =>
      import('./user-management/tabs/tab-auxiliar/tab-auxiliar').then(c => c.TabAuxiliar),
  },

  // ─── Matrículas ───────────────────────────────────────────────────────────
  {
    path: 'matriculas',
    loadComponent: () =>
      import('./matriculas/matriculas').then(c => c.Matriculas),
  },

  // ─── Histórico de Alumnos ─────────────────────────────────────────────────
  {
    path: 'historico',
    loadComponent: () =>
      import('./historico-alumnos/historico-alumnos').then(c => c.HistoricoAlumnos),
  },
  {
    path: 'historico/reporte/:id',
    loadComponent: () =>
      import('./reporte-alumno/reporte-alumno').then(c => c.ReporteAlumno),
  },

  // ─── Permisos extra ───────────────────────────────────────────────────────
  {
    path: 'permisos',
    loadComponent: () =>
      import('./permisos-management/permisos-management').then(c => c.PermisosManagement),
  },

  // ─── Editor de horario por sección ────────────────────────────────────────
  {
    path: 'secciones/:seccionId/periodo/:periodoId/horario',
    loadComponent: () =>
      import('./schedule-editor/schedule-editor').then(c => c.ScheduleEditor),
    title: 'Editor de horario | EduAula',
  },

  // ─── Vínculo Padre-Hijo ───────────────────────────────────────────────────
  {
    path: 'padre-hijo',
    loadComponent: () =>
      import('./parent-child-link/parent-child-link').then(c => c.ParentChildLink),
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
      import('./reports/reports').then(c => c.Reports),
  },

];