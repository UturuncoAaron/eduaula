// ═══════════════════════════════════════════════════════════════
// Modelos del módulo de citas y disponibilidad
// ═══════════════════════════════════════════════════════════════

export type AppointmentTipo =
    | 'academico' | 'conductual' | 'psicologico'
    | 'familiar' | 'disciplinario' | 'otro';

export type AppointmentModalidad = 'presencial' | 'virtual' | 'telefonico';

export type AppointmentEstado =
    | 'pendiente' | 'confirmada' | 'realizada'
    | 'cancelada' | 'rechazada' | 'no_asistio';

// Roles que tienen disponibilidad propia y pueden citar a otros
// (debe mantenerse sincronizado con ROLES_WITH_AVAILABILITY del backend).
export type RoleWithAvailability =
    | 'psicologa' | 'docente' | 'admin' | 'auxiliar';

export const ROLES_WITH_AVAILABILITY: readonly RoleWithAvailability[] = [
    'psicologa', 'docente', 'admin', 'auxiliar',
] as const;

export function hasAvailability(rol: string | undefined): boolean {
    return !!rol && (ROLES_WITH_AVAILABILITY as readonly string[]).includes(rol);
}

// Alias para compatibilidad con componentes que usan AppointmentStatus
export type AppointmentStatus = AppointmentEstado;

export type DiaSemana =
    | 'lunes' | 'martes' | 'miercoles'
    | 'jueves' | 'viernes' | 'sabado';

// ── Reglas por rol (mirror del BE) ─────────────────────────────
// El BE las sirve por GET /appointments/rules/:targetId.
// Las usamos para configurar el dialog (duración fija, días permitidos,
// horario por defecto si el profesional aún no configuró su agenda).
export type AppointmentRole =
    | 'psicologa' | 'docente' | 'director'
    | 'admin' | 'auxiliar' | 'padre';

export interface AppointmentRoleRule {
    role: AppointmentRole;
    fixedDurationMin: number | null;
    maxDurationMin: number;
    allowedDays: string[];        // ['lunes','martes',...]
    defaultHours: { start: string; end: string };  // 'HH:MM'
    directBooking: boolean;
    label: string;
}

// ── Cita ────────────────────────────────────────────────────────
export interface Appointment {
    id: string;
    createdById: string;
    convocadoAId: string | null;
    parentId: string | null;
    studentId: string;
    tipo: AppointmentTipo;
    modalidad: AppointmentModalidad;
    motivo: string;
    scheduledAt: string;
    durationMin: number;
    estado: AppointmentEstado;
    priorNotes: string | null;
    followUpNotes: string | null;
    rescheduledFromId: string | null;
    reminderSent: boolean;
    cancelledAt: string | null;
    cancelledById: string | null;
    cancelReason: string | null;
    createdAt: string;
    updatedAt: string;
    // Joins opcionales enriquecidos por el backend
    student?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
    } | null;
    parent?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
    } | null;
    convocadoA?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
        rol: string;
    } | null;
    convocadoPor?: {
        id: string;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string | null;
        rol: string;
    } | null;
}

export interface CreateAppointmentPayload {
    convocadoAId: string;
    studentId?: string;
    parentId?: string;
    tipo: AppointmentTipo;
    motivo: string;
    scheduledAt: string;
    durationMin?: number;
    priorNotes?: string;
    modalidad?: AppointmentModalidad;
}

export interface UpdateAppointmentPayload {
    estado?: AppointmentEstado;
    scheduledAt?: string;
    durationMin?: number;
    followUpNotes?: string;
    rescheduledFromId?: string;
}

export interface CancelAppointmentPayload {
    motivo?: string;
}

export interface ListAppointmentsQuery {
    estado?: AppointmentEstado;
    from?: string;
    to?: string;
    studentId?: string;
    order?: 'DESC' | 'ASC';
    page?: number;
    limit?: number;
}

// ── Disponibilidad genérica (psicóloga, docente, etc.) ──────────
export interface AccountAvailability {
    id: string;
    cuentaId: string;
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
    activo: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SetAvailabilityPayload {
    diaSemana: DiaSemana;
    horaInicio: string;
    horaFin: string;
}

// ── Slot ocupado (para pintar el calendario) ────────────────────
export interface SlotTaken {
    id: string;
    scheduledAt: string;
    durationMin: number;
    estado: AppointmentEstado;
}