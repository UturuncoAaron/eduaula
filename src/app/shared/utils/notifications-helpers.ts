export const NOTIFICATION_TYPES = [
    'cita_agendada',
    'cita_confirmada',
    'cita_cancelada',
    'cita_recordatorio',
    'libreta_disponible',
    'tarea_nueva',
    'tarea_vence_pronto',
    'tarea_calificada',
    'comunicado_nuevo',
    'contrato_por_vencer',
    'inasistencia_alumno',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const ICONS: Record<string, string> = {
    cita_agendada: 'event',
    cita_confirmada: 'event_available',
    cita_cancelada: 'event_busy',
    cita_recordatorio: 'alarm',
    libreta_disponible: 'menu_book',
    tarea_nueva: 'assignment',
    tarea_vence_pronto: 'schedule',
    tarea_calificada: 'grade',
    comunicado_nuevo: 'campaign',
    contrato_por_vencer: 'warning',
    inasistencia_alumno: 'person_off',
};

const COLORS: Record<string, string> = {
    cita_agendada: '#3b82f6',
    cita_confirmada: '#10b981',
    cita_cancelada: '#ef4444',
    cita_recordatorio: '#f59e0b',
    libreta_disponible: '#8b5cf6',
    tarea_nueva: '#f59e0b',
    tarea_vence_pronto: '#ef4444',
    tarea_calificada: '#10b981',
    comunicado_nuevo: '#1A3A6B',
    contrato_por_vencer: '#ef4444',
    inasistencia_alumno: '#ef4444',
};

const ROUTES: Record<string, string> = {
    cita: '/mis-citas',
    tarea: '/tareas',
    comunicado: '/comunicados',
    libreta: '/mis-libretas',
    alumno: '/notificaciones',
};

export function iconForType(tipo: string): string {
    return ICONS[tipo] ?? 'notifications';
}

export function colorForType(tipo: string): string {
    return COLORS[tipo] ?? '#64748b';
}

export function routeForReferenceType(
    referenceType?: string | null,
): string | null {
    if (!referenceType) return null;
    return ROUTES[referenceType] ?? null;
}