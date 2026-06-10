import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'academico', pathMatch: 'full' },

  // ─── Académico ────────────────────────────────────────────────────────────
  {
    path: 'academico',
    loadComponent: () =>
      import('./academic-setup/grados-tab/grados-tab').then(c => c.GradosTab),
    title: 'Grados y Secciones | EduAula',
  },
  {
    path: 'academico/cursos',
    loadComponent: () =>
      import('./academic-setup/course-catalog/course-catalog').then(c => c.CourseCatalog),
    title: 'Catálogo de Cursos | EduAula',
  },
  {
    path: 'secciones/:seccionId',
    loadComponent: () =>
      import('./academic-setup/seccion-page/seccion-page').then(c => c.SeccionPage),
    title: 'Sección | EduAula',
  },
  {
    path: 'periodos',
    loadComponent: () =>
      import('./academic-setup/periodos-tab/periodos-tab').then(c => c.PeriodosTab),
  },
  {
    path: 'anios-lectivos',
    loadComponent: () =>
      import('./anios-lectivos/anios-lectivos-tab').then(c => c.AniosLectivosTab),
    title: 'Año Lectivo | EduAula',
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
    path: 'usuarios/staff',
    loadComponent: () =>
      import('./user-management/tabs/tab-staff/tab-staff').then(c => c.TabStaff),
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

  // ─── Editor de horario ────────────────────────────────────────────────────
  {
    path: 'secciones/:seccionId/horario',
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
      import('../../shared/components/announcements-page/announcements-page')
        .then(c => c.AnnouncementsPage),
  },

  // ─── Reportes ─────────────────────────────────────────────────────────────
  {
    path: 'reportes',
    loadComponent: () =>
      import('./reports/reports').then(c => c.Reports),
  },

  // ─── Asistencia Personal ─────────────────────────────────────────────────
  {
    path: 'asistencia-personal',
    loadComponent: () =>
      import('./asistencia-personal/asistencia-personal').then(c => c.AsistenciaPersonal),
    title: 'Asistencia Personal | EduAula',
  },
  {
    path: 'academico/horario-entrada',
    loadComponent: () =>
      import('./academic-setup/horario-entrada/horario-entrada').then(c => c.HorarioEntrada),
    title: 'Horario de Entrada | EduAula',
  },
];