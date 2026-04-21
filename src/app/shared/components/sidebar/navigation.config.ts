export type UserRole = 'alumno' | 'docente' | 'admin' | 'padre';

export interface NavItem {
    label: string;
    icon: string;
    route: string;
    roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', roles: ['alumno', 'docente', 'admin', 'padre'] },
    { label: 'Mis cursos', icon: 'menu_book', route: '/cursos', roles: ['alumno', 'docente'] },
    { label: 'Exámenes', icon: 'assignment', route: '/examenes', roles: ['alumno', 'docente'] },
    { label: 'Tareas', icon: 'task_alt', route: '/tareas', roles: ['alumno', 'docente'] },
    { label: 'Notas', icon: 'grade', route: '/notas', roles: ['alumno', 'docente'] },
    { label: 'Foro', icon: 'forum', route: '/foro', roles: ['alumno', 'docente'] },
    { label: 'Clases en vivo', icon: 'videocam', route: '/clases-vivo', roles: ['alumno', 'docente'] },
    { label: 'Portal Padres', icon: 'family_restroom', route: '/portal-padres', roles: ['padre'] },
    { label: 'Usuarios', icon: 'manage_accounts', route: '/admin/usuarios', roles: ['admin'] },
    { label: 'Académico', icon: 'school', route: '/admin/academico', roles: ['admin'] },
    { label: 'Padre-Hijo', icon: 'link', route: '/admin/padre-hijo', roles: ['admin'] },
    { label: 'Reportes', icon: 'bar_chart', route: '/admin/reportes', roles: ['admin'] },
];