// ═══════════════════════════════════════════════════════════════
// navigation.config.ts
// ═══════════════════════════════════════════════════════════════

export type UserRole = 'alumno' | 'docente' | 'admin' | 'padre' | 'psicologa';

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  roles: UserRole[];
  requiresTutor?: boolean;
  children?: NavItem[];
  exactMatch?: boolean;
  dividerBefore?: boolean;
}

export const NAV_ITEMS: NavItem[] = [

  // ─── Común ────────────────────────────────────────────────────────────────
  {
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard',
    roles: ['alumno', 'docente', 'admin', 'padre', 'psicologa'], // Agregado psicologa
    exactMatch: true,
  },

  // ─── Alumno y Docente ──────────────────────────────────────────────────────
  {
    label: 'Mis cursos',
    icon: 'menu_book',
    route: '/cursos',
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

  // ─── Solo Docente ──────────────────────────────────────────────────────────
  {
    label: 'Mi Tutoría',
    icon: 'school',
    route: '/mi-tutoria',
    roles: ['docente'], // CORRECCIÓN: Quitamos 'admin', solo los docentes pueden ser tutores
    requiresTutor: true,
    exactMatch: true,
    dividerBefore: true,
  },

  // ─── Solo Alumno ───────────────────────────────────────────────────────────
  {
    label: 'Mis libretas',
    icon: 'auto_stories',
    route: '/mis-libretas',
    roles: ['alumno'],
    dividerBefore: true,
  },

  // ─── Solo Padre ────────────────────────────────────────────────────────────
  {
    label: 'Portal Padres',
    icon: 'family_restroom',
    route: '/portal-padres',
    roles: ['padre'],
  },

  {
    label: 'Comunicados',
    icon: 'campaign',
    route: '/comunicados',
    roles: ['alumno', 'docente', 'padre', 'psicologa'],
    dividerBefore: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PSICOLOGÍA
  // ═══════════════════════════════════════════════════════════════════════════
  // Sección PSICOLOGÍA — sin cambios de rutas, ya están correctas:
  { label: 'Mis Alumnos', icon: 'groups', route: '/dashboard/psicologa/alumnos', roles: ['psicologa'], dividerBefore: true },
  { label: 'Fichas', icon: 'folder_open', route: '/dashboard/psicologa/fichas', roles: ['psicologa'] },
  { label: 'Agenda y Citas', icon: 'event', route: '/dashboard/psicologa/citas', roles: ['psicologa'] },
  { label: 'Disponibilidad', icon: 'schedule', route: '/dashboard/psicologa/disponibilidad', roles: ['psicologa'] },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════════

  // ... (El resto de tu configuración de Admin se mantiene exactamente igual)
  {
    label: 'Académico',
    icon: 'school',
    roles: ['admin'],
    dividerBefore: true,
    children: [
      { label: 'Grados y Cursos', icon: 'class', route: '/admin/academico', roles: ['admin'], exactMatch: true },
      { label: 'Periodos', icon: 'calendar_month', route: '/admin/periodos', roles: ['admin'], exactMatch: true },
      { label: 'Matrículas', icon: 'how_to_reg', route: '/admin/matriculas', roles: ['admin'], exactMatch: true },
      { label: 'Vínculo Padre-Hijo', icon: 'family_restroom', route: '/admin/padre-hijo', roles: ['admin'], exactMatch: true },
    ],
  },
  {
    label: 'Usuarios',
    icon: 'manage_accounts',
    roles: ['admin'],
    children: [
      { label: 'Alumnos', icon: 'person', route: '/admin/usuarios/alumnos', roles: ['admin'], exactMatch: true },
      { label: 'Padres', icon: 'family_restroom', route: '/admin/usuarios/padres', roles: ['admin'], exactMatch: true },
      { label: 'Docentes', icon: 'badge', route: '/admin/usuarios/docentes', roles: ['admin'], exactMatch: true },
      { label: 'Administración', icon: 'admin_panel_settings', route: '/admin/usuarios/admins', roles: ['admin'], exactMatch: true },
      // Añadimos a la psicóloga al gestor de usuarios del Admin
      { label: 'Psicología', icon: 'psychology', route: '/admin/usuarios/psicologos', roles: ['admin'], exactMatch: true },
    ],
  },
  {
    label: 'Comunicados',
    icon: 'campaign',
    route: '/admin/comunicados',
    roles: ['admin'],
    exactMatch: true,
    dividerBefore: true,
  },
  {
    label: 'Reportes',
    icon: 'bar_chart',
    route: '/admin/reportes',
    roles: ['admin'],
    exactMatch: true,
  },
  {
    label: 'Configuración',
    icon: 'settings',
    roles: ['admin'],
    dividerBefore: true,
    children: [
      { label: 'Importar alumnos', icon: 'upload_file', route: '/admin/importar', roles: ['admin'], exactMatch: true },
      { label: 'Ajustes del sistema', icon: 'tune', route: '/admin/ajustes', roles: ['admin'], exactMatch: true },
    ],
  },
];