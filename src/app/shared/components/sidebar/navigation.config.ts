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

  // ─── Dashboard ────────────────────────────────────────────────────────────
  {
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard',
    modulos: [MODULO.DASHBOARD],
    exactMatch: true,
  },

  // ─── Alumno ───────────────────────────────────────────────────────────────
  { label: 'Mis cursos', icon: 'menu_book', route: '/cursos', modulos: [MODULO.MIS_CURSOS] },
  {
    label: 'Mis libretas',
    icon: 'auto_stories',
    route: '/mis-libretas',
    modulos: [MODULO.MIS_LIBRETAS],
  },
  {
    label: 'Mis citas',
    icon: 'event_available',
    route: '/mis-citas',
    modulos: [MODULO.MIS_CITAS],
  },

  // ─── Docente ──────────────────────────────────────────────────────────────
  { label: 'Mis cursos', icon: 'menu_book', route: '/cursos', modulos: [MODULO.CURSOS_DOCENTE] },

  // Mi Tutoría — solo docentes que sean tutores de sección
  {
    label: 'Mi Tutoría',
    icon: 'school',
    route: '/mi-tutoria',
    modulos: [MODULO.TUTORIA],
    exactMatch: true,
  },

  // ─── Comunicados (alumno / docente / etc.) ────────────────────────────────
  {
    label: 'Comunicados',
    icon: 'campaign',
    route: '/comunicados',
    modulos: [MODULO.COMUNICADOS],
    dividerBefore: true,
  },

  // ─── Solo Padre ───────────────────────────────────────────────────────────
  {
    label: 'Portal Padres',
    icon: 'family_restroom',
    route: '/portal-padres',
    modulos: [MODULO.HIJOS],
  },
  {
    label: 'Mis Citas',
    icon: 'event_available',
    route: '/padre/citas',
    modulos: [MODULO.CITAS_PADRE, MODULO.CITAS_AGENDADAS],
  },

  // ─── Docente — Mi Agenda ──────────────────────────────────────────────────
  {
    label: 'Mi Agenda',
    icon: 'event_note',
    modulos: [MODULO.CITAS_DOCENTE, MODULO.DISPONIBILIDAD_DOCENTE],
    dividerBefore: true,
    children: [
      { label: 'Mis Citas', icon: 'event_available', route: '/docente/citas', modulos: [MODULO.CITAS_DOCENTE] },
      { label: 'Disponibilidad', icon: 'schedule', route: '/docente/disponibilidad', modulos: [MODULO.DISPONIBILIDAD_DOCENTE] },
    ],
  },

  // ─── Agenda propia (admin, auxiliar) ──────────────────────────────────────
  {
    label: 'Mi Agenda',
    icon: 'event_note',
    modulos: [MODULO.AGENDA_PROPIA],
    dividerBefore: true,
    children: [
      { label: 'Mis Citas', icon: 'event_available', route: '/agenda/citas', modulos: [MODULO.AGENDA_PROPIA] },
      { label: 'Disponibilidad', icon: 'schedule', route: '/agenda/disponibilidad', modulos: [MODULO.AGENDA_PROPIA] },
    ],
  },

  // ═══ PSICOLOGÍA ═══════════════════════════════════════════════════════════
  {
    label: 'Mis Alumnos',
    icon: 'groups',
    route: '/psicologa/alumnos',
    modulos: [MODULO.CASOS],
    dividerBefore: true,
  },
  { label: 'Agenda y Citas', icon: 'event', route: '/psicologa/citas', modulos: [MODULO.CITAS] },
  { label: 'Disponibilidad', icon: 'schedule', route: '/psicologa/disponibilidad', modulos: [MODULO.DISPONIBILIDAD] },

  // ═══ ADMIN ════════════════════════════════════════════════════════════════
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

  // ─── Histórico de Alumnos ─────────────────────────────────────────────────
  {
    label: 'Histórico de Alumnos',
    icon: 'history_edu',
    route: '/admin/historico',
    modulos: [MODULO.HISTORICO_ALUMNOS],
    exactMatch: true,
  },
  {
    label: 'Reportes',
    icon: 'bar_chart',
    route: '/admin/reportes',
    modulos: [MODULO.REPORTES_GLOBALES],
    exactMatch: true,
  },
];