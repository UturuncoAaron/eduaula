import { MODULO, Modulo } from '../../../core/auth/modulos';

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  modulos: Modulo[];
  children?: NavItem[];
  exactMatch?: boolean;
  dividerBefore?: boolean;
}

export const NAV_ITEMS: NavItem[] = [

  // ─── Dashboard (todos los roles) ──────────────────────────────────────────
  {
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard',
    modulos: [MODULO.DASHBOARD],
    exactMatch: true,
  },

  // ─── Alumno + Docente ──────────────────────────────────────────────────────
  { label: 'Mis cursos', icon: 'menu_book', route: '/cursos', modulos: [MODULO.MIS_CURSOS, MODULO.CURSOS_DOCENTE] },
  { label: 'Tareas', icon: 'task_alt', route: '/tareas', modulos: [MODULO.MIS_TAREAS, MODULO.TAREAS_GESTIONAR] },
  { label: 'Notas', icon: 'grade', route: '/notas', modulos: [MODULO.MIS_NOTAS, MODULO.NOTAS_CURSO] },
  { label: 'Foro', icon: 'forum', route: '/foro', modulos: [MODULO.FORO] },
  { label: 'Clases en vivo', icon: 'videocam', route: '/clases-vivo', modulos: [MODULO.CLASES_VIVO] },

  // ─── Tutor (docente con secciones.tutor_id) ────────────────────────────────
  {
    label: 'Mi Tutoría',
    icon: 'school',
    route: '/mi-tutoria',
    modulos: [MODULO.TUTORIA],
    exactMatch: true,
    dividerBefore: true,
  },

  // ─── ASISTENCIAS ────────────────────────────────────────────────────────────
  { label: 'Asistencia entrada', icon: 'how_to_reg', route: '/asistencia/general', modulos: [MODULO.ASIST_GENERAL] },
  { label: 'Asistencia curso', icon: 'fact_check', route: '/asistencia/curso', modulos: [MODULO.ASIST_CURSO] },

  // ─── Solo Alumno ───────────────────────────────────────────────────────────
  {
    label: 'Mis libretas',
    icon: 'auto_stories',
    route: '/mis-libretas',
    modulos: [MODULO.MIS_LIBRETAS],
    dividerBefore: true,
  },

  // ─── Solo Padre ────────────────────────────────────────────────────────────
  { label: 'Portal Padres', icon: 'family_restroom', route: '/portal-padres', modulos: [MODULO.HIJOS] },

  // ─── Citas (alumno + padre) ────────────────────────────────────────────────
  {
    label: 'Mis citas',
    icon: 'event_available',
    route: '/mis-citas',
    modulos: [MODULO.MIS_CITAS, MODULO.CITAS_AGENDADAS],
  },

  // ─── Comunicados (alumno, docente, padre, psicologa, auxiliar) ─────────────
  {
    label: 'Comunicados',
    icon: 'campaign',
    route: '/comunicados',
    modulos: [MODULO.COMUNICADOS],
    dividerBefore: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PSICOLOGÍA
  // ═══════════════════════════════════════════════════════════════════════════
// ═══ PSICOLOGÍA ═══════════════════════════════════════════════════════════
{
  label: 'Mis Alumnos',
  icon: 'groups',
  route: '/psicologa/alumnos',
  modulos: [MODULO.CASOS],
  dividerBefore: true,
},
{ label: 'Fichas',        icon: 'folder_open', route: '/psicologa/fichas',         modulos: [MODULO.FICHAS] },
{ label: 'Agenda y Citas', icon: 'event',      route: '/psicologa/citas',          modulos: [MODULO.CITAS] },
{ label: 'Disponibilidad', icon: 'schedule',   route: '/psicologa/disponibilidad', modulos: [MODULO.DISPONIBILIDAD] },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    label: 'Académico',
    icon: 'school',
    modulos: [MODULO.GRADOS_SECCIONES, MODULO.PERIODOS, MODULO.MATRICULAS, MODULO.PADRE_HIJO_ADMIN],
    dividerBefore: true,
    children: [
      { label: 'Grados y Cursos', icon: 'class', route: '/admin/academico', modulos: [MODULO.GRADOS_SECCIONES], exactMatch: true },
      { label: 'Periodos', icon: 'calendar_month', route: '/admin/periodos', modulos: [MODULO.PERIODOS], exactMatch: true },
      { label: 'Matrículas', icon: 'how_to_reg', route: '/admin/matriculas', modulos: [MODULO.MATRICULAS], exactMatch: true },
      { label: 'Vínculo Padre-Hijo', icon: 'family_restroom', route: '/admin/padre-hijo', modulos: [MODULO.PADRE_HIJO_ADMIN], exactMatch: true },
    ],
  },
  {
    label: 'Usuarios',
    icon: 'manage_accounts',
    modulos: [MODULO.USUARIOS],
    children: [
      { label: 'Alumnos', icon: 'person', route: '/admin/usuarios/alumnos', modulos: [MODULO.USUARIOS], exactMatch: true },
      { label: 'Padres', icon: 'family_restroom', route: '/admin/usuarios/padres', modulos: [MODULO.USUARIOS], exactMatch: true },
      { label: 'Docentes', icon: 'badge', route: '/admin/usuarios/docentes', modulos: [MODULO.USUARIOS], exactMatch: true },
      { label: 'Auxiliares', icon: 'support_agent', route: '/admin/usuarios/auxiliares', modulos: [MODULO.USUARIOS], exactMatch: true },
      { label: 'Psicología', icon: 'psychology', route: '/admin/usuarios/psicologos', modulos: [MODULO.USUARIOS], exactMatch: true },
      { label: 'Administración', icon: 'admin_panel_settings', route: '/admin/usuarios/admins', modulos: [MODULO.USUARIOS], exactMatch: true },
    ],
  },
  {
    label: 'Comunicados',
    icon: 'campaign',
    route: '/admin/comunicados',
    modulos: [MODULO.COMUNICADOS_ADMIN],
    exactMatch: true,
    dividerBefore: true,
  },
  {
    label: 'Reportes',
    icon: 'bar_chart',
    route: '/admin/reportes',
    modulos: [MODULO.REPORTES_GLOBALES],
    exactMatch: true,
  },
  {
    label: 'Configuración',
    icon: 'settings',
    modulos: [MODULO.IMPORTAR, MODULO.AJUSTES],
    dividerBefore: true,
    children: [
      { label: 'Importar alumnos', icon: 'upload_file', route: '/admin/importar', modulos: [MODULO.IMPORTAR], exactMatch: true },
      { label: 'Ajustes del sistema', icon: 'tune', route: '/admin/ajustes', modulos: [MODULO.AJUSTES], exactMatch: true },
    ],
  },
];
