// ═══════════════════════════════════════════════════════════════
// navigation.config.ts — Configuración dinámica del sidebar
// Solo incluye módulos terminados y funcionales
// ═══════════════════════════════════════════════════════════════

export type UserRole = 'alumno' | 'docente' | 'admin' | 'padre';

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  roles: UserRole[];
  requiresTutor?: boolean;
  children?: NavItem[];
  exactMatch?: boolean;       // true = la ruta debe coincidir exactamente
}

// ─── Items de navegación ───────────────────────────────────────
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard',
    roles: ['alumno', 'docente', 'admin', 'padre'],
    exactMatch: true,
  },
  {
    label: 'Mis cursos',
    icon: 'menu_book',
    route: '/cursos',
    roles: ['alumno', 'docente'],
  },
  {
    label: 'Exámenes',
    icon: 'assignment',
    route: '/examenes',
    roles: ['alumno', 'docente'],
  },
  {
    label: 'Tareas',
    icon: 'task_alt',
    route: '/tareas',
    roles: ['alumno', 'docente'],
  },
  {
    label: 'Notas',
    icon: 'grade',
    route: '/notas',
    roles: ['alumno', 'docente'],
  },
  {
    label: 'Foro',
    icon: 'forum',
    route: '/foro',
    roles: ['alumno', 'docente'],
  },
  {
    label: 'Clases en vivo',
    icon: 'videocam',
    route: '/clases-vivo',
    roles: ['alumno', 'docente'],
  },
  {
    label: 'Mi Tutoría',
    icon: 'school',
    route: '/mi-tutoria',
    roles: ['docente', 'admin'],
    requiresTutor: true,
    exactMatch: true,
  },
  {
    label: 'Mis libretas',
    icon: 'auto_stories',
    route: '/mis-libretas',
    roles: ['alumno', 'padre'],
  },
  {
    label: 'Portal Padres',
    icon: 'family_restroom',
    route: '/portal-padres',
    roles: ['padre'],
  },

  // ═══ SECCIÓN ADMIN ═══════════════════════════════════════════

  // ─── Académico: solo módulos terminados ──────────────────────
  {
    label: 'Académico',
    icon: 'school',
    roles: ['admin'],
    children: [
      { label: 'Grados y Cursos', icon: 'class',              route: '/admin/academico',  roles: ['admin'], exactMatch: true },
      { label: 'Tutores',         icon: 'supervisor_account', route: '/admin/padre-hijo', roles: ['admin'], exactMatch: true },
    ],
  },

  // ─── Usuarios ────────────────────────────────────────────────
  {
    label: 'Usuarios',
    icon: 'manage_accounts',
    roles: ['admin'],
    children: [
      { label: 'Administración', icon: 'admin_panel_settings', route: '/admin/usuarios/admins',   roles: ['admin'], exactMatch: true },
      { label: 'Alumnos',        icon: 'person',               route: '/admin/usuarios/alumnos',  roles: ['admin'], exactMatch: true },
      { label: 'Docentes',       icon: 'badge',                route: '/admin/usuarios/docentes', roles: ['admin'], exactMatch: true },
      { label: 'Padres',         icon: 'family_restroom',      route: '/admin/usuarios/padres',   roles: ['admin'], exactMatch: true },
    ],
  },

  // ─── Otros módulos admin ─────────────────────────────────────
  {
    label: 'Reportes',
    icon: 'bar_chart',
    route: '/admin/reportes',
    roles: ['admin'],
    exactMatch: true,
  },
  {
    label: 'Comunicados',
    icon: 'campaign',
    route: '/admin/comunicados',
    roles: ['admin'],
    exactMatch: true,
  },
  {
    label: 'Importar alumnos',
    icon: 'upload_file',
    route: '/admin/importar',
    roles: ['admin'],
    exactMatch: true,
  },
];
